class PlaceholderService {
  constructor(options = {}) {
    this.logger = options.logger ?? console;
    this.config = options.config ?? {};
    this.expansions = new Map();
    this.aliasMap = new Map();
    this.cache = new Map();
    this.placeholderRegex = /%([a-z0-9_]+)%/gi;
  }

  setConfig(nextConfig = {}) {
    this.config = nextConfig;
    this.cache.clear();
  }

  registerExpansion(expansion, aliases = []) {
    if (!expansion?.identifier) {
      throw new Error("Expansion identifier is required.");
    }
    const identifier = String(expansion.identifier).toLowerCase();
    this.expansions.set(identifier, expansion);
    this.aliasMap.set(identifier, identifier);
    for (const alias of aliases) {
      this.aliasMap.set(String(alias).toLowerCase(), identifier);
    }
    return true;
  }

  unregisterExpansion(identifier) {
    const id = String(identifier ?? "").toLowerCase();
    if (!id) return false;
    const removed = this.expansions.delete(id);
    this.aliasMap.delete(id);
    for (const [alias, target] of [...this.aliasMap.entries()]) {
      if (target === id) this.aliasMap.delete(alias);
    }
    return removed;
  }

  listExpansions() {
    return [...this.expansions.values()].map((expansion) => ({
      identifier: expansion.identifier,
      version: expansion.version ?? "1.0.0",
      author: expansion.author ?? "unknown",
    }));
  }

  parse(text, player = null, context = {}) {
    if (typeof text !== "string" || text.length === 0) return "";
    const maxLength = Number(this.config?.maxParseInputLength ?? 240);
    const input = text.length > maxLength ? text.slice(0, maxLength) : text;
    return input.replace(this.placeholderRegex, (full, tokenRaw) => this.resolveToken(full, String(tokenRaw), player, context));
  }

  resolveToken(full, tokenRaw, player, context) {
    const token = String(tokenRaw ?? "").toLowerCase();
    const cached = this.getCached(token, player);
    if (cached !== null) return cached;

    const [identifier, key] = this.parseToken(token);
    const resolvedIdentifier = this.aliasMap.get(identifier) ?? identifier;
    const expansion = this.expansions.get(resolvedIdentifier);
    if (!expansion) return full;

    try {
      const result = expansion.onPlaceholderRequest(player, key, context);
      if (result === null || result === undefined) return full;
      const text = String(result);
      this.setCached(token, player, text, resolvedIdentifier);
      return text;
    } catch (error) {
      this.logger?.warn?.(`[PlaceholderAPI] Expansion '${resolvedIdentifier}' failed for '${token}': ${error?.message ?? "unknown error"}`);
      return full;
    }
  }

  parseToken(token) {
    const parts = token.split("_");
    if (parts.length >= 2) {
      const identifier = parts[0];
      const key = parts.slice(1).join("_");
      if (this.expansions.has(identifier) || this.aliasMap.has(identifier)) {
        return [identifier, key];
      }
    }
    return ["general", token];
  }

  getCached(token, player) {
    const key = this.buildCacheKey(token, player);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  setCached(token, player, value, identifier) {
    const ttl = this.resolveTtl(identifier);
    if (ttl <= 0) return;
    const key = this.buildCacheKey(token, player);
    this.cache.set(key, { value, expiresAt: Date.now() + ttl });
  }

  resolveTtl(identifier) {
    const map = this.config?.cacheTtl ?? {};
    if (identifier === "player") return Number(map.playerMs ?? 0);
    if (identifier === "server") return Number(map.serverMs ?? 0);
    if (identifier === "time") return Number(map.timeMs ?? 0);
    return Number(map.generalMs ?? 0);
  }

  buildCacheKey(token, player) {
    const playerId = player?.id ?? player?.name ?? "global";
    return `${playerId}:${token}`;
  }
}

export { PlaceholderService };
