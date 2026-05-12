export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function asObject(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return value;
}

export function normalizePlayerName(value) {
  return String(value ?? "").trim().toLowerCase();
}
