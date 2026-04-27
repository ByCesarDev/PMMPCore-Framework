import { world as mcWorld, system, Player, CustomCommandStatus, CommandPermissionLevel, CustomCommandParamType } from "@minecraft/server";
import { Color } from "../../PMMPCore.js";
import { PMMPCore } from "../../PMMPCore.js";
import {
  WORLD_TYPES,
  VANILLA_WORLDS,
  resolveVanillaWorld,
  CLEAR_RADIUS,
  DELETE_SAFETY_SWEEP,
  DELETE_SAFETY_RADIUS,
  DELETE_SAFETY_RADIUS_WHEN_TRACKED,
} from "./config.js";
import { worldsData, generatedChunks } from "./state.js";
import { WorldManager, RuntimeController, requestPersistFlush } from "./manager.js";
import { WorldGenerator } from "./generator.js";

// ============== COMMAND HANDLERS ==============
export class CommandHandlers {
  static _resolveCustomWorldByNameInsensitive(name) {
    const normalized = name.toLowerCase();
    return WorldManager.getAllWorlds().find((wd) => wd.id.toLowerCase() === normalized) ?? null;
  }

  static _resolveTrackedChunkKeys(worldName) {
    let trackedChunkKeys = Array.from(generatedChunks.get(worldName) ?? []);
    if (trackedChunkKeys.length === 0) {
      // Fallback: usa tracking persistido si el runtime aun no tenia chunks en memoria.
      const persisted = PMMPCore.db?.getChunks(worldName);
      if (Array.isArray(persisted) && persisted.length > 0) {
        trackedChunkKeys = persisted;
      }
    }
    return trackedChunkKeys;
  }

