const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  EUR: "€",
  GBP: "£",
  HKD: "HK$",
  JPY: "¥",
  SGD: "S$",
  USD: "$",
};

export function formatCost(micros: number, currency: string) {
  const code = currency.trim().toUpperCase() || "CNY";
  const amount = Number.isFinite(micros) ? micros / 1_000_000 : 0;
  const formatted = amount.toFixed(4);
  return `${CURRENCY_SYMBOLS[code] ?? `${code} `}${formatted}`;
}

export function formatCostSummary(micros: number, currency: string) {
  const code = currency.trim().toUpperCase() || "CNY";
  return `${code} ${formatCost(micros, code)}`;
}
