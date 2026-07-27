import { BlockPermutation } from "@minecraft/server";
import { worldsData, generatedChunks, markWorldDataDirty } from "../state.js";
import { WORLD_TYPES, MW_DEBUG } from "../config.js";

function initChunks(worldName) {
  if (!generatedChunks.has(worldName)) generatedChunks.set(worldName, new Set());
}

function debugWarn(message, context = null) {
  if (!MW_DEBUG) return;
  if (context) {
    console.warn(`[MultiWorld][debug] ${message}`, context);
    return;
  }
  console.warn(`[MultiWorld][debug] ${message}`);
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

function frac(v) {
  return v - Math.floor(v);
}

function hash2(x, z, seed = 0) {
  return frac(Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise2D(x, z, seed = 0) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const tz = fade(z - z0);

  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);

  const ab = lerp(a, b, tx);
  const cd = lerp(c, d, tx);
  return lerp(ab, cd, tz);
}

function stringHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function naturalTopYAt(x, z, seed = 0) {
  const broad = valueNoise2D(x * 0.012, z * 0.012, seed + 11) * 2 - 1;
  const medium = valueNoise2D(x * 0.03, z * 0.03, seed + 29) * 2 - 1;
  const detail = valueNoise2D(x * 0.06, z * 0.06, seed + 53) * 2 - 1;
  const y = 70 + Math.round(broad * 8 + medium * 4 + detail * 2);
  return Math.max(58, Math.min(86, y));
}

function slopeAt(x, z, seed = 0) {
  const h = naturalTopYAt(x, z, seed);
  const hx = naturalTopYAt(x + 3, z, seed);
  const hz = naturalTopYAt(x, z + 3, seed);
  return Math.abs(hx - h) + Math.abs(hz - h);
}

function soilProfileAt(x, z, seed = 0) {
  const broad = valueNoise2D(x * 0.015, z * 0.015, seed + 97);
  const detail = valueNoise2D(x * 0.09, z * 0.09, seed + 131);
  const slope = slopeAt(x, z, seed);
  const slopeFactor = Math.max(0, Math.min(1, slope / 8));

  let dirtDepth = 2.5 + broad * 3.2 + detail * 1.6;
  dirtDepth = dirtDepth * (1 - 0.55 * slopeFactor);
  dirtDepth = Math.max(2, Math.min(7, dirtDepth));

  const coarseChance = (detail > 0.82 && slopeFactor < 0.25);
  const useCoarseTop = coarseChance && (hash2(x, z, seed + 911) > 0.7);

  return {
    dirtDepth,
    topBlock: "minecraft:grass_block",
    dirtBlock: useCoarseTop ? "minecraft:coarse_dirt" : "minecraft:dirt",
  };
}

export function generateNormalChunk(dimension, chunkX, chunkZ, worldName, options = {}) {
  if (!worldsData.has(worldName)) return false;
  initChunks(worldName);
  const key = `${chunkX},${chunkZ}`;
  if (generatedChunks.get(worldName).has(key)) return true;

  const worldSeed = stringHash(worldName);
  const originX = chunkX * 16;
  const originZ = chunkZ * 16;
  const probeY = naturalTopYAt(originX + 8, originZ + 8, worldSeed);
  const probe = dimension.getBlock({ x: originX + 8, y: probeY, z: originZ + 8 });
  if (probe === undefined) return false;

  const GRASS = "minecraft:grass_block";
  const STONE = "minecraft:stone";
  const BEDROCK = "minecraft:bedrock";
  const oakLog = BlockPermutation.resolve("minecraft:oak_log");
  const oakLeaves = BlockPermutation.resolve("minecraft:oak_leaves");

  for (let lx = 0; lx < 16; lx++) {
    for (let lz = 0; lz < 16; lz++) {
      const x = originX + lx;
      const z = originZ + lz;
      const topY = naturalTopYAt(x, z, worldSeed);
      const soil = soilProfileAt(x, z, worldSeed);
      const dirtDepth = soil.dirtDepth;
      const dirtStartY = topY - Math.floor(dirtDepth);
      const stoneTopY = dirtStartY - 1;

      fillColumnRange(dimension, x, z, -64, -64, BEDROCK);
      fillColumnRange(dimension, x, z, -63, stoneTopY, STONE);
      fillColumnRange(dimension, x, z, dirtStartY, topY - 1, soil.dirtBlock);
      fillColumnRange(dimension, x, z, topY, topY, soil.topBlock ?? GRASS);
    }
  }

  if (options.generateOres) {
    options.generateOres(dimension, chunkX, chunkZ, {
      worldName,
      dimensionId: dimension.id,
      worldType: WORLD_TYPES.NORMAL,
    });
  }

  if (options.runHooks) {
    options.runHooks({
      dimension,
      chunkX,
      chunkZ,
      worldName,
      dimensionId: dimension.id,
      worldType: WORLD_TYPES.NORMAL,
      originX,
      originZ,
    });
  }

  for (let lx = 1; lx < 15; lx++) {
    for (let lz = 1; lz < 15; lz++) {
      const x = originX + lx;
      const z = originZ + lz;
      const treeChance = hash2(x, z, 701);
      if (treeChance < 0.975) continue;
      if ((Math.abs(x) + Math.abs(z)) < 8) continue;
      if (x % 5 !== 0 || z % 5 !== 0) continue;

      const groundY = naturalTopYAt(x, z);
      const above = dimension.getBlock({ x, y: groundY + 1, z });
      if (!above || above.typeId !== "minecraft:air") continue;

      const trunkHeight = 4 + Math.floor(hash2(x, z, 719) * 2);
      for (let h = 1; h <= trunkHeight; h++) {
        try { dimension.getBlock({ x, y: groundY + h, z })?.setPermutation(oakLog); } catch (error) {
          debugWarn("Failed to place oak log", { error: error?.message, worldName, chunkX, chunkZ, x, y: groundY + h, z });
        }
      }

      const leafCenterY = groundY + trunkHeight;
      for (let ax = x - 2; ax <= x + 2; ax++) {
        for (let az = z - 2; az <= z + 2; az++) {
          for (let ay = leafCenterY - 1; ay <= leafCenterY + 2; ay++) {
            const dx = Math.abs(ax - x);
            const dz = Math.abs(az - z);
            const dy = Math.abs(ay - leafCenterY);
            if (dx + dz + dy > 4) continue;
            const lb = dimension.getBlock({ x: ax, y: ay, z: az });
            if (lb?.typeId === "minecraft:air") {
              try { lb.setPermutation(oakLeaves); } catch (error) {
                debugWarn("Failed to place oak leaves", { error: error?.message, worldName, chunkX, chunkZ, x: ax, y: ay, z: az });
              }
            }
          }
        }
      }
    }
  }

  generatedChunks.get(worldName).add(key);
  markWorldDataDirty();
  return true;
}