  static handleCreate(player, worldName, worldType, dimensionNumber = undefined) {
    if (!worldName) {
      player.sendMessage(`${Color.red}Usage: /mw create <name> [type] [dimension]${Color.reset}`);
      player.sendMessage(`${Color.yellow}Types: normal (default), flat, void, skyblock — Dimensions: 1-50 (optional)${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const type = (worldType ?? WORLD_TYPES.NORMAL).toLowerCase();
    const dim  = dimensionNumber === undefined ? null : dimensionNumber;

    if (!Object.values(WORLD_TYPES).includes(type)) {
      player.sendMessage(`${Color.red}Invalid type. Use: normal, flat, void, skyblock${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }
    if (dim !== null && (Number.isNaN(dim) || dim < 1 || dim > 50)) {
      player.sendMessage(`${Color.red}Dimension must be between 1 and 50${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    try {
      const wd = WorldManager.createWorld(worldName, type, player.name, dim);
      requestPersistFlush("create");
      player.sendMessage(`${Color.green}World '${worldName}' created! Dimension: ${wd.dimensionId}${Color.reset}`);
      player.sendMessage(`${Color.aqua}Use /mw tp ${worldName} to teleport${Color.reset}`);
    } catch (e) {
      player.sendMessage(`${Color.red}Error: ${e.message}${Color.reset}`);
    }
    return { status: CustomCommandStatus.Success };
  }

  static handleTeleport(player, worldName) {
    if (!worldName) {
      player.sendMessage(`${Color.red}Usage: /mw tp <world>${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const vanillaWorld = resolveVanillaWorld(worldName);
    if (vanillaWorld) {
      system.run(() => {
        const resolved = WorldManager._resolveVanillaSpawnWithMeta(vanillaWorld);
        const dim = mcWorld.getDimension(vanillaWorld.id);
        player.teleport(resolved.spawn, { dimension: dim });
        player.sendMessage(`${Color.green}Teleported to ${vanillaWorld.label}!${Color.reset}`);
      });
      return { status: CustomCommandStatus.Success };
    }

    const worldData = WorldManager.getWorld(worldName);
    if (!worldData) {
      player.sendMessage(`${Color.red}World '${worldName}' does not exist${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    try {
      RuntimeController.activateWorld(worldName);
      system.run(() => {
        const dimension = mcWorld.getDimension(worldData.dimensionId);
        const spawn = worldData.spawn;
        const tickId = `${worldName}_tp`;

        if (mcWorld.tickingAreaManager.hasTickingArea(tickId)) {
          mcWorld.tickingAreaManager.removeTickingArea(tickId);
        }

        mcWorld.tickingAreaManager
          .createTickingArea(tickId, {
            dimension,
            from: { x: -32, y: 40,  z: -32 },
            to:   { x:  32, y: 120, z:  32 },
          })
          .then(() => {
            // Pre-generar spawn para evitar caída al vacío
            const scx = Math.floor(spawn.x / 16);
            const scz = Math.floor(spawn.z / 16);
            if (worldData.type === WORLD_TYPES.NORMAL) {
              for (let dx = -1; dx <= 1; dx++)
                for (let dz = -1; dz <= 1; dz++)
                  WorldGenerator.generateNormalChunk(dimension, scx + dx, scz + dz, worldName);
            } else if (worldData.type === WORLD_TYPES.FLAT) {
              for (let dx = -1; dx <= 1; dx++)
                for (let dz = -1; dz <= 1; dz++)
                  WorldGenerator.generateFlatChunk(dimension, scx + dx, scz + dz, worldName);
            } else if (worldData.type === WORLD_TYPES.SKYBLOCK) {
              WorldGenerator.generateSkyblockChunk(dimension, 0, 0, worldName);
            } else if (worldData.type === WORLD_TYPES.VOID) {
              WorldGenerator.generateVoidChunk(dimension, scx, scz, worldName);
            }

            player.teleport(spawn, { dimension });
            player.sendMessage(`${Color.green}Teleported to '${worldName}'!${Color.reset}`);

            // Limpiar ticking area temporal
            system.runTimeout(() => mcWorld.tickingAreaManager.removeTickingArea(tickId), 5000);
          });
      });
    } catch (e) {
      player.sendMessage(`${Color.red}Error teleporting: ${e.message}${Color.reset}`);
    }
    return { status: CustomCommandStatus.Success };
  }

  static handleList(player) {
    const worlds = WorldManager.getAllWorlds();
    player.sendMessage(`${Color.bold}=== MultiWorld List ===${Color.reset}`);
    player.sendMessage(`${Color.aqua}Vanilla:${Color.reset} overworld, nether, end`);

    if (!worlds.length) {
      player.sendMessage(`${Color.yellow}No custom worlds yet${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    player.sendMessage(`${Color.aqua}Custom worlds (${worlds.length}):${Color.reset}`);
    for (const wd of worlds) {
      const status = wd.loaded ? `${Color.green}Active${Color.reset}` : `${Color.gray}Inactive${Color.reset}`;
      const owner  = wd.owner === player.name ? `${Color.aqua}You${Color.reset}` : `${Color.white}${wd.owner}${Color.reset}`;
      const dimNum = wd.dimensionId.replace("pmmpcore:multiworld_", "");
      player.sendMessage(`  ${Color.white}${wd.id} ${Color.gray}(${wd.type}) Dim:${dimNum} ${status} — ${owner}`);
    }
    return { status: CustomCommandStatus.Success };
  }

  static handleDelete(player, worldName) {
    if (!worldName) {
      player.sendMessage(`${Color.red}Usage: /mw delete <world>${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const worldData = WorldManager.getWorld(worldName);
    if (!worldData) {
      player.sendMessage(`${Color.red}World '${worldName}' does not exist${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }
    if (worldData.owner !== player.name) {
      player.sendMessage(`${Color.red}You can only delete your own worlds${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const dimId     = worldData.dimensionId;
    const includeSafetySweep = false;
    const spawnChunk = {
      x: Math.floor(worldData.spawn.x / 16),
      z: Math.floor(worldData.spawn.z / 16),
    };
    const trackedChunkKeys = this._resolveTrackedChunkKeys(worldName);

    if (player.dimension.id === dimId) {
      const tpMain = WorldManager.teleportPlayerToMainWorld(player, worldName);
      if (tpMain.ok) {
        const fallbackText = tpMain.destination?.isFallback
          ? ` ${Color.gray}(configured main world unavailable, using fallback)`
          : "";
        player.sendMessage(`${Color.aqua}[MW] Moving you to main world: ${tpMain.destination.label}.${fallbackText}${Color.reset}`);
      } else {
        player.sendMessage(`${Color.red}[MW] Warning: could not teleport to main world before delete (${tpMain.error?.message ?? "unknown error"}).${Color.reset}`);
      }
    }

    try {
      WorldManager.deleteWorld(worldName);
      requestPersistFlush("delete");
    } catch (e) {
      player.sendMessage(`${Color.red}Error: ${e.message}${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    if (trackedChunkKeys.length > 0) {
      const estimated = trackedChunkKeys.length;
      player.sendMessage(
        `${Color.yellow}[MW] Deleting '${worldName}'... tracked mode, estimated ~${estimated.toLocaleString()} chunks.${Color.reset}`
      );
      player.sendMessage(
        `${Color.yellow}[MW] Tracked chunks found: ${trackedChunkKeys.length}. No extra sweep in normal delete mode.${Color.reset}`
      );
    } else {
      const fallbackRadius = CLEAR_RADIUS;
      const totalCols = Math.pow(fallbackRadius * 2 + 1, 2);
      player.sendMessage(
        `${Color.yellow}[MW] Deleting '${worldName}'... fallback mode, estimated ~${totalCols.toLocaleString()} chunks.${Color.reset}`
      );
      player.sendMessage(
        `${Color.yellow}[MW] No tracked chunks found. Using normal fallback radius clear (~${totalCols.toLocaleString()}).${Color.reset}`
      );
    }

    WorldGenerator.clearGeneratedChunksAsync(worldName, dimId, spawnChunk, player, (count) => {
      system.run(() => {
        player.sendMessage(
          `${Color.green}World '${worldName}' deleted! Cleared ${count} chunk columns.${Color.reset}`
        );
      });
    }, trackedChunkKeys, includeSafetySweep);

    return { status: CustomCommandStatus.Success };
  }

  static handleSetMain(player, worldName) {
    if (!worldName) {
      player.sendMessage(`${Color.red}Usage: /mw setmain <world>${Color.reset}`);
      player.sendMessage(`${Color.yellow}Examples: overworld, nether, end, myCustomWorld${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const vanilla = resolveVanillaWorld(worldName);
    let targetName = worldName;
    if (vanilla) {
      targetName = vanilla.aliases[0];
    } else {
      const custom = this._resolveCustomWorldByNameInsensitive(worldName);
      if (!custom) {
        player.sendMessage(`${Color.red}World '${worldName}' does not exist. Use /mw list first.${Color.reset}`);
        return { status: CustomCommandStatus.Success };
      }
      targetName = custom.id;
    }

    try {
      WorldManager.setMainWorldTarget(targetName);
      player.sendMessage(`${Color.green}Main world set to '${targetName}'.${Color.reset}`);
      player.sendMessage(`${Color.aqua}New players will spawn there on first join.${Color.reset}`);
    } catch (e) {
      player.sendMessage(`${Color.red}Error setting main world: ${e.message}${Color.reset}`);
    }

    return { status: CustomCommandStatus.Success };
  }

  static handleMainInfo(player) {
    const configured = WorldManager.getMainWorldTarget();
    const resolved = WorldManager.resolveMainWorldDestination();
    const fallbackNote = resolved.isFallback
      ? `${Color.yellow} (configured world unavailable, fallback active)`
      : "";
    player.sendMessage(`${Color.bold}=== Main World ===${Color.reset}`);
    player.sendMessage(`${Color.aqua}Configured: ${Color.white}${configured}${Color.reset}`);
    player.sendMessage(`${Color.aqua}Resolved: ${Color.white}${resolved.label} ${Color.gray}(${resolved.id})${Color.reset}${fallbackNote}`);
    return { status: CustomCommandStatus.Success };
  }

  static handleSetSpawn(player, worldName) {
    if (!worldName) {
      player.sendMessage(`${Color.red}Usage: /pmmpcore:mw setspawn <world>${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const vanilla = resolveVanillaWorld(worldName);
    if (vanilla) {
      if (player.dimension.id !== vanilla.id) {
        player.sendMessage(`${Color.red}You must be inside '${vanilla.label}' to set its global spawn${Color.reset}`);
        return { status: CustomCommandStatus.Success };
      }

      const newSpawn = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z),
      };

      try {
        WorldManager.setVanillaSpawn(vanilla.id, newSpawn);
        player.sendMessage(
          `${Color.green}Global spawn for '${vanilla.label}' updated to ${newSpawn.x}, ${newSpawn.y}, ${newSpawn.z}${Color.reset}`
        );
      } catch (e) {
        player.sendMessage(`${Color.red}Error setting vanilla spawn: ${e.message}${Color.reset}`);
      }
      return { status: CustomCommandStatus.Success };
    }

    const worldData = WorldManager.getWorld(worldName);
    if (!worldData) {
      player.sendMessage(`${Color.red}World '${worldName}' does not exist${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    if (worldData.owner !== player.name) {
      player.sendMessage(`${Color.red}You can only set spawn in your own worlds${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    if (player.dimension.id !== worldData.dimensionId) {
      player.sendMessage(`${Color.red}You must be inside '${worldName}' to set its global spawn${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const newSpawn = {
      x: Math.floor(player.location.x),
      y: Math.floor(player.location.y),
      z: Math.floor(player.location.z),
    };

    worldData.spawn = newSpawn;
    worldData.lastUsed = Date.now();
    requestPersistFlush("setspawn");

    player.sendMessage(
      `${Color.green}Global spawn for '${worldName}' updated to ${newSpawn.x}, ${newSpawn.y}, ${newSpawn.z}${Color.reset}`
    );
    return { status: CustomCommandStatus.Success };
  }

  static handleSetLobby(player, worldName, mode) {
    if (!worldName || !mode) {
      player.sendMessage(`${Color.red}Usage: /pmmpcore:mw setlobby <world> <on|off>${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const worldData = WorldManager.getWorld(worldName);
    if (!worldData) {
      player.sendMessage(`${Color.red}World '${worldName}' does not exist (custom worlds only).${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    if (worldData.owner !== player.name) {
      player.sendMessage(`${Color.red}You can only change lobby mode in your own worlds${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const normalized = String(mode).toLowerCase();
    if (normalized !== "on" && normalized !== "off") {
      player.sendMessage(`${Color.red}Invalid mode. Use: on or off${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    worldData.forceSpawnOnJoin = normalized === "on";
    worldData.lastUsed = Date.now();
    requestPersistFlush("setlobby");

    player.sendMessage(
      `${Color.green}Lobby mode for '${worldData.id}' is now ${worldData.forceSpawnOnJoin ? "ON" : "OFF"}${Color.reset}`
    );
    return { status: CustomCommandStatus.Success };
  }

  static handlePurgeChunks(player, worldName) {
    if (!worldName) {
      player.sendMessage(`${Color.red}Usage: /mw purgechunks <world>${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const worldData = WorldManager.getWorld(worldName);
    if (!worldData) {
      player.sendMessage(`${Color.red}World '${worldName}' does not exist${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }
    if (worldData.owner !== player.name) {
      player.sendMessage(`${Color.red}You can only purge chunks in your own worlds${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const dimId = worldData.dimensionId;
    const includeSafetySweep = true;
    const spawnChunk = {
      x: Math.floor(worldData.spawn.x / 16),
      z: Math.floor(worldData.spawn.z / 16),
    };
    const trackedChunkKeys = this._resolveTrackedChunkKeys(worldName);

    if (trackedChunkKeys.length > 0) {
      const trackedSweepCols = Math.pow(DELETE_SAFETY_RADIUS_WHEN_TRACKED * 2 + 1, 2);
      const estimated = trackedChunkKeys.length + (DELETE_SAFETY_SWEEP ? trackedSweepCols : 0);
      player.sendMessage(
        `${Color.yellow}[MW] Purging chunks in '${worldName}'... tracked mode, estimated ~${estimated.toLocaleString()} chunks.${Color.reset}`
      );
      player.sendMessage(
        `${Color.yellow}[MW] Tracked chunks found: ${trackedChunkKeys.length}. Using fast tracked sweep (~${trackedSweepCols.toLocaleString()} extra).${Color.reset}`
      );
    } else {
      const fallbackRadius = DELETE_SAFETY_SWEEP ? Math.max(CLEAR_RADIUS, DELETE_SAFETY_RADIUS) : CLEAR_RADIUS;
      const totalCols = Math.pow(fallbackRadius * 2 + 1, 2);
      player.sendMessage(
        `${Color.yellow}[MW] Purging chunks in '${worldName}'... fallback mode, estimated ~${totalCols.toLocaleString()} chunks.${Color.reset}`
      );
      player.sendMessage(
        `${Color.yellow}[MW] No tracked chunks found. Using fallback radius clear (~${totalCols.toLocaleString()}).${Color.reset}`
      );
    }

    WorldGenerator.clearGeneratedChunksAsync(worldName, dimId, spawnChunk, player, (count) => {
      system.run(() => {
        player.sendMessage(
          `${Color.green}Chunk purge completed for '${worldName}'! Cleared ${count} chunk columns.${Color.reset}`
        );
      });
    }, trackedChunkKeys, includeSafetySweep);

    return { status: CustomCommandStatus.Success };
  }

  static handleInfo(player, worldName) {
    if (!worldName) {
      player.sendMessage(`${Color.red}Usage: /mw info <world>${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const vanilla = resolveVanillaWorld(worldName);
    if (vanilla) {
      const resolvedMeta = WorldManager._resolveVanillaSpawnWithMeta(vanilla);
      const resolvedSpawn = resolvedMeta.spawn;
      const resolvedSource = resolvedMeta.source;
      const savedSpawn = WorldManager.getVanillaSpawn(vanilla.id, vanilla.spawn);

      player.sendMessage(`${Color.bold}=== ${worldName} ===${Color.reset}`);
      player.sendMessage(`${Color.aqua}Type: ${Color.white}vanilla`);
      player.sendMessage(`${Color.aqua}Dimension: ${Color.white}${vanilla.id}`);
      player.sendMessage(
        `${Color.aqua}Spawn (saved): ${Color.white}${savedSpawn.x}, ${savedSpawn.y}, ${savedSpawn.z}`
      );
      player.sendMessage(
        `${Color.aqua}Spawn (resolved now): ${Color.white}${resolvedSpawn.x}, ${resolvedSpawn.y}, ${resolvedSpawn.z}`
      );
      player.sendMessage(
        `${Color.aqua}Spawn source: ${Color.white}${resolvedSource}`
      );
      return { status: CustomCommandStatus.Success };
    }

    const wd = WorldManager.getWorld(worldName);
    if (!wd) {
      player.sendMessage(`${Color.red}World '${worldName}' not found${Color.reset}`);
      return { status: CustomCommandStatus.Success };
    }

    const status = wd.loaded ? `${Color.green}Active` : `${Color.gray}Inactive`;
    const created = new Date(wd.createdAt).toLocaleString();
    const lastUsed = new Date(wd.lastUsed).toLocaleString();
    const chunks = generatedChunks.get(worldName)?.size ?? 0;
    const savedSpawn = wd.spawn;
    const resolvedSpawn = WorldManager.resolveWorldSpawnNow(worldName) ?? savedSpawn;

    player.sendMessage(`${Color.bold}=== World: ${worldName} ===${Color.reset}`);
    player.sendMessage(`${Color.aqua}Type: ${Color.white}${wd.type}`);
    player.sendMessage(`${Color.aqua}Dimension: ${Color.white}${wd.dimensionId}`);
    player.sendMessage(`${Color.aqua}Owner: ${Color.white}${wd.owner}`);
    player.sendMessage(`${Color.aqua}Status: ${status}${Color.reset}`);
    player.sendMessage(`${Color.aqua}Force spawn on join: ${Color.white}${wd.forceSpawnOnJoin ? "ON" : "OFF"}`);
    player.sendMessage(
      `${Color.aqua}Spawn (saved): ${Color.white}${savedSpawn.x}, ${savedSpawn.y}, ${savedSpawn.z}`
    );
    player.sendMessage(
      `${Color.aqua}Spawn (resolved now): ${Color.white}${resolvedSpawn.x}, ${resolvedSpawn.y}, ${resolvedSpawn.z}`
    );
    player.sendMessage(`${Color.aqua}Chunks: ${Color.white}${chunks}`);
    player.sendMessage(`${Color.aqua}Created: ${Color.white}${created}`);
    player.sendMessage(`${Color.aqua}Last used: ${Color.white}${lastUsed}`);
    return { status: CustomCommandStatus.Success };
  }

  static handleHelp(player) {
    player.sendMessage(`${Color.bold}§e=== MultiWorld Help ===${Color.reset}`);
    player.sendMessage(`${Color.aqua}Commands:${Color.reset}`);
    player.sendMessage(`  ${Color.white}/pmmpcore:mw create ${Color.yellow}<name> ${Color.gray}[type] [dim]  — Create a new world`);
    player.sendMessage(`  ${Color.white}/pmmpcore:mw tp     ${Color.yellow}<name>              ${Color.gray}— Teleport to a world`);
    player.sendMessage(`  ${Color.white}/pmmpcore:mw list                         ${Color.gray}— List all worlds`);
    player.sendMessage(`  ${Color.white}/pmmpcore:mw delete ${Color.yellow}<name>              ${Color.gray}— Delete your world`);
    player.sendMessage(`  ${Color.white}/pmmpcore:mw purgechunks ${Color.yellow}<name>         ${Color.gray}— Batch clear generated chunks`);
    player.sendMessage(`  ${Color.white}/pmmpcore:mw setmain ${Color.yellow}<name>             ${Color.gray}— Set default join world`);
    player.sendMessage(`  ${Color.white}/pmmpcore:mw setspawn ${Color.yellow}<name>           ${Color.gray}— Set global spawn to your current location`);
    player.sendMessage(`  ${Color.white}/pmmpcore:mw setlobby ${Color.yellow}<name> <on|off>   ${Color.gray}— Force spawn on join for a custom world`);
    player.sendMessage(`  ${Color.white}/pmmpcore:mw main                         ${Color.gray}— Show current main world`);
    player.sendMessage(`  ${Color.white}/pmmpcore:mw info   ${Color.yellow}<name>              ${Color.gray}— Show world details`);
    player.sendMessage(`  ${Color.white}/pmmpcore:mw help                         ${Color.gray}— Show this message`);
    player.sendMessage(`${Color.aqua}World types:${Color.reset}`);
    player.sendMessage(`  ${Color.green}normal   ${Color.gray}— Vanilla-like terrain with oak trees`);
    player.sendMessage(`  ${Color.green}flat     ${Color.gray}— Flat world (grass, dirt, bedrock)`);
    player.sendMessage(`  ${Color.green}void     ${Color.gray}— Empty dimension`);
    player.sendMessage(`  ${Color.green}skyblock ${Color.gray}— Floating island`);
    player.sendMessage(`${Color.yellow}Examples: ${Color.white}/pmmpcore:mw create myWorld ${Color.gray}(defaults to normal)`);
    player.sendMessage(`${Color.yellow}          ${Color.white}/pmmpcore:mw create myWorld flat`);
    return { status: CustomCommandStatus.Success };
  }
}

// ============== COMMAND REGISTRATION ==============
export function setupCommands(event) {
  event.customCommandRegistry.registerEnum("pmmpcore:mw_subcommand", [
    "create",
    "tp",
    "list",
    "delete",
    "purgechunks",
    "setmain",
    "setspawn",
    "setlobby",
    "main",
    "info",
    "help",
  ]);
  event.customCommandRegistry.registerEnum("pmmpcore:mw_world_type", Object.values(WORLD_TYPES));
  event.customCommandRegistry.registerEnum("pmmpcore:mw_toggle", ["on", "off"]);

  const mwCommandHandler = (origin, subcommand, name, type, dimension, toggle) => {
    const player = origin.initiator ?? origin.sourceEntity;
    if (!player || !(player instanceof Player))
      return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };

    if (!subcommand) return CommandHandlers.handleHelp(player);

    switch (subcommand.toLowerCase()) {
      case "create": return CommandHandlers.handleCreate(player, name, type, dimension);
      case "tp":     return CommandHandlers.handleTeleport(player, name);
      case "list":   return CommandHandlers.handleList(player);
      case "delete": return CommandHandlers.handleDelete(player, name);
      case "purgechunks": return CommandHandlers.handlePurgeChunks(player, name);
      case "setmain": return CommandHandlers.handleSetMain(player, name);
      case "setspawn": return CommandHandlers.handleSetSpawn(player, name);
      case "setlobby": return CommandHandlers.handleSetLobby(player, name, toggle ?? type);
      case "main": return CommandHandlers.handleMainInfo(player);
      case "info":   return CommandHandlers.handleInfo(player, name);
      case "help":   return CommandHandlers.handleHelp(player);
      default:
        player.sendMessage(`${Color.red}Unknown subcommand. Use /mw help${Color.reset}`);
        return { status: CustomCommandStatus.Success };
    }
  };

  const mwCommandDefinition = {
    description: "MultiWorld commands",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
    mandatoryParameters: [
      { type: CustomCommandParamType.Enum, name: "pmmpcore:mw_subcommand" },
    ],
    optionalParameters: [
      { type: CustomCommandParamType.String,  name: "name" },
      { type: CustomCommandParamType.Enum,  name: "pmmpcore:mw_world_type" },
      { type: CustomCommandParamType.Integer, name: "dimension" },
      { type: CustomCommandParamType.Enum, name: "pmmpcore:mw_toggle" },
    ],
  };

  event.customCommandRegistry.registerCommand(
    {
      name: "pmmpcore:mw",
      ...mwCommandDefinition,
    },
    mwCommandHandler
  );

  console.log("[MultiWorld] Commands registered.");
}
