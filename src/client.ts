import axios, { AxiosInstance } from 'axios';
import { KPS_URLS, DEFAULT_TIMEOUT } from './constants';
import { KPSClientConfig, QueryRequest, QueryResult, STSArtifacts } from './types';
import { ResponseParser } from './response-parser';
import { buildSTSRequest, buildQueryBody, buildTimestamp, buildSignedInfo, buildSignature, buildServiceEnvelope } from './soap-builder';
import {
  canonicalizeXML,
  sha1Digest,
  hmacSha1,
  base64Encode,
  base64Decode,
  extractInnerXML,
} from './utils';
import {
  ValidationError,
  STSError,
  ServiceError,
  NetworkError,
  TimeoutError,
  AuthenticationError,
} from './errors';

/**
 * KPS Identity Verification Client
 * 
 * @example
 * ```typescript
 * import { KPSClient } from '@yucelozalp/kps-identity-client';
 * 
 * const client = new KPSClient({
 *   username: 'your_username',
 *   password: 'your_password',
 * });
 * 
 * const result = await client.verify({
 *   tcno: '12345678901',
 *   firstname: 'AHMET',
 *   lastname: 'YILMAZ',
 *   birthyear: '1990',
 * });
 * 
 * console.log(result.status); // true if verified
 * ```
 */
export class KPSClient {
  private httpClient: AxiosInstance;
  private username: string;
  private password: string;
  private responseParser: ResponseParser;
  private debug: boolean;

  /**
   * Create a new KPS client
   * @param config Client configuration
   */
  constructor(config: KPSClientConfig) {
    this.validateConfig(config);
    this.username = config.username;
    this.password = config.password;
    this.debug = config.debug || false;
    
    this.httpClient = axios.create({
      timeout: config.httpConfig?.timeout || DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        ...config.httpConfig?.headers,
      },
    });

