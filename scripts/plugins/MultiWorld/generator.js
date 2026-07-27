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

// Isolated generators per world type
import { generateFlatChunk as flatGen } from "./generators/flatGenerator.js";
import { generateVoidChunk as voidGen } from "./generators/voidGenerator.js";
import { generateNormalChunk as normalGen } from "./generators/normalGenerator.js";
import { generateSkyblockChunk as skyblockGen } from "./generators/skyblockGenerator.js";
import { generateExperimentalChunk as experimentalGen } from "./generators/experimental/experimentalGenerator.js";

// ============== WORLD GENERATOR ROUTER ==============
export class WorldGenerator {
  static _noiseCache = new Map();

  // API Ores y Hooks
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
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
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
    const frac = (v) => v - Math.floor(v);
    return frac(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 11.131) * 43758.5453);
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

  static _debugWarn(message, context = null) {
    if (!MW_DEBUG) return;
    if (context) {
      console.warn(`[MultiWorld][debug] ${message}`, context);
      return;
    }
    console.warn(`[MultiWorld][debug] ${message}`);
  }

  // Delegaciones hacia generadores aislados
  static generateFlatChunk(dimension, chunkX, chunkZ, worldName) {
    return flatGen(dimension, chunkX, chunkZ, worldName);
  }

  static generateVoidChunk(dimension, cx, cz, worldName) {
    return voidGen(dimension, cx, cz, worldName);
  }

  static generateNormalChunk(dimension, chunkX, chunkZ, worldName) {
    return normalGen(dimension, chunkX, chunkZ, worldName, {
      generateOres: (dim, cx, cz, ctx) => this.generateOresForChunk(dim, cx, cz, ctx),
      runHooks: (ctx) => this.runGenerationHooksForChunk(ctx),
    });
  }

  static generateSkyblockChunk(dimension, cx, cz, worldName) {
    return skyblockGen(dimension, cx, cz, worldName);
  }

  static generatePocketMCChunk(dimension, chunkX, chunkZ, worldName) {
    return experimentalGen(dimension, chunkX, chunkZ, worldName, {
      generateOres: (dim, cx, cz, ctx) => this.generateOresForChunk(dim, cx, cz, ctx),
      runHooks: (ctx) => this.runGenerationHooksForChunk(ctx),
    });
  }

  static generateAroundPlayer(player, worldName) {
    return this.generateChunkForWorld(player, worldName);
  }

  static generateChunkForWorld(player, worldName) {
    if (!worldsData.has(worldName)) return;

    const worldData = worldsData.get(worldName);
    const dimensionId = worldData.dimensionId ?? worldData.dimension ?? player?.dimension?.id;
    if (typeof dimensionId !== "string" || !dimensionId) return;

    const dimension = player?.dimension?.id === dimensionId ? player.dimension : mcWorld.getDimension(dimensionId);
    if (!dimension) return;

    const playerChunkX = Math.floor(player.location.x / 16);
    const playerChunkZ = Math.floor(player.location.z / 16);

    if (!generatedChunks.has(worldName)) {
      generatedChunks.set(worldName, new Set());
    }
    const chunkSet = generatedChunks.get(worldName);

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

      if (ok) generatedThisCycle++;
    }

    WorldManager.flushDirtyRegionsBatch(2);
  }

  // Borrado masivo (async, lotes)
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
    const CLEAR_TILE_SIZE_CHUNKS = 15;
    const PROGRESS_MESSAGE_EVERY_BATCHES = 1;
    const CHUNKS_PER_SLICE = 6;

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
