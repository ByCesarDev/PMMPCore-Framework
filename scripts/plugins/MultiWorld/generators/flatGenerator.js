import { BlockPermutation } from "@minecraft/server";
import { generatedChunks, markWorldDataDirty } from "../state.js";
import { FLAT_WORLD_TOP_Y, MW_DEBUG } from "../config.js";

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

export function generateFlatChunk(dimension, chunkX, chunkZ, worldName) {
  initChunks(worldName);
  const chunkKey = `${chunkX},${chunkZ}`;

  if (generatedChunks.get(worldName).has(chunkKey)) {
    return true;
  }

  const grass = BlockPermutation.resolve("minecraft:grass_block");
  const dirt = BlockPermutation.resolve("minecraft:dirt");
  const stone = BlockPermutation.resolve("minecraft:stone");
  const bedrock = BlockPermutation.resolve("minecraft:bedrock");

  const startX = chunkX * 16;
  const startZ = chunkZ * 16;
  const baseY = FLAT_WORLD_TOP_Y;
  const thickness = 12;

  const testBlock = dimension.getBlock({ x: startX + 8, y: baseY, z: startZ + 8 });
  if (testBlock === undefined) {
    return false;
  }

  if (testBlock.typeId !== "minecraft:air") {
    generatedChunks.get(worldName).add(chunkKey);
    markWorldDataDirty();
    return true;
  }

  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      const worldX = startX + x;
      const worldZ = startZ + z;

      for (let y = 0; y >= -thickness; y--) {
        const blockY = baseY + y;
        let blockType = stone;

        if (y === 0) blockType = grass;
        else if (y > -3) blockType = dirt;
        else if (y <= -thickness + 1) blockType = bedrock;

        const block = dimension.getBlock({ x: worldX, y: blockY, z: worldZ });
        if (block) {
          try {
            block.setPermutation(blockType);
          } catch (e) {
            debugWarn("Failed to set block permutation in flat generation", {
              error: e?.message,
              worldName,
              chunkX,
              chunkZ,
              x: worldX,
              y: blockY,
              z: worldZ,
            });
          }
        }
      }
    }
  }

  generatedChunks.get(worldName).add(chunkKey);
  markWorldDataDirty();
  return true;
}
