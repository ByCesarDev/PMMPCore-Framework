export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizePlayerName(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

export function randomId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
