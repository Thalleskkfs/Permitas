const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatPrice(cents: number) {
  return currencyFormatter.format(cents / 100);
}

// UTC fixo: a data renderizada no servidor e no cliente precisa ser idêntica.
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(isoDate: string) {
  return dateFormatter.format(new Date(isoDate));
}
