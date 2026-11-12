export const money = (v: number, digits?: number) => {
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(digits ?? 2)}M`;
  if (a >= 1e4) return `${s}$${(a / 1e3).toFixed(digits ?? 0)}K`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(digits ?? 1)}K`;
  return `${s}$${a.toFixed(digits ?? 0)}`;
};
export const moneyFull = (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
export const pct = (v: number, d = 1) => `${v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(d)}%`;
export const signedPct = (v: number, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(d)}%`;
export const int = (v: number) => Math.round(v).toLocaleString("en-US");
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
