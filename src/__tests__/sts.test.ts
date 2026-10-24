import { parseSTSResponse } from '../sts';
import { STSError } from '../errors';
import { buildSTSResponse } from './helpers/fixtures';

describe('parseSTSResponse', () => {
  it('extracts proof key, assertion id and encrypted token', () => {
    const secret = Buffer.from('secret-key-material').toString('base64');
    const artifacts = parseSTSResponse(
      buildSTSResponse({ assertionId: '_abc', secretB64: secret })
    );

    expect(artifacts.binarySecretB64).toBe(secret);
    expect(artifacts.assertionID).toBe('_abc');
    expect(artifacts.tokenXML).toMatch(/^<xenc:EncryptedData[\s\S]*<\/xenc:EncryptedData>$/);
  });

  it('derives expiry from the token lifetime, independent of the local clock', () => {
    const response = buildSTSResponse({
      lifetimeMs: 10 * 60 * 1000,
      created: new Date('2001-01-01T00:00:00Z'),
    });
    expect(parseSTSResponse(response, 1000).expiresAt).toBe(1000 + 10 * 60 * 1000);
  });

  it('falls back to a short lifetime when Lifetime is missing', () => {
    const response = buildSTSResponse({ lifetimeMs: null });
    expect(parseSTSResponse(response, 0).expiresAt).toBe(5 * 60 * 1000);
  });

  it('prefers the SAMLAssertionID key identifier', () => {
    const response = buildSTSResponse({ assertionId: '_saml' }).replace(
      '<trust:RequestedSecurityToken>',
      '<trust:RequestedSecurityToken><o:KeyIdentifier ValueType="#ThumbprintSHA1">thumb</o:KeyIdentifier>'
    );
    expect(parseSTSResponse(response).assertionID).toBe('_saml');
  });

  it.each([
    ['BinarySecret', /<trust:BinarySecret>[^<]*<\/trust:BinarySecret>/],
    ['KeyIdentifier', /<o:KeyIdentifier[^>]*>[^<]*<\/o:KeyIdentifier>/g],
    [
      'RequestedSecurityToken',
      /<trust:RequestedSecurityToken>[\s\S]*<\/trust:RequestedSecurityToken>/,
    ],
  ])('throws when %s is missing', (name, pattern) => {
    const response = buildSTSResponse().replace(pattern, '');
    expect(() => parseSTSResponse(response)).toThrow(STSError);
    expect(() => parseSTSResponse(response)).toThrow(`${name} not found in STS response`);
  });
});
