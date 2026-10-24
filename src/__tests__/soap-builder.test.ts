import { DOMParser } from '@xmldom/xmldom';
import { ExclusiveCanonicalization } from 'xml-crypto';
import {
  buildQueryBody,
  buildSignedEnvelope,
  buildSignedInfo,
  buildSTSRequest,
  buildTimestamp,
} from '../soap-builder';
import { normalizeRequest } from '../validation';
import { STSArtifacts } from '../types';
import { verifySignedEnvelope } from './helpers/wcf-verifier';

const secret = Buffer.from('0123456789abcdef0123456789abcdef');
const artifacts: STSArtifacts = {
  binarySecretB64: secret.toString('base64'),
  tokenXML:
    '<xenc:EncryptedData xmlns:xenc="http://www.w3.org/2001/04/xmlenc#">token</xenc:EncryptedData>',
  assertionID: '_assertion-1',
  expiresAt: Date.now() + 60000,
};

function canonicalize(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return new ExclusiveCanonicalization().process(doc.documentElement as any, {});
}

const criteria = normalizeRequest({
  tcno: '10000000146',
  firstname: 'Ahmet',
  lastname: 'Yılmaz',
  birthyear: '1990',
  birthmonth: '01',
  birthday: '15',
});

describe('SOAP builder', () => {
  describe('buildSignedEnvelope', () => {
    it('produces a signature that verifies like the WCF service does', () => {
      const envelope = buildSignedEnvelope(artifacts, buildQueryBody([criteria]));
      const result = verifySignedEnvelope(envelope, (id) =>
        id === '_assertion-1' ? secret : undefined
      );
      expect(result).toEqual({ valid: true, assertionId: '_assertion-1' });
    });

    it('is rejected when signed with another key', () => {
      const envelope = buildSignedEnvelope(artifacts, buildQueryBody([criteria]));
      const result = verifySignedEnvelope(envelope, () => Buffer.from('wrong-key'));
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Signature mismatch');
    });

    it('keeps the token between timestamp and signature (strict layout)', () => {
      const envelope = buildSignedEnvelope(artifacts, '<Body/>');
      const security = envelope.match(/<wsse:Security[^>]*>([\s\S]*)<\/wsse:Security>/)![1];
      expect(security.indexOf('<wsu:Timestamp')).toBe(0);
      expect(security.indexOf(artifacts.tokenXML)).toBeGreaterThan(0);
      expect(security.indexOf('<dsig:Signature')).toBeGreaterThan(
        security.indexOf(artifacts.tokenXML)
      );
    });

    it('addresses the official KPS endpoint', () => {
      const envelope = buildSignedEnvelope(artifacts, '<Body/>');
      expect(envelope).toContain('>https://kpsv2.nvi.gov.tr/Services/RoutingService.svc</a:To>');
      expect(envelope).toContain(
        '>http://kps.nvi.gov.tr/2025/08/01/TumKutukDogrulaServis/Sorgula</a:Action>'
      );
    });
  });

  describe('canonical forms', () => {
    it('writes the timestamp exactly as exc-c14n renders it', () => {
      const { xml } = buildTimestamp(new Date('2026-01-01T10:00:00.123Z'));
      expect(xml).toBe(canonicalize(xml));
      expect(xml).toContain('<wsu:Created>2026-01-01T10:00:00Z</wsu:Created>');
      expect(xml).toContain('<wsu:Expires>2026-01-01T10:05:00Z</wsu:Expires>');
    });

    it('writes SignedInfo exactly as exc-c14n renders it', () => {
      const xml = buildSignedInfo('ZGlnZXN0');
      expect(xml).toBe(canonicalize(xml));
    });
  });

  describe('buildQueryBody', () => {
    it('writes criteria fields in DataContract order', () => {
      const body = buildQueryBody([criteria]);
      expect(body).toContain(
        '<TumKutukDogrulamaSorguKriteri><Ad>AHMET</Ad><DogumAy>1</DogumAy><DogumGun>15</DogumGun>' +
          '<DogumYil>1990</DogumYil><KimlikNo>10000000146</KimlikNo><Soyad>YILMAZ</Soyad></TumKutukDogrulamaSorguKriteri>'
      );
      expect(body).toContain('xmlns="http://kps.nvi.gov.tr/2025/08/01"');
    });

    it('appends TCKKSeriNo last when a serial number is given', () => {
      const body = buildQueryBody([
        normalizeRequest({
          tcno: '10000000146',
          firstname: 'a',
          lastname: 'b',
          birthyear: 1990,
          serialno: 'a12b34567',
        }),
      ]);
      expect(body).toMatch(
        /<Soyad>B<\/Soyad><TCKKSeriNo>A12B34567<\/TCKKSeriNo><\/TumKutukDogrulamaSorguKriteri>/
      );
    });

    it('sends zero for missing birth month and day', () => {
      const body = buildQueryBody([
        normalizeRequest({ tcno: '10000000146', firstname: 'a', lastname: 'b', birthyear: '1990' }),
      ]);
      expect(body).toContain('<DogumAy>0</DogumAy><DogumGun>0</DogumGun>');
    });

    it('writes one criteria element per request', () => {
      const body = buildQueryBody([criteria, { ...criteria, tcno: '99000000042' }]);
      expect(body.match(/<TumKutukDogrulamaSorguKriteri>/g)).toHaveLength(2);
    });

    it('escapes XML special characters', () => {
      const body = buildQueryBody([{ ...criteria, firstname: 'A<B>&"' }]);
      expect(body).toContain('<Ad>A&lt;B&gt;&amp;&quot;</Ad>');
    });
  });

  describe('buildSTSRequest', () => {
    it('escapes credentials', () => {
      const request = buildSTSRequest('user&1', 'p<ss>');
      expect(request).toContain('<wsse:Username>user&amp;1</wsse:Username>');
      expect(request).toContain('>p&lt;ss&gt;</wsse:Password>');
    });

    it('asks for a symmetric key SAML 1.1 token for the KPS endpoint', () => {
      const request = buildSTSRequest('user', 'pass');
      expect(request).toContain('#SAMLV1.1</wst:TokenType>');
      expect(request).toContain('/SymmetricKey</wst:KeyType>');
      expect(request).toContain(
        '<a:Address>https://kpsv2.nvi.gov.tr/Services/RoutingService.svc</a:Address>'
      );
    });
  });
});
