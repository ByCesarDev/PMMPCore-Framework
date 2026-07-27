/**
 * 1.16.220 Surface Construction Engine (surface_parameters & noise adjustments)
 */

export function buildSurfaceColumn(biome, worldX, worldZ, highestSolidY, minY, waterHeight, col, noiseBeach) {
  if (highestSolidY <= minY) return;

  const surf = biome.surface;
  const isSubmerged = highestSolidY <= waterHeight;
  const isBeach = highestSolidY >= waterHeight - 2 && highestSolidY <= waterHeight + 3;

  // Modificador de ajuste por ruido 2D (p. ej., parches de nether_wart_block o terracota)
  let topMaterial = surf.top;
  let midMaterial = surf.mid;

  if (surf.adjustments && Array.isArray(surf.adjustments)) {
    const adjNoise = noiseBeach ? noiseBeach.getValue(worldX * 0.05, 0, worldZ * 0.05) : 0;
    for (const adj of surf.adjustments) {
      if (adj.noiseRange && adjNoise >= adj.noiseRange[0] && adjNoise <= adj.noiseRange[1]) {
        topMaterial = adj.top;
        midMaterial = adj.mid;
        break;
      }
    }
  }

  // Determinar material de la superficie si está sumergido o en playa
  if (isSubmerged) {
    topMaterial = surf.seaFloor ?? "minecraft:sand";
    midMaterial = "minecraft:dirt";
  } else if (isBeach || biome.id === "beach") {
    topMaterial = "minecraft:sand";
    midMaterial = "minecraft:sandstone";
  }

  const dirtDepth = surf.dirtDepth ?? 4;

  for (let depth = 0; depth < dirtDepth; depth++) {
    const currentY = highestSolidY - depth;
    const yIdx = currentY - minY;
    if (yIdx < 0 || yIdx > 192) continue;

    if (depth === 0) {
      col[yIdx] = topMaterial;
    } else {
      col[yIdx] = midMaterial;
    }
  }
}
