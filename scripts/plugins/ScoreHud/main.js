import { system, world } from "@minecraft/server";
import { PMMPCore } from "../../PMMPCore.js";
import { registerScoreHudCommands } from "./commands.js";
import { SCOREHUD_PLUGIN_NAME, SCOREHUD_SCHEMA_VERSION, SCOREHUD_DEFAULTS_HASH } from "./config.js";
import { ScoreHudService } from "./service.js";

console.log("[ScoreHud] Loading ScoreHud plugin...");

PMMPCore.registerPlugin({
  name: SCOREHUD_PLUGIN_NAME,
  version: "1.0.0",
  depend: ["PMMPCore"],
  softdepend: ["PlaceholderAPI", "PurePerms"],

  onEnable() {
    this.service = new ScoreHudService();
    this._intervalId = null;
    this._subs = [];

    PMMPCore.getMigrationService()?.register(SCOREHUD_PLUGIN_NAME, SCOREHUD_SCHEMA_VERSION, () => {
      PMMPCore.db.setPluginData(SCOREHUD_PLUGIN_NAME, {
        meta: { 
          schemaVersion: SCOREHUD_SCHEMA_VERSION,
          defaultsHash: SCOREHUD_DEFAULTS_HASH 
        },
        config: this.service.getConfig(),
      });
    });

    this.runtime = {
      hasPermissionNode: (player, node) => {
        if (!player || !node) return true;
        const perms = PMMPCore.getPermissionService();
        if (!perms?.has) return true;
        return !!perms.has(player.name, node, player.dimension?.id ?? null, player);
      },
      onReloaded: () => this._restartTickInterval(),
    };
  },

  onStartup(event) {
    registerScoreHudCommands(event, this.service, this.runtime);
  },

  onWorldReady() {
    PMMPCore.getMigrationService()?.run(SCOREHUD_PLUGIN_NAME);
    this.service.initialize();
    this._restartTickInterval();
    system.run(() => {
      try {
        this.service.refreshSidebarGlobal();
      } catch (_) {}
    });
    const leave = world.afterEvents.playerLeave.subscribe(() => {
      system.run(() => {
        try {
          this.service.refreshSidebarGlobal();
        } catch (_) {}
      });
    });
    this._subs.push(() => leave.unsubscribe?.());
    PMMPCore.emit("scorehud.ready", { provider: SCOREHUD_PLUGIN_NAME });
    console.log("[ScoreHud] Ready.");
  },

  onDisable() {
    if (this._intervalId != null) {
      try {
        system.clearRun(this._intervalId);
      } catch (_) {}
      this._intervalId = null;
    }
    for (const unsub of this._subs ?? []) {
      try {
        unsub?.();
      } catch (_) {}
    }
    this._subs = [];
    try {
      this.service?.shutdownCleanup();
    } catch (_) {}
    PMMPCore.db.flush();
  },

  _restartTickInterval() {
    if (this._intervalId != null) {
      try {
        system.clearRun(this._intervalId);
      } catch (_) {}
      this._intervalId = null;
    }
    const ticks = Math.max(1, Math.floor(Number(this.service.getConfig().updateIntervalTicks ?? 20)));
    this._intervalId = system.runInterval(() => {
      system.run(() => {
        try {
          this.service.refreshSidebarGlobal();
        } catch (e) {
          console.warn(`[ScoreHud] refresh: ${e?.message ?? e}`);
        }
      });
    }, ticks);
  },
});
