import {
  xmlEscape,
  formatISODate,
  base64Encode,
  base64Decode,
  padNumber,
  findElements,
  extractInnerXML,
  extractElementText,
  parseSoapFault,
  redactSecrets,
  toArray,
} from '../utils';
import { INVALID_SECURITY_FAULT } from './helpers/fixtures';

describe('Utils', () => {
  describe('xmlEscape', () => {
    it('should escape special XML characters', () => {
      expect(xmlEscape('Hello & <World>')).toBe('Hello &amp; &lt;World&gt;');
      expect(xmlEscape('"quoted" \'text\'')).toBe('&quot;quoted&quot; &apos;text&apos;');
    });
  });

  describe('formatISODate', () => {
    it('should format date to ISO', () => {
      const date = new Date('2024-01-15T10:30:45.123Z');
      const formatted = formatISODate(date);
      expect(formatted).toBe('2024-01-15T10:30:45Z');
    });
  });

  describe('base64 encoding/decoding', () => {
    it('should encode to base64', () => {
      expect(base64Encode('Hello World')).toBe('SGVsbG8gV29ybGQ=');
    });

    it('should decode from base64', () => {
      const decoded = base64Decode('SGVsbG8gV29ybGQ=');
      expect(decoded.toString()).toBe('Hello World');
    });

    it('should round-trip', () => {
      const original = Buffer.from('Test data 123');
      const encoded = base64Encode(original);
      const decoded = base64Decode(encoded);
      expect(decoded.equals(original)).toBe(true);
    });
  });

  describe('padNumber', () => {
    it('should pad single digit', () => {
      expect(padNumber(5)).toBe('05');
      expect(padNumber('5')).toBe('05');
    });

    it('should not pad two digits', () => {
      expect(padNumber(15)).toBe('15');
      expect(padNumber('15')).toBe('15');
    });
  });

  describe('element extraction', () => {
    const xml =
      '<root xmlns:t="urn:t"><t:Token Id="1"><inner>a</inner></t:Token><TokenType>x</TokenType>' +
      '<Empty/><t:Token>b</t:Token></root>';

    it('matches elements with or without prefix', () => {
      expect(findElements(xml, 'Token')).toEqual([
        { attributes: ' Id="1"', inner: '<inner>a</inner>' },
        { attributes: '', inner: 'b' },
      ]);
    });

    it('does not match elements that only share a name prefix', () => {
      expect(extractInnerXML('<TokenType>x</TokenType>', 'Token')).toBe('');
    });

    it('handles self-closing elements', () => {
      expect(findElements(xml, 'Empty')).toEqual([{ attributes: '', inner: '' }]);
    });

    it('extracts text content', () => {
      expect(extractElementText(xml, 'Token')).toBe('a');
      expect(extractElementText(xml, 'Missing')).toBe('');
    });
  });

  describe('parseSoapFault', () => {
    it('parses SOAP 1.2 faults', () => {
      expect(parseSoapFault(INVALID_SECURITY_FAULT)).toEqual({
        code: 's:Sender',
        subcode: 'a:InvalidSecurity',
        reason: 'An error occurred when verifying security for the message.',
      });
    });

    it('parses SOAP 1.1 faults', () => {
      expect(
        parseSoapFault(
          '<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Boom</faultstring></soap:Fault>'
        )
      ).toEqual({ code: 'soap:Server', subcode: undefined, reason: 'Boom' });
    });

    it('returns null for non-faults', () => {
      expect(parseSoapFault('<Envelope><Body/></Envelope>')).toBeNull();
      expect(parseSoapFault(undefined)).toBeNull();
    });
  });

  describe('redactSecrets', () => {
    it('masks passwords and proof keys', () => {
      const xml =
        '<wsse:Password Type="x">hunter2</wsse:Password><trust:BinarySecret>c2VjcmV0</trust:BinarySecret>';
      expect(redactSecrets(xml)).toBe(
        '<wsse:Password Type="x">***</wsse:Password><trust:BinarySecret>***</trust:BinarySecret>'
      );
    });

    it('passes non-strings through', () => {
      expect(redactSecrets(42)).toBe(42);
    });
  });

  describe('toArray', () => {
    it('normalizes single values and empties', () => {
      expect(toArray('a')).toEqual(['a']);
      expect(toArray(['a', 'b'])).toEqual(['a', 'b']);
      expect(toArray(undefined)).toEqual([]);
      expect(toArray(null)).toEqual([]);
    });
  });
});
