const WSU_NS = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd';
const WSSE_NS = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';

export interface STSFixture {
  assertionId?: string;
  secretB64?: string;
  /** Token lifetime in ms; omit the Lifetime element when null */
  lifetimeMs?: number | null;
  created?: Date;
}

/**
 * WCF style RequestSecurityTokenResponseCollection with an encrypted SAML token
 */
export function buildSTSResponse(options: STSFixture = {}): string {
  const assertionId = options.assertionId ?? '_7e1c0a3b-5d2f-4a8e-9b6c-1f0e2d3c4b5a';
  const secret =
    options.secretB64 ?? Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
  const created = options.created ?? new Date();
  const lifetimeMs = options.lifetimeMs === undefined ? 10 * 60 * 1000 : options.lifetimeMs;
  const lifetime =
    lifetimeMs === null
      ? ''
      : '<trust:Lifetime>' +
        `<wsu:Created xmlns:wsu="${WSU_NS}">${created.toISOString()}</wsu:Created>` +
        `<wsu:Expires xmlns:wsu="${WSU_NS}">${new Date(created.getTime() + lifetimeMs).toISOString()}</wsu:Expires>` +
        '</trust:Lifetime>';

  const reference =
    `<o:SecurityTokenReference xmlns:o="${WSSE_NS}" xmlns:k="http://docs.oasis-open.org/wss/oasis-wss-wssecurity-secext-1.1.xsd" k:TokenType="http://docs.oasis-open.org/wss/oasis-wss-saml-token-profile-1.1#SAMLV1.1">` +
    `<o:KeyIdentifier ValueType="http://docs.oasis-open.org/wss/oasis-wss-saml-token-profile-1.0#SAMLAssertionID">${assertionId}</o:KeyIdentifier>` +
    '</o:SecurityTokenReference>';

  return (
    '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing" xmlns:u="' +
    WSU_NS +
    '">' +
    '<s:Header><a:Action s:mustUnderstand="1">http://docs.oasis-open.org/ws-sx/ws-trust/200512/RSTRC/IssueFinal</a:Action>' +
    `<o:Security s:mustUnderstand="1" xmlns:o="${WSSE_NS}"><u:Timestamp u:Id="_0"><u:Created>2020-01-01T00:00:00.000Z</u:Created><u:Expires>2020-01-01T00:05:00.000Z</u:Expires></u:Timestamp></o:Security>` +
    '</s:Header><s:Body>' +
    '<trust:RequestSecurityTokenResponseCollection xmlns:trust="http://docs.oasis-open.org/ws-sx/ws-trust/200512">' +
    '<trust:RequestSecurityTokenResponse>' +
    lifetime +
    '<wsp:AppliesTo xmlns:wsp="http://schemas.xmlsoap.org/ws/2004/09/policy"><wsa:EndpointReference xmlns:wsa="http://www.w3.org/2005/08/addressing"><wsa:Address>https://kpsv2.nvi.gov.tr/Services/RoutingService.svc</wsa:Address></wsa:EndpointReference></wsp:AppliesTo>' +
    '<trust:RequestedSecurityToken>' +
    '<xenc:EncryptedData xmlns:xenc="http://www.w3.org/2001/04/xmlenc#" Type="http://www.w3.org/2001/04/xmlenc#Element">' +
    '<xenc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes256-cbc"/>' +
    '<KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><e:EncryptedKey xmlns:e="http://www.w3.org/2001/04/xmlenc#">' +
    '<e:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p"><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/></e:EncryptionMethod>' +
    `<KeyInfo><o:SecurityTokenReference xmlns:o="${WSSE_NS}"><X509Data><X509IssuerSerial><X509IssuerName>CN=KPS</X509IssuerName><X509SerialNumber>1234567890</X509SerialNumber></X509IssuerSerial></X509Data></o:SecurityTokenReference></KeyInfo>` +
    '<e:CipherData><e:CipherValue>Q2lwaGVyS2V5</e:CipherValue></e:CipherData></e:EncryptedKey></KeyInfo>' +
    '<xenc:CipherData><xenc:CipherValue>Q2lwaGVyVG9rZW4=</xenc:CipherValue></xenc:CipherData>' +
    '</xenc:EncryptedData>' +
    '</trust:RequestedSecurityToken>' +
    `<trust:RequestedAttachedReference>${reference}</trust:RequestedAttachedReference>` +
    `<trust:RequestedUnattachedReference>${reference}</trust:RequestedUnattachedReference>` +
    `<trust:RequestedProofToken><trust:BinarySecret>${secret}</trust:BinarySecret></trust:RequestedProofToken>` +
    '<trust:TokenType>http://docs.oasis-open.org/wss/oasis-wss-saml-token-profile-1.1#SAMLV1.1</trust:TokenType>' +
    '<trust:RequestType>http://docs.oasis-open.org/ws-sx/ws-trust/200512/Issue</trust:RequestType>' +
    '<trust:KeyType>http://docs.oasis-open.org/ws-sx/ws-trust/200512/SymmetricKey</trust:KeyType>' +
    '</trust:RequestSecurityTokenResponse>' +
    '</trust:RequestSecurityTokenResponseCollection>' +
    '</s:Body></s:Envelope>'
  );
}

