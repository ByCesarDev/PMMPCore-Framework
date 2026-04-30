console.log("=== PMMPCore MAIN SCRIPT LOADING ===");

import { world, system, Player, CustomCommandStatus, CommandPermissionLevel, CustomCommandParamType } from "@minecraft/server";

console.log("=== MINECRAFT IMPORTS COMPLETED ===");

import { PMMPCore, Color } from "./PMMPCore.js";
import { DatabaseManager } from "./DatabaseManager.js";

console.log("=== PMMPCore IMPORTS COMPLETED ===");

const SQL_DEBUG_STATE_KEY = "core:sqlDebug.enabled";
const SQL_MAX_CHAT_ROWS = 10;
const SQL_COMMAND_DEDUP_MS = 250;
const SQL_PERMISSIONS = {
  read: "pmmpcore.sql.read",
  write: "pmmpcore.sql.write",
  admin: "pmmpcore.sql.admin",
};
const SQL_RECENT_EXECUTIONS = new Map();

function registerCommandSafe(registry, definition, callback) {
  let primaryRegistered = false;
  try {
    registry.registerCommand(definition, callback);
    primaryRegistered = true;
  } catch (error) {
    const message = String(error?.message ?? error ?? "");
    if (message.includes("cannot change parameters") && message.includes("during reload")) {
      console.warn(`[PMMPCore] Skipping command re-register during reload: ${definition?.name}`);
      return;
    }
    throw error;
  }
  const name = definition?.name;
  // SQL command aliases can double-fire during runtime reload windows in Bedrock.
  // Keep SQL commands namespaced-only; users can still call them as /sql in chat.
  if (typeof name === "string" && name.startsWith("pmmpcore:sql")) {
    return;
  }
  if (primaryRegistered && typeof name === "string" && name.includes(":")) {
    const alias = name.split(":").slice(1).join(":");
    if (alias) {
      try {
        registry.registerCommand({ ...definition, name: alias }, callback);
      } catch (_) {
        // Ignore runtimes that reject non-namespaced aliases.
      }
    }
  }
}

console.log("=== LOADING PLUGINS ===");
import "./plugins.js";
console.log("=== PLUGINS LOADED ===");

world.afterEvents.worldLoad.subscribe(() => {
  try {
    if (PMMPCore.db && typeof PMMPCore.db.replayWalIfAny === "function") {
      PMMPCore.db.replayWalIfAny();
    }
    PMMPCore.emit("world.ready", {});
    for (const plugin of PMMPCore.getPlugins()) {
      const state = PMMPCore.getPluginState(plugin.name);
      if (!state.enabled) continue;
      if (plugin.onWorldReady && typeof plugin.onWorldReady === "function") {
        try {
          plugin.onWorldReady();
        } catch (error) {
          console.error(`[PMMPCore] Failed world-ready hook for ${plugin.name}: ${error.message}`);
        }
      }
    }
  } catch (e) {
    console.error(`[PMMPCore] WAL replay: ${e.message}`);
  }
});

