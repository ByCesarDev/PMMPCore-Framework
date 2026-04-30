function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePlayerName(name) {
  return String(name ?? "").trim().toLowerCase();
}

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function roundMoney(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export { clone, normalizePlayerName, nowUnix, roundMoney };
