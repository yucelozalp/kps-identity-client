import {
  xmlEscape,
  formatISODate,
  canonicalizeXML,
  base64Encode,
  base64Decode,
  padNumber,
} from '../utils';

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

  describe('canonicalizeXML', () => {
    it('should remove XML declaration', () => {
      const xml = '<?xml version="1.0"?><root>test</root>';
      expect(canonicalizeXML(xml)).toBe('<root>test</root>');
    });

    it('should normalize whitespace', () => {
      const xml = '<root>  <child>text</child>  </root>';
      expect(canonicalizeXML(xml)).toBe('<root><child>text</child></root>');
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
});
