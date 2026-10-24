import crypto from 'crypto';
import { DOMParser } from '@xmldom/xmldom';
import { ExclusiveCanonicalization } from 'xml-crypto';

const WSU_NS = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd';
const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
const WSSE_NS = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  assertionId?: string;
}

function firstByLocalName(doc: Document, ns: string, localName: string): Element | null {
  const list = doc.getElementsByTagNameNS(ns, localName);
  return list.length > 0 ? (list.item(0) as Element) : null;
}

/**
 * Verify a signed envelope the way the WCF service does: exc-c14n of the elements as
 * they appear in the received document, SHA-1 digest of the timestamp and HMAC-SHA1
 * of SignedInfo with the proof key.
 */
export function verifySignedEnvelope(
  envelope: string,
  secretFor: (assertionId: string) => Buffer | undefined
): VerificationResult {
  const doc = new DOMParser().parseFromString(envelope, 'text/xml') as unknown as Document;
  const c14n = new ExclusiveCanonicalization();

  const security = firstByLocalName(doc, WSSE_NS, 'Security');
  if (!security) return { valid: false, reason: 'Security header missing' };

  // Strict layout: Timestamp first, signature after the token it references
  const children = Array.from(security.childNodes).filter((n) => n.nodeType === 1) as Element[];
  if (children[0]?.localName !== 'Timestamp') {
    return { valid: false, reason: 'Timestamp is not the first security header element' };
  }
  if (children[children.length - 1]?.localName !== 'Signature') {
    return { valid: false, reason: 'Signature is not the last security header element' };
  }

  const timestamp = children[0];
  if (timestamp.getAttributeNS(WSU_NS, 'Id') !== '_0') {
    return { valid: false, reason: 'Timestamp wsu:Id mismatch' };
  }

  const signedInfo = firstByLocalName(doc, DSIG_NS, 'SignedInfo');
  const digestValue = firstByLocalName(doc, DSIG_NS, 'DigestValue')?.textContent ?? '';
  const signatureValue = firstByLocalName(doc, DSIG_NS, 'SignatureValue')?.textContent ?? '';
  const keyIdentifier = firstByLocalName(doc, WSSE_NS, 'KeyIdentifier')?.textContent?.trim() ?? '';
  if (!signedInfo) return { valid: false, reason: 'SignedInfo missing' };

  const canonicalTimestamp = c14n.process(timestamp as any, {});
  const expectedDigest = crypto.createHash('sha1').update(canonicalTimestamp).digest('base64');
  if (expectedDigest !== digestValue) {
    return { valid: false, reason: 'Timestamp digest mismatch', assertionId: keyIdentifier };
  }

  const secret = secretFor(keyIdentifier);
  if (!secret) return { valid: false, reason: 'Unknown token', assertionId: keyIdentifier };

  const canonicalSignedInfo = c14n.process(signedInfo as any, {});
  const expectedSignature = crypto
    .createHmac('sha1', secret)
    .update(canonicalSignedInfo)
    .digest('base64');
  if (expectedSignature !== signatureValue) {
    return { valid: false, reason: 'Signature mismatch', assertionId: keyIdentifier };
  }

  return { valid: true, assertionId: keyIdentifier };
}
