import { world } from "@minecraft/server";
import { JsonCodec } from "./db/JsonCodec.js";
import { WalLog } from "./db/WalLog.js";

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneForGet(value) {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "object") {
    try {
      return structuredClone(value);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  }
  return value;
}

/**
 * DatabaseManager — PMMPCore KV con caché LRU, buffer dirty y flush.
 * Único módulo que llama a world.get/setDynamicProperty (excepto getStats lectura global).
 *
 * Esquema de claves (suffix tras pmmpcore:):
 *   player:<name>, plugin:<name>, mw:index, mw:world:<name>, mw:chunks:<name>
 */
class DatabaseManager {
  /**
   * @param {{ cacheLimit?: number, wal?: boolean }} [options]
   */
  constructor(options = {}) {
    this.ns = "pmmpcore";
    this.cacheLimit = options.cacheLimit ?? 500;
    this.codec = new JsonCodec();
    /** @type {Map<string, unknown>} fullKey → valor vivo en caché */
    this._cache = new Map();
    /** @type {Set<string>} fullKeys pendientes de persistir */
    this._dirty = new Set();
    this._walEnabled = options.wal !== false;
    /** @type {WalLog | null} */
    this._wal = this._walEnabled ? new WalLog() : null;
  }

  _fullKey(suffix) {
    return `${this.ns}:${suffix}`;
  }

  _suffixFromFullKey(fullKey) {
    const p = `${this.ns}:`;
    return fullKey.startsWith(p) ? fullKey.slice(p.length) : fullKey;
  }

  /** Lectura directa del mundo (sin caché). */
  _readWorldRaw(fullKey) {
    try {
      return world.getDynamicProperty(fullKey);
    } catch (e) {
      console.error(`[DB] _readWorldRaw: ${e.message}`);
      return undefined;
    }
  }

  _decodeRaw(raw) {
    if (raw === undefined || raw === null) return null;
    try {
      return this.codec.decode(raw);
    } catch (e) {
      console.error(`[DB] decode: ${e.message}`);
      return null;
    }
  }

  /**
   * Persiste un suffix al mundo sin pasar por dirty (replay / interno).
   * @param {string} suffix
   * @param {unknown} value
   */
  _writeThrough(suffix, value) {
    const fullKey = this._fullKey(suffix);
    try {
      world.setDynamicProperty(fullKey, this.codec.encode(value));
      this._cache.delete(fullKey);
      this._cache.set(fullKey, value);
      this._dirty.delete(fullKey);
      return true;
    } catch (e) {
      console.error(`[DB] _writeThrough (${suffix}): ${e.message}`);
      return false;
    }
  }

  _touchCache(fullKey, value) {
    if (this._cache.delete(fullKey)) {
      /* mover al final (LRU) */
    }
    this._cache.set(fullKey, value);
    this._evictIfNeeded();
  }

  _evictIfNeeded() {
    while (this._cache.size > this.cacheLimit) {
      if (this._dirty.size > 0) {
        this.flush();
      }
      const k = this._cache.keys().next().value;
      if (!k) break;
      if (this._dirty.has(k)) {
        console.warn("[DB] cache over limit with dirty keys after flush; stopping eviction");
        break;
      }
      this._cache.delete(k);
    }
  }

  /** Reaplica WAL en disco si quedó un snapshot a medias. */
  replayWalIfAny() {
    if (!this._wal) return;
    const snap = this._wal.readAny();
    if (!snap?.length) return;
    console.log(`[DB] Replaying WAL (${snap.length} entries)...`);
    for (const { suffix, value } of snap) {
      try {
        this._writeThrough(suffix, value);
      } catch (e) {
        console.error(`[DB] WAL replay error: ${e.message}`);
      }
    }
    this._wal.clear();
  }

  /**
   * Persiste todas las claves dirty. Opcional: snapshot WAL al inicio.
   * @returns {boolean}
   */
  flush() {
    if (this._dirty.size === 0) {
      if (this._wal) this._wal.clear();
      return true;
    }

    const snapshot = [];
    for (const fullKey of this._dirty) {
      const suffix = this._suffixFromFullKey(fullKey);
      const value = this._cache.get(fullKey);
      snapshot.push({ suffix, value });
    }

    if (this._wal && snapshot.length > 0) {
      this._wal.writeSnapshot(snapshot);
    }

    let ok = true;
    for (const fullKey of Array.from(this._dirty)) {
      const suffix = this._suffixFromFullKey(fullKey);
      const value = this._cache.get(fullKey);
      try {
        world.setDynamicProperty(fullKey, this.codec.encode(value));
        this._dirty.delete(fullKey);
      } catch (e) {
        console.error(`[DB] flush error (${suffix}): ${e.message}`);
        ok = false;
      }
    }

    if (ok && this._wal) {
      this._wal.clear();
    }
    return ok;
  }

  // ─── API genérica ───────────────────────────────────────────────────────────

  /**
   * @param {string} key suffix (sin prefijo pmmpcore:)
   * @returns {unknown|null}
   */
  get(key) {
    const fullKey = this._fullKey(key);
    if (this._cache.has(fullKey)) {
      return cloneForGet(this._cache.get(fullKey));
    }
    const raw = this._readWorldRaw(fullKey);
    if (raw === undefined || raw === null) {
      return null;
    }
    const parsed = this._decodeRaw(raw);
    this._touchCache(fullKey, parsed);
    return cloneForGet(parsed);
  }

