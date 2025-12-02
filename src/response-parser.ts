import { QueryResult, PersonType } from './types';
import { parseXML } from './utils';
import { ParseError } from './errors';

/**
 * Parse KPS service response
 * @internal
 */
export class ResponseParser {
  async parseResponse(responseXML: string): Promise<QueryResult> {
    try {
      const doc = await parseXML(responseXML);
      
      // Navigate through SOAP envelope structure
      const envelope = this.findElement(doc, 'Envelope') || this.findElement(doc, 's:Envelope');
      if (!envelope) {
        throw new ParseError('SOAP Envelope not found in response');
      }
      
      const body = this.findElement(envelope, 'Body') || this.findElement(envelope, 's:Body');
      if (!body) {
        throw new ParseError('SOAP Body not found in response');
      }
      
      const sorgulaResponse = this.findElement(body, 'SorgulaResponse');
      if (!sorgulaResponse) {
        throw new ParseError('SorgulaResponse not found in response');
      }
      
      const sorgulaResult = this.findElement(sorgulaResponse, 'SorgulaResult');
      if (!sorgulaResult) {
        throw new ParseError('SorgulaResult not found in response');
      }
      
      const doluBilesenler = this.findElement(sorgulaResult, 'DoluBilesenler');
      const preference = this.getPreferredBucket(doluBilesenler);
      const buckets = this.getBucketOrder(preference);
      
      for (const bucket of buckets) {
        const result = await this.parsePersonBucket(sorgulaResult, bucket, responseXML);
        if (result) return result;
      }

      return {
        status: false,
        code: 2,
        aciklama: 'Kayıt bulunamadı',
        raw: responseXML,
      };
    } catch (error: any) {
      throw new ParseError('Failed to parse service response', { error: error.message });
    }
  }

  private getPreferredBucket(doluBilesenler: any): PersonType {
    if (!doluBilesenler) return PersonType.TC_VATANDASI;
    const content = JSON.stringify(doluBilesenler).toLowerCase();
    
    if (content.includes('yabanci')) return PersonType.YABANCI;
    if (content.includes('tckisi') || content.includes('tcvatandasi')) return PersonType.TC_VATANDASI;
    if (content.includes('mavikart')) return PersonType.MAVI;
    return PersonType.TC_VATANDASI;
  }

  private getBucketOrder(preference: PersonType): Array<{ type: PersonType; path: string }> {
    const buckets = [
      { type: PersonType.TC_VATANDASI, path: 'TCVatandasiKisiKutukleri' },
      { type: PersonType.YABANCI, path: 'YabanciKisiKutukleri' },
      { type: PersonType.MAVI, path: 'MaviKartliKisiKutukleri' },
    ];
    const preferred = buckets.find(b => b.type === preference);
    return preferred ? [preferred, ...buckets.filter(b => b.type !== preference)] : buckets;
  }

  private async parsePersonBucket(
    sorgulaResult: any,
    bucket: { type: PersonType; path: string },
    rawXML: string
  ): Promise<QueryResult | null> {
    const doluBilesenler = this.findElement(sorgulaResult, 'DoluBilesenler');
    if (!doluBilesenler) return null;
    
    const kisiBilgisi = this.findElement(doluBilesenler, bucket.path, 'KisiBilgisi');
    if (!kisiBilgisi) return null;

    const durumBilgisi = this.findElement(kisiBilgisi, 'DurumBilgisi');
    const durum = this.findElement(durumBilgisi || kisiBilgisi, 'Durum');
    const kodStr = this.getValue(durum, 'Kod');
    if (!kodStr) return null;

    const code = parseInt(kodStr, 10);
    if (isNaN(code)) return null;

    const aciklama = this.getValue(durum, 'Aciklama') || '';
    const extra: Record<string, string> = {};

    const kimlikNo = this.getValue(kisiBilgisi, 'TCKimlikNo') || this.getValue(kisiBilgisi, 'KimlikNo');
    if (kimlikNo) extra.KimlikNo = kimlikNo;

    const temelBilgisi = this.findElement(kisiBilgisi, 'TemelBilgisi');
    if (temelBilgisi) {
      const ad = this.getValue(temelBilgisi, 'Ad');
      const soyad = this.getValue(temelBilgisi, 'Soyad');
      const uyruk = this.getValue(temelBilgisi, 'Uyruk');
      if (ad) extra.Ad = ad;
      if (soyad) extra.Soyad = soyad;
      if (uyruk) extra.Uyruk = uyruk;
    }

    const dogumTarih = this.findElement(durumBilgisi, 'DogumTarih');
    if (dogumTarih) {
      const birthDate = this.formatDate(
        this.getValue(dogumTarih, 'Yil'),
        this.getValue(dogumTarih, 'Ay'),
        this.getValue(dogumTarih, 'Gun')
      );
      if (birthDate) extra.DogumTarih = birthDate;
    }

    const olumTarih = this.findElement(durumBilgisi, 'OlumTarih');
    if (olumTarih) {
      const deathDate = this.formatDate(
        this.getValue(olumTarih, 'Yil'),
        this.getValue(olumTarih, 'Ay'),
        this.getValue(olumTarih, 'Gun')
      );
      if (deathDate) extra.OlumTarih = deathDate;
    }

    return {
      status: code === 1,
      code,
      aciklama,
      person: bucket.type,
      extra,
      raw: rawXML,
    };
  }

  private findElement(obj: any, ...path: string[]): any {
    if (!obj || typeof obj !== 'object') return null;
    let current = obj;
    
    for (const segment of path) {
      const lowerSegment = segment.toLowerCase();
      let found = false;
      
      // First try exact match (for namespace-prefixed elements like 's:Envelope')
      if (current[segment]) {
        current = current[segment];
        found = true;
      } else {
        // Then try case-insensitive match on local name (after colon)
        for (const key of Object.keys(current)) {
          const lowerKey = key.toLowerCase();
          const localName = lowerKey.split(':').pop() || lowerKey;
          if (localName === lowerSegment) {
            current = current[key];
            found = true;
            break;
          }
        }
      }
      
      if (!found) return null;
    }
    
    return current;
  }

  private getValue(obj: any, key: string): string {
    if (!obj) return '';
    const element = this.findElement(obj, key);
    if (!element) return '';
    if (element.$ && element.$['xsi:nil'] === 'true') return '';
    if (typeof element === 'string') return element.trim();
    if (element._ && typeof element._ === 'string') return element._.trim();
    return '';
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
