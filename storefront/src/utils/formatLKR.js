const nf = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatLKR(amount) {
  return `Rs. ${nf.format(Number(amount) || 0)}`;
}

// Just the grouped number, no "Rs." prefix — for translated sentences that
// already carry their own currency word/symbol (e.g. "රු. {{price}}") and
// interpolate the amount in via i18next.
export function formatAmount(amount) {
  return nf.format(Number(amount) || 0);
}
