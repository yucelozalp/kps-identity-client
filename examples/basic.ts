/**
 * Basic usage example
 */
import { KPSClient } from '../src';

async function main() {
  // Create client with credentials
  const client = new KPSClient({
    username: process.env.KPS_USERNAME || 'your_username',
    password: process.env.KPS_PASSWORD || 'your_password',
  });

  try {
    // Verify identity
    const result = await client.verify({
      tcno: '10000000146',
      firstname: 'AHMET',
      lastname: 'YILMAZ',
      birthyear: '1990',
      birthmonth: '01',
      birthday: '15',
    });

    console.log('Verification Result:');
    console.log('- Status:', result.status ? '✓ Verified' : '✗ Not Verified');
    console.log('- Code:', result.code);
    console.log('- Message:', result.aciklama);
    console.log('- Person Type:', result.person);
    console.log('- Details:', result.extra);
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}

main();
