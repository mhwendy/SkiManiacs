// RFC 4180 style parser: quoted fields may contain commas, newlines and "" escapes.
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const endRow = () => {
    row.push(field);
    field = '';
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

// Column order of the Android CSV import (docs: CsvUploadHandler.kt).
export const CSV_COLUMNS = [
  'title_sr',
  'title_en',
  'priceAmount',
  'currency',
  'category_sr',
  'category_en',
  'location_sr',
  'location_en',
  'startDate',
  'endDate',
  'description_sr',
  'description_en',
  'imageUrl',
  'imageUrl2',
  'imageUrl3',
  'imageUrl4',
  'imageUrl5',
  'availablePlaces',
  'applicationDeadline',
  'isPriceComingSoon',
] as const;
