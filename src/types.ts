import type { Agent } from 'https';

/**
 * Person type representing citizenship status
 */
export enum PersonType {
  TC_VATANDASI = 'tc_vatandasi',
  YABANCI = 'yabanci',
  MAVI = 'mavi',
  EMPTY = '',
}

/**
 * Query request for KPS identity verification
 */
export interface QueryRequest {
  /** 11-digit Turkish identity number (TC Kimlik No or Yabancı Kimlik No) */
  tcno: string;
  /** First name (converted to Turkish uppercase, e.g. "ali" -> "ALİ") */
  firstname: string;
  /** Last name (converted to Turkish uppercase) */
  lastname: string;
  /** 4-digit birth year (e.g., "1990") */
  birthyear: string | number;
  /** Birth month (1-12, optional) */
  birthmonth?: string | number;
  /** Birth day (1-31, optional, requires birthmonth) */
  birthday?: string | number;
  /** TC Kimlik Kartı serial number (TCKKSeriNo, optional, e.g. "A12B34567") */
  serialno?: string;
}

/**
 * Error information returned by KPS (HataBilgisi)
 */
export interface HataBilgisi {
  /** KPS error code */
  kod?: number;
  /** KPS error description */
  aciklama?: string;
}

/**
 * Result of KPS query
 * Code meanings: 1 = Valid, 2 = Error/Not Found, 3 = Deceased
 */
export interface QueryResult {
  /** True if identity is verified (code === 1) */
  status: boolean;
  /** Status code: 1=Valid, 2=Invalid/NotFound, 3=Deceased */
  code: number;
  /** Status description in Turkish */
  aciklama?: string;
  /** Person type */
  person?: PersonType;
  /** Additional person information */
  extra?: Record<string, string>;
  /** Error information reported by KPS for this record, if any */
  hataBilgisi?: HataBilgisi;
  /** Raw SOAP response (for debugging, omitted when includeRaw is false) */
  raw?: string;
}

/**
 * STS artifacts from token service
 * @internal
 */
export interface STSArtifacts {
  binarySecretB64: string;
  tokenXML: string;
  assertionID: string;
  /** Local epoch milliseconds after which the token must not be used */
  expiresAt: number;
}

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Additional HTTP headers */
  headers?: Record<string, string>;
  /** Reuse TCP/TLS connections between requests (default: Node.js default agent) */
  keepAlive?: boolean;
  /** Custom HTTPS agent (proxy agents, TLS options, connection pooling). Overrides keepAlive */
  httpsAgent?: Agent;
}

/**
 * Service endpoint overrides (for proxies or test doubles)
 */
export interface KPSEndpoints {
  /** STS (token) endpoint URL */
  sts?: string;
  /** KPS query endpoint URL */
  query?: string;
}

/**
 * Logger used when debug mode is enabled
 */
export interface KPSLogger {
  debug(message: string, ...args: unknown[]): void;
}

/**
 * KPS Client configuration
 */
export interface KPSClientConfig {
  /** KPS username */
  username: string;
  /** KPS password */
  password: string;
  /** HTTP client configuration */
  httpConfig?: HttpClientConfig;
  /** Enable debug mode (logs SOAP requests/responses, credentials are redacted) */
  debug?: boolean;
  /** Logger for debug output (default: console) */
  logger?: KPSLogger;
  /** Reuse the STS token until it expires (default: true) */
  cacheToken?: boolean;
  /** Reject identity numbers that fail the TC Kimlik No checksum before calling KPS (default: false) */
  validateChecksum?: boolean;
  /** Include the raw SOAP response in results (default: true) */
  includeRaw?: boolean;
  /** Endpoint overrides; SOAP addressing headers always use the official KPS addresses */
  endpoints?: KPSEndpoints;
}

/**
 * Options for verifyMany()
 */
export interface VerifyManyOptions {
  /** Maximum number of criteria per KPS request (default: 50) */
  batchSize?: number;
}

/**
 * Error codes
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  STS_ERROR = 'STS_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}
