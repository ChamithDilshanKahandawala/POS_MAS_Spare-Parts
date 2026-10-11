const nf = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatLKR(amount) {
  return `Rs. ${nf.format(Number(amount) || 0)}`;
}
