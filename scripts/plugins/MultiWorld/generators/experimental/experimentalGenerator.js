/**
 * Pure JS 1.16.220 Experimental World Generator Engine
 * Orchestrates Biome Resolution, Terrain Interpolation, Surface Construction, Cave Carving & Feature Passes.
 */
import { BlockPermutation } from "@minecraft/server";
import { worldsData, generatedChunks, markWorldDataDirty, isExperimentalChunkGenerated, markExperimentalChunkGenerated } from "../../state.js";
import { MW_DEBUG } from "../../config.js";
import { MultiNoiseEvaluator3D, OctavePerlinNoise3D } from "./noise.js";
import { resolveBiomeFromMultiNoise } from "./biomes.js";
import { buildSurfaceColumn } from "./surface.js";
import { CaveCarver116 } from "./carvers.js";
import { FeatureRulesEngine116 } from "./featureRules.js";

const noiseCache = new Map();

function stringHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function getOrCreateNoiseForWorld(worldName) {
  if (noiseCache.has(worldName)) return noiseCache.get(worldName);
  const wd = worldsData.get(worldName);
  const seed = (wd && Number.isFinite(wd.seed)) ? wd.seed : stringHash(worldName);
  const noiseMain = new OctavePerlinNoise3D(4, seed + 1001);
  const noiseCave = new OctavePerlinNoise3D(3, seed + 2002);
  const noiseBeach = new OctavePerlinNoise3D(2, seed + 3003);
  const multiNoise = new MultiNoiseEvaluator3D(seed + 4004);

  const entry = { noiseMain, noiseCave, noiseBeach, multiNoise, seed };
  noiseCache.set(worldName, entry);
  return entry;
}

function initChunks(worldName) {
  if (!generatedChunks.has(worldName)) generatedChunks.set(worldName, new Set());
}

function fillColumnRange(dimension, x, z, yFrom, yTo, blockId) {
  if (yTo < yFrom) return true;
  try {
    dimension.fillBlocks({ x, y: yFrom, z }, { x, y: yTo, z }, blockId);
    return true;
  } catch (_) {
    let ok = true;
    const perm = BlockPermutation.resolve(blockId);
    for (let y = yFrom; y <= yTo; y++) {
      const block = dimension.getBlock({ x, y, z });
      if (!block) continue;
      try {
        block.setPermutation(perm);
      } catch (_e) {
        ok = false;
      }
    }
    return ok;
  }
}

function makePRNG(seed) {
  let s = (seed | 0) || 123456789;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 65536) / 65536;
  };
}

