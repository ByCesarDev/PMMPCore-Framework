console.log("=== PMMPCore MAIN SCRIPT LOADING ===");

import { system, Player, CustomCommandStatus, CommandPermissionLevel, CustomCommandParamType } from "@minecraft/server";

console.log("=== MINECRAFT IMPORTS COMPLETED ===");

import { PMMPCore, Color } from "./PMMPCore.js";
import { DatabaseManager } from "./DatabaseManager.js";

console.log("=== PMMPCore IMPORTS COMPLETED ===");

console.log("=== LOADING PLUGINS ===");
import "./plugins.js";
console.log("=== PLUGINS LOADED ===");

system.beforeEvents.startup.subscribe((event) => {
  console.log(`${Color.aqua}[PMMPCore] Starting initialization...${Color.reset}`);

  const dbManager = new DatabaseManager();
  PMMPCore.initialize(dbManager);

  event.customCommandRegistry.registerCommand(
    {
      name: "pmmpcore:plugins",
      description: "List all loaded plugins",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
      }

      const plugins = PMMPCore.getPluginSummaries();
      const list = plugins
        .map((p) => {
          const stateColor = p.state.enabled ? "§a" : "§c";
          const stateLabel = p.state.enabled ? "enabled" : "blocked";
          return `${stateColor}${p.name} §7v${p.version || "1.0.0"} §8(${stateLabel})`;
        })
        .join("§r, ");

      player.sendMessage(`§6Plugins (${plugins.length}): ${list}`);
      return { status: CustomCommandStatus.Success };
    }
  );

  event.customCommandRegistry.registerCommand(
    {
      name: "pmmpcore:pl",
      description: "List all loaded plugins (short)",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
      }

      const plugins = PMMPCore.getPluginSummaries();
      const list = plugins.map((p) => `${p.state.enabled ? "§a" : "§c"}${p.name}`).join("§r, ");

      player.sendMessage(`§6Plugins (${plugins.length}): ${list}`);
      return { status: CustomCommandStatus.Success };
    }
  );

  const pluginEnumValues = PMMPCore.getPlugins().map((plugin) => plugin.name);
  if (pluginEnumValues.length > 0) {
    event.customCommandRegistry.registerEnum("pmmpcore:plugin_name", pluginEnumValues);
  }

  event.customCommandRegistry.registerCommand(
    {
      name: "pmmpcore:pluginstatus",
      description: "Show status for one plugin",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.Enum, name: "pmmpcore:plugin_name" },
      ],
    },
    (origin, pluginName) => {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
      }

      const plugin = PMMPCore.getPlugin(pluginName);
      if (!plugin) {
        player.sendMessage(`${Color.red}Plugin not found: ${pluginName}${Color.reset}`);
        return { status: CustomCommandStatus.Success };
      }

      const state = PMMPCore.getPluginState(pluginName);
      const statusColor = state.enabled ? Color.green : Color.red;
      const statusLabel = state.enabled ? "enabled" : "blocked";

      player.sendMessage(`${Color.bold}=== Plugin Status ===${Color.reset}`);
      player.sendMessage(`${Color.aqua}Name: ${Color.white}${plugin.name}`);
      player.sendMessage(`${Color.aqua}Version: ${Color.white}${plugin.version || "1.0.0"}`);
      player.sendMessage(`${Color.aqua}Status: ${statusColor}${statusLabel}${Color.reset}`);
      player.sendMessage(`${Color.aqua}Reason: ${Color.white}${state.reason}`);

      return { status: CustomCommandStatus.Success };
    }
  );

  event.customCommandRegistry.registerCommand(
    {
      name: "pmmpcore:info",
      description: "Show PMMPCore system information",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
      }

      const stats = PMMPCore.db.getStats();
      player.sendMessage(`${Color.bold}=== PMMPCore System Info ===${Color.reset}`);
      player.sendMessage(`${Color.aqua}Version: ${Color.white}1.0.0`);
      const pluginSummaries = PMMPCore.getPluginSummaries();
      const enabledPlugins = pluginSummaries.filter((p) => p.state.enabled).length;
      player.sendMessage(`${Color.aqua}Plugins Loaded: ${Color.white}${pluginSummaries.length}`);
      player.sendMessage(`${Color.aqua}Plugins Enabled: ${Color.white}${enabledPlugins}`);
      player.sendMessage(`${Color.aqua}Database Keys: ${Color.white}${stats.totalKeys}`);
      player.sendMessage(`${Color.aqua}DB Size: ${Color.white}${stats.estimatedSize} chars`);
      player.sendMessage(`${Color.green}System Status: ${Color.white}Operational`);

      return { status: CustomCommandStatus.Success };
    }
  );

  event.customCommandRegistry.registerCommand(
    {
      name: "pmmpcore:pmmphelp",
      description: "Show PMMPCore commands information",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
      }

      // Show core help only
      player.sendMessage(`${Color.bold}=== PMMPCore Commands ===${Color.reset}`);
      player.sendMessage(`${Color.aqua}Core Commands:${Color.reset}`);
      player.sendMessage(`${Color.white}/pmmpcore:pmmphelp ${Color.gray}- Show this command list`);
      player.sendMessage(`${Color.white}/pmmpcore:plugins ${Color.gray}- List loaded plugins`);
      player.sendMessage(`${Color.white}/pmmpcore:pl ${Color.gray}- Short plugin list`);
      player.sendMessage(`${Color.white}/pmmpcore:pluginstatus <plugin> ${Color.gray}- Detailed plugin status`);
      player.sendMessage(`${Color.white}/pmmpcore:info ${Color.gray}- System information`);

      const plugins = PMMPCore.getPluginSummaries();
      if (plugins.length > 0) {
        player.sendMessage(`\n${Color.aqua}Available Plugins:${Color.reset}`);
        plugins.forEach((plugin) => {
          const statusColor = plugin.state.enabled ? Color.green : Color.red;
          const statusLabel = plugin.state.enabled ? "enabled" : `blocked: ${plugin.state.reason}`;
          player.sendMessage(
            `${statusColor}${plugin.name} ${Color.gray}v${plugin.version || "1.0.0"} ${Color.darkGray}- ${statusLabel}`
          );
        });
      }

      player.sendMessage(
        `\n${Color.yellow}Tip: Each plugin has its own help command. Check plugin documentation for details.`
      );

      return { status: CustomCommandStatus.Success };
    }
  );

  console.log(`${Color.aqua}[PMMPCore] Enabling plugins immediately...${Color.reset}`);
  PMMPCore.enableAll();
  
  // Inicializar hooks de startup de plugins en una sola pasada.
  console.log(`${Color.aqua}[PMMPCore] Running plugin startup hooks...${Color.reset}`);
  for (const plugin of PMMPCore.getPlugins()) {
    const state = PMMPCore.getPluginState(plugin.name);
    if (!state.enabled) {
      continue;
    }

    if (plugin.onStartup && typeof plugin.onStartup === "function") {
      try {
        plugin.onStartup(event);
      } catch (error) {
        console.error(`[PMMPCore] Failed startup hook for ${plugin.name}: ${error.message}`);
      }
    }
  }
  
  console.log(`${Color.green}[PMMPCore] Initialization complete!${Color.reset}`);
});

console.log("=== PMMPCore MAIN SCRIPT SETUP COMPLETE ===");
