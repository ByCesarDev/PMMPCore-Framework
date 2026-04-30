import { world, system } from "@minecraft/server";
import { PMMPCore, Color } from "../../PMMPCore.js";
import { dimensionPool, GENERATION_TICK_RATE, MW_METRICS } from "./config.js";
import { isWorldDataDirty, getWorldNameByDimensionId, generatedChunks } from "./state.js";
import { WorldManager, RuntimeController, requestPersistFlush } from "./manager.js";
import { WorldGenerator } from "./generator.js";
import { setupCommands } from "./commands.js";

const MW_PERMISSION_SEED = {
  Admin: [
    "pperms.command.mw.help",
    "pperms.command.mw.list",
    "pperms.command.mw.info",
    "pperms.command.mw.main",
    "pperms.command.mw.tp",
    "pperms.command.mw.setspawn",
    "pperms.command.mw.setlobby",
    "pperms.command.mw.keepmode",
    "pperms.command.mw.create",
    "pperms.command.mw.delete",
    "pperms.command.mw.purgechunks",
    "pperms.command.mw.setmain",
  ],
};

console.log("[MultiWorld] Loading modular MultiWorld plugin...");

PMMPCore.registerPlugin({
  name: "MultiWorld",
  version: "1.0.0",
  depend: ["PMMPCore"],

  onEnable() {
    console.log("[MultiWorld] Enabling modular runtime...");
    if (this._isRuntimeRunning) {
      console.log("[MultiWorld] Runtime already enabled, skipping duplicate setup.");
      return;
    }

    this._isRuntimeRunning = true;
    this._intervalIds = [];
    this._subscriptions = [];
    this.worldDataLoaded = false;
    this._mwPermissionsSeeded = false;
    PMMPCore.getMigrationService()?.register("MultiWorld", 1, () => {});

    // Generacion continua alrededor del jugador en mundos activos.
    const generationIntervalId = system.runInterval(() => {
      RuntimeController.cleanupInactiveWorlds();

      for (const player of world.getAllPlayers()) {
        const worldName = getWorldNameByDimensionId(player.dimension.id);
        const playerWorld = worldName ? WorldManager.getWorld(worldName) : null;
        if (playerWorld && !playerWorld.loaded) continue;
        if (!playerWorld) continue;

        RuntimeController.updateActivity(playerWorld.id);
        WorldGenerator.generateAroundPlayer(player, playerWorld.id);
      }
    }, GENERATION_TICK_RATE);
    this._intervalIds.push(generationIntervalId);

    // Persistencia periodica.
    const autosaveIntervalId = system.runInterval(() => {
      if (isWorldDataDirty()) {
        requestPersistFlush("autosave");
      }
    }, 200);
    this._intervalIds.push(autosaveIntervalId);

    // Persistir ultima ubicacion de jugadores para restaurar en reconexion.
    const locationSaveIntervalId = system.runInterval(() => {
      for (const player of world.getAllPlayers()) {
        WorldManager.savePlayerLastLocation(player);
      }
    }, 40);
    this._intervalIds.push(locationSaveIntervalId);

    if (MW_METRICS) {
      this._metricsState = { lastChunkCount: 0, lastSampleAt: Date.now() };
      const metricsIntervalId = system.runInterval(() => {
        const now = Date.now();
        const currentChunkCount = Array.from(generatedChunks.values()).reduce((acc, set) => acc + set.size, 0);
        const deltaChunks = Math.max(0, currentChunkCount - this._metricsState.lastChunkCount);
        const elapsedMin = Math.max((now - this._metricsState.lastSampleAt) / 60000, 1 / 60000);
        const chunksPerMin = Math.floor(deltaChunks / elapsedMin);
        console.log(`[MultiWorld][metrics] generated_chunks_per_min=${chunksPerMin} total_tracked_chunks=${currentChunkCount}`);
        this._metricsState.lastChunkCount = currentChunkCount;
        this._metricsState.lastSampleAt = now;
      }, 1200);
      this._intervalIds.push(metricsIntervalId);
    }

    // En primer ingreso, o respawn sin spawnpoint personal, mover al mundo principal configurado.
    const playerSpawnSubscription = world.afterEvents.playerSpawn.subscribe((event) => {
      const player = event.player;
      let hasPersonalSpawn = false;
      try {
        const spawnPoint = player.getSpawnPoint?.();
        hasPersonalSpawn = !!spawnPoint;
      } catch (_) {}

      const shouldRouteToMain = event.initialSpawn || !hasPersonalSpawn;
      if (!shouldRouteToMain) return;

      const tryRouteToMain = (attempt = 0) => {
        // Wait until world metadata is available; otherwise main-world resolution
        // can fallback incorrectly to overworld spawn.
        if (!this.worldDataLoaded && attempt < 40) {
          system.runTimeout(() => tryRouteToMain(attempt + 1), 1);
          return;
        }

        if (!this.worldDataLoaded) {
          try {
            WorldManager.loadWorldData();
            this.worldDataLoaded = true;
          } catch (_) {}
        }

        const restored = WorldManager.teleportPlayerToPreferredJoinLocation(player);
        if (restored.ok) return;

        const moved = WorldManager.teleportPlayerToMainWorld(player);
        if (!moved.ok) {
          player.sendMessage(`${Color.red}[MW] Could not move you to main world: ${moved.error?.message ?? "unknown error"}${Color.reset}`);
        }
      };

      system.runTimeout(() => tryRouteToMain(), 1);
    });
    this._subscriptions.push(playerSpawnSubscription);

    console.log("[MultiWorld] Modular runtime enabled.");
  },

  onStartup(event) {
    console.log("[MultiWorld] Startup hook (modular)...");

    for (const dimension of dimensionPool) {
      event.dimensionRegistry.registerCustomDimension(dimension.id);
    }

    setupCommands(event);

    // Default ore rules (vanilla-like). Can be extended via WorldGenerator.registerOreRule().
    try {
      const existing = WorldGenerator.getOreRules();
      if (!existing.length) {
        const normalScope = { type: "worldType", value: "normal" };
        WorldGenerator.registerOreRule({ id: "coal", blockId: "minecraft:coal_ore", minY: -64, maxY: 128, veinsPerChunk: 12, veinSize: 10, seed: 1, scope: normalScope });
        WorldGenerator.registerOreRule({ id: "iron", blockId: "minecraft:iron_ore", minY: -64, maxY: 72, veinsPerChunk: 7, veinSize: 9, seed: 2, scope: normalScope });
        WorldGenerator.registerOreRule({ id: "copper", blockId: "minecraft:copper_ore", minY: -16, maxY: 96, veinsPerChunk: 6, veinSize: 10, seed: 3, scope: normalScope });
        WorldGenerator.registerOreRule({ id: "gold", blockId: "minecraft:gold_ore", minY: -64, maxY: 32, veinsPerChunk: 2, veinSize: 8, seed: 4, scope: normalScope });
        WorldGenerator.registerOreRule({ id: "redstone", blockId: "minecraft:redstone_ore", minY: -64, maxY: 16, veinsPerChunk: 3, veinSize: 8, seed: 5, scope: normalScope });
        WorldGenerator.registerOreRule({ id: "lapis", blockId: "minecraft:lapis_ore", minY: -32, maxY: 64, veinsPerChunk: 1, veinSize: 7, seed: 6, scope: normalScope });
        WorldGenerator.registerOreRule({ id: "diamond", blockId: "minecraft:diamond_ore", minY: -64, maxY: 16, veinsPerChunk: 1, veinSize: 6, seed: 7, scope: normalScope });
      }
    } catch (e) {
      console.warn(`[MultiWorld] Ore rules init failed: ${e?.message ?? "unknown error"}`);
    }

  },

  onWorldReady() {
    try {
      PMMPCore.getMigrationService()?.run("MultiWorld");
    } catch (e) {
      console.warn(`[MultiWorld] Migration runner failed: ${e?.message ?? "unknown error"}`);
    }

    if (!this.worldDataLoaded) {
      try {
        WorldManager.loadWorldData();
        this.worldDataLoaded = true;
        console.log("[MultiWorld] World data loaded.");
      } catch (e) {
        console.warn(`[MultiWorld] World data load failed: ${e?.message ?? "unknown error"}`);
      }
    }

    if (!this._mwPermissionsSeeded) {
      try {
        this.seedPermissions();
      } finally {
        this._mwPermissionsSeeded = true;
      }
    }
  },

  seedPermissions() {
    const perms = PMMPCore.getPermissionService?.() ?? null;
    if (!perms || typeof perms.getGroupInfo !== "function" || typeof perms.setGroupPermission !== "function") {
      console.log("[MultiWorld] PermissionService not ready, skipping permission seed.");
      return;
    }
    let added = 0;
    for (const [groupName, nodes] of Object.entries(MW_PERMISSION_SEED)) {
      let existing = [];
      try {
        existing = perms.getGroupInfo(groupName)?.permissions ?? [];
      } catch (_) {
        continue;
      }
      const existingNormalized = new Set(
        existing
          .filter((perm) => typeof perm === "string")
          .map((perm) => perm.trim().replace(/^-/, "").toLowerCase())
      );
      for (const node of nodes) {
        if (existingNormalized.has(node.toLowerCase())) continue;
        try {
          perms.setGroupPermission(groupName, node, null, true);
          added++;
        } catch (_) {}
      }
    }
    if (added > 0) console.log(`[MultiWorld] Seeded ${added} default permission node(s).`);
    else console.log("[MultiWorld] Permission seed already up to date.");
  },

  onDisable() {
    if (Array.isArray(this._intervalIds)) {
      for (const intervalId of this._intervalIds) {
        try {
          system.clearRun(intervalId);
        } catch (_) {}
      }
    }
    this._intervalIds = [];

    if (Array.isArray(this._subscriptions)) {
      for (const subscription of this._subscriptions) {
        try {
          subscription?.unsubscribe?.();
        } catch (_) {}
      }
    }
    this._subscriptions = [];
    this._metricsState = null;
    this._isRuntimeRunning = false;

    requestPersistFlush("disable");
    if (isWorldDataDirty()) {
      const saved = WorldManager.flushWorldData();
      if (!saved) {
        console.warn("[MultiWorld] Final flush on disable failed.");
      }
    }
    console.log("[MultiWorld] MultiWorld disabled.");
  },

  getHelp() {
    return [
      `${Color.aqua}MultiWorld Commands:${Color.reset}`,
      `${Color.white}/pmmpcore:mw create <name> <type> [dimension] ${Color.gray}- Create a new world`,
      `${Color.white}/pmmpcore:mw tp <world> ${Color.gray}- Teleport to a world`,
      `${Color.white}/pmmpcore:mw list ${Color.gray}- List all worlds`,
      `${Color.white}/pmmpcore:mw delete <world> ${Color.gray}- Delete your world`,
      `${Color.white}/pmmpcore:mw purgechunks <world> ${Color.gray}- Batch clear generated chunks`,
      `${Color.white}/pmmpcore:mw keepmode <on|off> ${Color.gray}- Stay in world during delete/purge`,
      `${Color.white}/pmmpcore:mw setmain <world> ${Color.gray}- Set default join world`,
      `${Color.white}/pmmpcore:mw main ${Color.gray}- Show current main world`,
      `${Color.white}/pmmpcore:mw info <world> ${Color.gray}- Show world information`,
    ];
  },
});
