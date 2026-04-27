import { world as mcWorld, system } from "@minecraft/server";
import { PMMPCore } from "../../PMMPCore.js";
import {
  worldsData, activeWorlds, lastActivity, generatedChunks,
  markWorldDataDirty, clearDirtyFlag, isWorldDataDirty,
  indexWorldDimension, unindexWorldDimension, rebuildDimensionIndex, getDimensionCleanupLock,
} from "./state.js";
import {
  dimensionPool, WORLD_TYPES, FLAT_WORLD_TOP_Y, TOTAL_DIMENSIONS,
  MAX_ACTIVE_WORLDS, INACTIVE_TIMEOUT,
  resolveVanillaWorld, VANILLA_WORLDS,
} from "./config.js";

const MAIN_WORLD_DEFAULT = "overworld";
const MAIN_WORLD_CONFIG_KEY = "mainWorldTarget";
const VANILLA_SPAWN_OVERRIDES_KEY = "vanillaSpawnOverrides";

// ============== WORLD MANAGER ==============
export class WorldManager {
  static getVanillaSpawn(vanillaId, fallbackSpawn = { x: 0, y: 64, z: 0 }) {
    const overrides = PMMPCore.db?.getPluginData("MultiWorld", VANILLA_SPAWN_OVERRIDES_KEY) ?? {};
    const stored = overrides?.[vanillaId];
    if (this._isValidSpawn(stored)) return stored;
    return this._isValidSpawn(fallbackSpawn) ? fallbackSpawn : { x: 0, y: 64, z: 0 };
  }

  static setVanillaSpawn(vanillaId, spawn) {
    if (!PMMPCore.db) throw new Error("Database is not initialized");
    if (!this._isValidSpawn(spawn)) throw new Error("Invalid spawn coordinates");

    const overrides = PMMPCore.db.getPluginData("MultiWorld", VANILLA_SPAWN_OVERRIDES_KEY) ?? {};
    overrides[vanillaId] = {
      x: Math.floor(spawn.x),
      y: Math.floor(spawn.y),
      z: Math.floor(spawn.z),
    };
    return PMMPCore.db.setPluginData("MultiWorld", VANILLA_SPAWN_OVERRIDES_KEY, overrides);
  }

  static _isValidLocation(loc) {
    return !!loc && Number.isFinite(loc.x) && Number.isFinite(loc.y) && Number.isFinite(loc.z);
  }

  static _isMainDestination(destination, mainDestination) {
    if (!destination || !mainDestination) return false;
    if (destination.id === mainDestination.id) return true;
    if (destination.worldName && mainDestination.worldName && destination.worldName === mainDestination.worldName) {
      return true;
    }
    return false;
  }

  static _getDestinationByDimensionId(dimensionId) {
    const custom = Array.from(worldsData.values()).find((w) => w.dimensionId === dimensionId);
    if (custom) {
      return {
        id: custom.dimensionId,
        spawn: this._isValidSpawn(custom.spawn) ? custom.spawn : { x: 0, y: 64, z: 0 },
        label: custom.id,
        isCustom: true,
        worldName: custom.id,
      };
    }

    const vanilla = Object.values(VANILLA_WORLDS).find((entry) => entry?.id === dimensionId);

    if (vanilla) {
      return {
        id: vanilla.id,
        spawn: this._resolveVanillaSpawn(vanilla),
        label: vanilla.label,
        isCustom: false,
      };
    }

    return null;
  }

  static getPlayerLastLocation(playerName) {
    const playerData = PMMPCore.db?.getPlayerData(playerName);
    const locationData = playerData?.multiWorld?.lastLocation;
    if (!locationData) return null;
    if (!this._isValidLocation(locationData.location)) return null;
    if (typeof locationData.dimensionId !== "string" || locationData.dimensionId.length === 0) return null;
    return locationData;
  }

