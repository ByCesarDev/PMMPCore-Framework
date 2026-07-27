import { BlockPermutation } from "@minecraft/server";
import { worldsData, generatedChunks, markWorldDataDirty } from "../state.js";
import { MW_DEBUG } from "../config.js";

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

export function generateSkyblockChunk(dimension, cx, cz, worldName) {
  if (!worldsData.has(worldName)) return false;
  initChunks(worldName);
  const key = `${cx},${cz}`;
  if (generatedChunks.get(worldName).has(key)) return true;

  if (cx === 0 && cz === 0) {
    const grass   = BlockPermutation.resolve("minecraft:grass_block");
    const dirt    = BlockPermutation.resolve("minecraft:dirt");
    const oakLog  = BlockPermutation.resolve("minecraft:oak_log");
    const leaves  = BlockPermutation.resolve("minecraft:oak_leaves");
    const chest   = BlockPermutation.resolve("minecraft:chest");

    const topY = 100;
    const baseY = topY - 4;

    const min = -5;
    const max = 4;
    const isLand = (x, z) => {
      const horizontalArm = (x >= min && x <= max && z >= min && z <= -1);
      const verticalArm = (x >= 1 && x <= max && z >= min && z <= max);
      return horizontalArm || verticalArm;
    };

    for (let x = min; x <= max; x++) {
      for (let z = min; z <= max; z++) {
        if (!isLand(x, z)) continue;
        for (let y = baseY; y <= topY; y++) {
          const block = dimension.getBlock({ x, y, z });
          if (!block) continue;
          try {
            if (y === topY) block.setPermutation(grass);
            else block.setPermutation(dirt);
          } catch (_) {}
        }
      }
    }

    try {
      const chestBlock = dimension.getBlock({ x: -4, y: topY + 1, z: -4 });
      if (chestBlock) chestBlock.setPermutation(chest);
    } catch (_) {}

    const treeX = 3;
    const treeZ = 3;
    for (let h = 0; h < 4; h++) {
      try {
        dimension.getBlock({ x: treeX, y: topY + 1 + h, z: treeZ })?.setPermutation(oakLog);
      } catch (error) {
        debugWarn("Failed to place skyblock trunk", { error: error?.message, worldName, x: treeX, y: topY + 1 + h, z: treeZ });
      }
    }

    for (let x = treeX - 2; x <= treeX + 2; x++) {
      for (let z = treeZ - 2; z <= treeZ + 2; z++) {
        for (let y = topY + 3; y <= topY + 6; y++) {
          const dx = x - treeX;
          const dz = z - treeZ;
          const dy = y - (topY + 4);
          const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
          if (dist > 2.35) continue;
          const lb = dimension.getBlock({ x, y, z });
          if (lb?.typeId === "minecraft:air") {
            try { lb.setPermutation(leaves); } catch (error) {
              debugWarn("Failed to place skyblock leaves", { error: error?.message, worldName, x, y, z });
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
