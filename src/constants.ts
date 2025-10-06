/**
 * KPS Service URLs
 * @internal
 */
export const KPS_URLS = {
  STS: 'https://kimlikdogrulama.nvi.gov.tr/Services/Issuer.svc/IWSTrust13',
  QUERY: 'https://kpsv2.nvi.gov.tr/Services/RoutingService.svc',
} as const;

/**
 * XML Namespaces
 * @internal
 */
export const NAMESPACES = {
  SOAP_NS_12: 'http://www.w3.org/2003/05/soap-envelope',
  WSU_NS: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd',
  WSSE_NS: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
  WSA_NS: 'http://www.w3.org/2005/08/addressing',
  DSIG_NS: 'http://www.w3.org/2000/09/xmldsig#',
  TRUST_NS: 'http://docs.oasis-open.org/ws-sx/ws-trust/200512',
  WSP_NS: 'http://schemas.xmlsoap.org/ws/2004/09/policy',
  BODY_NS: 'http://kps.nvi.gov.tr/2025/08/01',
} as const;

/**
 * Service URIs
 * @internal
 */
export const SERVICE_URIS = {
  METHOD_URI: 'http://kps.nvi.gov.tr/2025/08/01/TumKutukDogrulaServis/Sorgula',
  RST_ACTION: 'http://docs.oasis-open.org/ws-sx/ws-trust/200512/RST/Issue',
  TOKEN_TYPE: 'http://docs.oasis-open.org/wss/oasis-wss-saml-token-profile-1.1#SAMLV1.1',
  REQUEST_TYPE: 'http://docs.oasis-open.org/ws-sx/ws-trust/200512/Issue',
  KEY_TYPE: 'http://docs.oasis-open.org/ws-sx/ws-trust/200512/SymmetricKey',
  PASSWORD_TYPE: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText',
} as const;

/**
 * Algorithms
 * @internal
 */
export const ALGORITHMS = {
  C14N: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  HMAC_SHA1: 'http://www.w3.org/2000/09/xmldsig#hmac-sha1',
  SHA1: 'http://www.w3.org/2000/09/xmldsig#sha1',
  SAML_ASSERTION_ID: 'http://docs.oasis-open.org/wss/oasis-wss-saml-token-profile-1.0#SAMLAssertionID',
} as const;

/**
 * Default timeout
 * @internal
 */
export const DEFAULT_TIMEOUT = 30000;
