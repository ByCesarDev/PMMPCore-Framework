import { system } from "@minecraft/server";
import { PMMPCore } from "../../PMMPCore.js";
import { registerEssentialsTPCommands } from "./commands.js";
import { ESSENTIALSTP_PLUGIN_NAME, ESSENTIALSTP_SCHEMA_VERSION } from "./config.js";
import { EssentialsTPService } from "./service.js";

console.log("[EssentialsTP] Loading EssentialsTP plugin...");

PMMPCore.registerPlugin({
  name: ESSENTIALSTP_PLUGIN_NAME,
  version: "1.0.0",
  depend: ["PMMPCore"],
  softdepend: ["PurePerms", "MultiWorld", "PlaceholderAPI", "EconomyAPI"],

  onEnable() {
    this.service = new EssentialsTPService();
    this._intervals = [];
    PMMPCore.getMigrationService()?.register(ESSENTIALSTP_PLUGIN_NAME, ESSENTIALSTP_SCHEMA_VERSION, () => {
      PMMPCore.db.setPluginData(ESSENTIALSTP_PLUGIN_NAME, {
        meta: { schemaVersion: ESSENTIALSTP_SCHEMA_VERSION },
        config: this.service.getConfig(),
      });
    });

    this.runtime = {
      getConfig: () => this.service.getConfig(),
      hasPermissionNode: (player, node) => {
        if (!player || !node) return true;
        const perms = PMMPCore.getPermissionService();
        if (!perms?.has) return true;
        return !!perms.has(player.name, node, player.dimension?.id ?? null, player);
      },
      createRequest: (fromPlayer, toPlayer, type = "tpa") => this.service.createRequest(fromPlayer, toPlayer, type),
      acceptRequest: (targetPlayer, requesterName = null) => this.service.acceptRequest(targetPlayer, requesterName),
      denyRequest: (targetPlayerName, requesterName = null) => this.service.denyRequest(targetPlayerName, requesterName),
      cancelRequest: (requesterName, targetName = null) => this.service.cancelRequest(requesterName, targetName),
      setHome: (player, name = "home") => this.service.setHome(player, name),
      getHome: (playerName, name = "home") => this.service.getHome(playerName, name),
      deleteHome: (playerName, name = "home") => this.service.deleteHome(playerName, name),
      listHomes: (playerName) => this.service.listHomes(playerName),
      setWarp: (player, name) => this.service.setWarp(player, name),
      getWarp: (name) => this.service.getWarp(name),
      deleteWarp: (name) => this.service.deleteWarp(name),
      listWarps: () => this.service.listWarps(),
      setSpawn: (player) => this.service.setSpawn(player),
      getSpawn: (dimensionId = "minecraft:overworld") => this.service.getSpawn(dimensionId),
      recordBack: (player, cause = "manual") => this.service.recordBack(player, cause),
      getBack: (playerName) => this.service.getBack(playerName),
      getCooldownSnapshot: (playerName) => this.service.getCooldownSnapshot(playerName),
    };
  },

  onStartup(event) {
    registerEssentialsTPCommands(event, this.service, this.runtime);
  },

  onWorldReady() {
    PMMPCore.getMigrationService()?.run(ESSENTIALSTP_PLUGIN_NAME);
    this.service.initialize();
    this._startIntervals();
    this._registerPlaceholderExpansion();
    PMMPCore.emit("essentialstp.ready", { provider: ESSENTIALSTP_PLUGIN_NAME });
    console.log("[EssentialsTP] Ready.");
  },

  onDisable() {
    for (const id of this._intervals) {
      try {
        system.clearRun(id);
      } catch (_) {}
    }
    this._intervals = [];
    PMMPCore.db.flush();
  },

  _startIntervals() {
    const cleanup = system.runInterval(() => {
      try {
        this.service.cleanupExpiredRequests();
      } catch (_) {}
    }, 100);
    this._intervals.push(cleanup);
  },

  _registerPlaceholderExpansion() {
    const placeholder = PMMPCore.getPlugin("PlaceholderAPI")?.runtime;
    if (!placeholder?.registerExpansion) return;
    try {
      placeholder.registerExpansion({
        identifier: "essentialstp",
        version: "1.0.0",
        author: "PMMPCore",
        onPlaceholderRequest: (player, key) => {
          if (!player) return "0";
          const normalized = String(key ?? "").toLowerCase();
          if (normalized === "home_count") return String(this.service.getPlayerHomeCount(player.name));
          if (normalized === "pending_requests") return String(this.service.listPendingRequestsForTarget(player.name).length);
          if (normalized === "back_available") return this.service.getBack(player.name) ? "true" : "false";
          if (normalized === "cooldown_home") return String(this.service.getCooldownSnapshot(player.name).home ?? 0);
          return null;
        },
      });
    } catch (_) {}
  },
});
