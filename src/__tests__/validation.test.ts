import {
  collectValidationErrors,
  isValidTCKimlikNo,
  normalizeName,
  normalizeRequest,
} from '../validation';

const valid = {
  tcno: '10000000146',
  firstname: 'AHMET',
  lastname: 'YILMAZ',
  birthyear: '1990',
};

describe('Validation', () => {
  describe('isValidTCKimlikNo', () => {
    it.each(['10000000146', '11111111110', '99000000042'])('accepts %s', (value) => {
      expect(isValidTCKimlikNo(value)).toBe(true);
    });

    it.each(['12345678901', '01234567890', '1000000014', '1000000014a', '10000000147'])(
      'rejects %s',
      (value) => {
        expect(isValidTCKimlikNo(value)).toBe(false);
      }
    );

    it('rejects non-string input', () => {
      expect(isValidTCKimlikNo(10000000146 as any)).toBe(false);
    });
  });

  describe('normalizeName', () => {
    it('uppercases with Turkish rules', () => {
      expect(normalizeName('ali')).toBe('ALİ');
      expect(normalizeName('ışık')).toBe('IŞIK');
      expect(normalizeName('çağrı şükrü öğün')).toBe('ÇAĞRI ŞÜKRÜ ÖĞÜN');
    });

    it('trims and collapses whitespace', () => {
      expect(normalizeName('  ahmet   can ')).toBe('AHMET CAN');
    });
  });

  describe('collectValidationErrors', () => {
    it('accepts a valid request', () => {
      expect(collectValidationErrors(valid)).toEqual([]);
    });

    it('accepts numeric birth fields', () => {
      expect(
        collectValidationErrors({ ...valid, birthyear: 1990, birthmonth: 1, birthday: 15 })
      ).toEqual([]);
    });

    it('reports every problem', () => {
      expect(
        collectValidationErrors({
          tcno: '123',
          firstname: ' ',
          lastname: '',
          birthyear: '90',
          birthmonth: '13',
          birthday: '32',
        })
      ).toEqual([
        'tcno must be 11 digits',
        'firstname is required',
        'lastname is required',
        'birthyear must be 4 digits',
        'birthmonth must be 1-12',
        'birthday must be 1-31',
      ]);
    });

    it('requires a month when a day is given', () => {
      expect(collectValidationErrors({ ...valid, birthday: '15' })).toEqual([
        'birthday requires birthmonth',
      ]);
    });

    it('rejects malformed serial numbers', () => {
      expect(collectValidationErrors({ ...valid, serialno: 'A12-B34' })).toEqual([
        'serialno must be alphanumeric',
      ]);
    });

    it('checks the checksum only when asked to', () => {
      const request = { ...valid, tcno: '12345678901' };
      expect(collectValidationErrors(request)).toEqual([]);
      expect(collectValidationErrors(request, { validateChecksum: true })).toEqual([
        'tcno failed checksum validation',
      ]);
    });

    it('rejects a missing request', () => {
      expect(collectValidationErrors(undefined as any)).toEqual(['request must be an object']);
    });
  });

  describe('normalizeRequest', () => {
    it('produces the values sent to KPS', () => {
      expect(
        normalizeRequest({
          tcno: ' 10000000146 ',
          firstname: 'iclal',
          lastname: 'güneş',
          birthyear: 1990,
          birthmonth: '01',
          birthday: '05',
          serialno: 'a12b34567',
        })
      ).toEqual({
        tcno: '10000000146',
        firstname: 'İCLAL',
        lastname: 'GÜNEŞ',
        birthyear: '1990',
        birthmonth: '1',
        birthday: '5',
        serialno: 'A12B34567',
      });
    });

    it('uses zero for missing month and day and omits the serial number', () => {
      const normalized = normalizeRequest(valid);
      expect(normalized.birthmonth).toBe('0');
      expect(normalized.birthday).toBe('0');
      expect(normalized).not.toHaveProperty('serialno');
    });
  });
});