  static savePlayerLastLocation(player) {
    if (!PMMPCore.db || !player?.name) return false;
    const dimensionId = player.dimension?.id;
    const location = player.location;
    if (typeof dimensionId !== "string" || !this._isValidLocation(location)) return false;

    const playerData = PMMPCore.db.getPlayerData(player.name);
    if (!playerData.multiWorld) playerData.multiWorld = {};

    const prev = playerData.multiWorld.lastLocation;
    const nextLocation = {
      x: Math.floor(location.x),
      y: Math.floor(location.y),
      z: Math.floor(location.z),
    };
    if (
      prev &&
      prev.dimensionId === dimensionId &&
      prev.location?.x === nextLocation.x &&
      prev.location?.y === nextLocation.y &&
      prev.location?.z === nextLocation.z
    ) {
      return true;
    }

    playerData.multiWorld.lastLocation = {
      dimensionId,
      location: nextLocation,
      updatedAt: Date.now(),
    };
    return PMMPCore.db.setPlayerData(player.name, playerData);
  }

  static teleportPlayerToPreferredJoinLocation(player) {
    const last = this.getPlayerLastLocation(player.name);
    if (!last) return { ok: false, reason: "no-last-location" };

    const destination = this._getDestinationByDimensionId(last.dimensionId);
    if (!destination) return { ok: false, reason: "unknown-dimension" };

    const mainDestination = this.resolveMainWorldDestination();
    if (this._isMainDestination(destination, mainDestination)) {
      return { ok: false, reason: "last-location-is-main" };
    }

    try {
      if (destination.isCustom && destination.worldName) {
        RuntimeController.activateWorld(destination.worldName);
      }

      system.run(() => {
        const dimension = mcWorld.getDimension(destination.id);
        let targetLocation = last.location;

        if (destination.isCustom && destination.worldName) {
          const worldData = this.getWorld(destination.worldName);
          const forceSpawnOnJoin = !!worldData?.forceSpawnOnJoin;
          if (forceSpawnOnJoin) {
            targetLocation = this._resolveSafeSpawnInDimension(dimension, worldData.spawn);
          } else if (!this._isValidLocation(targetLocation)) {
            targetLocation = this._resolveSafeSpawnInDimension(dimension, worldData.spawn);
          }
        } else if (destination.id === "minecraft:overworld") {
          if (!this._isValidLocation(targetLocation)) {
            targetLocation = this._resolveOverworldSpawnForPlayer(player, destination.spawn).spawn;
          }
        }

        player.teleport(targetLocation, { dimension });
      });

      return { ok: true, destination, reason: "restored-last-location" };
    } catch (error) {
      return { ok: false, reason: "teleport-failed", error };
    }
  }

  static _isValidSpawn(spawn) {
    if (!spawn) return false;
    if (!Number.isFinite(spawn.x) || !Number.isFinite(spawn.y) || !Number.isFinite(spawn.z)) return false;

    // Bedrock sometimes returns sentinel/invalid values (e.g. y=32767) before spawn is ready.
    const MIN_Y = -64;
    const MAX_Y = 320;
    if (spawn.y < MIN_Y || spawn.y > MAX_Y) return false;

    return true;
  }

  static _resolveVanillaSpawn(vanilla) {
    return this._resolveVanillaSpawnWithMeta(vanilla).spawn;
  }

  static _resolveVanillaSpawnWithMeta(vanilla) {
    const savedSpawn = this.getVanillaSpawn(vanilla.id, vanilla.spawn);
    const hasOverride = (
      savedSpawn.x !== vanilla.spawn.x ||
      savedSpawn.y !== vanilla.spawn.y ||
      savedSpawn.z !== vanilla.spawn.z
    );
    if (hasOverride) {
      return { spawn: savedSpawn, source: "saved-override" };
    }

    // For overworld, prefer the actual world default spawn instead of a fixed fallback.
    if (vanilla.id === "minecraft:overworld") {
      try {
        const defaultSpawn = mcWorld.getDefaultSpawnLocation?.();
        if (this._isValidSpawn(defaultSpawn)) {
          return { spawn: defaultSpawn, source: "world-default-spawn" };
        }
      } catch (_) {}

      // If world default spawn is unavailable/invalid, resolve a safe spawn at runtime.
      try {
        const overworld = mcWorld.getDimension("minecraft:overworld");
        const safeSpawn = this._resolveSafeSpawnInDimension(overworld, savedSpawn);
        if (this._isValidSpawn(safeSpawn)) {
          return { spawn: safeSpawn, source: "safe-scan-fallback" };
        }
      } catch (_) {}
    }

    return { spawn: savedSpawn, source: "fallback-config" };
  }

  static getResolvedVanillaSpawn(vanilla) {
    return this._resolveVanillaSpawnWithMeta(vanilla);
  }

