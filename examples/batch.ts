/**
 * Batch verification example
 *
 * verifyMany() sends all criteria in one signed KPS request (split into batches of
 * `batchSize`) and reuses a single STS token, instead of two round trips per person.
 */
import { KPSClient, isValidTCKimlikNo } from '../src';

async function main() {
  const client = new KPSClient({
    username: process.env.KPS_USERNAME || 'your_username',
    password: process.env.KPS_PASSWORD || 'your_password',
    // Every KPS query is billed: reject numbers with a wrong checksum locally
    validateChecksum: true,
    // Results only carry parsed fields, not the raw SOAP response
    includeRaw: false,
  });

  const people = [
    { tcno: '10000000146', firstname: 'Ahmet', lastname: 'Yılmaz', birthyear: 1990 },
    { tcno: '99000000042', firstname: 'John', lastname: 'Doe', birthyear: 1985 },
  ];

  console.log(
    'Checksums:',
    people.map((p) => isValidTCKimlikNo(p.tcno))
  );

  try {
    const results = await client.verifyMany(people, { batchSize: 50 });

    results.forEach((result, index) => {
      const person = people[index];
      console.log(
        `${person.firstname} ${person.lastname}:`,
        result.status ? '✓ Verified' : `✗ ${result.aciklama}`,
        result.person ?? ''
      );
    });
  } catch (error: any) {
    console.error('Error:', error.message, error.details ?? '');
  }
}

main();