  /**
   * @param {string} key
   * @param {unknown} value
   */
  set(key, value) {
    const fullKey = this._fullKey(key);
    const prev = this._cache.has(fullKey) ? this._cache.get(fullKey) : undefined;
    if (prev !== undefined) {
      try {
        if (JSON.stringify(prev) === JSON.stringify(value)) {
          return true;
        }
      } catch {
        /* continue */
      }
    }
    this._touchCache(fullKey, value);
    this._dirty.add(fullKey);
    return true;
  }

  /**
   * Borrado inmediato en mundo + limpia caché y dirty.
   * @param {string} key
   */
  delete(key) {
    const fullKey = this._fullKey(key);
    this._cache.delete(fullKey);
    this._dirty.delete(fullKey);
    try {
      world.setDynamicProperty(fullKey, undefined);
      return true;
    } catch (e) {
      console.error(`[DB] delete error (${key}): ${e.message}`);
      return false;
    }
  }

  /**
   * @param {string} key
   */
  has(key) {
    const fullKey = this._fullKey(key);
    if (this._cache.has(fullKey)) return true;
    const raw = this._readWorldRaw(fullKey);
    return raw !== undefined && raw !== null;
  }

  // ─── Jugador ─────────────────────────────────────────────────────────────────

  getPlayerData(playerName) {
    const v = this.get(`player:${playerName}`);
    return v !== null && typeof v === "object" ? v : {};
  }

  setPlayerData(playerName, data) {
    return this.set(`player:${playerName}`, data);
  }

  // ─── Plugin ─────────────────────────────────────────────────────────────────

  getPluginData(pluginName, key = null) {
    const data = this.get(`plugin:${pluginName}`);
    const obj = data !== null && typeof data === "object" ? data : {};
    return key ? obj[key] : obj;
  }

  /**
   * @param {string} pluginName
   * @param {string|object} key
   * @param {unknown} [value]
   */
  setPluginData(pluginName, key, value = null) {
    const data = this.getPluginData(pluginName);
    if (typeof key === "object" && key !== null) {
      Object.assign(data, key);
    } else {
      data[key] = value;
    }
    return this.set(`plugin:${pluginName}`, data);
  }

  // ─── MultiWorld ────────────────────────────────────────────────────────────

  getWorldIndex() {
    const v = this.get("mw:index");
    return Array.isArray(v) ? v : [];
  }

  /** @param {string[]} names */
  setWorldIndex(names) {
    return this.set("mw:index", names);
  }

  getWorld(name) {
    return this.get(`mw:world:${name}`);
  }

  /** @param {string} name
   * @param {object} data */
  setWorld(name, data) {
    return this.set(`mw:world:${name}`, data);
  }

  deleteWorld(name) {
    this.delete(`mw:world:${name}`);
    this.delete(`mw:chunks:${name}`);
  }

  getChunks(name) {
    const v = this.get(`mw:chunks:${name}`);
    return Array.isArray(v) ? v : [];
  }

  /** @param {string} name
   * @param {string[]} chunks */
  setChunks(name, chunks) {
    return this.set(`mw:chunks:${name}`, chunks);
  }

  deleteChunks(name) {
    return this.delete(`mw:chunks:${name}`);
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  /**
   * Lista sufijos (sin prefijo pmmpcore:) de propiedades existentes o dirty cuyo fullKey empieza por pmmpcore:`prefix`.
   * @param {string} prefix p. ej. "rtable:players:rowmeta:"
   * @returns {string[]}
   */
  listPropertySuffixes(prefix) {
    const fullPrefix = this._fullKey(prefix);
    const out = new Set();
    try {
      for (const id of world.getDynamicPropertyIds()) {
        if (typeof id === "string" && id.startsWith(fullPrefix)) {
          out.add(this._suffixFromFullKey(id));
        }
      }
    } catch (e) {
      console.error(`[DB] listPropertySuffixes: ${e.message}`);
    }
    for (const fk of this._dirty) {
      if (fk.startsWith(fullPrefix)) {
        out.add(this._suffixFromFullKey(fk));
      }
    }
    return [...out];
  }

  getStats() {
    try {
      const allKeys = world.getDynamicPropertyIds();
      const pmmpFromWorld = new Set(allKeys.filter((k) => k.startsWith(`${this.ns}:`)));
      for (const fk of this._dirty) {
        pmmpFromWorld.add(fk);
      }
      let totalSize = 0;
      const keys = [];
      for (const fullKey of pmmpFromWorld) {
        const suffix = fullKey.replace(`${this.ns}:`, "");
        keys.push(suffix);
        if (this._dirty.has(fullKey) && this._cache.has(fullKey)) {
          try {
            totalSize += this.codec.encode(this._cache.get(fullKey)).length;
          } catch {
            totalSize += 0;
          }
        } else {
          const v = world.getDynamicProperty(fullKey);
          if (typeof v === "string") totalSize += v.length;
        }
      }
      return {
        totalKeys: pmmpFromWorld.size,
        estimatedSize: totalSize,
        keys,
        dirtyKeys: this._dirty.size,
      };
    } catch (e) {
      console.error(`[DB] getStats error: ${e.message}`);
      return { totalKeys: 0, estimatedSize: 0, keys: [], dirtyKeys: 0 };
    }
  }
}

export { DatabaseManager };
