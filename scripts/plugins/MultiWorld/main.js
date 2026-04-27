import { world, system } from "@minecraft/server";
import { PMMPCore, Color } from "../../PMMPCore.js";
import { dimensionPool, GENERATION_TICK_RATE } from "./config.js";
import { worldsData, isWorldDataDirty } from "./state.js";
import { WorldManager, RuntimeController, requestPersistFlush } from "./manager.js";
import { WorldGenerator } from "./generator.js";
import { setupCommands } from "./commands.js";

console.log("[MultiWorld] Loading modular MultiWorld plugin...");

PMMPCore.registerPlugin({
  name: "MultiWorld",
  version: "1.0.0",
  depend: ["PMMPCore"],

  onEnable() {
    console.log("[MultiWorld] Enabling modular runtime...");
    this.worldDataLoaded = false;

    // Generacion continua alrededor del jugador en mundos activos.
    system.runInterval(() => {
      RuntimeController.cleanupInactiveWorlds();

      for (const player of world.getAllPlayers()) {
        const playerWorld = Array.from(worldsData.values()).find(
          (w) => w.loaded && player.dimension.id === w.dimensionId
        );
        if (!playerWorld) continue;

        RuntimeController.updateActivity(playerWorld.id);
        WorldGenerator.generateAroundPlayer(player, playerWorld.id);
      }
    }, GENERATION_TICK_RATE);

    // Persistencia periodica.
    system.runInterval(() => {
      if (isWorldDataDirty()) {
        requestPersistFlush("autosave");
      }
    }, 200);

    // Persistir ultima ubicacion de jugadores para restaurar en reconexion.
    system.runInterval(() => {
      for (const player of world.getAllPlayers()) {
        WorldManager.savePlayerLastLocation(player);
      }
    }, 40);

    // En primer ingreso, o respawn sin spawnpoint personal, mover al mundo principal configurado.
    world.afterEvents.playerSpawn.subscribe((event) => {
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

    console.log("[MultiWorld] Modular runtime enabled.");
  },

  onStartup(event) {
    console.log("[MultiWorld] Startup hook (modular)...");

    for (const dimension of dimensionPool) {
      event.dimensionRegistry.registerCustomDimension(dimension.id);
    }

    setupCommands(event);

    world.afterEvents.worldLoad.subscribe(() => {
      if (this.worldDataLoaded) return;
      system.run(() => {
        WorldManager.loadWorldData();
        this.worldDataLoaded = true;
        console.log("[MultiWorld] World data loaded.");
      });
    });
  },

  onDisable() {
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
      `${Color.white}/mw create <name> <type> [dimension] ${Color.gray}- Create a new world`,
      `${Color.white}/mw tp <world> ${Color.gray}- Teleport to a world`,
      `${Color.white}/mw list ${Color.gray}- List all worlds`,
      `${Color.white}/mw delete <world> ${Color.gray}- Delete your world`,
      `${Color.white}/mw purgechunks <world> ${Color.gray}- Batch clear generated chunks`,
      `${Color.white}/mw setmain <world> ${Color.gray}- Set default join world`,
      `${Color.white}/mw main ${Color.gray}- Show current main world`,
      `${Color.white}/mw info <world> ${Color.gray}- Show world information`,
    ];
  },
});
