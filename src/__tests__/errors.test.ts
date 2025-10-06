import {
  KPSError,
  ValidationError,
  STSError,
  ServiceError,
  AuthenticationError,
  TimeoutError,
  isKPSError,
} from '../errors';
import { ErrorCode } from '../types';

describe('Errors', () => {
  describe('KPSError', () => {
    it('should create error with properties', () => {
      const error = new KPSError(ErrorCode.INTERNAL_ERROR, 'Test error', { detail: 'test' });
      
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.details).toEqual({ detail: 'test' });
    });

    it('should serialize to JSON', () => {
      const error = new KPSError(ErrorCode.INTERNAL_ERROR, 'Test error');
      const json = error.toJSON();

      expect(json).toEqual({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Test error',
        details: undefined,
      });
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid input');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('STSError', () => {
    it('should create STS error', () => {
      const error = new STSError('STS failed');
      expect(error.code).toBe(ErrorCode.STS_ERROR);
      expect(error.name).toBe('STSError');
    });
  });

  describe('ServiceError', () => {
    it('should create service error', () => {
      const error = new ServiceError('Service failed');
      expect(error.code).toBe(ErrorCode.SERVICE_ERROR);
      expect(error.name).toBe('ServiceError');
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('Auth failed');
      expect(error.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
      expect(error.name).toBe('AuthenticationError');
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError('Timeout');
      expect(error.code).toBe(ErrorCode.TIMEOUT_ERROR);
      expect(error.name).toBe('TimeoutError');
    });
  });

  describe('isKPSError', () => {
    it('should identify KPSError instances', () => {
      const kpsError = new ValidationError('Test');
      const regularError = new Error('Test');

      expect(isKPSError(kpsError)).toBe(true);
      expect(isKPSError(regularError)).toBe(false);
    });
  });
});
