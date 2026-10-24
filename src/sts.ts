import { DEFAULT_TOKEN_TTL } from './constants';
import { STSError } from './errors';
import { STSArtifacts } from './types';
import { extractElementText, extractInnerXML, findElements } from './utils';

/**
 * Extract the proof key, token and assertion id from an STS response
 * @internal
 */
export function parseSTSResponse(responseXML: string, receivedAt = Date.now()): STSArtifacts {
  const proofToken = extractInnerXML(responseXML, 'RequestedProofToken');
  const binarySecret =
    extractElementText(proofToken, 'BinarySecret') ||
    extractElementText(responseXML, 'BinarySecret');
  if (!binarySecret) {
    throw new STSError('BinarySecret not found in STS response');
  }

  // The token itself is encrypted, the assertion id comes from the attached reference
  const keyIdentifiers = findElements(responseXML, 'KeyIdentifier');
  const keyIdentifier =
    keyIdentifiers.find((k) => /SAMLAssertionID/i.test(k.attributes)) || keyIdentifiers[0];
  const assertionID = keyIdentifier ? keyIdentifier.inner.trim() : '';
  if (!assertionID) {
    throw new STSError('KeyIdentifier not found in STS response');
  }

  const tokenXML = extractInnerXML(responseXML, 'RequestedSecurityToken');
  if (!tokenXML) {
    throw new STSError('RequestedSecurityToken not found in STS response');
  }

  return {
    binarySecretB64: binarySecret,
    tokenXML,
    assertionID,
    expiresAt: receivedAt + getTokenTTL(responseXML),
  };
}

/**
 * Token lifetime from wst:Lifetime, measured as Expires - Created so local clock skew
 * does not matter
 */
function getTokenTTL(responseXML: string): number {
  const lifetime = extractInnerXML(responseXML, 'Lifetime');
  const created = Date.parse(extractElementText(lifetime, 'Created'));
  const expires = Date.parse(extractElementText(lifetime, 'Expires'));
  const ttl = expires - created;
  return Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_TOKEN_TTL;
}
