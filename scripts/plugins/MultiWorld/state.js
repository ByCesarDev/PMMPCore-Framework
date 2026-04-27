// ============== ESTADO COMPARTIDO ==============
// Todos los Maps/Sets mutables del plugin viven aquí y se importan
// desde los demás módulos. Las exportaciones son referencias a los mismos objetos.

export const worldsData      = new Map(); // Map<string, WorldData>
export const activeWorlds    = new Set(); // Set<string>
export const lastActivity    = new Map(); // Map<string, number>
export const generatedChunks = new Map(); // Map<string, Set<string>>

let _dirty = false;

export function isWorldDataDirty()  { return _dirty; }
export function markWorldDataDirty() { _dirty = true; }
export function clearDirtyFlag()    { _dirty = false; }
