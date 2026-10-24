import http from 'http';
import { AddressInfo } from 'net';
import { KPSClient } from '../client';
import {
  AuthenticationError,
  NetworkError,
  STSError,
  TimeoutError,
  ValidationError,
} from '../errors';
import { PersonType, QueryRequest } from '../types';
import { AUTH_FAULT, buildSTSResponse, buildServiceResponse } from './helpers/fixtures';
import { MockKPSServer } from './helpers/mock-kps-server';

const ahmet: QueryRequest = {
  tcno: '10000000146',
  firstname: 'ahmet',
  lastname: 'yılmaz',
  birthyear: '1990',
  birthmonth: '01',
  birthday: '15',
};

describe('KPSClient', () => {
  let server: MockKPSServer;

  const createClient = (overrides: Partial<ConstructorParameters<typeof KPSClient>[0]> = {}) =>
    new KPSClient({
      username: 'user',
      password: 'secret-password',
      endpoints: server.endpoints,
      ...overrides,
    });

  beforeEach(async () => {
    server = await new MockKPSServer().start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('constructor', () => {
    it('requires credentials', () => {
      expect(() => new KPSClient({ username: '', password: 'x' })).toThrow(ValidationError);
      expect(() => new KPSClient(undefined as any)).toThrow(ValidationError);
    });
  });

  describe('verify', () => {
    it('verifies an identity end to end with a valid signature', async () => {
      const result = await createClient().verify(ahmet);

      expect(server.verificationFailures).toEqual([]);
      expect(result).toMatchObject({
        status: true,
        code: 1,
        person: PersonType.TC_VATANDASI,
        extra: { KimlikNo: '10000000146', Ad: 'AHMET', Soyad: 'YILMAZ', DogumTarih: '1990-01-15' },
      });
      expect(result.raw).toContain('SorgulaResponse');
    });

    it('sends names uppercased with Turkish rules', async () => {
      await createClient().verify({ ...ahmet, firstname: 'ali ihsan', lastname: 'ışık' });
      expect(server.queryRequests[0]).toContain('<Ad>ALİ İHSAN</Ad>');
      expect(server.queryRequests[0]).toContain('<Soyad>IŞIK</Soyad>');
    });

    it('sends the TC Kimlik Kartı serial number', async () => {
      await createClient().verify({ ...ahmet, serialno: 'a12b34567' });
      expect(server.queryRequests[0]).toContain('<TCKKSeriNo>A12B34567</TCKKSeriNo>');
    });

    it('validates the request before calling KPS', async () => {
      await expect(createClient().verify({ ...ahmet, tcno: '123' })).rejects.toMatchObject({
        name: 'ValidationError',
        details: { errors: ['tcno must be 11 digits'] },
      });
      expect(server.stsRequests).toHaveLength(0);
    });

    it('rejects bad checksums locally when validateChecksum is enabled', async () => {
      const client = createClient({ validateChecksum: true });
      await expect(client.verify({ ...ahmet, tcno: '12345678901' })).rejects.toThrow(
        ValidationError
      );
      expect(server.stsRequests).toHaveLength(0);
    });

    it('omits the raw response when includeRaw is false', async () => {
      const result = await createClient({ includeRaw: false }).verify(ahmet);
      expect(result.raw).toBeUndefined();
    });
  });

  describe('token caching', () => {
    it('reuses the STS token across queries', async () => {
      const client = createClient();
      await client.verify(ahmet);
      await client.verify(ahmet);
      await client.verify(ahmet);

      expect(server.stsRequests).toHaveLength(1);
      expect(server.queryRequests).toHaveLength(3);
    });

    it('requests a single token for concurrent queries', async () => {
      const client = createClient();
      await Promise.all([client.verify(ahmet), client.verify(ahmet), client.verify(ahmet)]);

      expect(server.stsRequests).toHaveLength(1);
      expect(server.queryRequests).toHaveLength(3);
    });

    it('requests a new token for every query when caching is disabled', async () => {
      const client = createClient({ cacheToken: false });
      await client.verify(ahmet);
      await client.verify(ahmet);

      expect(server.stsRequests).toHaveLength(2);
    });

    it('replaces a cached token that KPS rejects and retries once', async () => {
      const client = createClient();
      await client.verify(ahmet);
      server.revokeAll();

      const result = await client.verify(ahmet);

      expect(result.status).toBe(true);
      expect(server.stsRequests).toHaveLength(2);
      expect(server.queryRequests).toHaveLength(3);
    });

    it('does not retry when a fresh token is rejected', async () => {
      // A token the mock KPS never issued, so every signature made with it is rejected
      server.options.sts = () => ({
        status: 200,
        body: buildSTSResponse({ assertionId: '_unknown' }),
      });
      await expect(createClient().verify(ahmet)).rejects.toMatchObject({
        name: 'ServiceError',
        message:
          'Service request failed: An error occurred when verifying security for the message.',
        details: { statusCode: 500, fault: { subcode: 'a:InvalidSecurity' } },
      });
      expect(server.queryRequests).toHaveLength(1);
    });

    it('clearTokenCache forces a new token', async () => {
      const client = createClient();
      await client.verify(ahmet);
      client.clearTokenCache();
      await client.verify(ahmet);

      expect(server.stsRequests).toHaveLength(2);
    });
  });

  describe('verifyMany', () => {
    const people: QueryRequest[] = [
      ahmet,
      { tcno: '99000000042', firstname: 'john', lastname: 'doe', birthyear: 1985 },
      { tcno: '11111111110', firstname: 'ayşe', lastname: 'kaya', birthyear: '1970' },
    ];

    it('verifies several people with one token and one query', async () => {
      server.options.records = (criteria) =>
        criteria.map((c) =>
          c.KimlikNo === '99000000042'
            ? { kimlikNo: c.KimlikNo, type: 'none' as const }
            : { kimlikNo: c.KimlikNo, type: 'tc' as const, ad: c.Ad }
        );

      const results = await createClient().verifyMany(people);

      expect(server.stsRequests).toHaveLength(1);
      expect(server.queryRequests).toHaveLength(1);
      expect(results.map((r) => [r.status, r.extra?.Ad])).toEqual([
        [true, 'AHMET'],
        [false, undefined],
        [true, 'AYŞE'],
      ]);
    });

    it('splits large lists into batches', async () => {
      const results = await createClient().verifyMany(people, { batchSize: 2 });

      expect(results).toHaveLength(3);
      expect(server.queryRequests).toHaveLength(2);
      expect(server.stsRequests).toHaveLength(1);
    });

    it('matches results by KimlikNo when KPS omits a record', async () => {
      server.options.records = (criteria) =>
        criteria
          .filter((c) => c.KimlikNo !== '99000000042')
          .reverse()
          .map((c) => ({ kimlikNo: c.KimlikNo, type: 'tc' as const, ad: c.Ad }));

      const results = await createClient().verifyMany(people);

      expect(results.map((r) => [r.status, r.extra?.Ad])).toEqual([
        [true, 'AHMET'],
        [false, undefined],
        [true, 'AYŞE'],
      ]);
    });

    it('validates every request before sending anything', async () => {
      await expect(
        createClient().verifyMany([ahmet, { ...ahmet, tcno: 'x' }, { ...ahmet, lastname: '' }])
      ).rejects.toMatchObject({
        name: 'ValidationError',
        details: {
          errors: [
            { index: 1, errors: ['tcno must be 11 digits'] },
            { index: 2, errors: ['lastname is required'] },
          ],
        },
      });
      expect(server.stsRequests).toHaveLength(0);
    });

    it('returns an empty list for no requests', async () => {
      expect(await createClient().verifyMany([])).toEqual([]);
      expect(server.stsRequests).toHaveLength(0);
    });

    it('rejects invalid input', async () => {
      await expect(createClient().verifyMany('x' as any)).rejects.toThrow(ValidationError);
      await expect(createClient().verifyMany([ahmet], { batchSize: 0 })).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('errors', () => {
    it('reports wrong credentials as AuthenticationError', async () => {
      server.options.sts = () => ({ status: 500, body: AUTH_FAULT });
      await expect(createClient().verify(ahmet)).rejects.toThrow(AuthenticationError);
    });

    it('reports other STS faults as STSError', async () => {
      server.options.sts = () => ({
        status: 500,
        body: '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><s:Fault><s:Code><s:Value>s:Receiver</s:Value></s:Code><s:Reason><s:Text>Internal</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>',
      });
      await expect(createClient().verify(ahmet)).rejects.toMatchObject({
        name: 'STSError',
        message: 'STS request failed: Internal',
      });
    });

    it('reports malformed STS responses as STSError', async () => {
      server.options.sts = () => ({ status: 200, body: '<html>maintenance</html>' });
      await expect(createClient().verify(ahmet)).rejects.toThrow(STSError);
    });

    it('reports timeouts as TimeoutError', async () => {
      server.options.delayMs = 300;
      const client = createClient({ httpConfig: { timeout: 50 } });
      await expect(client.verify(ahmet)).rejects.toThrow(TimeoutError);
    });

    it('reports unreachable endpoints as NetworkError with the cause', async () => {
      const closed = http.createServer();
      await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
      const { port } = closed.address() as AddressInfo;
      await new Promise<void>((resolve) => closed.close(() => resolve()));

      const client = createClient({ endpoints: { sts: `http://127.0.0.1:${port}/sts` } });
      await expect(client.verify(ahmet)).rejects.toMatchObject({
        name: 'NetworkError',
        details: { code: 'ECONNREFUSED' },
      });
      await expect(client.verify(ahmet)).rejects.toThrow(NetworkError);
    });

    it('surfaces request level KPS errors as ServiceError', async () => {
      server.options.respond = () => ({
        status: 200,
        body: buildServiceResponse([], {
          requestError: { kod: 3, aciklama: 'Servis yetkisi yok' },
        }),
      });

      await expect(createClient().verify(ahmet)).rejects.toMatchObject({
        name: 'ServiceError',
        details: { hataBilgisi: { kod: 3, aciklama: 'Servis yetkisi yok' } },
      });
    });
  });

  describe('debug logging', () => {
    it('logs SOAP traffic through the logger with credentials redacted', async () => {
      const lines: string[] = [];
      const logger = { debug: (...args: unknown[]) => lines.push(args.join(' ')) };

      await createClient({ debug: true, logger }).verify(ahmet);
      const output = lines.join('\n');

      expect(output).toContain('[KPS Debug] STS Request:');
      expect(output).toContain('[KPS Debug] Service Response:');
      expect(output).not.toContain('secret-password');
      expect(output).toMatch(/<trust:BinarySecret>\*\*\*<\/trust:BinarySecret>/);
    });

    it('stays silent when debug is off', async () => {
      const logger = { debug: jest.fn() };
      await createClient({ logger }).verify(ahmet);
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });
});
