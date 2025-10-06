/**
 * @yucelozalp/kps-identity-client
 * 
 * Professional Turkish National Identity (TC Kimlik) verification client
 * for Node.js - KPS v2 API integration
 * 
 * @author Yücel Özalp
 * @license MIT
 * 
 * @example
 * ```typescript
 * import { KPSClient } from '@yucelozalp/kps-identity-client';
 * 
 * const client = new KPSClient({
 *   username: 'your_kps_username',
 *   password: 'your_kps_password',
 * });
 * 
 * const result = await client.verify({
 *   tcno: '12345678901',
 *   firstname: 'AHMET',
 *   lastname: 'YILMAZ',
 *   birthyear: '1990',
 * });
 * 
 * if (result.status) {
 *   console.log('Identity verified!');
 * }
 * ```
 */

export { KPSClient } from './client';

export {
  QueryRequest,
  QueryResult,
  KPSClientConfig,
  HttpClientConfig,
  PersonType,
  ErrorCode,
} from './types';

export {
  KPSError,
  ValidationError,
  STSError,
  ServiceError,
  ParseError,
  NetworkError,
  AuthenticationError,
  TimeoutError,
  isKPSError,
} from './errors';
