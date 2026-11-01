export type OfferInput = {
  title_sr: string;
  title_en: string | null;
  description_sr: string | null;
  description_en: string | null;
  category_sr: string | null;
  category_en: string | null;
  location_sr: string | null;
  location_en: string | null;
  priceAmount: number | null;
  currency: 'EUR' | 'RSD';
  isPriceComingSoon: boolean;
  startDate: string | null;
  endDate: string | null;
  applicationDeadline: string | null;
  availablePlaces: number | null;
  images: string[];
};

export class ValidationError extends Error {}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

// Accepts yyyy-MM-dd, dd.MM.yyyy[.] and Excel serial dates, like the Android importer.
export function normalizeDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (value === '') return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    if (!isRealDate(+iso[1], +iso[2], +iso[3])) {
      throw new ValidationError(`Invalid date: '${value}'`);
    }
    return value;
  }
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(value);
  if (dmy) {
    const [day, month, year] = [+dmy[1], +dmy[2], +dmy[3]];
    if (!isRealDate(year, month, day)) {
      throw new ValidationError(`Invalid date: '${value}'`);
    }
    return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  }
  if (/^\d+(\.\d+)?$/.test(value)) {
    const days = Math.trunc(Number(value));
    const date = new Date(Date.UTC(1899, 11, 30) + days * 86_400_000);
    if (days > 0 && days < 100_000) return date.toISOString().slice(0, 10);
  }
  throw new ValidationError(
    `Invalid date format: '${value}'. Use yyyy-MM-dd, dd.MM.yyyy or an Excel date serial`,
  );
}

function normalizeBoolean(raw: unknown, field: string): boolean {
  if (raw === undefined || raw === null || raw === '') return false;
  if (typeof raw === 'boolean') return raw;
  const value = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'da'].includes(value)) return true;
  if (['0', 'false', 'no', 'n', 'ne'].includes(value)) return false;
  throw new ValidationError(`${field} must be true/false`);
}

function optionalText(raw: unknown, field: string, max: number) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    throw new ValidationError(`${field} must be text`);
  }
  const value = raw.trim();
  if (value.length > max) throw new ValidationError(`${field} is too long`);
  return value === '' ? null : value;
}

function imageUrl(raw: unknown, field: string): string | null {
  const value = optionalText(raw, field, 2000);
  if (value === null) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError(`${field} must be a valid URL`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ValidationError(`${field} must be an http(s) URL`);
  }
  return value;
}

const IMAGE_FIELDS = [
  'imageUrl',
  'imageUrl2',
  'imageUrl3',
  'imageUrl4',
  'imageUrl5',
] as const;

// Validates an offer from JSON or from CSV strings; both share this path.
export function parseOfferInput(raw: Record<string, unknown>): OfferInput {
  const titleSr = optionalText(raw.title_sr, 'title_sr', 200);
  if (!titleSr) throw new ValidationError('Title (Serbian) is required');

  const comingSoon = normalizeBoolean(
    raw.isPriceComingSoon,
    'isPriceComingSoon',
  );

  let priceAmount: number | null = null;
  const rawPrice = raw.priceAmount;
  if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
    const parsed =
      typeof rawPrice === 'number'
        ? rawPrice
        : Number(String(rawPrice).trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new ValidationError('priceAmount must be a number');
    }
    priceAmount = parsed;
  } else if (!comingSoon) {
    throw new ValidationError('priceAmount must be a number');
  }

  const currencyRaw =
    typeof raw.currency === 'string' && raw.currency.trim() !== ''
      ? raw.currency.trim().toUpperCase()
      : 'EUR';
  if (currencyRaw !== 'EUR' && currencyRaw !== 'RSD') {
    throw new ValidationError('currency must be EUR or RSD');
  }

  let availablePlaces: number | null = null;
  const rawPlaces = raw.availablePlaces;
  if (rawPlaces !== undefined && rawPlaces !== null && rawPlaces !== '') {
    const text = String(rawPlaces).trim();
    if (!/^\d{1,6}$/.test(text)) {
      throw new ValidationError('availablePlaces must be an integer');
    }
    availablePlaces = Number(text);
  }

  const startDate = normalizeDate(raw.startDate);
  const endDate = normalizeDate(raw.endDate);
  if (startDate && endDate && endDate < startDate) {
    throw new ValidationError('endDate must not be before startDate');
  }

  const images = IMAGE_FIELDS.map((field) =>
    imageUrl(raw[field], field),
  ).filter((url): url is string => url !== null);

  return {
    title_sr: titleSr,
    title_en: optionalText(raw.title_en, 'title_en', 200),
    description_sr: optionalText(raw.description_sr, 'description_sr', 5000),
    description_en: optionalText(raw.description_en, 'description_en', 5000),
    category_sr: optionalText(raw.category_sr, 'category_sr', 200),
    category_en: optionalText(raw.category_en, 'category_en', 200),
    location_sr: optionalText(raw.location_sr, 'location_sr', 200),
    location_en: optionalText(raw.location_en, 'location_en', 200),
    priceAmount,
    currency: currencyRaw,
    isPriceComingSoon: comingSoon,
    startDate,
    endDate,
    applicationDeadline: normalizeDate(raw.applicationDeadline),
    availablePlaces,
    images,
  };
}
