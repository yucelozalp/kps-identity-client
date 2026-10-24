import crypto from 'crypto';
import { parseStringPromise, processors } from 'xml2js';
import { ParseError } from './errors';

/**
 * Escape XML special characters
 * @internal
 */
export function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date to ISO 8601
 * @internal
 */
export function formatISODate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Calculate SHA-1 digest
 * @internal
 */
export function sha1Digest(data: string | Buffer): Buffer {
  return crypto.createHash('sha1').update(data).digest();
}

/**
 * Calculate HMAC-SHA1
 * @internal
 */
export function hmacSha1(key: Buffer, data: string | Buffer): Buffer {
  return crypto.createHmac('sha1', key).update(data).digest();
}

/**
 * Base64 encode
 * @internal
 */
export function base64Encode(data: Buffer | string): string {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return buffer.toString('base64');
}

/**
 * Base64 decode
 * @internal
 */
export function base64Decode(data: string): Buffer {
  return Buffer.from(data, 'base64');
}

/**
 * Element found by {@link findElements}
 * @internal
 */
export interface XMLElementMatch {
  /** Raw attribute string of the start tag */
  attributes: string;
  /** Inner XML (empty for self-closing elements) */
  inner: string;
}

function elementPattern(localName: string): RegExp {
  // Matches <name>, <prefix:name>, self-closing forms and the matching close tag
  return new RegExp(
    `<((?:[\\w.-]+:)?${localName})(\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</\\1\\s*>)`,
    'gi'
  );
}

/**
 * Find all elements with the given local name (namespace prefix agnostic)
 * @internal
 */
export function findElements(xml: string, localName: string): XMLElementMatch[] {
  const matches: XMLElementMatch[] = [];
  for (const match of xml.matchAll(elementPattern(localName))) {
    matches.push({ attributes: match[2] || '', inner: match[3] || '' });
  }
  return matches;
}

/**
 * Inner XML of the first element with the given local name, or '' if absent
 * @internal
 */
export function extractInnerXML(xml: string, localName: string): string {
  const [match] = findElements(xml, localName);
  return match ? match.inner.trim() : '';
}

/**
 * Text content of the first element with the given local name, or '' if absent
 * @internal
 */
export function extractElementText(xml: string, localName: string): string {
  return extractInnerXML(xml, localName)
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Parsed SOAP fault
 * @internal
 */
export interface SoapFault {
  /** Fault code (e.g. "s:Sender") */
  code?: string;
  /** Fault subcode (e.g. "a:InvalidSecurity") */
  subcode?: string;
  /** Human readable reason */
  reason?: string;
}

/**
 * Parse a SOAP 1.1/1.2 fault, returns null if the document is not a fault
 * @internal
 */
export function parseSoapFault(xml: unknown): SoapFault | null {
  if (typeof xml !== 'string') return null;
  const [fault] = findElements(xml, 'Fault');
  if (!fault) return null;

  const values = findElements(fault.inner, 'Value').map((v) => v.inner.trim());
  const reason =
    extractElementText(fault.inner, 'Text') || extractElementText(fault.inner, 'faultstring');

  return {
    code: values[0] || extractElementText(fault.inner, 'faultcode') || undefined,
    subcode: values[1] || undefined,
    reason: reason || undefined,
  };
}

/**
 * Mask credentials and key material in SOAP messages before logging
 * @internal
 */
export function redactSecrets(xml: unknown): unknown {
  if (typeof xml !== 'string') return xml;
  return xml.replace(
    /(<((?:[\w.-]+:)?(?:Password|BinarySecret))(?:\s[^>]*)?>)[\s\S]*?(<\/\2\s*>)/gi,
    '$1***$3'
  );
}

/**
 * Normalize a value that xml2js returns as a single item or an array
 * @internal
 */
export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Parse XML to object, namespace prefixes are stripped from element and attribute names
 * @internal
 */
export async function parseXML(xml: string): Promise<any> {
  try {
    return await parseStringPromise(xml, {
      trim: true,
      explicitArray: false,
      ignoreAttrs: false,
      tagNameProcessors: [processors.stripPrefix],
      attrNameProcessors: [processors.stripPrefix],
    });
  } catch (error: any) {
    throw new ParseError('Failed to parse XML', { originalError: error?.message ?? error });
  }
}

/**
 * Zero-pad number
 * @internal
 */
export function padNumber(num: string | number): string {
  const str = String(num);
  return str.length === 1 ? `0${str}` : str;
}
