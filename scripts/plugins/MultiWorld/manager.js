import { world as mcWorld, system } from "@minecraft/server";
import { PMMPCore } from "../../PMMPCore.js";
import {
  worldsData, activeWorlds, lastActivity, generatedChunks,
  markWorldDataDirty, clearDirtyFlag, isWorldDataDirty,
} from "./state.js";
import {
  dimensionPool, WORLD_TYPES, FLAT_WORLD_TOP_Y, TOTAL_DIMENSIONS,
  MAX_ACTIVE_WORLDS, INACTIVE_TIMEOUT,
  resolveVanillaWorld,
} from "./config.js";

const MAIN_WORLD_DEFAULT = "overworld";
const MAIN_WORLD_CONFIG_KEY = "mainWorldTarget";

// ============== WORLD MANAGER ==============
export class WorldManager {
  static getMainWorldTarget() {
    const configured = PMMPCore.db?.getPluginData("MultiWorld", MAIN_WORLD_CONFIG_KEY);
    if (typeof configured !== "string" || !configured.trim()) return MAIN_WORLD_DEFAULT;
    return configured.trim();
  }

  static setMainWorldTarget(name) {
    if (!PMMPCore.db) throw new Error("Database is not initialized");
    return PMMPCore.db.setPluginData("MultiWorld", MAIN_WORLD_CONFIG_KEY, name);
  }

  static _getWorldByNameInsensitive(name) {
    const normalized = name.toLowerCase();
    for (const wd of worldsData.values()) {
      if (wd.id.toLowerCase() === normalized) return wd;
    }
    return null;
  }

  static resolveMainWorldDestination(excludedWorldName = null) {
    const target = this.getMainWorldTarget();
    const excluded = excludedWorldName?.toLowerCase() ?? null;
    const vanilla = resolveVanillaWorld(target);
    if (vanilla) {
      return {
        id: vanilla.id,
        spawn: vanilla.spawn,
        label: vanilla.label,
        isCustom: false,
      };
    }

    const custom = this._getWorldByNameInsensitive(target);
    if (custom && custom.id.toLowerCase() !== excluded) {
      return {
        id: custom.dimensionId,
        spawn: custom.spawn,
        label: custom.id,
        isCustom: true,
        worldName: custom.id,
      };
    }

    const fallback = resolveVanillaWorld(MAIN_WORLD_DEFAULT);
    return {
      id: fallback.id,
      spawn: fallback.spawn,
      label: fallback.label,
      isCustom: false,
      isFallback: true,
    };
  }

  static teleportPlayerToMainWorld(player, excludedWorldName = null) {
    const destination = this.resolveMainWorldDestination(excludedWorldName);
    try {
      if (destination.isCustom && destination.worldName) {
        RuntimeController.activateWorld(destination.worldName);
      }
      system.run(() => {
        const dimension = mcWorld.getDimension(destination.id);
        player.teleport(destination.spawn, { dimension });
      });
      return { ok: true, destination };
    } catch (e) {
      return { ok: false, error: e, destination };
    }
  }

  static createWorld(name, type, owner, dimensionNumber = null) {
    if (worldsData.has(name)) throw new Error(`World '${name}' already exists`);
    if (!Object.values(WORLD_TYPES).includes(type)) throw new Error(`World type '${type}' is not supported`);

    let targetDimension;
    if (dimensionNumber !== null) {
      if (dimensionNumber < 1 || dimensionNumber > TOTAL_DIMENSIONS)
        throw new Error(`Dimension number must be between 1 and ${TOTAL_DIMENSIONS}`);
      targetDimension = dimensionPool.find((d) => d.number === dimensionNumber);
      if (!targetDimension) throw new Error(`Dimension ${dimensionNumber} not found`);
      if (targetDimension.used) throw new Error(`Dimension ${dimensionNumber} is already in use`);
    } else {
      targetDimension = dimensionPool.find((d) => !d.used);
      if (!targetDimension) throw new Error(`No available dimensions. All ${TOTAL_DIMENSIONS} are in use`);
    }

    const defaultSpawnByType = {
      [WORLD_TYPES.NORMAL]: { x: 0, y: 72, z: 0 },
      [WORLD_TYPES.FLAT]: { x: 0, y: FLAT_WORLD_TOP_Y + 1, z: 0 },
      [WORLD_TYPES.SKYBLOCK]: { x: 0, y: 101, z: 0 },
      [WORLD_TYPES.VOID]: { x: 0, y: 64, z: 0 },
    };

    const worldData = {
      id: name,
      type,
      owner,
      loaded: false,
      dimensionId: targetDimension.id,
      dimensionNumber: targetDimension.number,
      spawn: defaultSpawnByType[type] ?? { x: 0, y: 64, z: 0 },
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };

    worldsData.set(name, worldData);
    targetDimension.used = true;
    markWorldDataDirty();
    console.log(`[MultiWorld] Created world '${name}' (${type}) in dimension ${targetDimension.number}`);
    return worldData;
  }

