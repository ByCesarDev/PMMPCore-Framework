import { world } from "@minecraft/server";

/**
 * DatabaseManager — PMMPCore v2
 *
 * Persiste datos en world.getDynamicProperty / world.setDynamicProperty.
 * Cada "registro" va en su propia clave para evitar el límite de ~32 767 chars
 * por propiedad. Todas las operaciones de escritura son SÍNCRONAS.
 *
 * Esquema de claves:
 *   pmmpcore:player:<name>      → datos del jugador (objeto JSON)
 *   pmmpcore:plugin:<name>      → datos del plugin  (objeto JSON)
 *   pmmpcore:mw:index           → array JSON con los nombres de mundos registrados
 *   pmmpcore:mw:world:<name>    → WorldData JSON de ese mundo
 *   pmmpcore:mw:chunks:<name>   → array JSON de chunk-keys del mundo
 */
class DatabaseManager {
  constructor() {
    this.ns = "pmmpcore";
  }

  // ─── Primitivas ──────────────────────────────────────────────────────────────

  _key(suffix) {
    return `${this.ns}:${suffix}`;
  }

  /** Lee una clave y devuelve el objeto parseado, o null si no existe. */
  _read(suffix) {
    try {
      const raw = world.getDynamicProperty(this._key(suffix));
      if (raw === undefined || raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error(`[DB] _read error (${suffix}): ${e.message}`);
      return null;
    }
  }

  /** Escribe un valor JSON en una clave (síncrono). Devuelve true si OK. */
  _write(suffix, value) {
    try {
      world.setDynamicProperty(this._key(suffix), JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[DB] _write error (${suffix}): ${e.message}`);
      return false;
    }
  }

  /** Elimina una clave. */
  _delete(suffix) {
    try {
      world.setDynamicProperty(this._key(suffix), undefined);
      return true;
    } catch (e) {
      console.error(`[DB] _delete error (${suffix}): ${e.message}`);
      return false;
    }
  }

  // ─── API genérica (compatibilidad con código existente) ──────────────────────

  /** Obtiene el valor de una clave arbitraria bajo el namespace. */
  get(key) {
    return this._read(key);
  }

  /** Guarda el valor de una clave arbitraria (síncrono). */
  set(key, value) {
    return this._write(key, value);
  }

  /** Elimina una clave arbitraria. */
  delete(key) {
    return this._delete(key);
  }

  /** ¿Existe la clave? */
  has(key) {
    return this._read(key) !== null;
  }

  // ─── Helpers de jugador ───────────────────────────────────────────────────────

  getPlayerData(playerName) {
    return this._read(`player:${playerName}`) || {};
  }

  setPlayerData(playerName, data) {
    return this._write(`player:${playerName}`, data);
  }

  // ─── Helpers de plugin (EconomyAPI, etc.) ────────────────────────────────────

  getPluginData(pluginName, key = null) {
    const data = this._read(`plugin:${pluginName}`) || {};
    return key ? data[key] : data;
  }

  /**
   * setPluginData(pluginName, key, value)  — asigna una sub-clave
   * setPluginData(pluginName, obj)          — merge de un objeto
   */
  setPluginData(pluginName, key, value = null) {
    const data = this.getPluginData(pluginName);
    if (typeof key === "object" && key !== null) {
      Object.assign(data, key);
    } else {
      data[key] = value;
    }
    return this._write(`plugin:${pluginName}`, data);
  }

  // ─── API de MultiWorld (sharded) ─────────────────────────────────────────────

  /**
   * Devuelve el array de nombres de mundos registrados.
   * @returns {string[]}
   */
  getWorldIndex() {
    return this._read("mw:index") || [];
  }

  /**
   * Guarda el array de nombres de mundos.
   * @param {string[]} names
   */
  setWorldIndex(names) {
    return this._write("mw:index", names);
  }

  /**
   * Obtiene los datos de un mundo concreto.
   * @param {string} name
   */
  getWorld(name) {
    return this._read(`mw:world:${name}`);
  }

  /**
   * Guarda los datos de un mundo concreto (síncrono).
   * @param {string} name
   * @param {object} data
   */
  setWorld(name, data) {
    return this._write(`mw:world:${name}`, data);
  }

  /**
   * Elimina los datos de un mundo (síncrono).
   * @param {string} name
   */
  deleteWorld(name) {
    this._delete(`mw:world:${name}`);
    this._delete(`mw:chunks:${name}`);
  }

  /**
   * Obtiene el array de chunk-keys generados para un mundo.
   * @param {string} name
   * @returns {string[]}
   */
  getChunks(name) {
    return this._read(`mw:chunks:${name}`) || [];
  }

  /**
   * Guarda el array de chunk-keys de un mundo (síncrono).
   * @param {string} name
   * @param {string[]} chunks
   */
  setChunks(name, chunks) {
    return this._write(`mw:chunks:${name}`, chunks);
  }

  /**
   * Elimina los chunks de un mundo.
   * @param {string} name
   */
  deleteChunks(name) {
    return this._delete(`mw:chunks:${name}`);
  }

  // ─── Estadísticas ─────────────────────────────────────────────────────────────

  getStats() {
    try {
      const allKeys = world.getDynamicPropertyIds();
      const pmmpKeys = allKeys.filter((k) => k.startsWith(`${this.ns}:`));
      let totalSize = 0;
      for (const k of pmmpKeys) {
        const v = world.getDynamicProperty(k);
        if (typeof v === "string") totalSize += v.length;
      }
      return {
        totalKeys: pmmpKeys.length,
        estimatedSize: totalSize,
        keys: pmmpKeys.map((k) => k.replace(`${this.ns}:`, "")),
      };
    } catch (e) {
      console.error(`[DB] getStats error: ${e.message}`);
      return { totalKeys: 0, estimatedSize: 0, keys: [] };
    }
  }
}

export { DatabaseManager };
