import { randomUUID } from 'crypto';
import { NAMESPACES, SERVICE_URIS, ALGORITHMS, KPS_URLS, TIMESTAMP_TTL } from './constants';
import {
  xmlEscape,
  formatISODate,
  sha1Digest,
  hmacSha1,
  base64Encode,
  base64Decode,
} from './utils';
import { STSArtifacts } from './types';
import { NormalizedQuery } from './validation';

/**
 * Build STS (Security Token Service) Request
 * @internal
 */
export function buildSTSRequest(username: string, password: string, now = new Date()): string {
  const messageId = `urn:uuid:${randomUUID()}`;
  const created = formatISODate(now);
  const expires = formatISODate(new Date(now.getTime() + TIMESTAMP_TTL));

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
 * Build query body, one TumKutukDogrulamaSorguKriteri per criteria
 * (DataContract element order: Ad, DogumAy, DogumGun, DogumYil, KimlikNo, Soyad, TCKKSeriNo)
 * @internal
 */
export function buildQueryBody(criteria: NormalizedQuery[]): string {
  const items = criteria
    .map(
      (c) =>
        '<TumKutukDogrulamaSorguKriteri>' +
        `<Ad>${xmlEscape(c.firstname)}</Ad>` +
        `<DogumAy>${xmlEscape(c.birthmonth)}</DogumAy>` +
        `<DogumGun>${xmlEscape(c.birthday)}</DogumGun>` +
        `<DogumYil>${xmlEscape(c.birthyear)}</DogumYil>` +
        `<KimlikNo>${xmlEscape(c.tcno)}</KimlikNo>` +
        `<Soyad>${xmlEscape(c.lastname)}</Soyad>` +
        (c.serialno ? `<TCKKSeriNo>${xmlEscape(c.serialno)}</TCKKSeriNo>` : '') +
        '</TumKutukDogrulamaSorguKriteri>'
    )
    .join('');

  return `<Sorgula xmlns="${NAMESPACES.BODY_NS}" xmlns:i="${NAMESPACES.XSI_NS}"><kriterListesi>${items}</kriterListesi></Sorgula>`;
}

/**
 * Build timestamp in Exclusive XML Canonicalization form.
 *
 * The digest is computed over these exact bytes and the same string is placed in the
 * envelope, so the server's exc-c14n of the received element matches the digest.
 * @internal
 */
export function buildTimestamp(now = new Date()): {
  xml: string;
  created: string;
  expires: string;
} {
  const created = formatISODate(now);
  const expires = formatISODate(new Date(now.getTime() + TIMESTAMP_TTL));

  const xml =
    `<wsu:Timestamp xmlns:wsu="${NAMESPACES.WSU_NS}" wsu:Id="_0">` +
    `<wsu:Created>${created}</wsu:Created>` +
    `<wsu:Expires>${expires}</wsu:Expires>` +
    '</wsu:Timestamp>';

  return { xml, created, expires };
}

/**
 * Build SignedInfo in Exclusive XML Canonicalization form
 * (no insignificant whitespace, empty elements written as start/end tag pairs)
 * @internal
 */
export function buildSignedInfo(digestValue: string): string {
  return (
    `<dsig:SignedInfo xmlns:dsig="${NAMESPACES.DSIG_NS}">` +
    `<dsig:CanonicalizationMethod Algorithm="${ALGORITHMS.C14N}"></dsig:CanonicalizationMethod>` +
    `<dsig:SignatureMethod Algorithm="${ALGORITHMS.HMAC_SHA1}"></dsig:SignatureMethod>` +
    '<dsig:Reference URI="#_0">' +
    '<dsig:Transforms>' +
    `<dsig:Transform Algorithm="${ALGORITHMS.C14N}"></dsig:Transform>` +
    '</dsig:Transforms>' +
    `<dsig:DigestMethod Algorithm="${ALGORITHMS.SHA1}"></dsig:DigestMethod>` +
    `<dsig:DigestValue>${digestValue}</dsig:DigestValue>` +
    '</dsig:Reference>' +
    '</dsig:SignedInfo>'
  );
}

/**
 * Build Signature
 * @internal
 */
export function buildSignature(
  signedInfo: string,
  signatureValue: string,
  assertionId: string
): string {
  return (
    `<dsig:Signature xmlns:dsig="${NAMESPACES.DSIG_NS}">` +
    signedInfo +
    `<dsig:SignatureValue>${signatureValue}</dsig:SignatureValue>` +
    '<dsig:KeyInfo>' +
    `<wsse:SecurityTokenReference xmlns:wsse="${NAMESPACES.WSSE_NS}">` +
    `<wsse:KeyIdentifier ValueType="${ALGORITHMS.SAML_ASSERTION_ID}">${xmlEscape(assertionId)}</wsse:KeyIdentifier>` +
    '</wsse:SecurityTokenReference>' +
    '</dsig:KeyInfo>' +
    '</dsig:Signature>'
  );
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
  const messageId = `urn:uuid:${randomUUID()}`;

  const header =
    `<a:MessageID xmlns:a="${NAMESPACES.WSA_NS}">${messageId}</a:MessageID>` +
    `<a:To xmlns:a="${NAMESPACES.WSA_NS}" s:mustUnderstand="1">${KPS_URLS.QUERY}</a:To>` +
    `<a:Action xmlns:a="${NAMESPACES.WSA_NS}" s:mustUnderstand="1">${SERVICE_URIS.METHOD_URI}</a:Action>` +
    `<wsse:Security xmlns:wsse="${NAMESPACES.WSSE_NS}" xmlns:wsu="${NAMESPACES.WSU_NS}" s:mustUnderstand="1">` +
    timestamp +
    tokenXML +
    signature +
    '</wsse:Security>';

  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    `<s:Envelope xmlns:s="${NAMESPACES.SOAP_NS_12}">` +
    `<s:Header>${header}</s:Header>` +
    `<s:Body>${bodyXML}</s:Body>` +
    '</s:Envelope>'
  );
}

/**
 * Build a service envelope whose timestamp is signed with the STS proof key (HMAC-SHA1)
 * @internal
 */
export function buildSignedEnvelope(
  artifacts: STSArtifacts,
  bodyXML: string,
  now = new Date()
): string {
  const { xml: timestampXML } = buildTimestamp(now);
  const digestValue = base64Encode(sha1Digest(timestampXML));

  const signedInfo = buildSignedInfo(digestValue);
  const secretKey = base64Decode(artifacts.binarySecretB64);
  const signatureValue = base64Encode(hmacSha1(secretKey, signedInfo));

  const signature = buildSignature(signedInfo, signatureValue, artifacts.assertionID);

  return buildServiceEnvelope(timestampXML, artifacts.tokenXML, signature, bodyXML);
}