    this.responseParser = new ResponseParser();
  }

  /**
   * Verify Turkish national identity
   * 
   * @param request Identity information to verify
   * @returns Verification result
   * 
   * @throws {ValidationError} If request parameters are invalid
   * @throws {AuthenticationError} If KPS credentials are invalid
   * @throws {STSError} If STS token service fails
   * @throws {ServiceError} If KPS service fails
   * @throws {NetworkError} If network connection fails
   * @throws {TimeoutError} If request times out
   * 
   * @example
   * ```typescript
   * const result = await client.verify({
   *   tcno: '12345678901',
   *   firstname: 'AHMET',
   *   lastname: 'YILMAZ',
   *   birthyear: '1990',
   *   birthmonth: '01',
   *   birthday: '15',
   * });
   * 
   * if (result.status) {
   *   console.log('Identity verified!');
   *   console.log('Person type:', result.person);
   *   console.log('Details:', result.extra);
   * } else {
   *   console.log('Not verified:', result.aciklama);
   * }
   * ```
   */
  async verify(request: QueryRequest): Promise<QueryResult> {
    this.validateRequest(request);

    const artifacts = await this.getSecurityToken();
    const bodyXML = buildQueryBody(request);
    const envelope = this.buildSignedEnvelope(artifacts, bodyXML);
    const responseXML = await this.callService(envelope);
    
    return await this.responseParser.parseResponse(responseXML);
  }

  private validateConfig(config: KPSClientConfig): void {
    if (!config.username || !config.password) {
      throw new ValidationError('KPS username and password are required');
    }
  }

  private validateRequest(request: QueryRequest): void {
    const errors: string[] = [];

    if (!request.tcno || !/^\d{11}$/.test(request.tcno)) {
      errors.push('tcno must be 11 digits');
    }

    if (!request.firstname || request.firstname.trim().length === 0) {
      errors.push('firstname is required');
    }

    if (!request.lastname || request.lastname.trim().length === 0) {
      errors.push('lastname is required');
    }

    if (!request.birthyear || !/^\d{4}$/.test(request.birthyear)) {
      errors.push('birthyear must be 4 digits');
    }

    if (request.birthmonth && !/^(0?[1-9]|1[0-2])$/.test(request.birthmonth)) {
      errors.push('birthmonth must be 1-12');
    }

    if (request.birthday && !/^(0?[1-9]|[12]\d|3[01])$/.test(request.birthday)) {
      errors.push('birthday must be 1-31');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid request parameters', { errors });
    }
  }

  private async getSecurityToken(): Promise<STSArtifacts> {
    const soapRequest = buildSTSRequest(this.username, this.password);

    if (this.debug) {
      console.log('[KPS Debug] STS Request:', soapRequest);
    }

    try {
      const response = await this.httpClient.post(KPS_URLS.STS, soapRequest);

      if (this.debug) {
        console.log('[KPS Debug] STS Response Status:', response.status);
        console.log('[KPS Debug] STS Response:', response.data);
      }

      if (response.status !== 200) {
        throw new STSError(`STS returned HTTP ${response.status}`);
      }

      return this.parseSTSResponse(response.data);
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new TimeoutError('STS request timed out');
      }

      if (error.response) {
        const responseData = typeof error.response.data === 'string' 
          ? error.response.data 
          : JSON.stringify(error.response.data);
        
        const authError = this.checkAuthenticationError(responseData);
        if (authError) throw authError;

        throw new STSError(`STS request failed: ${error.message}`, { response: error.response.data });
      }

      if (error.request) {
        throw new NetworkError('Failed to connect to STS service');
      }

      throw error;
    }
  }

  private parseSTSResponse(responseXML: string): STSArtifacts {
    const binarySecret = this.extractElementValue(responseXML, 'BinarySecret');
    if (!binarySecret) {
      throw new STSError('BinarySecret not found in STS response');
    }

    const keyIdentifier = this.extractElementValue(responseXML, 'KeyIdentifier');
    if (!keyIdentifier) {
      throw new STSError('KeyIdentifier not found in STS response');
    }

    const tokenXML = extractInnerXML(responseXML, 'RequestedSecurityToken');
    if (!tokenXML) {
      throw new STSError('RequestedSecurityToken not found in STS response');
    }

    return {
      binarySecretB64: binarySecret.trim(),
      tokenXML: tokenXML.trim(),
      assertionID: keyIdentifier.trim(),
    };
  }

  private extractElementValue(xml: string, tagName: string): string {
    const regex = new RegExp(`<[^:]*:?${tagName}[^>]*>([^<]*)<`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }

  private checkAuthenticationError(responseXml: string): AuthenticationError | null {
    if (!responseXml.includes('s:Fault') && !responseXml.includes('soap:Fault')) {
      return null;
    }

    const authPatterns = [
      /Invalid username\/password/i,
      /Authentication failed/i,
      /Kullanıcı adı veya parola hatalı/i,
      /Yetkilendirme hatası/i,
      /SecurityFaultContract/i,
    ];

    const isAuthError = authPatterns.some(pattern => pattern.test(responseXml));
    
    if (isAuthError) {
      const reasonMatch = responseXml.match(/<s:Text[^>]*>([^<]+)<\/s:Text>/i);
      const reason = reasonMatch ? reasonMatch[1].trim() : 'Invalid username/password';
      
      return new AuthenticationError(
        `KPS authentication failed: ${reason}. Please check your credentials.`,
        { hint: 'Verify that your KPS credentials are correct and active' }
      );
    }

    return null;
  }

  private buildSignedEnvelope(artifacts: STSArtifacts, bodyXML: string): string {
    const { xml: timestampXML, xmlForEnvelope: timestampXMLForEnvelope } = buildTimestamp();
    const canonicalTimestamp = canonicalizeXML(timestampXML);
    const timestampDigest = sha1Digest(canonicalTimestamp);
    const digestValue = base64Encode(timestampDigest);

    const { xml: signedInfoXML, xmlForSignature: signedInfoForSignature } = buildSignedInfo(digestValue);
    const canonicalSignedInfo = canonicalizeXML(signedInfoXML);
    const secretKey = base64Decode(artifacts.binarySecretB64);
    const signatureBytes = hmacSha1(secretKey, canonicalSignedInfo);
    const signatureValue = base64Encode(signatureBytes);

    const signature = buildSignature(signedInfoForSignature, signatureValue, artifacts.assertionID);

    return buildServiceEnvelope(timestampXMLForEnvelope, artifacts.tokenXML, signature, bodyXML);
  }

  private async callService(envelope: string): Promise<string> {
    if (this.debug) {
      console.log('[KPS Debug] Service Request:', envelope);
    }

    try {
      const response = await this.httpClient.post(KPS_URLS.QUERY, envelope);

      if (this.debug) {
        console.log('[KPS Debug] Service Response Status:', response.status);
        console.log('[KPS Debug] Service Response:', response.data);
      }

      if (response.status !== 200) {
        const faultMessage = this.extractFaultMessage(response.data);
        throw new ServiceError(
          `Service returned HTTP ${response.status}${faultMessage ? `: ${faultMessage}` : ''}`,
          { response: response.data }
        );
      }

      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new TimeoutError('Service request timed out');
      }

      if (error.response) {
        const responseData = typeof error.response.data === 'string' 
          ? error.response.data 
          : JSON.stringify(error.response.data);
        
        const faultMessage = this.extractFaultMessage(responseData);
        const errorMessage = faultMessage 
          ? `Service request failed: ${faultMessage}`
          : `Service request failed: ${error.message}`;
        
        throw new ServiceError(errorMessage, { 
          response: error.response.data,
          statusCode: error.response.status,
        });
      }

      if (error.request) {
        throw new NetworkError('Failed to connect to KPS service');
      }

      throw error;
    }
  }

  private extractFaultMessage(responseXml: string): string | null {
    if (!responseXml || typeof responseXml !== 'string') {
      return null;
    }

    // Try to extract fault reason/text from SOAP fault
    const faultPatterns = [
      /<s:Text[^>]*>([^<]+)<\/s:Text>/i,
      /<soap:Text[^>]*>([^<]+)<\/soap:Text>/i,
      /<faultstring[^>]*>([^<]+)<\/faultstring>/i,
      /<Reason[^>]*>.*?<Text[^>]*>([^<]+)<\/Text>.*?<\/Reason>/is,
    ];

    for (const pattern of faultPatterns) {
      const match = responseXml.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Try to extract fault code
    const faultCodePatterns = [
      /<s:Value[^>]*>([^<]+)<\/s:Value>/i,
      /<soap:Value[^>]*>([^<]+)<\/soap:Value>/i,
      /<faultcode[^>]*>([^<]+)<\/faultcode>/i,
    ];

    for (const pattern of faultCodePatterns) {
      const match = responseXml.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }
}