system.beforeEvents.startup.subscribe((event) => {
  console.log(`${Color.aqua}[PMMPCore] Starting initialization...${Color.reset}`);

  const dbManager = new DatabaseManager();
  PMMPCore.initialize(dbManager);
  const sqlEngine = PMMPCore.createRelationalEngine();

  const resolveWorldName = (dimensionId) => {
    if (!dimensionId) return "";
    if (dimensionId === "minecraft:overworld") return "overworld";
    if (dimensionId === "minecraft:nether") return "nether";
    if (dimensionId === "minecraft:the_end") return "end";
    return dimensionId;
  };

  const hasSqlPermission = (player, node) => {
    try {
      const perms = PMMPCore.getPermissionService();
      if (!perms?.has) return true;
      return !!perms.has(player.name, node, resolveWorldName(player.dimension?.id), player);
    } catch (_) {
      return false;
    }
  };

  const getSqlDebugEnabled = () => !!PMMPCore.db.get(SQL_DEBUG_STATE_KEY);
  const setSqlDebugEnabled = (enabled) => {
    PMMPCore.db.set(SQL_DEBUG_STATE_KEY, !!enabled);
    PMMPCore.db.flush();
  };

  sqlEngine.setQueryObserver?.((sample) => {
    PMMPCore.getLogger("sql-debug").debug(
      `query mode=${sample.mode} durationMs=${sample.durationMs} rows=${sample.rowCount} sql="${sample.sql}"`
    );
  });
  for (const plugin of PMMPCore.getPlugins()) {
    if (plugin.onLoad && typeof plugin.onLoad === "function") {
      try {
        plugin.onLoad();
      } catch (error) {
        console.error(`[PMMPCore] Failed load hook for ${plugin.name}: ${error.message}`);
      }
    }
  }

  const AUTO_FLUSH_TICKS = 120;
  system.runInterval(() => {
    try {
      PMMPCore.getTickCoordinator()?.tick?.();
      PMMPCore.getTickCoordinator()?.flushDatabase?.();
    } catch (e) {
      console.error(`[PMMPCore] DB auto-flush: ${e.message}`);
    }
  }, AUTO_FLUSH_TICKS);

  registerCommandSafe(
    event.customCommandRegistry,
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

  PMMPCore.getCommandBus()?.registerBedrockCommand(event.customCommandRegistry, {
    name: "pmmpcore:diag",
    description: "Show PMMPCore platform diagnostics",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
    owner: "core",
    execute(origin) {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
      }
      const services = PMMPCore.getApiMetadata().services;
      const eventSummary = PMMPCore.getEventBus()?.listenerSummary?.() ?? [];
      const schedulerSummary = PMMPCore.getScheduler()?.summary?.() ?? [];
      const observability = PMMPCore.getServiceRegistry()?.get("observability")?.snapshot?.() ?? {};
      player.sendMessage(`${Color.bold}=== PMMPCore Diagnostics ===${Color.reset}`);
      player.sendMessage(`${Color.aqua}API Version: ${Color.white}${PMMPCore.getApiMetadata().version}`);
      player.sendMessage(`${Color.aqua}Services: ${Color.white}${services.map((s) => `${s.name}:${s.stability}`).join(", ")}`);
      player.sendMessage(`${Color.aqua}Event topics: ${Color.white}${eventSummary.length}`);
      player.sendMessage(`${Color.aqua}Scheduled tasks: ${Color.white}${schedulerSummary.length}`);
      if (observability.lastFlush) {
        player.sendMessage(`${Color.aqua}Last flush: ${Color.white}${observability.lastFlush.durationMs}ms`);
      }
      if (observability.lastTick) {
        player.sendMessage(`${Color.aqua}Last core tick: ${Color.white}${observability.lastTick.durationMs}ms`);
      }
      return { status: CustomCommandStatus.Success };
    },
  });

  event.customCommandRegistry.registerEnum("pmmpcore:sql_subcommand", ["select", "upsert", "delete", "tables"]);
  event.customCommandRegistry.registerEnum("pmmpcore:sql_toggle_state", ["on", "off"]);

  registerCommandSafe(
    event.customCommandRegistry,
    {
      name: "pmmpcore:sql",
      description: "Run SQL debug commands (select/upsert/delete/tables)",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.Enum, name: "pmmpcore:sql_subcommand" },
      ],
      optionalParameters: [
        { type: CustomCommandParamType.String, name: "arg1" },
        { type: CustomCommandParamType.String, name: "arg2" },
        { type: CustomCommandParamType.String, name: "arg3" },
        { type: CustomCommandParamType.String, name: "arg4" },
        { type: CustomCommandParamType.String, name: "arg5" },
        { type: CustomCommandParamType.String, name: "arg6" },
        { type: CustomCommandParamType.String, name: "arg7" },
      ],
    },
    (origin, subcommand, arg1, arg2, arg3, arg4, arg5, arg6, arg7) => {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
      }

      const signature = [subcommand, arg1, arg2, arg3, arg4, arg5, arg6, arg7]
        .filter((x) => x !== undefined && x !== null)
        .join(" ")
        .trim();
      const now = Date.now();
      const dedupKey = `${player.name}|${signature}`;
      const lastAt = SQL_RECENT_EXECUTIONS.get(dedupKey) ?? 0;
      if (now - lastAt < SQL_COMMAND_DEDUP_MS) {
        return { status: CustomCommandStatus.Success };
      }
      SQL_RECENT_EXECUTIONS.set(dedupKey, now);

      if (!getSqlDebugEnabled()) {
        player.sendMessage("§e[SQL Debug] SQL shell is disabled. Use /sqltoggle on.§r");
        return { status: CustomCommandStatus.Success };
      }

      const op = String(subcommand ?? "").trim().toLowerCase();
      const allArgs = [arg1, arg2, arg3, arg4, arg5, arg6, arg7]
        .filter((x) => x !== undefined && x !== null)
        .map((x) => String(x).trim())
        .filter((x) => x.length > 0);

      if (op === "select") {
        if (!hasSqlPermission(player, SQL_PERMISSIONS.read)) {
          player.sendMessage(`§c[SQL Debug] Missing permission: ${SQL_PERMISSIONS.read}§r`);
          return { status: CustomCommandStatus.Success };
        }
        const rawQuery = allArgs.join(" ").trim();
        if (!rawQuery) {
          player.sendMessage("§e[SQL Debug] Usage: /sql select * FROM items§r");
          return { status: CustomCommandStatus.Success };
        }
        const query = rawQuery.toUpperCase().startsWith("SELECT ") ? rawQuery : `SELECT ${rawQuery}`;
        const startedAt = Date.now();
        sqlEngine.executeQueryAsync(
          query,
          system,
          (error, rows = []) => {
            if (error) {
              player.sendMessage(`§c[SQL Debug] Error: ${error.message}§r`);
              return;
            }
            player.sendMessage(`§b[SQL Debug] Executing: §7${query}§r`);
            player.sendMessage(`§a[SQL Debug] Rows (${rows.length}) in ${Date.now() - startedAt}ms§r`);
            rows.slice(0, SQL_MAX_CHAT_ROWS).forEach((row, i) => {
              player.sendMessage(`§f[SQL Debug] [${i}] ${JSON.stringify(row)}`);
            });
            if (rows.length > SQL_MAX_CHAT_ROWS) {
              player.sendMessage(`§7[SQL Debug] ... ${rows.length - SQL_MAX_CHAT_ROWS} more rows not shown.`);
            }
          },
          75
        );
        return { status: CustomCommandStatus.Success };
      }

      if (op === "upsert") {
        if (!hasSqlPermission(player, SQL_PERMISSIONS.write)) {
          player.sendMessage(`§c[SQL Debug] Missing permission: ${SQL_PERMISSIONS.write}§r`);
          return { status: CustomCommandStatus.Success };
        }
        const table = String(arg1 ?? "").trim();
        const id = String(arg2 ?? "").trim();
        const payloadRaw = [arg3, arg4, arg5, arg6, arg7]
          .filter((x) => x !== undefined && x !== null)
          .join(" ")
          .trim();
        if (!table || !id || !payloadRaw) {
          player.sendMessage("§e[SQL Debug] Usage: /sql upsert <table> <id> <json>§r");
          return { status: CustomCommandStatus.Success };
        }
        try {
          const payload = JSON.parse(payloadRaw);
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            throw new Error("JSON payload must be an object.");
          }
          if (!sqlEngine.getMeta(table)) {
            sqlEngine.createTable(table, {});
          }
          sqlEngine.upsert(table, id, payload);
          PMMPCore.db.flush();
          player.sendMessage(`§a[SQL Debug] Upsert ok: ${table}[${id}]§r`);
        } catch (error) {
          player.sendMessage(`§c[SQL Debug] Upsert error: ${error.message}§r`);
        }
        return { status: CustomCommandStatus.Success };
      }

      if (op === "delete") {
        if (!hasSqlPermission(player, SQL_PERMISSIONS.write)) {
          player.sendMessage(`§c[SQL Debug] Missing permission: ${SQL_PERMISSIONS.write}§r`);
          return { status: CustomCommandStatus.Success };
        }
        const table = String(arg1 ?? "").trim();
        const id = String(arg2 ?? "").trim();
        if (!table || !id) {
          player.sendMessage("§e[SQL Debug] Usage: /sql delete <table> <id>§r");
          return { status: CustomCommandStatus.Success };
        }
        const deleted = sqlEngine.deleteRow(table, id);
        PMMPCore.db.flush();
        player.sendMessage(
          deleted
            ? `§a[SQL Debug] Deleted: ${table}[${id}]§r`
            : `§e[SQL Debug] Row not found: ${table}[${id}]§r`
        );
        return { status: CustomCommandStatus.Success };
      }

      if (op === "tables") {
        if (!hasSqlPermission(player, SQL_PERMISSIONS.read)) {
          player.sendMessage(`§c[SQL Debug] Missing permission: ${SQL_PERMISSIONS.read}§r`);
          return { status: CustomCommandStatus.Success };
        }
        const suffixes = PMMPCore.db.listPropertySuffixes("rtable:");
        const tables = new Set();
        for (const key of suffixes) {
          const match = /^rtable:(.+):meta$/.exec(String(key));
          if (match?.[1]) tables.add(match[1]);
        }
        const list = [...tables].sort((a, b) => a.localeCompare(b));
        player.sendMessage(`§b[SQL Debug] Tables (${list.length})§r`);
        if (list.length === 0) {
          player.sendMessage("§7[SQL Debug] No relational tables found yet.");
        } else {
          list.slice(0, SQL_MAX_CHAT_ROWS).forEach((name, i) => {
            player.sendMessage(`§f[SQL Debug] [${i}] ${name}`);
          });
          if (list.length > SQL_MAX_CHAT_ROWS) {
            player.sendMessage(`§7[SQL Debug] ... ${list.length - SQL_MAX_CHAT_ROWS} more tables not shown.`);
          }
        }
        return { status: CustomCommandStatus.Success };
      }

      player.sendMessage("§e[SQL Debug] Usage: /sql select <query> | /sql upsert <table> <id> <json> | /sql delete <table> <id> | /sql tables§r");
      return { status: CustomCommandStatus.Success };
    }
  );

  registerCommandSafe(
    event.customCommandRegistry,
    {
      name: "pmmpcore:sqltoggle",
      description: "Enable or disable global SQL debug shell",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.Enum, name: "pmmpcore:sql_toggle_state" },
      ],
    },
    (origin, state) => {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
      }
      if (!hasSqlPermission(player, SQL_PERMISSIONS.admin)) {
        player.sendMessage(`§c[SQL Debug] Missing permission: ${SQL_PERMISSIONS.admin}§r`);
        return { status: CustomCommandStatus.Success };
      }
      const enabled = String(state ?? "").toLowerCase() === "on";
      setSqlDebugEnabled(enabled);
      player.sendMessage(`§b[SQL Debug] SQL shell is now ${enabled ? "§aON" : "§cOFF"}§r`);
      return { status: CustomCommandStatus.Success };
    }
  );

  registerCommandSafe(
    event.customCommandRegistry,
    {
      name: "pmmpcore:sqlseed",
      description: "Seed SQL debug sample data",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
      }
      if (!hasSqlPermission(player, SQL_PERMISSIONS.admin)) {
        player.sendMessage(`§c[SQL Debug] Missing permission: ${SQL_PERMISSIONS.admin}§r`);
        return { status: CustomCommandStatus.Success };
      }
      if (!getSqlDebugEnabled()) {
        player.sendMessage("§e[SQL Debug] SQL shell is disabled. Use /sqltoggle on.§r");
        return { status: CustomCommandStatus.Success };
      }
      sqlEngine.createTable("items", { name: "string", power: "number" });
      sqlEngine.createIndex("items", "name");
      sqlEngine.upsert("items", "1", { name: "Excalibur", power: 100 });
      sqlEngine.upsert("items", "2", { name: "Wooden Stick", power: 5 });
      sqlEngine.upsert("items", "3", { name: "Dragon Sword", power: 150 });
      PMMPCore.db.flush();
      player.sendMessage("§a[SQL Debug] Seed data loaded into table 'items'.§r");
      return { status: CustomCommandStatus.Success };
    }
  );

  PMMPCore.getCommandBus()?.registerBedrockCommand(event.customCommandRegistry, {
    name: "pmmpcore:selftest",
    description: "Run PMMPCore platform smoke tests",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
    owner: "core",
    execute(origin) {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
      }
      try {
        const db = PMMPCore.db;
        db.set("selftest:kv", { ok: true, at: Date.now() });
        const kv = db.get("selftest:kv");
        const rel = PMMPCore.createRelationalEngine();
        rel.createTable("selftest_rows", { kind: "text" });
        rel.createIndex("selftest_rows", "kind");
        rel.upsert("selftest_rows", "row1", { kind: "check" });
        const rows = rel.executeQuery(`SELECT * FROM selftest_rows WHERE kind = check`);
        const indexCheck = rel.checkIndexConsistency("selftest_rows");
        db.flush();
        player.sendMessage(`${Color.bold}=== PMMPCore Self Test ===${Color.reset}`);
        player.sendMessage(`${Color.aqua}KV: ${Color.white}${kv?.ok ? "ok" : "fail"}`);
        player.sendMessage(`${Color.aqua}SQL-lite rows: ${Color.white}${rows.length}`);
        player.sendMessage(`${Color.aqua}Index consistency: ${Color.white}${indexCheck.ok ? "ok" : "fail"}`);
      } catch (error) {
        player.sendMessage(`${Color.red}Self test failed: ${error.message}${Color.reset}`);
      }
      return { status: CustomCommandStatus.Success };
    },
  });

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
      if (stats.dirtyKeys !== undefined) {
        player.sendMessage(`${Color.aqua}DB Dirty (RAM buffer): ${Color.white}${stats.dirtyKeys}`);
      }
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
  PMMPCore.emit("startup.ready", {});
  
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
