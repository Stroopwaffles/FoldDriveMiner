export type NumberFormat = 'suffix' | 'scientific' | 'engineering';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa'];

/** Formats game numbers: 1,234 → "1.23K", up to Qa, then scientific. */
export function formatNumber(n: number, format: NumberFormat = 'suffix', decimals = 2): string {
  if (!Number.isFinite(n)) return '∞';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a < 1000) {
    // Small numbers: whole numbers stay whole, fractions get one decimal.
    const s = a < 10 && a % 1 !== 0 ? a.toFixed(1) : Math.floor(a).toString();
    return sign + s;
  }
  if (format === 'scientific' || (format === 'suffix' && a >= 1e18)) {
    const exp = Math.floor(Math.log10(a));
    return `${sign}${(a / 10 ** exp).toFixed(decimals)}e${exp}`;
  }
  const group = Math.floor(Math.log10(a) / 3);
  const scaled = a / 1000 ** group;
  if (format === 'engineering') {
    return `${sign}${scaled.toFixed(decimals)}e${group * 3}`;
  }
  return `${sign}${scaled.toFixed(decimals)}${SUFFIXES[group]}`;
}

/** "2h 05m", "3m 12s", "45s". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`;
  return `${sec}s`;
}
