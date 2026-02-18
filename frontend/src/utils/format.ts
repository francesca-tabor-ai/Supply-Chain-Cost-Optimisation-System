export const fmt = {
  currency: (v: number, digits = 0) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits }).format(v),

  number: (v: number, digits = 0) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(v),

  pct: (v: number, digits = 1) => `${v.toFixed(digits)}%`,

  date: (s: string) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
}