  static _resolveOverworldSpawnForPlayer(player, fallbackSpawn) {
    // 1) Player personal spawnpoint when available.
    try {
      const playerSpawn = player?.getSpawnPoint?.();
      if (this._isValidSpawn(playerSpawn)) {
        return { spawn: playerSpawn, source: "player-spawn-point" };
      }
    } catch (_) {}

    // 2) World/global spawn + safe fallback chain.
    const vanillaOverworld = {
      id: "minecraft:overworld",
      spawn: fallbackSpawn ?? { x: 0, y: 64, z: 0 },
    };
    return this._resolveVanillaSpawnWithMeta(vanillaOverworld);
  }

  static _resolveSafeSpawnInDimension(dimension, preferredSpawn) {
    const fallback = this._isValidSpawn(preferredSpawn) ? preferredSpawn : { x: 0, y: 64, z: 0 };
    const x = Math.floor(fallback.x);
    const z = Math.floor(fallback.z);

    // Find the highest non-air/non-fluid block and place player one block above.
    for (let y = 320; y >= -64; y--) {
      const block = dimension.getBlock({ x, y, z });
      if (block === undefined) {
        // Chunk not ready yet; keep fallback to avoid invalid teleport targets.
        return fallback;
      }
      if (!block) continue;

      const typeId = block.typeId;
      if (
        typeId !== "minecraft:air" &&
        typeId !== "minecraft:cave_air" &&
        typeId !== "minecraft:void_air" &&
        typeId !== "minecraft:water" &&
        typeId !== "minecraft:lava"
      ) {
        return { x, y: y + 1, z };
      }
    }

    return fallback;
  }

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
        spawn: this._resolveVanillaSpawn(vanilla),
        label: vanilla.label,
        isCustom: false,
      };
    }

    const custom = this._getWorldByNameInsensitive(target);
    if (custom && custom.id.toLowerCase() !== excluded) {
      const customSpawn = this._isValidSpawn(custom.spawn) ? custom.spawn : { x: 0, y: 64, z: 0 };
      return {
        id: custom.dimensionId,
        spawn: customSpawn,
        label: custom.id,
        isCustom: true,
        worldName: custom.id,
      };
    }

    const fallback = resolveVanillaWorld(MAIN_WORLD_DEFAULT);
    return {
      id: fallback.id,
      spawn: this._resolveVanillaSpawn(fallback),
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
        let destinationId = destination.id;
        let targetSpawn = destination.spawn;

        if (!destination.isCustom && destination.id === "minecraft:overworld") {
          const resolved = this._resolveOverworldSpawnForPlayer(player, destination.spawn);
          destinationId = "minecraft:overworld";
          targetSpawn = resolved.spawn;
        }

        const dimension = mcWorld.getDimension(destinationId);

        if (destination.isCustom && destination.worldName) {
          const safeSpawn = this._resolveSafeSpawnInDimension(dimension, destination.spawn);
          targetSpawn = safeSpawn;

          const worldData = this.getWorld(destination.worldName);
          if (worldData && (
            worldData.spawn.x !== safeSpawn.x ||
            worldData.spawn.y !== safeSpawn.y ||
            worldData.spawn.z !== safeSpawn.z
          )) {
            worldData.spawn = safeSpawn;
            worldData.lastUsed = Date.now();
            markWorldDataDirty();
          }
        }

        player.teleport(targetSpawn, { dimension });
      });
      return { ok: true, destination };
    } catch (e) {
      return { ok: false, error: e, destination };
    }
  }

  static resolveWorldSpawnNow(worldName) {
    const worldData = this.getWorld(worldName);
    if (!worldData) return null;

    try {
      const dimension = mcWorld.getDimension(worldData.dimensionId);
      return this._resolveSafeSpawnInDimension(dimension, worldData.spawn);
    } catch (_) {
      return this._isValidSpawn(worldData.spawn) ? worldData.spawn : { x: 0, y: 64, z: 0 };
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
      if (getDimensionCleanupLock(targetDimension.id)) {
        throw new Error(`Dimension ${dimensionNumber} is currently locked by cleanup`);
      }
    } else {
      targetDimension = dimensionPool.find((d) => !d.used && !getDimensionCleanupLock(d.id));
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
    indexWorldDimension(worldData);
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
    unindexWorldDimension(worldData);
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
    rebuildDimensionIndex();
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
