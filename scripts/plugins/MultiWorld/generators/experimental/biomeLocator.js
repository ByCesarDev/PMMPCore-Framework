/**
 * 1.16.220 Experimental Biome Locator Engine
 * Computes math spiral search in RAM over Multi-Noise climate grid
 */
import { worldsData } from "../../state.js";
import { MultiNoiseEvaluator3D } from "./noise.js";
import { resolveBiomeFromMultiNoise, BIOMES_116 } from "./biomes.js";

function stringHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function getAvailableExperimentalBiomeIds() {
  return Object.keys(BIOMES_116);
}

export function locateExperimentalBiome(worldName, originPos, targetBiomeId, maxRadius = 6000, step = 32) {
  const wd = worldsData.get(worldName);
  if (!wd) return null;

  const targetId = targetBiomeId.toLowerCase().trim();
  const available = getAvailableExperimentalBiomeIds();
  if (!available.includes(targetId)) {
    return { error: "INVALID_BIOME", available };
  }

  const seed = (wd && Number.isFinite(wd.seed)) ? wd.seed : stringHash(worldName);
  const multiNoise = new MultiNoiseEvaluator3D(seed + 4004);

  const startX = Math.floor(originPos.x);
  const startZ = Math.floor(originPos.z);

  // Algoritmo de Espiral en expansión por capas de radio
  for (let r = step; r <= maxRadius; r += step) {
    // Recorrer el borde del cuadrado de radio r
    for (let dx = -r; dx <= r; dx += step) {
      // Borde Superior e Inferior
      for (const dz of [-r, r]) {
        const x = startX + dx;
        const z = startZ + dz;
        const sample = multiNoise.sample(x, 64, z);
        const biome = resolveBiomeFromMultiNoise(sample);

        if (biome.id === targetId) {
          const dist = Math.round(Math.sqrt((x - startX) ** 2 + (z - startZ) ** 2));
          return { x, y: 64, z, distance: dist, biomeId: biome.id };
        }
      }
    }

    for (let dz = -r + step; dz <= r - step; dz += step) {
      // Borde Izquierdo y Derecho
      for (const dx of [-r, r]) {
        const x = startX + dx;
        const z = startZ + dz;
        const sample = multiNoise.sample(x, 64, z);
        const biome = resolveBiomeFromMultiNoise(sample);

        if (biome.id === targetId) {
          const dist = Math.round(Math.sqrt((x - startX) ** 2 + (z - startZ) ** 2));
          return { x, y: 64, z, distance: dist, biomeId: biome.id };
        }
      }
    }
  }

  return null;
}
