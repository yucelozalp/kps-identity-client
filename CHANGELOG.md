# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-10-25

### Fixed
- **Signature verification** ("An error occurred when verifying security for the message", #1): the digest and HMAC were computed over a whitespace-stripped copy of `Timestamp` and `SignedInfo`, while the envelope carried an indented copy with self-closing tags. The KPS (WCF) service canonicalizes the received elements, so the values never matched. Both elements are now generated directly in Exclusive XML Canonicalization form and the signed bytes are exactly the bytes sent.
- **Response parsing**: results were read from `SorgulaResult > DoluBilesenler`, but TumKutukDogrulaServis 2025/08/01 returns them under `SorgulaResult > SorguSonucu > TumKutukDogrulamaBilgileri`, with `DoluBilesenler` listing only the registries that matched. Every response was reported as "Kayıt bulunamadı".
- Names are uppercased with Turkish rules (`ali` → `ALİ`, `ışık` → `IŞIK`) instead of `toUpperCase()` (`ali` → `ALI`), which caused mismatches for names containing `i`.
- STS responses are parsed with prefix-aware matching; the assertion id is taken from the `SAMLAssertionID` key identifier.
- Parse errors are no longer wrapped twice, so the original reason is kept.
- Repaired the development toolchain: the lockfile could not run the test suite (`Cannot find module 'jest-util'`) and ESLint 9 could not find a configuration.

### Added
- `verifyMany(requests, { batchSize })` verifies several identities with one STS token and one KPS request per batch; results keep the input order.
- `serialno` request field for the TC Kimlik Kartı serial number (`TCKKSeriNo`, new in the 2025/08/01 service version).
- `extra.Ulke` for blue card (mavi kart) holders.
- `hataBilgisi` on results with the KPS error for that record; request level KPS errors throw `ServiceError` with `details.hataBilgisi`.
- `isValidTCKimlikNo()` checksum helper and the `validateChecksum` option to reject mistyped numbers before a billed query.
- Config options: `cacheToken`, `includeRaw`, `logger`, `endpoints` (proxies / test doubles), `httpConfig.keepAlive`, `httpConfig.httpsAgent`.
- `clearTokenCache()` method.
- `ServiceError`/`STSError` details include the parsed SOAP fault (`details.fault`: code, subcode, reason); `NetworkError` details include the socket error code (e.g. `ECONNREFUSED`).
- Birth fields accept numbers as well as strings.
- Test suite (109 tests) with a mock STS/KPS server that verifies signatures with Exclusive C14N, like the real service.
- GitHub Actions CI on Node.js 18, 20, 22 and 24.
- `examples/batch.ts`.

### Changed
- The STS token is cached and reused until one minute before its reported lifetime ends; concurrent calls share one STS request. A cached token rejected by KPS is replaced and the query retried once. Sequential verifications need one round trip instead of two.
- Debug output goes through `logger.debug` (default `console`) and masks the password and the STS proof key.
- Validation: `birthday` now requires `birthmonth`, `serialno` must be alphanumeric; `ValidationError` details for `verifyMany()` list the failing indexes.
- Replaced the `uuid` dependency with `crypto.randomUUID()`; updated `axios` to 1.20.
- Migrated to ESLint 9 flat config, Jest 30 and typescript-eslint 8; `npm audit` reports 0 vulnerabilities (previously 15).
- The published package includes `src` (for source maps) and `CHANGELOG.md`; `build` cleans `dist` first.

## [1.0.1] - 2025-12-02

### Fixed
- Fixed SOAP security verification error by resolving namespace conflicts in Timestamp and SignedInfo elements
- Fixed response parser to correctly handle SOAP envelope structure with namespace-prefixed elements
- Improved XML canonicalization for better signature verification
- Enhanced error messages with SOAP fault parsing for better debugging

### Added
- Added debug mode (`debug: true`) to log SOAP requests and responses for troubleshooting
- Improved error handling with detailed fault message extraction from SOAP responses

### Changed
- Timestamp and SignedInfo now use separate XML versions for canonicalization vs envelope insertion to prevent namespace conflicts
- Response parser now correctly navigates SOAP envelope structure (Envelope -> Body -> SorgulaResponse -> SorgulaResult)

## [1.0.0] - 2025-10-06

### Added
- Initial release
- KPS v2 API integration with WS-Trust authentication
- HMAC-SHA1 signing for SOAP requests
- TypeScript support with full type definitions
- Comprehensive error handling with typed errors
- Support for TC vatandaşı, yabancı, and mavi kart verifications
- Automatic uppercase conversion for names
- Optional birth month and day parameters
- Authentication error detection and helpful messages
- Request validation
- XML parsing and response handling
- Configurable HTTP client with timeout support
- Complete API documentation
- MIT license

### Features
- ✅ Secure WS-Trust authentication
- ✅ HMAC-SHA1 signed SOAP requests
- ✅ Full TypeScript support
- ✅ Comprehensive error types
- ✅ Zero configuration required
- ✅ Works with Node.js >= 18.0.0

[1.1.0]: https://github.com/yucelozalp/kps-identity-client/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/yucelozalp/kps-identity-client/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/yucelozalp/kps-identity-client/releases/tag/v1.0.0
