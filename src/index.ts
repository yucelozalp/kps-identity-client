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
 *   tcno: '10000000146',
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

export { isValidTCKimlikNo } from './validation';

export {
  QueryRequest,
  QueryResult,
  HataBilgisi,
  KPSClientConfig,
  HttpClientConfig,
  KPSEndpoints,
  KPSLogger,
  VerifyManyOptions,
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
