import { QueryResult, PersonType, HataBilgisi } from './types';
import { parseSoapFault, parseXML, toArray } from './utils';
import { KPSError, ParseError, ServiceError } from './errors';

/**
 * One TumKutukDogrulamaBilgileri entry of a response
 * @internal
 */
export interface ParsedRecord {
  /** KimlikNo echoed by KPS for this entry, used to match batch results to requests */
  kimlikNo?: string;
  result: QueryResult;
}

const BUCKETS: Array<{ type: PersonType; path: string }> = [
  { type: PersonType.TC_VATANDASI, path: 'TCVatandasiKisiKutukleri' },
  { type: PersonType.YABANCI, path: 'YabanciKisiKutukleri' },
  { type: PersonType.MAVI, path: 'MaviKartliKisiKutukleri' },
];

/**
 * Parse KPS service response
 *
 * Layout (TumKutukDogrulaServis 2025/08/01):
 * Envelope > Body > SorgulaResponse > SorgulaResult > SorguSonucu > TumKutukDogrulamaBilgileri[]
 * @internal
 */
export class ResponseParser {
  /**
   * Parse a single-criteria response
   */
  async parseResponse(
    responseXML: string,
    options: { includeRaw?: boolean } = {}
  ): Promise<QueryResult> {
    const [record] = await this.parseRecords(responseXML, options);
    return record ? record.result : this.notFound(responseXML, options);
  }

  /**
   * Parse every record of a response, in response order
   *
   * @throws {ServiceError} If KPS reports a request-level error (SorgulaResult.HataBilgisi)
   * @throws {ParseError} If the response is not a SorgulaResponse
   */
  async parseRecords(
    responseXML: string,
    options: { includeRaw?: boolean } = {}
  ): Promise<ParsedRecord[]> {
    const raw = options.includeRaw === false ? undefined : responseXML;

    try {
      const doc = await parseXML(responseXML);

      const envelope = this.child(doc, 'Envelope');
      if (!envelope) {
        throw new ParseError('SOAP Envelope not found in response');
      }

      const body = this.child(envelope, 'Body');
      if (!body) {
        throw new ParseError('SOAP Body not found in response');
      }

      const sorgulaResponse = this.child(body, 'SorgulaResponse');
      if (!sorgulaResponse) {
        const fault = this.child(body, 'Fault') ? parseSoapFault(responseXML) : null;
        if (fault) {
          throw new ServiceError(
            `Service request failed: ${fault.reason || fault.subcode || fault.code}`,
            {
              fault,
              response: responseXML,
            }
          );
        }
        throw new ParseError('SorgulaResponse not found in response');
      }

      const sorgulaResult = this.child(sorgulaResponse, 'SorgulaResult');
      if (!sorgulaResult) {
        throw new ParseError('SorgulaResult not found in response');
      }

      const requestError = this.getHata(sorgulaResult);
      if (requestError) {
        throw new ServiceError(
          `KPS returned an error: ${requestError.aciklama || requestError.kod}`,
          {
            hataBilgisi: requestError,
            response: raw,
          }
        );
      }

      const sorguSonucu = this.child(sorgulaResult, 'SorguSonucu');
      // Older layouts put the record fields directly under SorgulaResult
      const records = sorguSonucu
        ? toArray(this.childRaw(sorguSonucu, 'TumKutukDogrulamaBilgileri'))
        : [sorgulaResult];

      return records
        .filter((record) => record && typeof record === 'object' && !this.isNil(record))
        .map((record) => this.parseRecord(record, raw));
    } catch (error: any) {
      if (error instanceof KPSError) throw error;
      throw new ParseError('Failed to parse service response', { error: error.message });
    }
  }

  /**
   * Result used when KPS returned no record for a criteria
   */
  notFound(responseXML: string, options: { includeRaw?: boolean } = {}): QueryResult {
    return {
      status: false,
      code: 2,
      aciklama: 'Kayıt bulunamadı',
      raw: options.includeRaw === false ? undefined : responseXML,
    };
  }

  private parseRecord(record: any, raw: string | undefined): ParsedRecord {
    const kimlikNo = this.getValue(record, 'KimlikNo') || undefined;
    const preference = this.getPreferredBucket(this.child(record, 'DoluBilesenler'));
    const buckets = [
      ...BUCKETS.filter((b) => b.type === preference),
      ...BUCKETS.filter((b) => b.type !== preference),
    ];

    for (const bucket of buckets) {
      const result = this.parsePersonBucket(record, bucket, raw);
      if (result) {
        return { kimlikNo: kimlikNo || result.extra?.KimlikNo, result };
      }
    }

    const hata = this.getHata(record) || this.findBucketHata(record, buckets);

    return {
      kimlikNo,
      result: {
        status: false,
        code: 2,
        aciklama: hata?.aciklama || 'Kayıt bulunamadı',
        ...(hata ? { hataBilgisi: hata } : {}),
        raw,
      },
    };
  }