export interface DateFixture {
  yil: number;
  ay?: number;
  gun?: number;
}

export interface RecordFixture {
  kimlikNo: string;
  /** Registry that holds the person; 'none' produces a not-found record */
  type: 'tc' | 'yabanci' | 'mavi' | 'none';
  kod?: number;
  aciklama?: string;
  ad?: string;
  soyad?: string;
  uyruk?: string;
  ulke?: string;
  dogum?: DateFixture;
  olum?: DateFixture;
  /** Record level HataBilgisi */
  hata?: { kod: number; aciklama: string };
}

const nil = (name: string) => `<${name} i:nil="true"/>`;

function date(name: string, value?: DateFixture): string {
  if (!value) return nil(`b:${name}`);
  const part = (tag: string, v?: number) =>
    v === undefined ? nil(`b:${tag}`) : `<b:${tag}>${v}</b:${tag}>`;
  return `<b:${name}>${part('Ay', value.ay)}${part('Gun', value.gun)}${part('Yil', value.yil)}</b:${name}>`;
}

function kutuk(record: RecordFixture, type: RecordFixture['type'], path: string): string {
  if (record.type !== type) {
    return (
      `<${path}><HataBilgisi xmlns:b="http://kps.nvi.gov.tr/2011/01/01"><b:Aciklama>Kayıt bulunamadı.</b:Aciklama><b:Kod>1</b:Kod></HataBilgisi>` +
      `${nil('KisiBilgisi')}</${path}>`
    );
  }

  const idTag = type === 'tc' ? 'TCKimlikNo' : 'KimlikNo';
  const extraTag =
    type === 'yabanci'
      ? `<b:Uyruk>${record.uyruk ?? ''}</b:Uyruk>`
      : type === 'mavi'
        ? `<b:Ulke>${record.ulke ?? ''}</b:Ulke>`
        : '';

  return (
    `<${path}>${nil('HataBilgisi')}<KisiBilgisi>` +
    '<DurumBilgisi xmlns:b="http://kps.nvi.gov.tr/2011/01/01">' +
    date('DogumTarih', record.dogum) +
    `<b:Durum><b:Aciklama>${record.aciklama ?? 'Açık'}</b:Aciklama><b:Kod>${record.kod ?? 1}</b:Kod></b:Durum>` +
    date('OlumTarih', record.olum) +
    '</DurumBilgisi>' +
    nil('HataBilgisi') +
    `<${idTag}>${record.kimlikNo}</${idTag}>` +
    '<TemelBilgisi xmlns:b="http://kps.nvi.gov.tr/2011/01/01">' +
    `<b:Ad>${record.ad ?? 'AHMET'}</b:Ad><b:Soyad>${record.soyad ?? 'YILMAZ'}</b:Soyad>${extraTag}` +
    '</TemelBilgisi>' +
    `</KisiBilgisi></${path}>`
  );
}

