export function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Kigali",
  }).format(
    new Date(
      value.includes("T") ? `${value}:00+02:00` : `${value}T12:00:00+02:00`,
    ),
  );
}
export function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
export function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Kigali",
  }).format(new Date(`${value}:00+02:00`));
}
export function matches(query: string, ...values: string[]) {
  return values.join(" ").toLowerCase().includes(query.trim().toLowerCase());
}
export const workflow = [
  "Draft",
  "Prepared",
  "Open",
  "Closed",
  "Pending certification",
  "Certified",
] as const;
