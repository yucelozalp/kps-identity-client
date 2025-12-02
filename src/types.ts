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
  /** 11-digit Turkish identity number */
  tcno: string;
  /** First name (will be converted to uppercase) */
  firstname: string;
  /** Last name (will be converted to uppercase) */
  lastname: string;
  /** 4-digit birth year (e.g., "1990") */
  birthyear: string;
  /** Birth month (1-12, optional) */
  birthmonth?: string;
  /** Birth day (1-31, optional) */
  birthday?: string;
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
  /** Raw SOAP response (for debugging) */
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
}

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Additional HTTP headers */
  headers?: Record<string, string>;
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
  /** Enable debug mode (logs SOAP requests/responses) */
  debug?: boolean;
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
