/**
 * 1.16.220 Cave Carver Engine (Overworld & Nether Worm Carvers)
 */

export class CaveCarver116 {
  static _makePRNG(seed) {
    let s = (seed | 0) || 123456789;
    return {
      nextFloat: () => {
        s = (s * 1664525 + 1013904223) | 0;
        return ((s >>> 0) % 65536) / 65536;
      },
      nextInt: (max) => {
        if (max <= 0) return 0;
        s = (s * 1664525 + 1013904223) | 0;
        return Math.abs(s) % max;
      },
    };
  }

  static carveCaves(targetChunkX, targetChunkZ, worldSeed, chunkBlocks, isNether = false) {
    const radius = 3;
    const originX = targetChunkX * 16;
    const originZ = targetChunkZ * 16;

    for (let cx = targetChunkX - radius; cx <= targetChunkX + radius; cx++) {
      for (let cz = targetChunkZ - radius; cz <= targetChunkZ + radius; cz++) {
        const seed = (cx * 341873128712) ^ (cz * 132897987541) ^ worldSeed;
        const rand = this._makePRNG(seed);

        let caves = rand.nextInt(rand.nextInt(rand.nextInt(40) + 1) + 1);
        if (rand.nextInt(15) !== 0) caves = 0;

        for (let c = 0; c < caves; c++) {
          const xCave = cx * 16 + rand.nextInt(16);
          const yCave = isNether ? rand.nextInt(100) + 10 : rand.nextInt(rand.nextInt(110) + 8) - 50;
          const zCave = cz * 16 + rand.nextInt(16);

          let tunnels = 1;
          if (rand.nextInt(4) === 0) {
            this._carveTunnel(targetChunkX, targetChunkZ, originX, originZ, chunkBlocks, rand, xCave, yCave, zCave, 1 + rand.nextFloat() * 6, 0, 0, -1, -1, 0.5, isNether);
            tunnels += rand.nextInt(4);
          }

          for (let i = 0; i < tunnels; i++) {
            const yRot = rand.nextFloat() * Math.PI * 2;
            const xRot = ((rand.nextFloat() - 0.5) * 2) / 8;
            const thickness = rand.nextFloat() * 2.0 + rand.nextFloat();
            this._carveTunnel(targetChunkX, targetChunkZ, originX, originZ, chunkBlocks, rand, xCave, yCave, zCave, thickness, yRot, xRot, 0, 0, 1.0, isNether);
          }
        }
      }
    }
  }

  static _carveTunnel(targetChunkX, targetChunkZ, originX, originZ, chunkBlocks, rand, xCave, yCave, zCave, thickness, yRot, xRot, step, dist, yScale, isNether) {
    const xMid = targetChunkX * 16 + 8;
    const zMid = targetChunkZ * 16 + 8;

    if (dist <= 0) {
      const max = 64;
      dist = max - rand.nextInt(max / 4);
    }
    let singleStep = false;
    if (step === -1) {
      step = Math.floor(dist / 2);
      singleStep = true;
    }

    const splitPoint = rand.nextInt(dist / 2) + Math.floor(dist / 4);
    const steep = rand.nextInt(6) === 0;

    let xRota = 0;
    let yRota = 0;

    const minY = -64;
    const LAVA = "minecraft:lava";
    const AIR = "minecraft:air";
    const WATER = "minecraft:water";

    for (; step < dist; step++) {
      const rad = 1.5 + Math.sin((step * Math.PI) / dist) * thickness;
      const yRad = rad * yScale;

      const xc = Math.cos(xRot);
      const xs = Math.sin(xRot);
      xCave += Math.cos(yRot) * xc;
      yCave += xs;
      zCave += Math.sin(yRot) * xc;

      if (steep) {
        xRot *= 0.92;
      } else {
        xRot *= 0.7;
      }
      xRot += xRota * 0.1;
      yRot += yRota * 0.1;

      xRota *= 0.9;
      yRota *= 0.75;
      xRota += (rand.nextFloat() - rand.nextFloat()) * rand.nextFloat() * 2;
      yRota += (rand.nextFloat() - rand.nextFloat()) * rand.nextFloat() * 4;

      if (!singleStep && step === splitPoint && thickness > 1) {
        this._carveTunnel(targetChunkX, targetChunkZ, originX, originZ, chunkBlocks, rand, xCave, yCave, zCave, rand.nextFloat() * 0.5 + 0.5, yRot - Math.PI / 2, xRot / 3, step, dist, 1.0, isNether);
        this._carveTunnel(targetChunkX, targetChunkZ, originX, originZ, chunkBlocks, rand, xCave, yCave, zCave, rand.nextFloat() * 0.5 + 0.5, yRot + Math.PI / 2, xRot / 3, step, dist, 1.0, isNether);
        return;
      }

      if (!singleStep && rand.nextInt(4) === 0) continue;

      const xd = xCave - xMid;
      const zd = zCave - zMid;
      const remaining = dist - step;
      const rr = thickness + 18;
      if (xd * xd + zd * zd - remaining * remaining > rr * rr) continue;

      if (xCave < originX - 16 - rad * 2 || zCave < originZ - 16 - rad * 2 || xCave > originX + 32 + rad * 2 || zCave > originZ + 32 + rad * 2) {
        continue;
      }

      const x0 = Math.max(0, Math.floor(xCave - rad) - originX);
      const x1 = Math.min(16, Math.floor(xCave + rad) - originX + 1);

      const y0 = Math.max(-63, Math.floor(yCave - yRad));
      const y1 = Math.min(120, Math.floor(yCave + yRad) + 1);

      const z0 = Math.max(0, Math.floor(zCave - rad) - originZ);
      const z1 = Math.min(16, Math.floor(zCave + rad) - originZ + 1);

      // Water Guard: no romper oceanos
      if (!isNether) {
        let hasWater = false;
        for (let lx = x0; lx < x1 && !hasWater; lx++) {
          for (let lz = z0; lz < z1 && !hasWater; lz++) {
            const col = chunkBlocks[lx][lz];
            for (let y = y0; y <= y1; y++) {
              const yIdx = y - minY;
              if (col[yIdx] === WATER) {
                hasWater = true;
                break;
              }
            }
          }
        }
        if (hasWater) continue;
      }

      for (let lx = x0; lx < x1; lx++) {
        const wx = originX + lx + 0.5;
        const dxNorm = (wx - xCave) / rad;
        const dx2 = dxNorm * dxNorm;
        if (dx2 >= 1.0) continue;

        for (let lz = z0; lz < z1; lz++) {
          const wz = originZ + lz + 0.5;
          const dzNorm = (wz - zCave) / rad;
          const dz2 = dzNorm * dzNorm;
          if (dx2 + dz2 >= 1.0) continue;

          const col = chunkBlocks[lx][lz];

          for (let y = y0; y <= y1; y++) {
            const dyNorm = (y + 0.5 - yCave) / yRad;
            const dy2 = dyNorm * dyNorm;

            if (dx2 + dy2 + dz2 < 1.0) {
              const yIdx = y - minY;
              if (yIdx <= 0 || yIdx >= 192) continue;

              const currentBlock = col[yIdx];
              if (currentBlock && currentBlock !== AIR && currentBlock !== WATER && currentBlock !== LAVA && currentBlock !== "minecraft:bedrock") {
                if (y < -54 || (isNether && y < 30)) {
                  col[yIdx] = LAVA;
                } else {
                  col[yIdx] = AIR;
                }
              }
            }
          }
        }
      }

      if (singleStep) break;
    }
  }
}
