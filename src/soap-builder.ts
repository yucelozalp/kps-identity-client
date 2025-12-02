import { v4 as uuidv4 } from 'uuid';
import { NAMESPACES, SERVICE_URIS, ALGORITHMS, KPS_URLS } from './constants';
import { xmlEscape, formatISODate } from './utils';
import { QueryRequest } from './types';

/**
 * Build STS (Security Token Service) Request
 * @internal
 */
export function buildSTSRequest(username: string, password: string): string {
  const messageId = `urn:uuid:${uuidv4()}`;
  const now = new Date();
  const created = formatISODate(now);
  const expires = formatISODate(new Date(now.getTime() + 5 * 60 * 1000));

  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="${NAMESPACES.SOAP_NS_12}" xmlns:a="${NAMESPACES.WSA_NS}" xmlns:wst="${NAMESPACES.TRUST_NS}" xmlns:wsse="${NAMESPACES.WSSE_NS}" xmlns:wsu="${NAMESPACES.WSU_NS}" xmlns:wsp="${NAMESPACES.WSP_NS}">
  <s:Header>
    <a:MessageID>${messageId}</a:MessageID>
    <a:To>${KPS_URLS.STS}</a:To>
    <a:Action>${SERVICE_URIS.RST_ACTION}</a:Action>
    <wsse:Security s:mustUnderstand="1">
      <wsu:Timestamp wsu:Id="_0">
        <wsu:Created>${created}</wsu:Created>
        <wsu:Expires>${expires}</wsu:Expires>
      </wsu:Timestamp>
      <wsse:UsernameToken wsu:Id="Me">
        <wsse:Username>${xmlEscape(username)}</wsse:Username>
        <wsse:Password Type="${SERVICE_URIS.PASSWORD_TYPE}">${xmlEscape(password)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <wst:RequestSecurityToken>
      <wst:TokenType>${SERVICE_URIS.TOKEN_TYPE}</wst:TokenType>
      <wst:RequestType>${SERVICE_URIS.REQUEST_TYPE}</wst:RequestType>
      <wsp:AppliesTo>
        <a:EndpointReference>
          <a:Address>${KPS_URLS.QUERY}</a:Address>
        </a:EndpointReference>
      </wsp:AppliesTo>
      <wst:KeyType>${SERVICE_URIS.KEY_TYPE}</wst:KeyType>
    </wst:RequestSecurityToken>
  </s:Body>
</s:Envelope>`;
}

/**
 * Build query body
 * @internal
 */
export function buildQueryBody(request: QueryRequest): string {
  const zeroIfEmpty = (val?: string): string => {
    return val && val.trim() ? val.trim() : '0';
  };

  return `<Sorgula xmlns="${NAMESPACES.BODY_NS}" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
  <kriterListesi>
    <TumKutukDogrulamaSorguKriteri>
      <Ad>${xmlEscape(request.firstname.toUpperCase())}</Ad>
      <DogumAy>${xmlEscape(zeroIfEmpty(request.birthmonth))}</DogumAy>
      <DogumGun>${xmlEscape(zeroIfEmpty(request.birthday))}</DogumGun>
      <DogumYil>${xmlEscape(request.birthyear)}</DogumYil>
      <KimlikNo>${xmlEscape(request.tcno)}</KimlikNo>
      <Soyad>${xmlEscape(request.lastname.toUpperCase())}</Soyad>
    </TumKutukDogrulamaSorguKriteri>
  </kriterListesi>
</Sorgula>`;
}

/**
 * Build timestamp
 * @internal
 */
export function buildTimestamp(): { xml: string; xmlForEnvelope: string; created: string; expires: string } {
  const now = new Date();
  const created = formatISODate(now);
  const expires = formatISODate(new Date(now.getTime() + 5 * 60 * 1000));

  // XML with namespace for canonicalization (used for digest)
  const xml = `<wsu:Timestamp xmlns:wsu="${NAMESPACES.WSU_NS}" wsu:Id="_0">
<wsu:Created>${created}</wsu:Created>
<wsu:Expires>${expires}</wsu:Expires>
</wsu:Timestamp>`;

  // XML without namespace declaration for envelope (Security element already has namespace)
  const xmlForEnvelope = `<wsu:Timestamp wsu:Id="_0">
<wsu:Created>${created}</wsu:Created>
<wsu:Expires>${expires}</wsu:Expires>
</wsu:Timestamp>`;

  return { xml, xmlForEnvelope, created, expires };
}

/**
 * Build SignedInfo (without namespace declaration, will be added by Signature element)
 * @internal
 */
export function buildSignedInfo(digestValue: string): { xml: string; xmlForSignature: string } {
  // XML with namespace for canonicalization (used for signature calculation)
  const xml = `<dsig:SignedInfo xmlns:dsig="${NAMESPACES.DSIG_NS}">
  <dsig:CanonicalizationMethod Algorithm="${ALGORITHMS.C14N}"/>
  <dsig:SignatureMethod Algorithm="${ALGORITHMS.HMAC_SHA1}"/>
  <dsig:Reference URI="#_0">
    <dsig:Transforms>
      <dsig:Transform Algorithm="${ALGORITHMS.C14N}"/>
    </dsig:Transforms>
    <dsig:DigestMethod Algorithm="${ALGORITHMS.SHA1}"/>
    <dsig:DigestValue>${digestValue}</dsig:DigestValue>
  </dsig:Reference>
</dsig:SignedInfo>`;

  // XML without namespace declaration for Signature element (Signature already has namespace)
  const xmlForSignature = `<dsig:SignedInfo>
  <dsig:CanonicalizationMethod Algorithm="${ALGORITHMS.C14N}"/>
  <dsig:SignatureMethod Algorithm="${ALGORITHMS.HMAC_SHA1}"/>
  <dsig:Reference URI="#_0">
    <dsig:Transforms>
      <dsig:Transform Algorithm="${ALGORITHMS.C14N}"/>
    </dsig:Transforms>
    <dsig:DigestMethod Algorithm="${ALGORITHMS.SHA1}"/>
    <dsig:DigestValue>${digestValue}</dsig:DigestValue>
  </dsig:Reference>
</dsig:SignedInfo>`;

  return { xml, xmlForSignature };
}

/**
 * Build Signature
 * @internal
 */
export function buildSignature(signedInfo: string, signatureValue: string, assertionId: string): string {
  return `<dsig:Signature xmlns:dsig="${NAMESPACES.DSIG_NS}">
  ${signedInfo}
  <dsig:SignatureValue>${signatureValue}</dsig:SignatureValue>
  <dsig:KeyInfo>
    <wsse:SecurityTokenReference xmlns:wsse="${NAMESPACES.WSSE_NS}">
      <wsse:KeyIdentifier ValueType="${ALGORITHMS.SAML_ASSERTION_ID}">${xmlEscape(assertionId)}</wsse:KeyIdentifier>
    </wsse:SecurityTokenReference>
  </dsig:KeyInfo>
</dsig:Signature>`;
}

/**
 * Build service envelope
 * @internal
 */
export function buildServiceEnvelope(
  timestamp: string,
  tokenXML: string,
  signature: string,
  bodyXML: string
): string {
  const messageId = `urn:uuid:${uuidv4()}`;

  const header = `
  <a:MessageID xmlns:a="${NAMESPACES.WSA_NS}">${messageId}</a:MessageID>
  <a:To xmlns:a="${NAMESPACES.WSA_NS}" s:mustUnderstand="1">${KPS_URLS.QUERY}</a:To>
  <a:Action xmlns:a="${NAMESPACES.WSA_NS}" s:mustUnderstand="1">${SERVICE_URIS.METHOD_URI}</a:Action>
  <wsse:Security xmlns:wsse="${NAMESPACES.WSSE_NS}" xmlns:wsu="${NAMESPACES.WSU_NS}" s:mustUnderstand="1">
    ${timestamp}
    ${tokenXML}
    ${signature}
  </wsse:Security>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="${NAMESPACES.SOAP_NS_12}">
  <s:Header>${header}</s:Header>
  <s:Body>${bodyXML}</s:Body>
</s:Envelope>`;
}
