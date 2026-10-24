import { QueryRequest } from './types';

/**
 * Query criteria after validation and normalization
 * @internal
 */
export interface NormalizedQuery {
  tcno: string;
  firstname: string;
  lastname: string;
  birthyear: string;
  birthmonth: string;
  birthday: string;
  serialno?: string;
}

/**
 * Check a TC Kimlik No (or Yabancı Kimlik No) against the official checksum algorithm
 *
 * @example
 * ```typescript
 * isValidTCKimlikNo('10000000146'); // true
 * isValidTCKimlikNo('12345678901'); // false
 * ```
 */
export function isValidTCKimlikNo(value: string): boolean {
  if (typeof value !== 'string' || !/^[1-9]\d{10}$/.test(value)) return false;

  const d = value.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  const eleventh = d.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;

  return d[9] === tenth && d[10] === eleventh;
}

/**
 * Uppercase a name the way NVİ stores it (Turkish locale, single spaces)
 * @internal
 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR');
}

function asText(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return typeof value === 'string' ? value.trim() : '';
}

function isProvided(value: unknown): boolean {
  return value !== undefined && value !== null && asText(value) !== '';
}

/**
 * Validate a request and return the list of problems (empty when valid)
 * @internal
 */
export function collectValidationErrors(
  request: QueryRequest,
  options: { validateChecksum?: boolean } = {}
): string[] {
  if (!request || typeof request !== 'object') {
    return ['request must be an object'];
  }

  const errors: string[] = [];
  const tcno = asText(request.tcno);

  if (!/^\d{11}$/.test(tcno)) {
    errors.push('tcno must be 11 digits');
  } else if (options.validateChecksum && !isValidTCKimlikNo(tcno)) {
    errors.push('tcno failed checksum validation');
  }

  if (typeof request.firstname !== 'string' || request.firstname.trim().length === 0) {
    errors.push('firstname is required');
  }

  if (typeof request.lastname !== 'string' || request.lastname.trim().length === 0) {
    errors.push('lastname is required');
  }

  if (!/^\d{4}$/.test(asText(request.birthyear))) {
    errors.push('birthyear must be 4 digits');
  }

  const hasMonth = isProvided(request.birthmonth);
  const hasDay = isProvided(request.birthday);

  if (hasMonth && !/^(0?[1-9]|1[0-2])$/.test(asText(request.birthmonth))) {
    errors.push('birthmonth must be 1-12');
  }

  if (hasDay && !/^(0?[1-9]|[12]\d|3[01])$/.test(asText(request.birthday))) {
    errors.push('birthday must be 1-31');
  }

  if (hasDay && !hasMonth) {
    errors.push('birthday requires birthmonth');
  }

  if (isProvided(request.serialno) && !/^[A-Za-z0-9]{1,20}$/.test(asText(request.serialno))) {
    errors.push('serialno must be alphanumeric');
  }

  return errors;
}

/**
 * Convert a validated request into the values sent to KPS
 * @internal
 */
export function normalizeRequest(request: QueryRequest): NormalizedQuery {
  const intOrZero = (value: unknown): string =>
    isProvided(value) ? String(parseInt(asText(value), 10)) : '0';

  const normalized: NormalizedQuery = {
    tcno: asText(request.tcno),
    firstname: normalizeName(request.firstname),
    lastname: normalizeName(request.lastname),
    birthyear: asText(request.birthyear),
    birthmonth: intOrZero(request.birthmonth),
    birthday: intOrZero(request.birthday),
  };

  if (isProvided(request.serialno)) {
    normalized.serialno = asText(request.serialno).toUpperCase();
  }

  return normalized;
}
