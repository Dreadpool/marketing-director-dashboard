// Shared display formatters for the dashboard.
// Precision rules:
//  - Currency uses K/M shorthand for compact contexts (KPI cards, delta cells).
//    Switches to whole-unit at >=10K because trailing decimals on $746K read worse than they inform.
//    1 decimal between 1K-10K, where it actually carries information ($8.4K vs $8K).
//  - Percent always uses 1 decimal but trims a trailing .0 so round numbers stay clean (-5%, not -5.0%).
//  - All formatters short-circuit on non-finite input (NaN, Infinity from prior=0 deltas) so the cell
//    never renders a literal "Infinity%".

const NA = "—";

function isNum(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function trimZero(s: string): string {
  return s.replace(/\.0(?=\D|$)/, "");
}

export function formatCurrencyFull(n: number | null | undefined): string {
  if (!isNum(n)) return NA;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatCurrencyCompact(n: number | null | undefined, opts?: { signed?: boolean }): string {
  if (!isNum(n)) return NA;
  const signed = opts?.signed ?? false;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : signed ? "+" : "";

  if (abs >= 1_000_000) return `${sign}$${trimZero((abs / 1_000_000).toFixed(1))}M`;
  if (abs >= 100_000) return `${sign}$${Math.round(abs / 1000)}K`;
  if (abs >= 1000) return `${sign}$${trimZero((abs / 1000).toFixed(1))}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function formatCount(n: number | null | undefined, opts?: { signed?: boolean }): string {
  if (!isNum(n)) return NA;
  const signed = opts?.signed ?? false;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : signed ? "+" : "";
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatPct(n: number | null | undefined, opts?: { signed?: boolean }): string {
  if (!isNum(n)) return NA;
  const signed = opts?.signed ?? false;
  const sign = n > 0 && signed ? "+" : "";
  return `${sign}${trimZero(n.toFixed(1))}%`;
}

export function formatAvgTicket(n: number | null | undefined): string {
  if (!isNum(n)) return NA;
  return `$${n.toFixed(2)}`;
}
