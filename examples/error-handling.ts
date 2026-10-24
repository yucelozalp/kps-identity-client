/**
 * Error handling example
 */
import {
  KPSClient,
  ValidationError,
  AuthenticationError,
  STSError,
  ServiceError,
  NetworkError,
  TimeoutError,
  isKPSError,
} from '../src';

async function main() {
  const client = new KPSClient({
    username: process.env.KPS_USERNAME || 'test_user',
    password: process.env.KPS_PASSWORD || 'test_pass',
  });

  try {
    const result = await client.verify({
      tcno: '10000000146',
      firstname: 'AHMET',
      lastname: 'YILMAZ',
      birthyear: '1990',
    });

    console.log('Result:', result);
  } catch (error) {
    if (isKPSError(error)) {
      console.log('KPS Error:', error.code);
      console.log('Message:', error.message);

      // Handle specific error types
      if (error instanceof ValidationError) {
        console.log('→ Validation Error');
        console.log('  Details:', error.details);
      } else if (error instanceof AuthenticationError) {
        console.log('→ Authentication Error');
        console.log('  Hint:', error.details?.hint);
      } else if (error instanceof STSError) {
        console.log('→ STS Service Error');
      } else if (error instanceof ServiceError) {
        console.log('→ KPS Service Error');
      } else if (error instanceof NetworkError) {
        console.log('→ Network Connection Error');
      } else if (error instanceof TimeoutError) {
        console.log('→ Request Timeout');
      }
    } else {
      console.error('Unknown Error:', error);
    }
  }
}

main();
