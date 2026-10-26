/**
 * Utility functions for currency and numerical formatting.
 */

/**
 * Removes fractional rounding noise (e.g. .01 or .99 caused by dividing integer amounts by 3 or other slots and multiplying back).
 * Genuine decimals like .5, .25, .67 are preserved.
 */
export const cleanAmount = (val: number | string | null | undefined): number => {
  if (val === '' || val === undefined || val === null) return 0;
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) return 0;
  return Math.abs(num - Math.round(num)) < 0.15 ? Math.round(num) : num;
};

/**
 * Formats a monetary number for display in 'ru-RU' locale (e.g. "16 112 000" or "5 370 666,67"),
 * cleaning any negligible arithmetic rounding tail (like ,01 or ,99).
 */
export const formatPrice = (val: number | string | null | undefined): string => {
  if (val === '' || val === undefined || val === null) return '';
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) return '';
  const cleaned = cleanAmount(num);
  return new Intl.NumberFormat('ru-RU').format(cleaned);
};

/**
 * Parses user input into a clean numeric value or empty string.
 */
export const parsePrice = (str: string): number | '' => {
  const clean = str.replace(/\s/g, '').replace(/ /g, ''); // strip regular spaces and non-breaking spaces
  if (clean === '') return '';
  const digitsOnly = clean.replace(/[^\d]/g, '');
  if (digitsOnly === '') return '';
  const sanitized = digitsOnly.replace(/^0+(?=\d)/, '');
  const num = Number(sanitized);
  return isNaN(num) ? '' : num;
};
