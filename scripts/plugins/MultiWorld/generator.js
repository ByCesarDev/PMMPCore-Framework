import { world as mcWorld, system, BlockPermutation } from "@minecraft/server";
import { Color } from "../../PMMPCore.js";
import {
  worldsData, generatedChunks, markWorldDataDirty,
  isExperimentalChunkGenerated, markExperimentalChunkGenerated,
} from "./state.js";
import { WorldManager } from "./manager.js";
import {
  WORLD_TYPES, FLAT_WORLD_TOP_Y, GENERATION_RADIUS, CHUNKS_PER_TICK,
  CLEAR_RADIUS, CLEAR_BATCH_SIZE, CLEAR_TICKS_PER_BATCH, DELETE_SAFETY_SWEEP, DELETE_SAFETY_RADIUS,
  DELETE_SAFETY_RADIUS_WHEN_TRACKED, CLEAR_BATCHES_PER_CYCLE, MW_DEBUG, MW_METRICS,
} from "./config.js";

// ============== PERLIN NOISE 3D (POCKETMC ENGINE) ==============
class PerlinNoise3D {
  constructor(seed = 0) {
    this.p = new Int32Array(512);
    this._initPermutation(seed);
  }

  _initPermutation(seed) {
    let x = (seed | 0) || 123456789;
    const rand = () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x >>> 0) % 0xFFFFFFFF) / 0xFFFFFFFF;
    };
    const p256 = new Int32Array(256);
    for (let i = 0; i < 256; i++) p256[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p256[i];
      p256[i] = p256[j];
      p256[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.p[i] = p256[i & 255];
    }
  }

  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x, y, z) {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const fz = Math.floor(z);

    const X = fx & 255;
    const Y = fy & 255;
    const Z = fz & 255;

    x -= fx;
    y -= fy;
    z -= fz;

    const u = x * x * x * (x * (x * 6 - 15) + 10);
    const v = y * y * y * (y * (y * 6 - 15) + 10);
    const w = z * z * z * (z * (z * 6 - 15) + 10);

    const p = this.p;
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;

    const g000 = this.grad(p[AA], x, y, z);
    const g100 = this.grad(p[BA], x - 1, y, z);
    const g010 = this.grad(p[AB], x, y - 1, z);
    const g110 = this.grad(p[BB], x - 1, y - 1, z);
    const g001 = this.grad(p[AA + 1], x, y, z - 1);
    const g101 = this.grad(p[BA + 1], x - 1, y, z - 1);
    const g011 = this.grad(p[AB + 1], x, y - 1, z - 1);
    const g111 = this.grad(p[BB + 1], x - 1, y - 1, z - 1);

    const i00 = g000 + u * (g100 - g000);
    const i01 = g001 + u * (g101 - g001);
    const i10 = g010 + u * (g110 - g010);
    const i11 = g011 + u * (g111 - g011);

    const i0 = i00 + v * (i10 - i00);
    const i1 = i01 + v * (i11 - i01);

    return i0 + w * (i1 - i0);
  }
}

class OctavePerlinNoise3D {
  constructor(octaves = 4, seed = 0) {
    this.octaves = [];
    for (let i = 0; i < octaves; i++) {
      this.octaves.push(new PerlinNoise3D(seed + i * 31));
    }
  }

  getValue(x, y, z) {
    let total = 0;
    let freq = 1;
    let amp = 1;
    let maxAmp = 0;
    for (let i = 0; i < this.octaves.length; i++) {
      total += this.octaves[i].noise(x * freq, y * freq, z * freq) * amp;
      maxAmp += amp;
      amp *= 0.5;
      freq *= 2.0;
    }
    return total / maxAmp;
  }
}

