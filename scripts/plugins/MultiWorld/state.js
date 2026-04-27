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
