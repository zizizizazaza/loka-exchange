// Formatting helpers, same output as the prototype's (v2-exchange/app/index.html, "工具").

export const short = (h: string) => h.slice(0, 6) + '…' + h.slice(-4);

export const num = (n: number, d = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const usd = (n: number, d = 0) => '$' + num(n, d);

export const usdM = (n: number) =>
  n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : usd(n);

export const usdK = (n: number) => (n >= 1e6 ? '$' + n / 1e6 + 'M' : '$' + Math.round(n / 1e3) + 'K');

export const pct = (n: number, d = 1) => (n * 100).toFixed(d) + '%';

export const px = (n: number) => n.toFixed(4);

export const fmtD = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const sgn = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : '');

/** Month i after date s: "Apr 2026", or "2026-04-05" when iso is true. */
export const mon = (s: string, i: number, iso = false) => {
  const d = new Date(s + 'T00:00:00');
  d.setMonth(d.getMonth() + i);
  return iso
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

/** Deterministic fake hash from a seed, used for sample transaction and contract links. */
export function hx(seed: string, len = 64) {
  let h = 2166136261;
  let out = '';
  let i = 0;
  while (out.length < len) {
    for (const c of seed + '|' + i++) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    out += (h >>> 0).toString(16).padStart(8, '0');
  }
  return '0x' + out.slice(0, len);
}

/** "a"/"an" plus the word. */
export const withArticle = (b: string) => (/^[aeiouAEIOU]/.test(b) ? 'an ' : 'a ') + b;
