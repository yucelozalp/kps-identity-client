import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';
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
 * Canonicalize XML (simplified C14N)
 * @internal
 */
export function canonicalizeXML(xml: string): string {
  let canonical = xml.replace(/<\?xml[^?]*\?>\s*/g, '');
  canonical = canonical.replace(/>\s+</g, '><');
  return canonical.trim();
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
 * Extract inner XML of a tag (namespace-agnostic)
 * @internal
 */
export function extractInnerXML(xmlStr: string, tagName: string): string {
  const lowerXml = xmlStr.toLowerCase();
  const lowerTag = tagName.toLowerCase();
  
  let startIdx = lowerXml.indexOf(`<${lowerTag}`);
  if (startIdx === -1) {
    const colonTag = `:${lowerTag}`;
    startIdx = lowerXml.indexOf(colonTag);
    if (startIdx === -1) return '';
    startIdx = lowerXml.lastIndexOf('<', startIdx);
    if (startIdx === -1) return '';
  }
  
  const openTagEnd = lowerXml.indexOf('>', startIdx);
  if (openTagEnd === -1) return '';
  
  const contentStart = openTagEnd + 1;
  const closeTag = `</${lowerTag}>`;
  let closeIdx = lowerXml.indexOf(closeTag, contentStart);
  
  if (closeIdx === -1) {
    const altClose = lowerXml.indexOf(lowerTag + '>', contentStart);
    if (altClose >= 0) {
      const preClose = lowerXml.lastIndexOf('</', altClose);
      if (preClose >= contentStart) {
        closeIdx = preClose;
      }
    }
  }
  
  if (closeIdx === -1) return '';
  return xmlStr.substring(contentStart, closeIdx).trim();
}

/**
 * Parse XML to object
 * @internal
 */
export async function parseXML(xml: string): Promise<any> {
  try {
    return await parseStringPromise(xml, {
      trim: true,
      explicitArray: false,
      ignoreAttrs: false,
    });
  } catch (error) {
    throw new ParseError('Failed to parse XML', { originalError: error });
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