  static deleteWorld(name) {
    const worldData = worldsData.get(name);
    if (!worldData) throw new Error(`World '${name}' does not exist`);

    const dim = dimensionPool.find((d) => d.id === worldData.dimensionId);
    if (dim) dim.used = false;

    activeWorlds.delete(name);
    worldsData.delete(name);
    lastActivity.delete(name);
    generatedChunks.delete(name);

    if (PMMPCore.db) PMMPCore.db.deleteWorld(name);

    markWorldDataDirty();
    console.log(`[MultiWorld] Deleted world '${name}' — freed dimension ${worldData.dimensionNumber}`);
  }

  static getWorld(name)     { return worldsData.get(name); }
  static getAllWorlds()     { return Array.from(worldsData.values()); }
  static getWorldsByOwner(owner) { return Array.from(worldsData.values()).filter((w) => w.owner === owner); }

  /** Guarda todos los mundos y chunks en DynamicProperties (sharded, síncrono). */
  static flushWorldData() {
    if (!PMMPCore.db) { console.warn("[MultiWorld] Cannot flush: DB not initialized"); return false; }
    try {
      PMMPCore.db.setWorldIndex(Array.from(worldsData.keys()));
      for (const [name, data] of worldsData) PMMPCore.db.setWorld(name, data);
      for (const [name, set]  of generatedChunks) PMMPCore.db.setChunks(name, Array.from(set));
      clearDirtyFlag();
      return true;
    } catch (e) {
      console.error(`[MultiWorld] flushWorldData error: ${e.message}`);
      markWorldDataDirty();
      return false;
    }
  }

  /** Carga mundos y chunks desde DynamicProperties (sharded). */
  static loadWorldData() {
    const names = PMMPCore.db?.getWorldIndex();
    if (!names?.length) { console.log("[MultiWorld] No world index — starting fresh."); return; }

    worldsData.clear();
    generatedChunks.clear();

    for (const name of names) {
      const data = PMMPCore.db.getWorld(name);
      if (!data) { console.warn(`[MultiWorld] World '${name}' missing data, skipping`); continue; }

      if (!data.spawn) {
        if (data.type === WORLD_TYPES.FLAT) data.spawn = { x: 0, y: FLAT_WORLD_TOP_Y + 1, z: 0 };
        else if (data.type === WORLD_TYPES.SKYBLOCK) data.spawn = { x: 0, y: 101, z: 0 };
        else if (data.type === WORLD_TYPES.NORMAL) data.spawn = { x: 0, y: 72, z: 0 };
        else data.spawn = { x: 0, y: 64, z: 0 };
      }
      // Migrar mundos flat antiguos con spawn alto a la nueva altura negativa.
      if (data.type === WORLD_TYPES.FLAT && data.spawn.y > 0) data.spawn.y = FLAT_WORLD_TOP_Y + 1;

      worldsData.set(data.id, data);

      const dim = dimensionPool.find((d) => d.id === data.dimensionId);
      if (dim) dim.used = true;

      const chunks = PMMPCore.db.getChunks(name);
      generatedChunks.set(name, new Set(Array.isArray(chunks) ? chunks : []));
    }
    console.log(`[MultiWorld] Loaded ${worldsData.size} worlds.`);
  }
}

// ============== RUNTIME CONTROLLER ==============
export class RuntimeController {
  static activateWorld(name) {
    if (activeWorlds.size >= MAX_ACTIVE_WORLDS && !activeWorlds.has(name)) {
      const oldest = this.getLeastActiveWorld();
      if (oldest) this.deactivateWorld(oldest);
    }
    activeWorlds.add(name);
    lastActivity.set(name, Date.now());
    const data = WorldManager.getWorld(name);
    if (data) { data.loaded = true; data.lastUsed = Date.now(); markWorldDataDirty(); }
  }

  static deactivateWorld(name) {
    activeWorlds.delete(name);
    const data = WorldManager.getWorld(name);
    if (data) { data.loaded = false; markWorldDataDirty(); }
    console.log(`[MultiWorld] Deactivated world '${name}'`);
  }

  static updateActivity(name) {
    lastActivity.set(name, Date.now());
    const data = WorldManager.getWorld(name);
    if (data) { data.lastUsed = Date.now(); markWorldDataDirty(); }
  }

  static getLeastActiveWorld() {
    let oldest = null, oldestTime = Date.now();
    for (const [name, ts] of lastActivity) {
      if (ts < oldestTime) { oldestTime = ts; oldest = name; }
    }
    return oldest;
  }

  static cleanupInactiveWorlds() {
    const now = Date.now();
    for (const [name, ts] of lastActivity) {
      if (now - ts > INACTIVE_TIMEOUT) this.deactivateWorld(name);
    }
  }
}

// ============== PERSIST FLUSH ==============
export function requestPersistFlush(reason = "unknown") {
  if (!isWorldDataDirty()) return;
  const saved = WorldManager.flushWorldData();
  if (!saved) console.warn(`[MultiWorld] Persist flush failed (${reason}).`);
}
