# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/yucelozalp/kps-identity-client/releases/tag/v1.0.0
