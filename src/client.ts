import https from 'https';
import axios, { AxiosInstance } from 'axios';
import { KPS_URLS, DEFAULT_TIMEOUT, DEFAULT_BATCH_SIZE, TOKEN_REFRESH_MARGIN } from './constants';
import {
  KPSClientConfig,
  KPSLogger,
  QueryRequest,
  QueryResult,
  STSArtifacts,
  VerifyManyOptions,
} from './types';
import { ResponseParser, ParsedRecord } from './response-parser';
import { buildSTSRequest, buildQueryBody, buildSignedEnvelope } from './soap-builder';
import { parseSTSResponse } from './sts';
import { TokenProvider } from './token-provider';
import { collectValidationErrors, normalizeRequest, NormalizedQuery } from './validation';
import { parseSoapFault, redactSecrets, SoapFault } from './utils';
import {
  ValidationError,
  STSError,
  ServiceError,
  NetworkError,
  TimeoutError,
  AuthenticationError,
} from './errors';

/**
 * KPS Identity Verification Client
 *
 * @example
 * ```typescript
 * import { KPSClient } from '@yucelozalp/kps-identity-client';
 *
 * const client = new KPSClient({
 *   username: 'your_username',
 *   password: 'your_password',
 * });
 *
 * const result = await client.verify({
 *   tcno: '10000000146',
 *   firstname: 'AHMET',
 *   lastname: 'YILMAZ',
 *   birthyear: '1990',
 * });
 *
 * console.log(result.status); // true if verified
 * ```
 */
export class KPSClient {
  private readonly httpClient: AxiosInstance;
  private readonly username: string;
  private readonly password: string;
  private readonly responseParser = new ResponseParser();
  private readonly tokenProvider: TokenProvider;
  private readonly debug: boolean;
  private readonly logger: KPSLogger;
  private readonly validateChecksum: boolean;
  private readonly includeRaw: boolean;
  private readonly endpoints: { sts: string; query: string };

  /**
   * Create a new KPS client
   * @param config Client configuration
   */
  constructor(config: KPSClientConfig) {
    this.validateConfig(config);
    this.username = config.username;
    this.password = config.password;
    this.debug = config.debug || false;
    this.logger = config.logger || console;
    this.validateChecksum = config.validateChecksum || false;
    this.includeRaw = config.includeRaw !== false;
    this.endpoints = {
      sts: config.endpoints?.sts || KPS_URLS.STS,
      query: config.endpoints?.query || KPS_URLS.QUERY,
    };

    const httpsAgent =
      config.httpConfig?.httpsAgent ||
      (config.httpConfig?.keepAlive
        ? new https.Agent({ keepAlive: true, scheduling: 'lifo', timeout: 5000 })
        : undefined);

    this.httpClient = axios.create({
      timeout: config.httpConfig?.timeout || DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        ...config.httpConfig?.headers,
      },
      httpsAgent,
      responseType: 'text',
      transformResponse: [(data) => data],
    });

