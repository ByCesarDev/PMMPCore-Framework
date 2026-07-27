// ============== ESTADO COMPARTIDO ==============
// Todos los Maps/Sets mutables del plugin viven aquí y se importan
// desde los demás módulos. Las exportaciones son referencias a los mismos objetos.

export const worldsData      = new Map(); // Map<string, WorldData>
export const activeWorlds    = new Set(); // Set<string>
export const lastActivity    = new Map(); // Map<string, number>
export const generatedChunks = new Map(); // Map<string, Set<string>>
export const dimensionToWorldName = new Map(); // Map<string, string>
export const cleanupLocks = new Map(); // Map<string, { mode: string, startedAt: number }>
export const cleanupDimensionLocks = new Map(); // Map<string, { mode: string, startedAt: number, worldName: string }>

let _dirty = false;

export function isWorldDataDirty()  { return _dirty; }
export function markWorldDataDirty() { _dirty = true; }
export function clearDirtyFlag()    { _dirty = false; }

export function rebuildDimensionIndex() {
  dimensionToWorldName.clear();
  for (const worldData of worldsData.values()) {
    if (typeof worldData?.dimensionId === "string" && worldData.dimensionId.length > 0) {
      dimensionToWorldName.set(worldData.dimensionId, worldData.id);
    }
  }
}

export function indexWorldDimension(worldData) {
  if (!worldData || typeof worldData.dimensionId !== "string" || worldData.dimensionId.length === 0) return;
  dimensionToWorldName.set(worldData.dimensionId, worldData.id);
}

export function unindexWorldDimension(worldData) {
  if (!worldData || typeof worldData.dimensionId !== "string" || worldData.dimensionId.length === 0) return;
  const mapped = dimensionToWorldName.get(worldData.dimensionId);
  if (mapped === worldData.id) {
    dimensionToWorldName.delete(worldData.dimensionId);
  }
}

export function getWorldNameByDimensionId(dimensionId) {
  if (typeof dimensionId !== "string" || dimensionId.length === 0) return null;
  return dimensionToWorldName.get(dimensionId) ?? null;
}

export function lockWorldCleanup(worldName, mode) {
  cleanupLocks.set(worldName, { mode: mode ?? "unknown", startedAt: Date.now() });
}

export function unlockWorldCleanup(worldName) {
  cleanupLocks.delete(worldName);
}

export function getCleanupLock(worldName) {
  return cleanupLocks.get(worldName) ?? null;
}

export function lockDimensionCleanup(dimensionId, mode, worldName = null) {
  if (typeof dimensionId !== "string" || !dimensionId.length) return;
  cleanupDimensionLocks.set(dimensionId, {
    mode: mode ?? "unknown",
    startedAt: Date.now(),
    worldName: worldName ?? null,
  });
}

export function unlockDimensionCleanup(dimensionId) {
  if (typeof dimensionId !== "string" || !dimensionId.length) return;
  cleanupDimensionLocks.delete(dimensionId);
}

export function getDimensionCleanupLock(dimensionId) {
  if (typeof dimensionId !== "string" || !dimensionId.length) return null;
  return cleanupDimensionLocks.get(dimensionId) ?? null;
}

// ============== POCKETMC REGION BUCKETING (32x32 CHUNKS) ==============
export const experimentalRegionCache = new Map(); // Map<worldName, Map<regionKey, Uint8Array(128)>>
export const dirtyRegionsQueue = new Set(); // Set<"<worldName>|<regionKey>">

export function getRegionKey(chunkX, chunkZ) {
  const rX = (chunkX >> 5);
  const rZ = (chunkZ >> 5);
  return `${rX}_${rZ}`;
}

export function getChunkBitIndex(chunkX, chunkZ) {
  const localX = (chunkX % 32 + 32) % 32;
  const localZ = (chunkZ % 32 + 32) % 32;
  return localX + (localZ * 32); // 0 .. 1023
}

export function isExperimentalChunkGenerated(worldName, chunkX, chunkZ) {
  const worldMap = experimentalRegionCache.get(worldName);
  if (!worldMap) return false;
  const regionKey = getRegionKey(chunkX, chunkZ);
  const bitset = worldMap.get(regionKey);
  if (!bitset) return false;
  const bitIdx = getChunkBitIndex(chunkX, chunkZ);
  const byteIdx = Math.floor(bitIdx / 8);
  const bitPos = bitIdx % 8;
  return (bitset[byteIdx] & (1 << bitPos)) !== 0;
}

export function markExperimentalChunkGenerated(worldName, chunkX, chunkZ) {
  let worldMap = experimentalRegionCache.get(worldName);
  if (!worldMap) {
    worldMap = new Map();
    experimentalRegionCache.set(worldName, worldMap);
  }
  const regionKey = getRegionKey(chunkX, chunkZ);
  let bitset = worldMap.get(regionKey);
  if (!bitset) {
    bitset = new Uint8Array(128); // 128 bytes = 1024 bits
    worldMap.set(regionKey, bitset);
  }
  const bitIdx = getChunkBitIndex(chunkX, chunkZ);
  const byteIdx = Math.floor(bitIdx / 8);
  const bitPos = bitIdx % 8;

  if ((bitset[byteIdx] & (1 << bitPos)) === 0) {
    bitset[byteIdx] |= (1 << bitPos);
    dirtyRegionsQueue.add(`${worldName}|${regionKey}`);
  }
}

export function encodeRegionBitset(uint8Array) {
  let hex = "";
  for (let i = 0; i < uint8Array.length; i++) {
    const byte = uint8Array[i];
    hex += (byte < 16 ? "0" : "") + byte.toString(16);
  }
  return hex;
}

export function decodeRegionBitset(hexStr) {
  if (typeof hexStr !== "string") return new Uint8Array(128);
  const len = Math.floor(hexStr.length / 2);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(hexStr.substring(i * 2, i * 2 + 2), 16) || 0;
  }
  return bytes;
}
