export function formatDate(value) {
  if (!value) return "Date not recorded";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}
export function daysUntil(value) {
  if (!value) return null;
  const target = new Date(value);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / 86400000);
}
export function safeText(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}
