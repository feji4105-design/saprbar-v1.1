/** Formatting only: never use the returned text in calculations or model serialization. */
export const DEFAULT_DECIMAL_PLACES = 3;
export function decimalPlaces(value: number): number {
  return Number.isInteger(value) && value >= 0 && value <= 12 ? value : DEFAULT_DECIMAL_PLACES;
}
const superscript = (text: string) => text.replace(/[-+\d]/g, c => ({'-':'⁻','+':'⁺','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'}[c]!));
export function formatNumber(value: number, places = DEFAULT_DECIMAL_PLACES, scientific = false): string {
  const digits = decimalPlaces(places);
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0'; // includes exact IEEE negative zero
  if (scientific || Math.abs(value) < 10 ** -digits || Math.abs(value) >= 1e9) {
    const [mantissa, exponent] = value.toExponential(digits).split('e');
    return `${mantissa!.replace('.', ',').replace('-', '−')} · 10${superscript(String(Number(exponent)))}`;
  }
  return new Intl.NumberFormat('ru-RU', {maximumFractionDigits: digits, useGrouping: false}).format(value).replace(/^-/, '−');
}
export function formatSigned(value: number, places = DEFAULT_DECIMAL_PLACES): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value, places)}`;
}
