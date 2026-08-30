const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** "$12,450.00" — thousands separator included, always two decimals. */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}