export function generateExperimentalChunk(dimension, chunkX, chunkZ, worldName, options = {}) {
  if (!worldsData.has(worldName)) return false;
  initChunks(worldName);
  const key = `${chunkX},${chunkZ}`;
  if (isExperimentalChunkGenerated(worldName, chunkX, chunkZ)) return true;
  if (generatedChunks.get(worldName).has(key)) return true;

  const originX = chunkX * 16;
  const originZ = chunkZ * 16;

  const probe = dimension.getBlock({ x: originX + 8, y: 64, z: originZ + 8 });
  if (probe === undefined) return false;

  const { noiseMain, noiseCave, noiseBeach, multiNoise, seed: worldSeed } = getOrCreateNoiseForWorld(worldName);

  const isNether = dimension.id.includes("nether");

  // 1) RESOLUCIÓN DE BIOMA 1.16.220 OVERWORLD (Muestreo 3D Multi-Noise)
  const climateSample = multiNoise.sample(originX + 8, 64, originZ + 8);
  const sampledBiome = resolveBiomeFromMultiNoise(climateSample);

  const minY = -64;
  const waterHeight = 62;
  const BEDROCK = "minecraft:bedrock";
  const DEEPSLATE = "minecraft:deepslate";
  const STONE = "minecraft:stone";
  const WATER = "minecraft:water";
  const AIR = "minecraft:air";

  // Malla de densidad 5 x 25 x 5 (425 puntos de densidad)
  const densityGrid = new Float32Array(5 * 25 * 5);
  for (let xc = 0; xc <= 4; xc++) {
    for (let zc = 0; zc <= 4; zc++) {
      const wx = originX + xc * 4;
      const wz = originZ + zc * 4;
      for (let yc = 0; yc <= 24; yc++) {
        const wy = minY + yc * 8;
        const targetY = 66 + noiseMain.getValue(wx * 0.008, wy * 0.008, wz * 0.008) * 28;
        let density = noiseMain.getValue(wx * 0.02, wy * 0.03, wz * 0.02) - (wy - targetY) / 32;

        if (wy < waterHeight - 4 && wy > -55) {
          const caveVal = noiseCave.getValue(wx * 0.045, wy * 0.05, wz * 0.045);
          if (caveVal > 0.46) density = -1.0;
        }

        densityGrid[(xc * 25 + yc) * 5 + zc] = density;
      }
    }
  }

  // Rejilla de memoria RAM para 16x16x193 bloques
  const chunkBlocks = new Array(16);
  for (let lx = 0; lx < 16; lx++) {
    chunkBlocks[lx] = new Array(16);
    for (let lz = 0; lz < 16; lz++) {
      chunkBlocks[lx][lz] = new Array(193);
    }
  }

  // 2) INTERPOLACIÓN TRILINEAL DEL TERRENO BASE OVERWORLD
  for (let lx = 0; lx < 16; lx++) {
    for (let lz = 0; lz < 16; lz++) {
      const worldX = originX + lx;
      const worldZ = originZ + lz;
      const col = chunkBlocks[lx][lz];
      const xc = Math.floor(lx / 4);
      const zc = Math.floor(lz / 4);
      const fx = (lx % 4) / 4.0;
      const fz = (lz % 4) / 4.0;

      for (let yc = 0; yc < 24; yc++) {
        const d000 = densityGrid[(xc * 25 + yc) * 5 + zc];
        const d001 = densityGrid[(xc * 25 + yc) * 5 + (zc + 1)];
        const d010 = densityGrid[(xc * 25 + (yc + 1)) * 5 + zc];
        const d011 = densityGrid[(xc * 25 + (yc + 1)) * 5 + (zc + 1)];
        const d100 = densityGrid[((xc + 1) * 25 + yc) * 5 + zc];
        const d101 = densityGrid[((xc + 1) * 25 + yc) * 5 + (zc + 1)];
        const d110 = densityGrid[((xc + 1) * 25 + (yc + 1)) * 5 + zc];
        const d111 = densityGrid[((xc + 1) * 25 + (yc + 1)) * 5 + (zc + 1)];

        for (let ly = 0; ly < 8; ly++) {
          const fy = ly / 8.0;
          const yIndex = yc * 8 + ly;
          const absoluteY = minY + yIndex;

          const i00 = d000 + (d100 - d000) * fx;
          const i01 = d001 + (d101 - d001) * fx;
          const i10 = d010 + (d110 - d010) * fx;
          const i11 = d011 + (d111 - d011) * fx;

          const i0 = i00 + (i01 - i00) * fz;
          const i1 = i10 + (i11 - i10) * fz;
          const density = i0 + (i1 - i0) * fy;

          if (absoluteY === -64) {
            col[yIndex] = BEDROCK;
          } else if (density > 0) {
            const deepslateNoise = noiseBeach.getValue(worldX * 0.04, absoluteY * 0.08, worldZ * 0.04) * 9.0;
            col[yIndex] = absoluteY < -16 + deepslateNoise ? DEEPSLATE : STONE;
          } else {
            col[yIndex] = absoluteY <= waterHeight ? WATER : AIR;
          }
        }
      }
    }
  }

  // 3) CARVERS (Cuevas / Cañones Overworld 1.16.220)
  CaveCarver116.carveCaves(chunkX, chunkZ, worldSeed, chunkBlocks, false);

  // 4) CONSTRUCCIÓN DE SUPERFICIE Y RENDERIZADO DE BLOQUES COMPLETO POR COLUMNA
  for (let lx = 0; lx < 16; lx++) {
    for (let lz = 0; lz < 16; lz++) {
      const worldX = originX + lx;
      const worldZ = originZ + lz;
      const col = chunkBlocks[lx][lz];

      let highestSolidY = minY;
      for (let yIndex = 192; yIndex >= 0; yIndex--) {
        const b = col[yIndex];
        if (b === STONE || b === DEEPSLATE) {
          highestSolidY = minY + yIndex;
          break;
        }
      }

      buildSurfaceColumn(sampledBiome, worldX, worldZ, highestSolidY, minY, waterHeight, col, noiseBeach);

      // Escribir columna completa desde Y=-64 (index 0) hasta Y=128 (index 192)
      let segStart = 0;
      let currentBlock = col[0];

      for (let i = 1; i <= 192; i++) {
        const nextBlock = col[i];
        if (nextBlock !== currentBlock || i === 192) {
          const yFrom = minY + segStart;
          const yTo = minY + (i === 192 && nextBlock === currentBlock ? i : i - 1);
          if (currentBlock && currentBlock !== AIR) {
            fillColumnRange(dimension, worldX, worldZ, yFrom, yTo, currentBlock);
          }
          segStart = i;
          currentBlock = nextBlock;
        }
      }
    }
  }

  // 5) EJECUCIÓN DE FEATURE RULES Y PASADAS 1.16.220
  const chunkRandom = makePRNG(worldSeed ^ (chunkX * 73471) ^ (chunkZ * 91249));
  FeatureRulesEngine116.runPasses(dimension, chunkX, chunkZ, sampledBiome, chunkRandom);

  if (options.generateOres) {
    options.generateOres(dimension, chunkX, chunkZ, {
      worldName,
      dimensionId: dimension.id,
      worldType: "experimental",
    });
  }

  if (options.runHooks) {
    options.runHooks({
      dimension,
      chunkX,
      chunkZ,
      worldName,
      dimensionId: dimension.id,
      worldType: "experimental",
      originX,
      originZ,
    });
  }

  generatedChunks.get(worldName).add(key);
  markExperimentalChunkGenerated(worldName, chunkX, chunkZ);
  markWorldDataDirty();
  return true;
}
