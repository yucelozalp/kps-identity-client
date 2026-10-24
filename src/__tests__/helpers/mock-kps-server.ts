import crypto from 'crypto';
import http from 'http';
import { AddressInfo } from 'net';
import {
  buildSTSResponse,
  buildServiceResponse,
  INVALID_SECURITY_FAULT,
  RecordFixture,
} from './fixtures';
import { verifySignedEnvelope } from './wcf-verifier';

export interface Criteria {
  Ad: string;
  Soyad: string;
  DogumYil: string;
  DogumAy: string;
  DogumGun: string;
  KimlikNo: string;
  TCKKSeriNo?: string;
}

export interface MockKPSOptions {
  /** Override the STS reply */
  sts?: (body: string) => { status: number; body: string };
  /** Build the records returned for a query (default: everyone is a TC citizen) */
  records?: (criteria: Criteria[]) => RecordFixture[];
  /** Override the reply to a correctly signed query */
  respond?: (criteria: Criteria[]) => { status: number; body: string };
  /** Token lifetime handed out by the STS */
  lifetimeMs?: number | null;
  /** Delay before answering, in ms */
  delayMs?: number;
}

/**
 * In-process stand-in for the STS and KPS endpoints that verifies signatures like WCF
 */
export class MockKPSServer {
  readonly stsRequests: string[] = [];
  readonly queryRequests: string[] = [];
  readonly verificationFailures: string[] = [];
  private readonly tokens = new Map<string, Buffer>();
  private readonly revoked = new Set<string>();
  private server: http.Server | null = null;
  private tokenCounter = 0;

  constructor(public options: MockKPSOptions = {}) {}

  get url(): string {
    const { port } = this.server!.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  get endpoints() {
    return { sts: `${this.url}/sts`, query: `${this.url}/query` };
  }

  /** Make KPS reject every token issued so far (simulates expiry) */
  revokeAll(): void {
    for (const id of this.tokens.keys()) this.revoked.add(id);
  }

  async start(): Promise<this> {
    this.server = http.createServer((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const reply = req.url === '/sts' ? this.handleSTS(body) : this.handleQuery(body);
        const send = () => {
          res.writeHead(reply.status, { 'Content-Type': 'application/soap+xml; charset=utf-8' });
          res.end(reply.body);
        };
        if (this.options.delayMs) setTimeout(send, this.options.delayMs);
        else send();
      });
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    return this;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    this.server.closeAllConnections?.();
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = null;
  }

  private handleSTS(body: string): { status: number; body: string } {
    this.stsRequests.push(body);
    if (this.options.sts) return this.options.sts(body);

    const assertionId = `_token-${++this.tokenCounter}`;
    const secret = crypto.randomBytes(32);
    this.tokens.set(assertionId, secret);

    return {
      status: 200,
      body: buildSTSResponse({
        assertionId,
        secretB64: secret.toString('base64'),
        lifetimeMs: this.options.lifetimeMs,
      }),
    };
  }

  private handleQuery(body: string): { status: number; body: string } {
    this.queryRequests.push(body);

    const verification = verifySignedEnvelope(body, (id) =>
      this.revoked.has(id) ? undefined : this.tokens.get(id)
    );
    if (!verification.valid) {
      this.verificationFailures.push(verification.reason || 'unknown');
      return { status: 500, body: INVALID_SECURITY_FAULT };
    }

    const criteria = parseCriteria(body);
    if (this.options.respond) return this.options.respond(criteria);

    const records = this.options.records
      ? this.options.records(criteria)
      : criteria.map((c) => ({
          kimlikNo: c.KimlikNo,
          type: 'tc' as const,
          ad: c.Ad,
          soyad: c.Soyad,
          dogum: { yil: Number(c.DogumYil), ay: Number(c.DogumAy), gun: Number(c.DogumGun) },
        }));

    return { status: 200, body: buildServiceResponse(records) };
  }
}

export function parseCriteria(envelope: string): Criteria[] {
  const items =
    envelope.match(/<TumKutukDogrulamaSorguKriteri>[\s\S]*?<\/TumKutukDogrulamaSorguKriteri>/g) ||
    [];
  return items.map((item) => {
    const field = (name: string) => item.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1];
    return {
      Ad: field('Ad') ?? '',
      Soyad: field('Soyad') ?? '',
      DogumYil: field('DogumYil') ?? '',
      DogumAy: field('DogumAy') ?? '',
      DogumGun: field('DogumGun') ?? '',
      KimlikNo: field('KimlikNo') ?? '',
      TCKKSeriNo: field('TCKKSeriNo'),
    };
  });
}
