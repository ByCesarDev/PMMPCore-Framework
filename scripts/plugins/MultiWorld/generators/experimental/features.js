/**
 * 1.16.220 Pure JS Feature Executors (Ores, Trees, Fungi, Flora, Single Blocks)
 */
import { BlockPermutation } from "@minecraft/server";

function trySetBlock(dimension, x, y, z, perm) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (!block) return false;
    block.setPermutation(perm);
    return true;
  } catch (_) {
    return false;
  }
}

function getBlockTypeId(dimension, x, y, z) {
  try {
    return dimension.getBlock({ x, y, z })?.typeId ?? "minecraft:air";
  } catch (_) {
    return "minecraft:air";
  }
}

export const FEATURES_116 = {
  // --- ORES ---
  placeOreVein(dimension, originX, originZ, random, blockId, count, minY, maxY, replaceList) {
    const perm = BlockPermutation.resolve(blockId);
    const sx = originX + Math.floor(random() * 16);
    const sz = originZ + Math.floor(random() * 16);
    const sy = minY + Math.floor(random() * (maxY - minY + 1));

    let x = sx;
    let y = sy;
    let z = sz;

    for (let i = 0; i < count; i++) {
      const typeId = getBlockTypeId(dimension, x, y, z);
      if (replaceList.includes(typeId)) {
        trySetBlock(dimension, x, y, z, perm);
      }
      x += Math.floor(random() * 3) - 1;
      y += Math.floor(random() * 3) - 1;
      z += Math.floor(random() * 3) - 1;
      x = Math.max(originX, Math.min(originX + 15, x));
      z = Math.max(originZ, Math.min(originZ + 15, z));
      y = Math.max(minY, Math.min(maxY, y));
    }
  },

  // --- TREES ---
  placeOakTree(dimension, x, y, z, random) {
    const log = BlockPermutation.resolve("minecraft:oak_log");
    const leaves = BlockPermutation.resolve("minecraft:oak_leaves");
    const height = 4 + Math.floor(random() * 3);

    for (let h = 1; h <= height; h++) {
      trySetBlock(dimension, x, y + h, z, log);
    }

    const leafCenter = y + height;
    for (let lx = x - 2; lx <= x + 2; lx++) {
      for (let lz = z - 2; lz <= z + 2; lz++) {
        for (let ly = leafCenter - 1; ly <= leafCenter + 2; ly++) {
          if (Math.abs(lx - x) + Math.abs(lz - z) + Math.abs(ly - leafCenter) > 4) continue;
          if (getBlockTypeId(dimension, lx, ly, lz) === "minecraft:air") {
            trySetBlock(dimension, lx, ly, lz, leaves);
          }
        }
      }
    }
  },

  placeBirchTree(dimension, x, y, z, random) {
    const log = BlockPermutation.resolve("minecraft:birch_log");
    const leaves = BlockPermutation.resolve("minecraft:birch_leaves");
    const height = 5 + Math.floor(random() * 3);

    for (let h = 1; h <= height; h++) {
      trySetBlock(dimension, x, y + h, z, log);
    }

    const leafCenter = y + height;
    for (let lx = x - 2; lx <= x + 2; lx++) {
      for (let lz = z - 2; lz <= z + 2; lz++) {
        for (let ly = leafCenter - 2; ly <= leafCenter + 1; ly++) {
          if (Math.abs(lx - x) + Math.abs(lz - z) > 3) continue;
          if (getBlockTypeId(dimension, lx, ly, lz) === "minecraft:air") {
            trySetBlock(dimension, lx, ly, lz, leaves);
          }
        }
      }
    }
  },

  placeSpruceTree(dimension, x, y, z, random) {
    const log = BlockPermutation.resolve("minecraft:spruce_log");
    const leaves = BlockPermutation.resolve("minecraft:spruce_leaves");
    const height = 6 + Math.floor(random() * 4);

    for (let h = 1; h <= height; h++) {
      trySetBlock(dimension, x, y + h, z, log);
    }

    let radius = 2;
    for (let ly = y + height; ly >= y + 3; ly--) {
      for (let lx = x - radius; lx <= x + radius; lx++) {
        for (let lz = z - radius; lz <= z + radius; lz++) {
          if (Math.abs(lx - x) === radius && Math.abs(lz - z) === radius) continue;
          if (getBlockTypeId(dimension, lx, ly, lz) === "minecraft:air") {
            trySetBlock(dimension, lx, ly, lz, leaves);
          }
        }
      }
      radius = (radius === 2) ? 1 : 2;
    }
  },

  // --- FUNGI (NETHER 1.16) ---
  placeCrimsonFungus(dimension, x, y, z, random) {
    const stem = BlockPermutation.resolve("minecraft:crimson_stem");
    const cap = BlockPermutation.resolve("minecraft:nether_wart_block");
    const shroomlight = BlockPermutation.resolve("minecraft:shroomlight");
    const height = 4 + Math.floor(random() * 4);

    for (let h = 1; h <= height; h++) {
      trySetBlock(dimension, x, y + h, z, stem);
    }

    const capCenter = y + height;
    for (let lx = x - 2; lx <= x + 2; lx++) {
      for (let lz = z - 2; lz <= z + 2; lz++) {
        for (let ly = capCenter - 1; ly <= capCenter + 2; ly++) {
          if (Math.abs(lx - x) + Math.abs(lz - z) > 3) continue;
          const target = (random() < 0.15) ? shroomlight : cap;
          if (getBlockTypeId(dimension, lx, ly, lz) === "minecraft:air") {
            trySetBlock(dimension, lx, ly, lz, target);
          }
        }
      }
    }
  },

  placeWarpedFungus(dimension, x, y, z, random) {
    const stem = BlockPermutation.resolve("minecraft:warped_stem");
    const cap = BlockPermutation.resolve("minecraft:warped_wart_block");
    const shroomlight = BlockPermutation.resolve("minecraft:shroomlight");
    const height = 4 + Math.floor(random() * 4);

    for (let h = 1; h <= height; h++) {
      trySetBlock(dimension, x, y + h, z, stem);
    }

    const capCenter = y + height;
    for (let lx = x - 2; lx <= x + 2; lx++) {
      for (let lz = z - 2; lz <= z + 2; lz++) {
        for (let ly = capCenter - 1; ly <= capCenter + 2; ly++) {
          if (Math.abs(lx - x) + Math.abs(lz - z) > 3) continue;
          const target = (random() < 0.15) ? shroomlight : cap;
          if (getBlockTypeId(dimension, lx, ly, lz) === "minecraft:air") {
            trySetBlock(dimension, lx, ly, lz, target);
          }
        }
      }
    }
  },

  // --- SCATTER FLORA ---
  placeScatterFlora(dimension, originX, originZ, random, blockId, iterations) {
    const perm = BlockPermutation.resolve(blockId);
    for (let i = 0; i < iterations; i++) {
      const x = originX + Math.floor(random() * 16);
      const z = originZ + Math.floor(random() * 16);
      for (let y = 120; y >= 60; y--) {
        const ground = getBlockTypeId(dimension, x, y, z);
        if (ground === "minecraft:grass_block" || ground === "minecraft:dirt" || ground === "minecraft:crimson_nylium" || ground === "minecraft:warped_nylium" || ground === "minecraft:soul_sand") {
          const above = getBlockTypeId(dimension, x, y + 1, z);
          if (above === "minecraft:air") {
            trySetBlock(dimension, x, y + 1, z, perm);
            break;
          }
        }
      }
    }
  },
};
