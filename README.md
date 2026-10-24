# NVİ KPS Client

[![npm version](https://img.shields.io/npm/v/@yucelozalp/kps-identity-client.svg)](https://www.npmjs.com/package/@yucelozalp/kps-identity-client)
[![CI](https://github.com/yucelozalp/kps-identity-client/actions/workflows/ci.yml/badge.svg)](https://github.com/yucelozalp/kps-identity-client/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

Professional Turkish National Identity (TC Kimlik) verification client for Node.js. Integrates with Turkey's NVI (Nüfus ve Vatandaşlık İşleri) KPS v2 system using WS-Trust authentication and HMAC-SHA1 signed SOAP requests.

Targets **TumKutukDogrulaServis version 2025/08/01** (`http://kps.nvi.gov.tr/2025/08/01`), the current version published by NVİ. One query checks the TC citizen, foreigner (yabancı) and blue card (mavi kart) registries.

## Features

✅ **Secure** - WS-Trust (STS) token-based authentication, spec-compliant Exclusive C14N signatures  
✅ **Fast** - STS token caching, shared token requests and batch verification  
✅ **Complete** - TC vatandaşı, yabancı and mavi kart records, TC Kimlik Kartı serial number (TCKKSeriNo)  
✅ **Correct** - Turkish uppercase rules (`ali` → `ALİ`), optional TC Kimlik No checksum validation  
✅ **Type-Safe** - Full TypeScript support with comprehensive types  
✅ **Reliable** - Typed errors with SOAP fault and KPS error (HataBilgisi) details  
✅ **Tested** - Signature verification tested the way the KPS (WCF) service checks it  
✅ **Lean** - Two runtime dependencies (`axios`, `xml2js`)

## Installation

```bash
npm install @yucelozalp/kps-identity-client
```

## Quick Start

```typescript
import { KPSClient } from '@yucelozalp/kps-identity-client';

// Create the client once and reuse it: the STS token is cached per client
const client = new KPSClient({
  username: 'your_kps_username',
  password: 'your_kps_password',
});

// Verify identity
const result = await client.verify({
  tcno: '10000000146',        // 11-digit TC Kimlik No or Yabancı Kimlik No
  firstname: 'Ahmet',         // Converted to Turkish uppercase: AHMET
  lastname: 'Yılmaz',         // YILMAZ
  birthyear: '1990',          // 4-digit birth year
  birthmonth: '01',           // Optional: birth month
  birthday: '15',             // Optional: birth day (requires birthmonth)
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

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| username | string | — | KPS username (required) |
| password | string | — | KPS password (required) |
| httpConfig | HttpClientConfig | — | HTTP client configuration |
| cacheToken | boolean | `true` | Reuse the STS token until shortly before it expires |
| validateChecksum | boolean | `false` | Reject identity numbers that fail the TC Kimlik No checksum before calling KPS |
| includeRaw | boolean | `true` | Include the raw SOAP response in results |
| debug | boolean | `false` | Log SOAP traffic (password and proof key are redacted) |
| logger | KPSLogger | `console` | Logger used for debug output (`{ debug(message, ...args) }`) |
| endpoints | KPSEndpoints | official URLs | Override the URLs requests are sent to (`{ sts, query }`) |

**HTTP Config:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| timeout | number | 30000 | Request timeout in milliseconds |
| headers | Record<string, string> | {} | Additional HTTP headers |
| keepAlive | boolean | Node.js default | Reuse TCP/TLS connections between requests |
| httpsAgent | https.Agent | — | Custom agent (proxy agent, TLS options); overrides `keepAlive` |

#### Methods

##### `verify(request: QueryRequest): Promise<QueryResult>`

Verify a Turkish national identity.

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tcno | string | Yes | 11-digit TC Kimlik No or Yabancı Kimlik No |
| firstname | string | Yes | First name (Turkish uppercase applied, spaces collapsed) |
| lastname | string | Yes | Last name (Turkish uppercase applied, spaces collapsed) |
| birthyear | string \| number | Yes | 4-digit birth year |
| birthmonth | string \| number | No | Birth month (1-12) |
| birthday | string \| number | No | Birth day (1-31), requires `birthmonth` |
| serialno | string | No | TC Kimlik Kartı serial number (`TCKKSeriNo`), e.g. `A12B34567` |

Lowercase letters are converted with Turkish rules (`i` → `İ`, `ı` → `I`). For foreigners, pass names in uppercase exactly as written on their document (e.g. `MICHAEL`); uppercase input is sent unchanged.

**Returns: `QueryResult`**

| Field | Type | Description |
|-------|------|-------------|
| status | boolean | true if verified (code === 1) |
| code | number | Status code: 1=Valid, 2=Invalid/NotFound, 3=Deceased |
| aciklama | string | Status description in Turkish, as returned by KPS |
| person | PersonType | Person type: `'tc_vatandasi'`, `'yabanci'` or `'mavi'` |
| extra | Record<string, string> | `KimlikNo`, `Ad`, `Soyad`, `Uyruk` (yabancı), `Ulke` (mavi kart), `DogumTarih`, `OlumTarih` |
| hataBilgisi | HataBilgisi | KPS error for this record (`{ kod, aciklama }`), e.g. "Kayıt bulunamadı" |
| raw | string | Raw SOAP response (omitted when `includeRaw: false`) |

##### `verifyMany(requests: QueryRequest[], options?: VerifyManyOptions): Promise<QueryResult[]>`

Verify several identities with one STS token and one KPS request per batch. All requests are validated before anything is sent, and results are returned in the same order as the requests.

```typescript
const results = await client.verifyMany(
  [
    { tcno: '10000000146', firstname: 'AHMET', lastname: 'YILMAZ', birthyear: '1990' },
    { tcno: '99000000042', firstname: 'JOHN', lastname: 'DOE', birthyear: '1985' },
  ],
  { batchSize: 50 } // criteria per KPS request (default: 50)
);
```

Each criterion is a separate KPS query for billing purposes; batching saves round trips, not query fees.

##### `clearTokenCache(): void`

Discard the cached STS token, for example after rotating credentials.

### `isValidTCKimlikNo(value: string): boolean`

Check an identity number against the official TC Kimlik No checksum algorithm (also valid for Yabancı Kimlik No). Useful for rejecting typos before paying for a KPS query.

```typescript
import { isValidTCKimlikNo } from '@yucelozalp/kps-identity-client';

isValidTCKimlikNo('10000000146'); // true
isValidTCKimlikNo('12345678901'); // false
```

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
    } else if (error instanceof ServiceError) {
      console.log('SOAP fault:', error.details?.fault);       // { code, subcode, reason }
      console.log('KPS error:', error.details?.hataBilgisi);  // request level HataBilgisi
    } else if (error instanceof NetworkError) {
      console.log('Connection failed:', error.details?.code); // e.g. ECONNREFUSED
    }
  }
}
```

### Error Types

| Error | Description |
|-------|-------------|
| `ValidationError` | Invalid request parameters (`details.errors` lists every problem) |
| `AuthenticationError` | Invalid KPS credentials |
| `STSError` | STS token service error |
| `ServiceError` | KPS service error: SOAP fault (`details.fault`) or request level KPS error (`details.hataBilgisi`) |
| `ParseError` | Response parsing error |
| `NetworkError` | Network connection error (`details.code`, e.g. `ECONNREFUSED`, `ENOTFOUND`) |
| `TimeoutError` | Request timeout |

A person who is not found is **not** an error: `verify()` resolves with `status: false`, `code: 2` and the KPS reason in `aciklama` / `hataBilgisi`.

## Performance

- **Token caching** – The STS token is reused until one minute before the lifetime the STS reports, so each verification needs one HTTP round trip instead of two. If KPS rejects a cached token, the client fetches a new one and retries once (KPS rejects these before running the query).
- **Shared token requests** – Concurrent `verify()` calls on the same client wait for a single STS request.
- **Batching** – `verifyMany()` sends up to `batchSize` criteria in one signed request.
- **Connection reuse** – Set `httpConfig.keepAlive: true` (or pass your own `httpsAgent`) to reuse TLS connections.

Measured against a local mock KPS with 50 ms latency per request, 20 identities:

| Approach | Total | HTTP requests |
|----------|-------|---------------|
| 1.0.x flow (no token cache), sequential | 2126 ms | 40 |
| `verify()` sequential, token cache | 1126 ms | 21 |
| `verify()` with `Promise.all` | 127 ms | 21 |
| `verifyMany()` | 109 ms | 2 |

Create one `KPSClient` per credential and reuse it; creating a client per request discards the token cache.

## Proxies and IP Restrictions

KPS only accepts connections from IP addresses registered with NVİ. If your application runs elsewhere, route traffic through a host with a registered IP:

```typescript
import { HttpsProxyAgent } from 'https-proxy-agent';

const client = new KPSClient({
  username: process.env.KPS_USERNAME!,
  password: process.env.KPS_PASSWORD!,
  httpConfig: {
    httpsAgent: new HttpsProxyAgent('http://proxy.internal:3128'),
  },
});
```

The `HTTPS_PROXY` environment variable is also honored. With a reverse proxy, point `endpoints` at it; the SOAP addressing headers keep the official KPS addresses, as the service requires:

```typescript
const client = new KPSClient({
  username, password,
  endpoints: {
    sts: 'https://kps-gateway.internal/sts',
    query: 'https://kps-gateway.internal/query',
  },
});
```

## Debugging

```typescript
const client = new KPSClient({
  username, password,
  debug: true,
  logger: { debug: (message, ...args) => myLogger.debug(message, ...args) },
});
```

Debug output contains the SOAP messages with the password and the STS proof key masked as `***`. Responses still contain personal data, so do not enable debug logging in production.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `ServiceError: ... An error occurred when verifying security for the message.` | Fixed in 1.1.0 (signature canonicalization). If it persists, make sure the server clock is synchronized (NTP): WS-Security timestamps are only accepted within a few minutes of server time. |
| `AuthenticationError` | Wrong username/password, or the KPS account is not active. |
| `NetworkError (ETIMEDOUT)` / `TimeoutError` | The calling IP is not registered with NVİ, or a firewall blocks outbound HTTPS. |
| `status: false`, `aciklama: 'Kayıt bulunamadı'` | No record matches all criteria: check spelling, birth year and that `birthday` is only given together with `birthmonth`. |

## TypeScript Support

This package is written in TypeScript and includes comprehensive type definitions:

```typescript
import {
  KPSClient,
  QueryRequest,
  QueryResult,
  HataBilgisi,
  PersonType,
  ErrorCode,
} from '@yucelozalp/kps-identity-client';

const request: QueryRequest = {
  tcno: '10000000146',
  firstname: 'AHMET',
  lastname: 'YILMAZ',
  birthyear: 1990,
};

const result: QueryResult = await client.verify(request);
```

## Requirements

- Node.js >= 18.0.0
- Valid KPS credentials from NVI and a registered IP address

## Important Notes

⚠️ **Credentials**: You must have valid KPS credentials from Turkey's NVI to use this service.

⚠️ **HMAC-SHA1**: This package uses HMAC-SHA1 as required by KPS services (not a security choice by the package).

⚠️ **Billing**: KPS queries are billed per query. Enable `validateChecksum` to reject mistyped numbers locally.

⚠️ **Rate Limiting**: KPS services may have rate limits. Implement appropriate throttling in your application.

⚠️ **Data Privacy**: Handle identity information in accordance with KVKK (Turkish Data Protection Law). Use `includeRaw: false` if you do not need the raw response.

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

The test suite runs the client against an in-process mock of the STS and KPS endpoints that verifies every signature with Exclusive XML Canonicalization, the way the KPS (WCF) service does.

## Building

```bash
# Build TypeScript
npm run build

# Type check
npm run typecheck

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
