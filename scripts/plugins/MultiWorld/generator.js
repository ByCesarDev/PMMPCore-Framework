import { world as mcWorld, system, BlockPermutation } from "@minecraft/server";
import { Color } from "../../PMMPCore.js";
import { worldsData, generatedChunks, markWorldDataDirty } from "./state.js";
import { WorldManager } from "./manager.js";
import {
  WORLD_TYPES, FLAT_WORLD_TOP_Y, GENERATION_RADIUS, CHUNKS_PER_TICK,
  CLEAR_RADIUS, CLEAR_BATCH_SIZE, CLEAR_TICKS_PER_BATCH, DELETE_SAFETY_SWEEP, DELETE_SAFETY_RADIUS,
  DELETE_SAFETY_RADIUS_WHEN_TRACKED, CLEAR_BATCHES_PER_CYCLE, MW_DEBUG, MW_METRICS,
} from "./config.js";

// ============== WORLD GENERATOR ==============
export class WorldGenerator {
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

  static generateOresForChunk(dimension, chunkX, chunkZ) {
    if (!this._oreRules.length) return;
    const originX = chunkX * 16;
    const originZ = chunkZ * 16;

    for (const rule of this._oreRules) {
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

    // Minerals/ores (vanilla-like rules). Runs after base terrain, before trees.
    this.generateOresForChunk(dimension, chunkX, chunkZ);

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
      if (chunkSet.has(chunkKey)) continue;

      let ok = false;
      switch (worldData.type) {
        case WORLD_TYPES.NORMAL:
          ok = this.generateNormalChunk(dimension, chunkX, chunkZ, worldName);
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
