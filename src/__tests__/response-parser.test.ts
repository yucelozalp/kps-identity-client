import { ResponseParser } from '../response-parser';
import { ParseError, ServiceError } from '../errors';
import { PersonType } from '../types';
import { buildServiceResponse, INVALID_SECURITY_FAULT } from './helpers/fixtures';

const parser = new ResponseParser();

describe('ResponseParser', () => {
  it('parses a verified Turkish citizen', async () => {
    const xml = buildServiceResponse([
      {
        kimlikNo: '10000000146',
        type: 'tc',
        ad: 'AHMET',
        soyad: 'YILMAZ',
        dogum: { yil: 1990, ay: 1, gun: 15 },
      },
    ]);

    expect(await parser.parseResponse(xml)).toEqual({
      status: true,
      code: 1,
      aciklama: 'Açık',
      person: PersonType.TC_VATANDASI,
      extra: { KimlikNo: '10000000146', Ad: 'AHMET', Soyad: 'YILMAZ', DogumTarih: '1990-01-15' },
      raw: xml,
    });
  });

  it('parses a foreigner with nationality', async () => {
    const xml = buildServiceResponse([
      {
        kimlikNo: '99000000042',
        type: 'yabanci',
        ad: 'JOHN',
        soyad: 'DOE',
        uyruk: 'ALMANYA',
        dogum: { yil: 1985 },
      },
    ]);
    const result = await parser.parseResponse(xml);

    expect(result.status).toBe(true);
    expect(result.person).toBe(PersonType.YABANCI);
    expect(result.extra).toEqual({
      KimlikNo: '99000000042',
      Ad: 'JOHN',
      Soyad: 'DOE',
      Uyruk: 'ALMANYA',
      DogumTarih: '1985',
    });
  });

  it('parses a blue card holder with country', async () => {
    const xml = buildServiceResponse([
      { kimlikNo: '10000000146', type: 'mavi', ulke: 'ALMANYA', dogum: { yil: 1970, ay: 5 } },
    ]);
    const result = await parser.parseResponse(xml);

    expect(result.person).toBe(PersonType.MAVI);
    expect(result.extra?.Ulke).toBe('ALMANYA');
    expect(result.extra?.DogumTarih).toBe('1970-05');
  });

  it('reports deceased persons as not verified', async () => {
    const xml = buildServiceResponse([
      {
        kimlikNo: '10000000146',
        type: 'tc',
        kod: 3,
        aciklama: 'Ölüm',
        dogum: { yil: 1930, ay: 2, gun: 3 },
        olum: { yil: 2020, ay: 12, gun: 1 },
      },
    ]);
    const result = await parser.parseResponse(xml);

    expect(result.status).toBe(false);
    expect(result.code).toBe(3);
    expect(result.extra?.OlumTarih).toBe('2020-12-01');
  });

  it('returns not found with the KPS reason when no registry has the person', async () => {
    const xml = buildServiceResponse([{ kimlikNo: '10000000146', type: 'none' }]);

    expect(await parser.parseResponse(xml)).toEqual({
      status: false,
      code: 2,
      aciklama: 'Kayıt bulunamadı.',
      hataBilgisi: { kod: 1, aciklama: 'Kayıt bulunamadı.' },
      raw: xml,
    });
  });

  it('surfaces record level errors', async () => {
    const xml = buildServiceResponse([
      { kimlikNo: '10000000146', type: 'none', hata: { kod: 5, aciklama: 'Kriter hatalı' } },
    ]);
    const result = await parser.parseResponse(xml);

    expect(result.status).toBe(false);
    expect(result.aciklama).toBe('Kriter hatalı');
    expect(result.hataBilgisi).toEqual({ kod: 5, aciklama: 'Kriter hatalı' });
  });

  it('throws a ServiceError for request level errors', async () => {
    const xml = buildServiceResponse([], { requestError: { kod: 9, aciklama: 'Yetkisiz erişim' } });

    await expect(parser.parseResponse(xml)).rejects.toThrow(ServiceError);
    await expect(parser.parseResponse(xml)).rejects.toMatchObject({
      message: 'KPS returned an error: Yetkisiz erişim',
      details: { hataBilgisi: { kod: 9, aciklama: 'Yetkisiz erişim' } },
    });
  });

  it('returns every record of a batch response in order', async () => {
    const xml = buildServiceResponse([
      { kimlikNo: '10000000146', type: 'tc' },
      { kimlikNo: '99000000042', type: 'none' },
      { kimlikNo: '11111111110', type: 'yabanci' },
    ]);
    const records = await parser.parseRecords(xml);

    expect(records.map((r) => [r.kimlikNo, r.result.status, r.result.person])).toEqual([
      ['10000000146', true, PersonType.TC_VATANDASI],
      ['99000000042', false, undefined],
      ['11111111110', true, PersonType.YABANCI],
    ]);
  });

  it('omits the raw response when asked to', async () => {
    const xml = buildServiceResponse([{ kimlikNo: '10000000146', type: 'tc' }]);
    const result = await parser.parseResponse(xml, { includeRaw: false });
    expect(result).not.toHaveProperty('raw', expect.anything());
  });

  it('throws a ServiceError for a SOAP fault delivered with HTTP 200', async () => {
    await expect(parser.parseResponse(INVALID_SECURITY_FAULT)).rejects.toMatchObject({
      name: 'ServiceError',
      message: 'Service request failed: An error occurred when verifying security for the message.',
      details: { fault: { subcode: 'a:InvalidSecurity' } },
    });
  });

  it('throws a ParseError for non-SOAP responses', async () => {
    await expect(parser.parseResponse('<html>Service Unavailable</html>')).rejects.toThrow(
      ParseError
    );
    await expect(parser.parseResponse('not xml')).rejects.toThrow(ParseError);
  });
});