  private getPreferredBucket(doluBilesenler: any): PersonType {
    const values = toArray(this.childRaw(doluBilesenler, 'CstTumKutukDogrulaServisDoluBilesen'))
      .map((v) => this.text(v).toLowerCase())
      .filter(Boolean);

    // Fall back to a loose match for unexpected serializations
    const candidates =
      values.length > 0 ? values : [JSON.stringify(doluBilesenler ?? '').toLowerCase()];

    for (const value of candidates) {
      if (value.includes('yabanci')) return PersonType.YABANCI;
      if (value.includes('mavikart')) return PersonType.MAVI;
      if (value.includes('tckisi') || value.includes('tcvatandasi')) return PersonType.TC_VATANDASI;
    }
    return PersonType.TC_VATANDASI;
  }

  private parsePersonBucket(
    record: any,
    bucket: { type: PersonType; path: string },
    raw: string | undefined
  ): QueryResult | null {
    const kisiBilgisi = this.child(this.child(record, bucket.path), 'KisiBilgisi');
    if (!kisiBilgisi) return null;

    const durumBilgisi = this.child(kisiBilgisi, 'DurumBilgisi');
    const durum = this.child(durumBilgisi || kisiBilgisi, 'Durum');
    const kodStr = this.getValue(durum, 'Kod');
    if (!kodStr) return null;

    const code = parseInt(kodStr, 10);
    if (isNaN(code)) return null;

    const aciklama = this.getValue(durum, 'Aciklama') || '';
    const extra: Record<string, string> = {};

    const kimlikNo =
      this.getValue(kisiBilgisi, 'TCKimlikNo') || this.getValue(kisiBilgisi, 'KimlikNo');
    if (kimlikNo) extra.KimlikNo = kimlikNo;

    const temelBilgisi = this.child(kisiBilgisi, 'TemelBilgisi');
    for (const field of ['Ad', 'Soyad', 'Uyruk', 'Ulke']) {
      const value = this.getValue(temelBilgisi, field);
      if (value) extra[field] = value;
    }

    for (const field of ['DogumTarih', 'OlumTarih']) {
      const date = this.child(durumBilgisi, field);
      const formatted = date
        ? this.formatDate(
            this.getValue(date, 'Yil'),
            this.getValue(date, 'Ay'),
            this.getValue(date, 'Gun')
          )
        : '';
      if (formatted) extra[field] = formatted;
    }

    const hata = this.getHata(kisiBilgisi);

    return {
      status: code === 1,
      code,
      aciklama,
      person: bucket.type,
      extra,
      ...(hata ? { hataBilgisi: hata } : {}),
      raw,
    };
  }

  private findBucketHata(record: any, buckets: Array<{ path: string }>): HataBilgisi | null {
    for (const bucket of buckets) {
      const kutuk = this.child(record, bucket.path);
      const hata = this.getHata(this.child(kutuk, 'KisiBilgisi')) || this.getHata(kutuk);
      if (hata) return hata;
    }
    return null;
  }

  private getHata(obj: any): HataBilgisi | null {
    const hata = this.child(obj, 'HataBilgisi');
    if (!hata) return null;

    const aciklama = this.getValue(hata, 'Aciklama');
    const kodStr = this.getValue(hata, 'Kod');
    const kod = kodStr ? parseInt(kodStr, 10) : NaN;
    if (!aciklama && isNaN(kod)) return null;

    return {
      ...(isNaN(kod) ? {} : { kod }),
      ...(aciklama ? { aciklama } : {}),
    };
  }

  private isNil(element: any): boolean {
    return Boolean(element && typeof element === 'object' && element.$ && element.$.nil === 'true');
  }

  /**
   * Child element value as returned by xml2js (may be an array), case-insensitive
   */
  private childRaw(obj: any, name: string): any {
    if (!obj || typeof obj !== 'object') return null;
    if (name in obj) return obj[name];
    const lowerName = name.toLowerCase();
    const key = Object.keys(obj).find((k) => k !== '$' && k.toLowerCase() === lowerName);
    return key === undefined ? null : obj[key];
  }

  /**
   * Single child element, null when absent or xsi:nil
   */
  private child(obj: any, name: string): any {
    const value = this.childRaw(obj, name);
    const element = Array.isArray(value) ? value[0] : value;
    if (element === undefined || element === null || this.isNil(element)) return null;
    return element;
  }

  private text(element: any): string {
    if (typeof element === 'string') return element.trim();
    if (element && typeof element._ === 'string') return element._.trim();
    return '';
  }

  private getValue(obj: any, key: string): string {
    return this.text(this.child(obj, key));
  }

  private formatDate(year?: string, month?: string, day?: string): string {
    if (!year) return '';
    const y = year.trim();
    const m = month?.trim();
    const d = day?.trim();

    if (!m && !d) return y;
    const paddedMonth = m ? m.padStart(2, '0') : '';
    const paddedDay = d ? d.padStart(2, '0') : '';

    if (!d) return `${y}-${paddedMonth}`;
    return `${y}-${paddedMonth}-${paddedDay}`;
  }
}
