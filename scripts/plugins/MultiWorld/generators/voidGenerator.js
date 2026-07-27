import { worldsData, generatedChunks, markWorldDataDirty } from "../state.js";

function initChunks(worldName) {
  if (!generatedChunks.has(worldName)) generatedChunks.set(worldName, new Set());
}

export function generateVoidChunk(dimension, cx, cz, worldName) {
  if (!worldsData.has(worldName)) return false;
  initChunks(worldName);
  const key = `${cx},${cz}`;
  if (generatedChunks.get(worldName).has(key)) return true;
  generatedChunks.get(worldName).add(key);
  markWorldDataDirty();
  return true;
}
