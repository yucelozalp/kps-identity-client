import { ErrorCode } from './types';

/**
 * Base application error class
 */
export class KPSError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'KPSError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Validation error - invalid input parameters
 */
export class ValidationError extends KPSError {
  constructor(message: string, details?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * STS (Security Token Service) error
 */
export class STSError extends KPSError {
  constructor(message: string, details?: any) {
    super(ErrorCode.STS_ERROR, message, details);
    this.name = 'STSError';
  }
}

/**
 * KPS Service error
 */
export class ServiceError extends KPSError {
  constructor(message: string, details?: any) {
    super(ErrorCode.SERVICE_ERROR, message, details);
    this.name = 'ServiceError';
  }
}

/**
 * XML Parse error
 */
export class ParseError extends KPSError {
  constructor(message: string, details?: any) {
    super(ErrorCode.PARSE_ERROR, message, details);
    this.name = 'ParseError';
  }
}

/**
 * Network error
 */
export class NetworkError extends KPSError {
  constructor(message: string, details?: any) {
    super(ErrorCode.NETWORK_ERROR, message, details);
    this.name = 'NetworkError';
  }
}

/**
 * Authentication error - invalid credentials
 */
export class AuthenticationError extends KPSError {
  constructor(message: string, details?: any) {
    super(ErrorCode.AUTHENTICATION_ERROR, message, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends KPSError {
  constructor(message: string, details?: any) {
    super(ErrorCode.TIMEOUT_ERROR, message, details);
    this.name = 'TimeoutError';
  }
}

/**
 * Check if error is a KPSError instance
 */
export function isKPSError(error: any): error is KPSError {
  return error instanceof KPSError;
}
