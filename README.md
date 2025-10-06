# KPS Identity Client

[![npm version](https://img.shields.io/npm/v/@yucelozalp/kps-identity-client.svg)](https://www.npmjs.com/package/@yucelozalp/kps-identity-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

Professional Turkish National Identity (TC Kimlik) verification client for Node.js. Integrates with Turkey's NVI (Nüfus ve Vatandaşlık İşleri) KPS v2 system using WS-Trust authentication and HMAC-SHA1 signed SOAP requests.

## Features
 
✅ **Secure** - WS-Trust (STS) token-based authentication  
✅ **Compliant** - HMAC-SHA1 signing as required by KPS  
✅ **Type-Safe** - Full TypeScript support with comprehensive types  
✅ **Reliable** - Robust error handling with detailed error types  
✅ **Simple** - Clean, intuitive API  
✅ **Tested** - Comprehensive test coverage  
✅ **Zero Config** - Works out of the box with valid credentials

## Installation

```bash
npm install @yucelozalp/kps-identity-client
```

## Quick Start

```typescript
import { KPSClient } from '@yucelozalp/kps-identity-client';

// Create client
const client = new KPSClient({
  username: 'your_kps_username',
  password: 'your_kps_password',
});

// Verify identity
const result = await client.verify({
  tcno: '12345678901',        // 11-digit TC number
  firstname: 'AHMET',         // First name (uppercase)
  lastname: 'YILMAZ',         // Last name (uppercase)
  birthyear: '1990',          // 4-digit birth year
  birthmonth: '01',           // Optional: birth month
  birthday: '15',             // Optional: birth day
});

// Check result
if (result.status) {
  console.log('✓ Identity verified!');
  console.log('Person type:', result.person);
  console.log('Details:', result.extra);
} else {
  console.log('✗ Not verified');
  console.log('Reason:', result.aciklama);
}
```

## API Reference

### `KPSClient`

Main client class for identity verification.

#### Constructor

```typescript
constructor(config: KPSClientConfig)
```

**Config Options:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| username | string | Yes | KPS username |
| password | string | Yes | KPS password |
| httpConfig | HttpClientConfig | No | HTTP client configuration |

**HTTP Config:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| timeout | number | 30000 | Request timeout in milliseconds |
| headers | Record<string, string> | {} | Additional HTTP headers |

#### Methods

##### `verify(request: QueryRequest): Promise<QueryResult>`

Verify a Turkish national identity.

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tcno | string | Yes | 11-digit Turkish identity number |
| firstname | string | Yes | First name |
| lastname | string | Yes | Last name |
| birthyear | string | Yes | 4-digit birth year |
| birthmonth | string | No | Birth month (1-12) |
| birthday | string | No | Birth day (1-31) |

**Returns: `QueryResult`**

| Field | Type | Description |
|-------|------|-------------|
| status | boolean | true if verified (code === 1) |
| code | number | Status code: 1=Valid, 2=Invalid/NotFound, 3=Deceased |
| aciklama | string | Status description in Turkish |
| person | PersonType | Person type: 'tc_vatandasi', 'yabanci', or 'mavi' |
| extra | Record<string, string> | Additional person information |
| raw | string | Raw SOAP response (for debugging) |

## Error Handling

The client throws typed errors for different failure scenarios:

```typescript
import { 
  ValidationError,
  AuthenticationError,
  STSError,
  ServiceError,
  NetworkError,
  TimeoutError,
  isKPSError
} from '@yucelozalp/kps-identity-client';

try {
  const result = await client.verify(request);
} catch (error) {
  if (isKPSError(error)) {
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    
    if (error instanceof ValidationError) {
      console.log('Invalid input:', error.details);
    } else if (error instanceof AuthenticationError) {
      console.log('Invalid credentials');
    } else if (error instanceof NetworkError) {
      console.log('Connection failed');
    }
  }
}
```

### Error Types

| Error | Description |
|-------|-------------|
| `ValidationError` | Invalid request parameters |
| `AuthenticationError` | Invalid KPS credentials |
| `STSError` | STS token service error |
| `ServiceError` | KPS service error |
| `ParseError` | Response parsing error |
| `NetworkError` | Network connection error |
| `TimeoutError` | Request timeout |

## Examples

### Basic Verification

```typescript
const client = new KPSClient({
  username: process.env.KPS_USERNAME!,
  password: process.env.KPS_PASSWORD!,
});

const result = await client.verify({
  tcno: '12345678901',
  firstname: 'AHMET',
  lastname: 'YILMAZ',
  birthyear: '1990',
});

console.log('Status:', result.status);
console.log('Code:', result.code);
```

### With Full Birth Date

```typescript
const result = await client.verify({
  tcno: '12345678901',
  firstname: 'AHMET',
  lastname: 'YILMAZ',
  birthyear: '1990',
  birthmonth: '01',
  birthday: '15',
});
```

### Custom Timeout

```typescript
const client = new KPSClient({
  username: 'your_username',
  password: 'your_password',
  httpConfig: {
    timeout: 60000, // 60 seconds
  },
});
```

### Error Handling

```typescript
try {
  const result = await client.verify(request);
  
  if (result.status) {
    console.log('Verified:', result.extra);
  } else {
    console.log('Not found:', result.aciklama);
  }
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.details);
  } else if (error instanceof AuthenticationError) {
    console.error('Invalid credentials');
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## TypeScript Support

This package is written in TypeScript and includes comprehensive type definitions:

```typescript
import {
  KPSClient,
  QueryRequest,
  QueryResult,
  PersonType,
  ErrorCode,
} from '@yucelozalp/kps-identity-client';

const request: QueryRequest = {
  tcno: '12345678901',
  firstname: 'AHMET',
  lastname: 'YILMAZ',
  birthyear: '1990',
};

const result: QueryResult = await client.verify(request);
```

## Requirements

- Node.js >= 18.0.0
- Valid KPS credentials from NVI

## Important Notes

⚠️ **Credentials**: You must have valid KPS credentials from Turkey's NVI to use this service.

⚠️ **HMAC-SHA1**: This package uses HMAC-SHA1 as required by KPS services (not a security choice by the package).

⚠️ **Rate Limiting**: KPS services may have rate limits. Implement appropriate throttling in your application.

⚠️ **Data Privacy**: Handle identity information in accordance with KVKK (Turkish Data Protection Law).

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Building

```bash
# Build TypeScript
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © [Yücel Özalp](https://github.com/yucelozalp)

## Author

**Yücel Özalp**

- GitHub: [@yucelozalp](https://github.com/yucelozalp)

## Acknowledgments

This package integrates with Turkey's National Population Information System (KPS) operated by NVI (Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü).

## Disclaimer

This is an unofficial client library. Use at your own risk. The author is not responsible for any misuse or data breaches.

---

Made with ❤️ for the Turkish developer community