function recordXML(record: RecordFixture): string {
  const dolu = {
    tc: 'TCKisiBilgisi',
    yabanci: 'YabanciKisiBilgisi',
    mavi: 'MaviKartliKisiBilgisi',
    none: '',
  }[record.type];

  return (
    '<TumKutukDogrulamaBilgileri>' +
    '<DoluBilesenler xmlns:a="http://schemas.datacontract.org/2004/07/Common.Types.Constants">' +
    (dolu
      ? `<a:CstTumKutukDogrulaServisDoluBilesen>${dolu}</a:CstTumKutukDogrulaServisDoluBilesen>`
      : '') +
    '</DoluBilesenler>' +
    (record.hata
      ? `<HataBilgisi xmlns:b="http://kps.nvi.gov.tr/2011/01/01"><b:Aciklama>${record.hata.aciklama}</b:Aciklama><b:Kod>${record.hata.kod}</b:Kod></HataBilgisi>`
      : nil('HataBilgisi')) +
    `<KimlikNo>${record.kimlikNo}</KimlikNo>` +
    kutuk(record, 'mavi', 'MaviKartliKisiKutukleri') +
    kutuk(record, 'tc', 'TCVatandasiKisiKutukleri') +
    kutuk(record, 'yabanci', 'YabanciKisiKutukleri') +
    '</TumKutukDogrulamaBilgileri>'
  );
}

/**
 * TumKutukDogrulaServis 2025/08/01 SorgulaResponse
 */
export function buildServiceResponse(
  records: RecordFixture[],
  options: { requestError?: { kod: number; aciklama: string } } = {}
): string {
  const requestError = options.requestError
    ? `<HataBilgisi xmlns:b="http://kps.nvi.gov.tr/2011/01/01"><b:Aciklama>${options.requestError.aciklama}</b:Aciklama><b:Kod>${options.requestError.kod}</b:Kod></HataBilgisi>`
    : nil('HataBilgisi');
  const sonuc = options.requestError
    ? nil('SorguSonucu')
    : `<SorguSonucu>${records.map(recordXML).join('')}</SorguSonucu>`;

  return (
    '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing">' +
    '<s:Header><a:Action s:mustUnderstand="1">http://kps.nvi.gov.tr/2025/08/01/TumKutukDogrulaServis/SorgulaResponse</a:Action></s:Header>' +
    '<s:Body><SorgulaResponse xmlns="http://kps.nvi.gov.tr/2025/08/01">' +
    `<SorgulaResult xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${requestError}${sonuc}</SorgulaResult>` +
    '</SorgulaResponse></s:Body></s:Envelope>'
  );
}

/**
 * Fault returned by KPS when the message signature cannot be verified (issue #1)
 */
export const INVALID_SECURITY_FAULT =
  '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing"><s:Header><a:Action s:mustUnderstand="1">http://www.w3.org/2005/08/addressing/soap/fault</a:Action><a:RelatesTo>urn:uuid:e0210db8-aa92-4ff6-a7e1-52c694600ac0</a:RelatesTo></s:Header><s:Body><s:Fault><s:Code><s:Value>s:Sender</s:Value><s:Subcode><s:Value xmlns:a="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">a:InvalidSecurity</s:Value></s:Subcode></s:Code><s:Reason><s:Text xml:lang="tr-TR">An error occurred when verifying security for the message.</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>';

/**
 * Fault returned by the STS for wrong credentials
 */
export const AUTH_FAULT =
  '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><s:Fault><s:Code><s:Value>s:Sender</s:Value><s:Subcode><s:Value xmlns:a="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">a:FailedAuthentication</s:Value></s:Subcode></s:Code><s:Reason><s:Text xml:lang="tr-TR">At least one security token in the message could not be validated.</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>';