    this.tokenProvider = new TokenProvider(() => this.requestSecurityToken(), {
      enabled: config.cacheToken !== false,
      refreshMargin: TOKEN_REFRESH_MARGIN,
    });
  }

  /**
   * Verify Turkish national identity
   *
   * @param request Identity information to verify
   * @returns Verification result
   *
   * @throws {ValidationError} If request parameters are invalid
   * @throws {AuthenticationError} If KPS credentials are invalid
   * @throws {STSError} If STS token service fails
   * @throws {ServiceError} If KPS service fails
   * @throws {NetworkError} If network connection fails
   * @throws {TimeoutError} If request times out
   *
   * @example
   * ```typescript
   * const result = await client.verify({
   *   tcno: '10000000146',
   *   firstname: 'AHMET',
   *   lastname: 'YILMAZ',
   *   birthyear: '1990',
   *   birthmonth: '01',
   *   birthday: '15',
   * });
   *
   * if (result.status) {
   *   console.log('Identity verified!');
   *   console.log('Person type:', result.person);
   *   console.log('Details:', result.extra);
   * } else {
   *   console.log('Not verified:', result.aciklama);
   * }
   * ```
   */
  async verify(request: QueryRequest): Promise<QueryResult> {
    const criteria = this.prepareCriteria([request]);
    const [result] = await this.query(criteria);
    return result;
  }

  /**
   * Verify several identities with as few KPS requests as possible.
   * All requests are validated before anything is sent; results keep the input order.
   *
   * @param requests Identities to verify
   * @param options Batch options
   * @returns One result per request, in the same order
   *
   * @example
   * ```typescript
   * const results = await client.verifyMany([
   *   { tcno: '10000000146', firstname: 'AHMET', lastname: 'YILMAZ', birthyear: '1990' },
   *   { tcno: '99000000042', firstname: 'JOHN', lastname: 'DOE', birthyear: '1985' },
   * ]);
   * ```
   */
  async verifyMany(
    requests: QueryRequest[],
    options: VerifyManyOptions = {}
  ): Promise<QueryResult[]> {
    if (!Array.isArray(requests)) {
      throw new ValidationError('requests must be an array');
    }
    if (requests.length === 0) return [];

    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new ValidationError('batchSize must be a positive integer');
    }

    const criteria = this.prepareCriteria(requests);
    const results: QueryResult[] = [];

    for (let i = 0; i < criteria.length; i += batchSize) {
      results.push(...(await this.query(criteria.slice(i, i + batchSize))));
    }

    return results;
  }

  /**
   * Discard the cached STS token; the next query requests a new one
   */
  clearTokenCache(): void {
    this.tokenProvider.invalidate();
  }

  private validateConfig(config: KPSClientConfig): void {
    if (!config || !config.username || !config.password) {
      throw new ValidationError('KPS username and password are required');
    }
  }

  private prepareCriteria(requests: QueryRequest[]): NormalizedQuery[] {
    const failures: Array<{ index: number; errors: string[] }> = [];

    requests.forEach((request, index) => {
      const errors = collectValidationErrors(request, { validateChecksum: this.validateChecksum });
      if (errors.length > 0) failures.push({ index, errors });
    });

    if (failures.length > 0) {
      throw new ValidationError(
        'Invalid request parameters',
        requests.length === 1 ? { errors: failures[0].errors } : { errors: failures }
      );
    }

    return requests.map(normalizeRequest);
  }

  private async query(criteria: NormalizedQuery[]): Promise<QueryResult[]> {
    const bodyXML = buildQueryBody(criteria);
    const responseXML = await this.sendWithToken(bodyXML);
    const records = await this.responseParser.parseRecords(responseXML, {
      includeRaw: this.includeRaw,
    });
    return this.matchRecords(criteria, records, responseXML);
  }

  /**
   * Send the body signed with the current token. A cached token rejected by KPS
   * (e.g. expired early) is replaced once; KPS rejects these before running the query.
   */
  private async sendWithToken(bodyXML: string): Promise<string> {
    const { artifacts, fromCache } = await this.tokenProvider.get();

    try {
      return await this.callService(buildSignedEnvelope(artifacts, bodyXML));
    } catch (error) {
      if (!fromCache || !this.isSecurityFault(error)) throw error;

      this.log('Cached token rejected, requesting a new one');
      this.tokenProvider.invalidate(artifacts);
      const fresh = await this.tokenProvider.get();
      return await this.callService(buildSignedEnvelope(fresh.artifacts, bodyXML));
    }
  }

  /**
   * KPS answers a criteria list with a result list in the same order; when the counts
   * differ, results are matched by the KimlikNo KPS echoes back
   */
  private matchRecords(
    criteria: NormalizedQuery[],
    records: ParsedRecord[],
    responseXML: string
  ): QueryResult[] {
    if (records.length === criteria.length) {
      return records.map((r) => r.result);
    }

    const remaining = [...records];
    return criteria.map((c) => {
      const position = remaining.findIndex((r) => r.kimlikNo === c.tcno);
      return position !== -1
        ? remaining.splice(position, 1)[0].result
        : this.responseParser.notFound(responseXML, { includeRaw: this.includeRaw });
    });
  }

  private async requestSecurityToken(): Promise<STSArtifacts> {
    const soapRequest = buildSTSRequest(this.username, this.password);
    this.log('STS Request:', redactSecrets(soapRequest));

    let responseData: string;
    try {
      const response = await this.httpClient.post(this.endpoints.sts, soapRequest);
      this.log('STS Response Status:', response.status);
      this.log('STS Response:', redactSecrets(response.data));
      responseData = response.data;
    } catch (error: any) {
      throw this.toTransportError(error, 'STS');
    }

    return parseSTSResponse(responseData);
  }

  private async callService(envelope: string): Promise<string> {
    this.log('Service Request:', envelope);

    try {
      const response = await this.httpClient.post(this.endpoints.query, envelope);
      this.log('Service Response Status:', response.status);
      this.log('Service Response:', response.data);
      return response.data;
    } catch (error: any) {
      throw this.toTransportError(error, 'Service');
    }
  }

  private toTransportError(error: any, kind: 'STS' | 'Service'): Error {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new TimeoutError(`${kind} request timed out`, { code: error.code });
    }

    if (error.response) {
      const responseData =
        typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data);
      const fault = parseSoapFault(responseData);
      this.log(`${kind} Error Response:`, redactSecrets(responseData));

      if (kind === 'STS') {
        const authError = this.checkAuthenticationError(responseData, fault);
        if (authError) return authError;
      }

      const ErrorClass = kind === 'STS' ? STSError : ServiceError;
      const reason = fault?.reason || fault?.subcode || error.message;
      return new ErrorClass(`${kind} request failed: ${reason}`, {
        response: error.response.data,
        statusCode: error.response.status,
        ...(fault ? { fault } : {}),
      });
    }

    if (error.request) {
      return new NetworkError(
        `Failed to connect to ${kind === 'STS' ? 'STS' : 'KPS'} service${error.code ? ` (${error.code})` : ''}`,
        { code: error.code, message: error.message }
      );
    }

    return error;
  }

  private checkAuthenticationError(
    responseXml: string,
    fault: SoapFault | null
  ): AuthenticationError | null {
    if (!fault) return null;

    const authPatterns = [
      /Invalid username\/password/i,
      /Authentication failed/i,
      /Kullanıcı adı veya parola hatalı/i,
      /Yetkilendirme hatası/i,
      /SecurityFaultContract/i,
      /FailedAuthentication/i,
      /security token .*could not be (?:validated|authenticated)/i,
    ];

    if (!authPatterns.some((pattern) => pattern.test(responseXml))) {
      return null;
    }

    const reason = fault.reason || 'Invalid username/password';
    return new AuthenticationError(
      `KPS authentication failed: ${reason}. Please check your credentials.`,
      { hint: 'Verify that your KPS credentials are correct and active', fault }
    );
  }

  private isSecurityFault(error: unknown): boolean {
    if (!(error instanceof ServiceError)) return false;
    const fault: SoapFault | undefined = error.details?.fault;
    const text = `${fault?.subcode || ''} ${fault?.reason || ''}`;
    return /InvalidSecurity|FailedAuthentication|MessageExpired|verifying security|security token/i.test(
      text
    );
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      this.logger.debug(`[KPS Debug] ${message}`, ...args);
    }
  }
}