// ============== POCKETMC WORM CAVE CARVER ENGINE ==============
class PocketMCCaveCarver {
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
      }
    };
  }

  static carveCaves(targetChunkX, targetChunkZ, worldSeed, chunkBlocks) {
    const radius = 4; // Radio de 4 chunks alrededor (9x9 chunks)
    const originX = targetChunkX * 16;
    const originZ = targetChunkZ * 16;

    for (let cx = targetChunkX - radius; cx <= targetChunkX + radius; cx++) {
      for (let cz = targetChunkZ - radius; cz <= targetChunkZ + radius; cz++) {
        const seed = (cx * 341873128712) ^ (cz * 132897987541) ^ worldSeed;
        const rand = this._makePRNG(seed);

        // Generación de Cuevas en Túnel (LargeCaveFeature)
        let caves = rand.nextInt(rand.nextInt(rand.nextInt(40) + 1) + 1);
        if (rand.nextInt(15) !== 0) caves = 0;

        for (let c = 0; c < caves; c++) {
          const xCave = cx * 16 + rand.nextInt(16);
          const yCave = rand.nextInt(rand.nextInt(110) + 8) - 50; // Y: -50 a 60
          const zCave = cz * 16 + rand.nextInt(16);

          let tunnels = 1;
          if (rand.nextInt(4) === 0) {
            // Room esférico
            this._carveTunnel(targetChunkX, targetChunkZ, originX, originZ, chunkBlocks, rand, xCave, yCave, zCave, 1 + rand.nextFloat() * 6, 0, 0, -1, -1, 0.5);
            tunnels += rand.nextInt(4);
          }

          for (let i = 0; i < tunnels; i++) {
            const yRot = rand.nextFloat() * Math.PI * 2;
            const xRot = ((rand.nextFloat() - 0.5) * 2) / 8;
            const thickness = rand.nextFloat() * 2.0 + rand.nextFloat();
            this._carveTunnel(targetChunkX, targetChunkZ, originX, originZ, chunkBlocks, rand, xCave, yCave, zCave, thickness, yRot, xRot, 0, 0, 1.0);
          }
        }

        // Generación de Cañones / Barrancos Profundos (CanyonFeature de PocketMC)
        if (rand.nextInt(50) === 0) {
          const xCanyon = cx * 16 + rand.nextInt(16);
          const yCanyon = rand.nextInt(rand.nextInt(110) + 8) - 50;
          const zCanyon = cz * 16 + rand.nextInt(16);

          const yRot = rand.nextFloat() * Math.PI * 2;
          const xRot = ((rand.nextFloat() - 0.5) * 2) / 8;
          const thickness = (rand.nextFloat() * 2.0 + rand.nextFloat()) + 1.2;

          // yScale = 4.5 crea la fisura vertical alta del barranco
          this._carveTunnel(targetChunkX, targetChunkZ, originX, originZ, chunkBlocks, rand, xCanyon, yCanyon, zCanyon, thickness, yRot, xRot, 0, 0, 4.5);
        }
      }
    }
  }

  static _carveTunnel(targetChunkX, targetChunkZ, originX, originZ, chunkBlocks, rand, xCave, yCave, zCave, thickness, yRot, xRot, step, dist, yScale) {
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
    const STONE = "minecraft:stone";
    const DEEPSLATE = "minecraft:deepslate";
    const DIRT = "minecraft:dirt";
    const GRASS = "minecraft:grass_block";

    for (; step < dist; step++) {
      const rad = 1.5 + (Math.sin((step * Math.PI) / dist) * thickness);
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

      xRota *= 0.90;
      yRota *= 0.75;
      xRota += (rand.nextFloat() - rand.nextFloat()) * rand.nextFloat() * 2;
      yRota += (rand.nextFloat() - rand.nextFloat()) * rand.nextFloat() * 4;

      if (!singleStep && step === splitPoint && thickness > 1) {
        this._carveTunnel(targetChunkX, targetChunkZ, originX, originZ, chunkBlocks, rand, xCave, yCave, zCave, rand.nextFloat() * 0.5 + 0.5, yRot - Math.PI / 2, xRot / 3, step, dist, 1.0);
        this._carveTunnel(targetChunkX, targetChunkZ, originX, originZ, chunkBlocks, rand, xCave, yCave, zCave, rand.nextFloat() * 0.5 + 0.5, yRot + Math.PI / 2, xRot / 3, step, dist, 1.0);
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

      // Water Guard check
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
      if (hasWater) continue; // Protección de agua: no vaciar océanos o ríos

      // Excavación de volumen esférico sobre la rejilla en memoria chunkBlocks
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
              if (currentBlock === STONE || currentBlock === DEEPSLATE || currentBlock === DIRT || currentBlock === GRASS) {
                if (y < -54) {
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

// ============== WORLD GENERATOR ==============
export class WorldGenerator {
  static _noiseCache = new Map();

  static _stringHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  static _getOrCreateNoiseForWorld(worldName) {
    if (this._noiseCache.has(worldName)) {
      return this._noiseCache.get(worldName);
    }
    const seed = this._stringHash(worldName);
    const noiseMain = new OctavePerlinNoise3D(4, seed + 1001);
    const noiseCave = new OctavePerlinNoise3D(3, seed + 2002);
    const noiseBeach = new OctavePerlinNoise3D(2, seed + 3003);
    const noise = { noiseMain, noiseCave, noiseBeach };
    this._noiseCache.set(worldName, noise);
    return noise;
  }

  static _debugWarn(message, context = null) {
    if (!MW_DEBUG) return;
    if (context) {
      console.warn(`[MultiWorld][debug] ${message}`, context);
      return;
    }
    console.warn(`[MultiWorld][debug] ${message}`);
  }

  static _fillColumnRange(dimension, x, z, yFrom, yTo, blockId) {
    if (yTo < yFrom) return true;
    try {
      dimension.fillBlocks(
        { x, y: yFrom, z },
        { x, y: yTo, z },
        blockId
      );
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

  static _frac(v) {
    return v - Math.floor(v);
  }

  static _hash2(x, z, seed = 0) {
    return this._frac(Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123);
  }

  static _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  static _fade(t) {
    return t * t * (3 - 2 * t);
  }

  static _valueNoise2D(x, z, seed = 0) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const tx = this._fade(x - x0);
    const tz = this._fade(z - z0);

    const a = this._hash2(x0, z0, seed);
    const b = this._hash2(x0 + 1, z0, seed);
    const c = this._hash2(x0, z0 + 1, seed);
    const d = this._hash2(x0 + 1, z0 + 1, seed);

    const ab = this._lerp(a, b, tx);
    const cd = this._lerp(c, d, tx);
    return this._lerp(ab, cd, tz);
  }

  static _naturalTopYAt(x, z) {
    const broad = this._valueNoise2D(x * 0.012, z * 0.012, 11) * 2 - 1;
    const medium = this._valueNoise2D(x * 0.03, z * 0.03, 29) * 2 - 1;
    const detail = this._valueNoise2D(x * 0.06, z * 0.06, 53) * 2 - 1;
    const y = 70 + Math.round(broad * 8 + medium * 4 + detail * 2);
    return Math.max(58, Math.min(86, y));
  }

  static _slopeAt(x, z) {
    // Cheap slope approximation from height deltas.
    const h = this._naturalTopYAt(x, z);
    const hx = this._naturalTopYAt(x + 3, z);
    const hz = this._naturalTopYAt(x, z + 3);
    return Math.abs(hx - h) + Math.abs(hz - h);
  }

  static _soilProfileAt(x, z) {
    // Goal: vanilla-like variability without discrete fixed depths.
    // - Flatter areas -> deeper soil
    // - Steeper slopes -> thinner soil / more exposed stone
    const broad = this._valueNoise2D(x * 0.015, z * 0.015, 97); // 0..1
    const detail = this._valueNoise2D(x * 0.09, z * 0.09, 131); // 0..1
    const slope = this._slopeAt(x, z); // 0+
    const slopeFactor = Math.max(0, Math.min(1, slope / 8)); // 0..1

    // Continuous depth targets (not just 4/5/6).
    // Typical vanilla feel: 2..7 with bias toward 3..5.
    let dirtDepth = 2.5 + broad * 3.2 + detail * 1.6; // ~2.5..7.3
    dirtDepth = dirtDepth * (1 - 0.55 * slopeFactor); // reduce on slopes
    dirtDepth = Math.max(2, Math.min(7, dirtDepth));

    // Occasional coarse dirt patches, mostly on flatter areas.
    const coarseChance = (detail > 0.82 && slopeFactor < 0.25);
    const useCoarseTop = coarseChance && (this._hash2(x, z, 911) > 0.7);

    return {
      dirtDepth,
      topBlock: "minecraft:grass_block",
      dirtBlock: useCoarseTop ? "minecraft:coarse_dirt" : "minecraft:dirt",
    };
  }

  // ============== ORE GENERATION API ==============
  static _oreRules = [];
  static _generationHooks = [];

  static _matchesScope(scope, ctx) {
    if (!scope) return true;
    const type = scope.type;
    const value = scope.value;
    if (!type || value === undefined || value === null) return true;

    if (type === "dimensionId") return String(ctx.dimensionId) === String(value);
    if (type === "worldName") return String(ctx.worldName).toLowerCase() === String(value).toLowerCase();
    if (type === "worldType") return String(ctx.worldType) === String(value);
    return true;
  }

  static registerGenerationHook(hook) {
    if (!hook || typeof hook !== "object") throw new Error("Generation hook must be an object");
    if (typeof hook.id !== "string" || !hook.id) throw new Error("Generation hook requires id");
    if (typeof hook.onChunkGenerated !== "function") throw new Error("Generation hook requires onChunkGenerated(ctx)");
    const normalized = {
      id: hook.id,
      scope: hook.scope ?? null,
      onChunkGenerated: hook.onChunkGenerated,
      seed: Number.isFinite(hook.seed) ? hook.seed : 0,
    };
    this._generationHooks = this._generationHooks.filter((h) => h.id !== normalized.id);
    this._generationHooks.push(normalized);
  }

  static getGenerationHooks() {
    return Array.from(this._generationHooks).map((h) => ({ id: h.id, scope: h.scope ?? null, seed: h.seed ?? 0 }));
  }

  static _makeDeterministicRandom(seed) {
    let x = (seed | 0) || 123456789;
    // xorshift32
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      // convert to 0..1
      return ((x >>> 0) % 0xFFFFFFFF) / 0xFFFFFFFF;
    };
  }

  static _runTasksSliced(tasks, options = {}) {
    if (!Array.isArray(tasks) || tasks.length === 0) return;
    const maxPerTick = Number.isFinite(options.maxPerTick) ? options.maxPerTick : 4;
    let idx = 0;
    const runSlice = () => {
      const end = Math.min(idx + maxPerTick, tasks.length);
      for (; idx < end; idx++) {
        try {
          tasks[idx]?.();
        } catch (e) {
          this._debugWarn("Generation hook task failed", { error: e?.message });
        }
      }
      if (idx >= tasks.length) return;
      system.runTimeout(runSlice, 1);
    };
    runSlice();
  }

  static runGenerationHooksForChunk(ctx) {
    if (!this._generationHooks.length) return;
    const scopeCtx = {
      worldName: ctx.worldName ?? "",
      dimensionId: ctx.dimensionId ?? "",
      worldType: ctx.worldType ?? "",
    };

    for (const hook of this._generationHooks) {
      if (!this._matchesScope(hook.scope, scopeCtx)) continue;
      const seed = (hook.seed ?? 0) + (ctx.chunkX * 73471) + (ctx.chunkZ * 91249);
      const random = this._makeDeterministicRandom(seed);
      const hookCtx = {
        ...ctx,
        random,
      };
      try {
        const result = hook.onChunkGenerated(hookCtx);
        // If hook returns an array of tasks, execute them sliced over ticks.
        if (Array.isArray(result) && result.length) {
          this._runTasksSliced(result, { maxPerTick: 4 });
        }
      } catch (e) {
        this._debugWarn("Generation hook failed", { error: e?.message, hookId: hook.id, scope: hook.scope });
      }
    }
  }

  static registerOreRule(rule) {
    if (!rule || typeof rule !== "object") throw new Error("Ore rule must be an object");
    if (typeof rule.id !== "string" || !rule.id) throw new Error("Ore rule requires id");
    if (typeof rule.blockId !== "string" || !rule.blockId) throw new Error("Ore rule requires blockId");
    const normalized = {
      id: rule.id,
      blockId: rule.blockId,
      minY: Number.isFinite(rule.minY) ? rule.minY : -64,
      maxY: Number.isFinite(rule.maxY) ? rule.maxY : 64,
      veinsPerChunk: Number.isFinite(rule.veinsPerChunk) ? rule.veinsPerChunk : 0,
      veinSize: Number.isFinite(rule.veinSize) ? rule.veinSize : 0,
      replace: Array.isArray(rule.replace) && rule.replace.length ? rule.replace : ["minecraft:stone"],
      seed: Number.isFinite(rule.seed) ? rule.seed : 0,
      scope: rule.scope ?? null,
    };
    this._oreRules = this._oreRules.filter((r) => r.id !== normalized.id);
    this._oreRules.push(normalized);
  }

  static getOreRules() {
    return Array.from(this._oreRules);
  }

  static _rand01(x, y, z, seed) {
    // deterministic pseudo-random 0..1
    return this._frac(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 11.131) * 43758.5453);
  }

  static _randomIntInclusive(x, y, z, seed, min, max) {
    const r = this._rand01(x, y, z, seed);
    return min + Math.floor(r * (max - min + 1));
  }

  static _tryPlaceOreBlock(dimension, x, y, z, perm, replaceList) {
    const b = dimension.getBlock({ x, y, z });
    if (!b) return false;
    if (!replaceList.includes(b.typeId)) return false;
    try {
      b.setPermutation(perm);
      return true;
    } catch (_) {
      return false;
    }
  }

  static generateOresForChunk(dimension, chunkX, chunkZ, ctx = {}) {
    if (!this._oreRules.length) return;
    const originX = chunkX * 16;
    const originZ = chunkZ * 16;
    const scopeCtx = {
      worldName: ctx.worldName ?? "",
      dimensionId: ctx.dimensionId ?? dimension?.id ?? "",
      worldType: ctx.worldType ?? "",
    };

    for (const rule of this._oreRules) {
      if (!this._matchesScope(rule.scope, scopeCtx)) continue;
      if (!rule.veinsPerChunk || !rule.veinSize) continue;
      const perm = BlockPermutation.resolve(rule.blockId);

      for (let v = 0; v < rule.veinsPerChunk; v++) {
        const seedBase = 20000 + rule.seed + v * 31 + chunkX * 101 + chunkZ * 103;
        const sx = originX + this._randomIntInclusive(originX, 0, originZ, seedBase + 1, 0, 15);
        const sz = originZ + this._randomIntInclusive(originX, 0, originZ, seedBase + 2, 0, 15);
        const sy = this._randomIntInclusive(originX, 0, originZ, seedBase + 3, rule.minY, rule.maxY);

        // Random walk vein, bounded inside chunk footprint (vanilla-ish)
        let x = sx;
        let y = sy;
        let z = sz;
        for (let i = 0; i < rule.veinSize; i++) {
          this._tryPlaceOreBlock(dimension, x, y, z, perm, rule.replace);
          const stepSeed = seedBase + 1000 + i * 7;
          x += this._randomIntInclusive(x, y, z, stepSeed + 1, -1, 1);
          y += this._randomIntInclusive(x, y, z, stepSeed + 2, -1, 1);
          z += this._randomIntInclusive(x, y, z, stepSeed + 3, -1, 1);
          x = Math.max(originX, Math.min(originX + 15, x));
          z = Math.max(originZ, Math.min(originZ + 15, z));
          y = Math.max(rule.minY, Math.min(rule.maxY, y));
        }
      }
    }
  }

  static _initChunks(worldName) {
    if (!generatedChunks.has(worldName)) generatedChunks.set(worldName, new Set());
  }

  // ── Flat ─────────────────────────────────────────────────────────────────
  // Sin árboles. Usa getBlock+setPermutation (probado como funcional).
  // Genera directamente sin verificar carga de chunks (como el viejo.js que funcionaba).
  static generateFlatChunk(dimension, chunkX, chunkZ, worldName) {
      this._initChunks(worldName);
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

      // Si el chunk aun no esta cargado, no lo marques como generado.
      // Esto evita huecos "en damero" cuando system.run intenta escribir fuera de area activa.
      const testBlock = dimension.getBlock({ x: startX + 8, y: baseY, z: startZ + 8 });
      if (testBlock === undefined) {
        return false;
      }

      // Si ya hay terreno en el centro, se considera listo.
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
                this._debugWarn("Failed to set block permutation in flat generation", {
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

  // ── Void ─────────────────────────────────────────────────────────────────
  static generateVoidChunk(dimension, cx, cz, worldName) {
    if (!worldsData.has(worldName)) return false;
    this._initChunks(worldName);
    const key = `${cx},${cz}`;
    if (generatedChunks.get(worldName).has(key)) return true;
    generatedChunks.get(worldName).add(key);
    markWorldDataDirty();
    return true;
  }

  // ── Normal (vanilla-like overworld with oak trees) ───────────────────────
  static generateNormalChunk(dimension, chunkX, chunkZ, worldName) {
    if (!worldsData.has(worldName)) return false;
    this._initChunks(worldName);
    const key = `${chunkX},${chunkZ}`;
    if (generatedChunks.get(worldName).has(key)) return true;

    const originX = chunkX * 16;
    const originZ = chunkZ * 16;
    const probeY = this._naturalTopYAt(originX + 8, originZ + 8);
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
        const topY = this._naturalTopYAt(x, z);
        const soil = this._soilProfileAt(x, z);
        const dirtDepth = soil.dirtDepth;
        const dirtStartY = topY - Math.floor(dirtDepth);
        const stoneTopY = dirtStartY - 1;

        this._fillColumnRange(dimension, x, z, -64, -64, BEDROCK);
        this._fillColumnRange(dimension, x, z, -63, stoneTopY, STONE);
        this._fillColumnRange(dimension, x, z, dirtStartY, topY - 1, soil.dirtBlock);
        this._fillColumnRange(dimension, x, z, topY, topY, soil.topBlock ?? GRASS);
      }
    }

    // Minerals/ores (vanilla-like rules). Runs after base terrain, before hooks/features.
    this.generateOresForChunk(dimension, chunkX, chunkZ, {
      worldName,
      dimensionId: dimension.id,
      worldType: WORLD_TYPES.NORMAL,
    });

    // Custom generation hooks (scoped). Hooks may schedule sliced tasks.
    this.runGenerationHooksForChunk({
      dimension,
      chunkX,
      chunkZ,
      worldName,
      dimensionId: dimension.id,
      worldType: WORLD_TYPES.NORMAL,
      originX,
      originZ,
    });

    // Arboles de roble: densidad moderada y separacion simple por grilla.
    for (let lx = 1; lx < 15; lx++) {
      for (let lz = 1; lz < 15; lz++) {
        const x = originX + lx;
        const z = originZ + lz;
        const treeChance = this._hash2(x, z, 701);
        if (treeChance < 0.975) continue;
        if ((Math.abs(x) + Math.abs(z)) < 8) continue; // evita spawn exacto saturado
        if (x % 5 !== 0 || z % 5 !== 0) continue;

        const groundY = this._naturalTopYAt(x, z);
        const above = dimension.getBlock({ x, y: groundY + 1, z });
        if (!above || above.typeId !== "minecraft:air") continue;

        const trunkHeight = 4 + Math.floor(this._hash2(x, z, 719) * 2);
        for (let h = 1; h <= trunkHeight; h++) {
          try { dimension.getBlock({ x, y: groundY + h, z })?.setPermutation(oakLog); } catch (error) {
            this._debugWarn("Failed to place oak log", { error: error?.message, worldName, chunkX, chunkZ, x, y: groundY + h, z });
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
                  this._debugWarn("Failed to place oak leaves", { error: error?.message, worldName, chunkX, chunkZ, x: ax, y: ay, z: az });
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

  // ── Skyblock ─────────────────────────────────────────────────────────────
  static generateSkyblockChunk(dimension, cx, cz, worldName) {
    if (!worldsData.has(worldName)) return false;
    this._initChunks(worldName);
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

      // Isla en forma de L: 10 bloques por lado.
      const min = -5;
      const max = 4; // total 10 bloques
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

      // Cofre en el brazo izquierdo.
      try {
        const chestBlock = dimension.getBlock({ x: -4, y: topY + 1, z: -4 });
        if (chestBlock) chestBlock.setPermutation(chest);
      } catch (_) {}

      // Arbol en el extremo del brazo derecho.
      const treeX = 3;
      const treeZ = 3;
      for (let h = 0; h < 4; h++) {
        try {
          dimension.getBlock({ x: treeX, y: topY + 1 + h, z: treeZ })?.setPermutation(oakLog);
        } catch (error) {
          this._debugWarn("Failed to place skyblock trunk", { error: error?.message, worldName, x: treeX, y: topY + 1 + h, z: treeZ });
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
                this._debugWarn("Failed to place skyblock leaves", { error: error?.message, worldName, x, y, z });
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

  // ── PocketMC 3D Overworld Generator (Perlin Noise 3D + Sub-chunk Trilinear Interpolation) ──
  static generatePocketMCChunk(dimension, chunkX, chunkZ, worldName) {
    if (!worldsData.has(worldName)) return false;
    this._initChunks(worldName);
    const key = `${chunkX},${chunkZ}`;
    if (isExperimentalChunkGenerated(worldName, chunkX, chunkZ)) return true;
    if (generatedChunks.get(worldName).has(key)) return true;

    const originX = chunkX * 16;
    const originZ = chunkZ * 16;

    // Probe block at center of chunk at Y=64 to check chunk readiness
    const probe = dimension.getBlock({ x: originX + 8, y: 64, z: originZ + 8 });
    if (probe === undefined) return false; // Chunk not loaded in Bedrock engine yet

    const BEDROCK = "minecraft:bedrock";
    const DEEPSLATE = "minecraft:deepslate";
    const STONE = "minecraft:stone";
    const DIRT = "minecraft:dirt";
    const GRASS = "minecraft:grass_block";
    const SAND = "minecraft:sand";
    const GRAVEL = "minecraft:gravel";
    const WATER = "minecraft:water";
    const AIR = "minecraft:air";

    const oakLog = BlockPermutation.resolve("minecraft:oak_log");
    const oakLeaves = BlockPermutation.resolve("minecraft:oak_leaves");
    const birchLog = BlockPermutation.resolve("minecraft:birch_log");
    const birchLeaves = BlockPermutation.resolve("minecraft:birch_leaves");

    // Obtener generadores de ruido deterministas compartidos por todo el mundo (continuidad sin cortes entre chunks)
    const { noiseMain, noiseCave, noiseBeach } = this._getOrCreateNoiseForWorld(worldName);

    const minY = -64;
    const waterHeight = 62;

    // Malla de densidad 5 x 25 x 5 (425 puntos de densidad por chunk)
    const densityGrid = new Float32Array(5 * 25 * 5);
    for (let xc = 0; xc <= 4; xc++) {
      for (let zc = 0; zc <= 4; zc++) {
        const wx = originX + xc * 4;
        const wz = originZ + zc * 4;
        for (let yc = 0; yc <= 24; yc++) {
          const wy = minY + yc * 8;
          // Curva de altura del terreno estilo MCPE PocketMC
          const targetY = 66 + noiseMain.getValue(wx * 0.008, wy * 0.008, wz * 0.008) * 28;
          let density = noiseMain.getValue(wx * 0.02, wy * 0.03, wz * 0.02) - ((wy - targetY) / 32);

          // Cueva 3D PocketMC (tallado de túneles bajo nivel del agua)
          if (wy < waterHeight - 4 && wy > -55) {
            const caveVal = noiseCave.getValue(wx * 0.045, wy * 0.05, wz * 0.045);
            if (caveVal > 0.46) {
              density = -1.0; // hueco de cueva
            }
          }

          densityGrid[(xc * 25 + yc) * 5 + zc] = density;
        }
      }
    }

    // Estructurar rejilla de memoria 16x16 para los 193 bloques de altura del chunk
    const chunkBlocks = new Array(16);
    for (let lx = 0; lx < 16; lx++) {
      chunkBlocks[lx] = new Array(16);
      for (let lz = 0; lz < 16; lz++) {
        chunkBlocks[lx][lz] = new Array(193);
      }
    }

    // 1) Interpolación trilineal del terreno base sobre la memoria RAM
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
              // Ruido 3D para la transición orgánica entre Piedra y Deepslate (elimina la línea plana)
              const deepslateNoise = noiseBeach.getValue(worldX * 0.04, absoluteY * 0.08, worldZ * 0.04) * 9.0;
              const deepslateThreshold = -16 + deepslateNoise;

              if (absoluteY < deepslateThreshold) {
                col[yIndex] = DEEPSLATE;
              } else {
                col[yIndex] = STONE;
              }
            } else {
              if (absoluteY <= waterHeight) {
                col[yIndex] = WATER;
              } else {
                col[yIndex] = AIR;
              }
            }
          }
        }
      }
    }

    // 2) Excavación de Cuevas de Gusano estilo PocketMC (Worm Carvers + Salones + Lava + Anti-Agua)
    const worldSeed = this._stringHash(worldName);
    PocketMCCaveCarver.carveCaves(chunkX, chunkZ, worldSeed, chunkBlocks);

    // 3) Determinar superficie de bioma, césped y playas (PocketMC buildSurfaces)
    for (let lx = 0; lx < 16; lx++) {
      for (let lz = 0; lz < 16; lz++) {
        const worldX = originX + lx;
        const worldZ = originZ + lz;
        const col = chunkBlocks[lx][lz];

        let highestSolidY = -64;
        for (let yIndex = 192; yIndex >= 0; yIndex--) {
          const b = col[yIndex];
          if (b === STONE || b === DEEPSLATE) {
            highestSolidY = minY + yIndex;
            break;
          }
        }

        if (highestSolidY > -64) {
          const beachVal = noiseBeach.getValue(worldX * 0.03, 0, worldZ * 0.03);
          const isBeach = highestSolidY >= waterHeight - 3 && highestSolidY <= waterHeight + 4;
          const isSubmerged = highestSolidY <= waterHeight;

          // Profundidad de tierra variable que oscila suavemente entre 5 y 9 bloques para tierra firme
          const dirtDepth = Math.floor(5 + Math.abs(noiseBeach.getValue(worldX * 0.05, 12, worldZ * 0.05)) * 4.9);

          // Determinar si la columna pertenece a playa o lecho acuático (arena/grava)
          const useSandBed = isSubmerged ? (beachVal > -0.45) : (isBeach && beachVal > -0.15);
          const useGravelBed = isSubmerged ? (beachVal > 0.55) : (isBeach && beachVal > 0.45);

          const surfaceDepth = (useSandBed || useGravelBed) ? Math.min(4, dirtDepth) : dirtDepth;

          for (let depth = 0; depth < surfaceDepth; depth++) {
            const currentY = highestSolidY - depth;
            const yIdx = currentY - minY;
            if (yIdx < 0 || yIdx > 192) continue;

            if (useGravelBed) {
              col[yIdx] = GRAVEL;
            } else if (useSandBed) {
              col[yIdx] = SAND;
            } else if (depth === 0) {
              col[yIdx] = GRASS;
            } else {
              col[yIdx] = DIRT;
            }
          }
        }

        // 4) Relleno optimizado por rangos verticales (fillBlocks batch)
        let segStart = 0;
        let currentBlock = col[0];

        for (let i = 1; i <= 192; i++) {
          const nextBlock = col[i];
          if (nextBlock !== currentBlock || i === 192) {
            const yFrom = minY + segStart;
            const yTo = minY + (i === 192 && nextBlock === currentBlock ? i : i - 1);
            if (currentBlock !== AIR) {
              this._fillColumnRange(dimension, worldX, worldZ, yFrom, yTo, currentBlock);
            }
            segStart = i;
            currentBlock = nextBlock;
          }
        }
      }
    }

    // Minerales vanilla (OreRules)
    this.generateOresForChunk(dimension, chunkX, chunkZ, {
      worldName,
      dimensionId: dimension.id,
      worldType: WORLD_TYPES.EXPERIMENTAL,
    });

    // Custom Generation Hooks
    this.runGenerationHooksForChunk({
      dimension,
      chunkX,
      chunkZ,
      worldName,
      dimensionId: dimension.id,
      worldType: WORLD_TYPES.EXPERIMENTAL,
      originX,
      originZ,
    });

    // Decorador de Árboles (Oak y Birch estilo PocketMC)
    for (let lx = 2; lx < 14; lx += 4) {
      for (let lz = 2; lz < 14; lz += 4) {
        const x = originX + lx;
        const z = originZ + lz;
        const treeHash = this._hash2(x, z, 909);
        if (treeHash < 0.72) continue;

        let groundY = -64;
        for (let y = 120; y >= 60; y--) {
          const b = dimension.getBlock({ x, y, z });
          if (b && b.typeId === GRASS) {
            groundY = y;
            break;
          }
        }
        if (groundY < 62) continue; // no plantamos árboles bajo agua

        const isBirch = treeHash > 0.88;
        const logPerm = isBirch ? birchLog : oakLog;
        const leafPerm = isBirch ? birchLeaves : oakLeaves;
        const trunkHeight = 4 + Math.floor(this._hash2(x, z, 123) * 3);

        for (let h = 1; h <= trunkHeight; h++) {
          try { dimension.getBlock({ x, y: groundY + h, z })?.setPermutation(logPerm); } catch (_) {}
        }

        const leafCenter = groundY + trunkHeight;
        for (let ax = x - 2; ax <= x + 2; ax++) {
          for (let az = z - 2; az <= z + 2; az++) {
            for (let ay = leafCenter - 1; ay <= leafCenter + 2; ay++) {
              if (Math.abs(ax - x) + Math.abs(az - z) + Math.abs(ay - leafCenter) > 4) continue;
              const lb = dimension.getBlock({ x: ax, y: ay, z: az });
              if (lb?.typeId === AIR) {
                try { lb.setPermutation(leafPerm); } catch (_) {}
              }
            }
          }
        }
      }
    }

    generatedChunks.get(worldName).add(key);
    markExperimentalChunkGenerated(worldName, chunkX, chunkZ);
    markWorldDataDirty();
    return true;
  }

    // ── Generación continua ───────────────────────────────────────────────────
  
    static generateAroundPlayer(player, worldName) {
    const worldData = WorldManager.getWorld(worldName);
    if (!worldData) return;

    this._initChunks(worldName);
    const chunkSet = generatedChunks.get(worldName);
    const dimension = mcWorld.getDimension(worldData.dimensionId);
    const playerChunkX = Math.floor(player.location.x / 16);
    const playerChunkZ = Math.floor(player.location.z / 16);

    // Ordena por cercania (primero lo visible alrededor del jugador).
    const offsets = [];
    for (let dx = -GENERATION_RADIUS; dx <= GENERATION_RADIUS; dx++) {
      for (let dz = -GENERATION_RADIUS; dz <= GENERATION_RADIUS; dz++) {
        offsets.push({ dx, dz, dist2: dx * dx + dz * dz });
      }
    }
    offsets.sort((a, b) => a.dist2 - b.dist2);

    let generatedThisCycle = 0;
    for (const { dx, dz } of offsets) {
      if (generatedThisCycle >= CHUNKS_PER_TICK) break;

      const chunkX = playerChunkX + dx;
      const chunkZ = playerChunkZ + dz;
      const chunkKey = `${chunkX},${chunkZ}`;

      if (worldData.type === WORLD_TYPES.EXPERIMENTAL) {
        if (isExperimentalChunkGenerated(worldName, chunkX, chunkZ)) continue;
      } else {
        if (chunkSet.has(chunkKey)) continue;
      }

      let ok = false;
      switch (worldData.type) {
        case WORLD_TYPES.NORMAL:
          ok = this.generateNormalChunk(dimension, chunkX, chunkZ, worldName);
          break;
        case WORLD_TYPES.EXPERIMENTAL:
          ok = this.generatePocketMCChunk(dimension, chunkX, chunkZ, worldName);
          break;
        case WORLD_TYPES.FLAT:
          ok = this.generateFlatChunk(dimension, chunkX, chunkZ, worldName);
          break;
        case WORLD_TYPES.VOID:
          ok = this.generateVoidChunk(dimension, chunkX, chunkZ, worldName);
          break;
        case WORLD_TYPES.SKYBLOCK:
          ok = this.generateSkyblockChunk(dimension, chunkX, chunkZ, worldName);
          break;
      }

      // Solo cuenta trabajo realmente aplicado/confirmado.
      if (ok) generatedThisCycle++;
    }

    // Volcado de regiones dirty estilo PocketMC (UnsavedChunkList)
    WorldManager.flushDirtyRegionsBatch(2);
  }


  // ── Borrado masivo (async, lotes) ─────────────────────────────────────────
  static clearGeneratedChunksAsync(
    worldName,
    dimensionId,
    spawnChunk,
    player,
    onDone,
    trackedChunkKeys = null,
    options = {}
  ) {
    const dimension = mcWorld.getDimension(dimensionId);
    const CLEAR_TILE_SIZE_CHUNKS = 15; // 15x15 = 225 chunks (mas rapido y bajo limite de 300)
    const PROGRESS_MESSAGE_EVERY_BATCHES = 1;
    const CHUNKS_PER_SLICE = 6; // anti-watchdog: corta trabajo pesado en micro-lotes

    const Y_SEGMENTS = [
      { from: -64, to:  35 },
      { from:  36, to: 135 },
      { from: 136, to: 235 },
      { from: 236, to: 320 },
    ];

    const todo = [];
    const seen = new Set();
    const pushChunk = (cx, cz) => {
      const key = `${cx},${cz}`;
      if (seen.has(key)) return;
      seen.add(key);
      todo.push({ cx, cz });
    };

    if (Array.isArray(trackedChunkKeys) && trackedChunkKeys.length > 0) {
      for (const chunkKey of trackedChunkKeys) {
        const [cxRaw, czRaw] = chunkKey.split(",");
        const cx = Number.parseInt(cxRaw, 10);
        const cz = Number.parseInt(czRaw, 10);
        if (Number.isNaN(cx) || Number.isNaN(cz)) continue;
        pushChunk(cx, cz);
      }
    }

    const { x: cx0, z: cz0 } = spawnChunk;
    const includeSafetySweep = options.includeSafetySweep ?? false;
    const safetySweepEnabled = options.safetySweepEnabled ?? DELETE_SAFETY_SWEEP;
    const configuredFallbackRadius = Number.isFinite(options.fallbackRadius) ? options.fallbackRadius : CLEAR_RADIUS;
    const configuredTrackedExtraRadius = Number.isFinite(options.trackedExtraRadius)
      ? options.trackedExtraRadius
      : DELETE_SAFETY_RADIUS_WHEN_TRACKED;
    const shouldSweep = includeSafetySweep && safetySweepEnabled;
    const extraRadius = shouldSweep
      ? (Number.isFinite(options.safetyRadius) ? options.safetyRadius : DELETE_SAFETY_RADIUS)
      : 0;
    const extraRadiusWhenTracked = shouldSweep ? configuredTrackedExtraRadius : 0;
    const fallbackRadius = trackedChunkKeys?.length
      ? extraRadiusWhenTracked
      : Math.max(configuredFallbackRadius, extraRadius);
    for (let r = 0; r <= fallbackRadius; r++) {
      if (r === 0) { pushChunk(cx0, cz0); continue; }
      for (let i = -r; i <= r; i++) {
        pushChunk(cx0 + i, cz0 - r);
        pushChunk(cx0 + i, cz0 + r);
      }
      for (let i = -r + 1; i <= r - 1; i++) {
        pushChunk(cx0 - r, cz0 + i);
        pushChunk(cx0 + r, cz0 + i);
      }
    }

    const totalChunks  = todo.length;
    const totalBatches = Math.ceil(totalChunks / CLEAR_BATCH_SIZE);
    let index = 0, batchNum = 0, tickCount = 0;
    let batchInProgress = false;
    const startedAt = Date.now();
    if (totalChunks === 0) {
      const result = {
        requestedChunks: 0,
        clearedChunks: 0,
        elapsedMs: 0,
        mode: options.mode ?? "unknown",
        usedTracked: Array.isArray(trackedChunkKeys) && trackedChunkKeys.length > 0,
      };
      if (MW_METRICS || MW_DEBUG) {
        console.log(`[MultiWorld] Cleanup metrics`, result);
      }
      onDone(result);
      return;
    }

    const startNextBatch = () => {
      if (index >= totalChunks) return false;
      batchNum++;

      const batchEnd = Math.min(index + CLEAR_BATCH_SIZE, totalChunks);
      const batch = todo.slice(index, batchEnd);

      const clearChunkColumns = (cx, cz) => {
        const x0 = cx * 16;
        const z0 = cz * 16;
        const x1 = x0 + 15;
        const z1 = z0 + 15;
        for (const seg of Y_SEGMENTS) {
          try {
            dimension.runCommand(`fill ${x0} ${seg.from} ${z0} ${x1} ${seg.to} ${z1} air`);
          } catch (_) {
            try {
              dimension.fillBlocks(
                { x: x0, y: seg.from, z: z0 },
                { x: x1, y: seg.to, z: z1 },
                "minecraft:air"
              );
            } catch (_e) {}
          }
        }
      };

      const buildTileChunkList = (tile) => {
        const tileChunks = [];
        for (let cx = tile.minCX; cx <= tile.maxCX; cx++) {
          for (let cz = tile.minCZ; cz <= tile.maxCZ; cz++) {
            tileChunks.push({ cx, cz });
          }
        }
        return tileChunks;
      };

      const clearTileChunksAsync = (tile, done) => {
        const tileChunks = buildTileChunkList(tile);
        let tileCursor = 0;
        const runSlice = () => {
          const end = Math.min(tileCursor + CHUNKS_PER_SLICE, tileChunks.length);
          for (; tileCursor < end; tileCursor++) {
            const { cx, cz } = tileChunks[tileCursor];
            clearChunkColumns(cx, cz);
          }
          if (tileCursor >= tileChunks.length) {
            done();
            return;
          }
          system.runTimeout(runSlice, 1);
        };
        runSlice();
      };

      const tiles = new Map();
      for (const { cx, cz } of batch) {
        const tileX = Math.floor(cx / CLEAR_TILE_SIZE_CHUNKS);
        const tileZ = Math.floor(cz / CLEAR_TILE_SIZE_CHUNKS);
        const tileKey = `${tileX},${tileZ}`;
        if (!tiles.has(tileKey)) {
          const minCX = tileX * CLEAR_TILE_SIZE_CHUNKS;
          const minCZ = tileZ * CLEAR_TILE_SIZE_CHUNKS;
          const maxCX = minCX + CLEAR_TILE_SIZE_CHUNKS - 1;
          const maxCZ = minCZ + CLEAR_TILE_SIZE_CHUNKS - 1;
          tiles.set(tileKey, { minCX, minCZ, maxCX, maxCZ });
        }
      }
      const tileList = Array.from(tiles.values());

      const processTileSequentially = (tileIndex) => {
        if (tileIndex >= tileList.length) {
          index = batchEnd;
          if (batchNum % PROGRESS_MESSAGE_EVERY_BATCHES === 0 || index >= totalChunks) {
            const elapsedMinutes = Math.max((Date.now() - startedAt) / 60000, 1 / 60000);
            const chunksPerMinute = Math.floor(index / elapsedMinutes);
            try {
              player?.sendMessage(
                `${Color.yellow}[MW] Clearing... batch ${batchNum}/${totalBatches} (${index}/${totalChunks}) | speed ~${chunksPerMinute.toLocaleString()} chunks/min${Color.reset}`
              );
            } catch (_) {}
          }

          if (index >= totalChunks) {
            system.clearRun(intervalId);
            generatedChunks.delete(worldName);
            this._noiseCache.delete(worldName);
            markWorldDataDirty();
            const elapsedMs = Date.now() - startedAt;
            const result = {
              requestedChunks: totalChunks,
              clearedChunks: totalChunks,
              elapsedMs,
              mode: options.mode ?? "unknown",
              usedTracked: Array.isArray(trackedChunkKeys) && trackedChunkKeys.length > 0,
            };
            if (MW_METRICS || MW_DEBUG) {
              console.log(`[MultiWorld] Cleanup metrics`, result);
            }
            onDone(result);
          }
          batchInProgress = false;
          return;
        }

        const tile = tileList[tileIndex];
        const fromX = tile.minCX * 16;
        const fromZ = tile.minCZ * 16;
        const toX = tile.maxCX * 16 + 15;
        const toZ = tile.maxCZ * 16 + 15;
        const areaId = `mw_clear_${worldName}_${batchNum}_${tileIndex}`;
        const from = { x: fromX, y: -64, z: fromZ };
        const to = { x: toX, y: 320, z: toZ };

        if (mcWorld.tickingAreaManager.hasTickingArea(areaId)) {
          mcWorld.tickingAreaManager.removeTickingArea(areaId);
        }

        mcWorld.tickingAreaManager
          .createTickingArea(areaId, { dimension, from, to })
          .then(() => {
            clearTileChunksAsync(tile, () => {
              if (mcWorld.tickingAreaManager.hasTickingArea(areaId)) {
                mcWorld.tickingAreaManager.removeTickingArea(areaId);
              }
              processTileSequentially(tileIndex + 1);
            });
          })
          .catch((error) => {
            // Fallback: intenta limpiar aun sin ticking area y continua.
            this._debugWarn("Ticking area creation failed, fallback clear", {
              error: error?.message,
              worldName,
              batchNum,
              tileIndex,
              areaId,
            });
            clearTileChunksAsync(tile, () => {
              processTileSequentially(tileIndex + 1);
            });
          });
      };

      processTileSequentially(0);
      return true;
    };

    const intervalId = system.runInterval(() => {
      if (batchInProgress) return;
      tickCount++;
      if (tickCount < CLEAR_TICKS_PER_BATCH) return;
      tickCount = 0;
      batchInProgress = true;

      let launched = 0;
      const launchLoop = () => {
        if (launched >= CLEAR_BATCHES_PER_CYCLE || index >= totalChunks) {
          batchInProgress = false;
          return;
        }
        launched++;
        startNextBatch();
      };

      launchLoop();
    }, 1);
  }
}
