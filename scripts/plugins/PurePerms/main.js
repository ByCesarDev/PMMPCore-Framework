import { PMMPCore, Color } from "../../PMMPCore.js";
import { world, system } from "@minecraft/server";
import { registerPurePermsCommands } from "./commands.js";
import { PurePermsService } from "./service.js";
import { PurePermsExpansion } from "../PlaceholderAPI/expansion/PurePermsExpansion.js";

console.log("[PurePerms] Loading PurePerms plugin...");

PMMPCore.registerPlugin({
  name: "PurePerms",
  version: "1.0.0",
  depend: ["PMMPCore"],
  softdepend: ["PlaceholderAPI"],

  onEnable() {
    this.service = new PurePermsService();
    this._subscriptions = [];
    this._initialized = false;
    PMMPCore.registerPermissionBackend(this.service);
    PMMPCore.getMigrationService()?.register("PurePerms", 1, () => {});
    
    // Don't register expansion here - wait for onWorldReady

    const worldLoadSub = world.afterEvents.worldLoad.subscribe(() => {
      if (this._initialized) return;
      system.run(() => {
        if (this._initialized) return;
        try {
          this.service.initialize();
          this._initialized = true;
          console.log("[PurePerms] Data initialized after world load.");
        } catch (error) {
          console.warn(`[PurePerms] Failed delayed initialization: ${error?.message ?? "unknown error"}`);
        }
      });
    });
    this._subscriptions.push(worldLoadSub);

    const spawnSub = world.afterEvents.playerSpawn.subscribe((event) => {
      try {
        const changed = this.service.syncNativeOperatorGroup(event.player);
        if (changed) {
          console.log(`[PurePerms] Synced native OP -> group OP for ${event.player.name}`);
        }
      } catch (error) {
        console.warn(`[PurePerms] Failed OP sync on spawn: ${error?.message ?? "unknown error"}`);
      }
    });
    this._subscriptions.push(spawnSub);
    this.context?.getLogger?.()?.info?.("Permission backend online");
    console.log("[PurePerms] PurePerms system enabled.");
  },

  onStartup(event) {
    registerPurePermsCommands(event, this.service);
    console.log("[PurePerms] Command registration completed.");
  },

  onDisable() {
    if (Array.isArray(this._subscriptions)) {
      for (const sub of this._subscriptions) {
        try {
          sub?.unsubscribe?.();
        } catch (_) {}
      }
    }
    this._subscriptions = [];
    this.service?.clearCache?.();
    PMMPCore.registerPermissionBackend(null);
    console.log("[PurePerms] PurePerms system disabled.");
  },

  onWorldReady() {
    try {
      PMMPCore.getMigrationService()?.run("PurePerms");
      PMMPCore.emit("permissions.ready", { provider: "PurePerms" });
      
      // Register PlaceholderAPI expansion now that all plugins are loaded
      this._registerPlaceholderExpansion();
    } catch (error) {
      console.warn(`[PurePerms] Migration runner failed: ${error?.message ?? "unknown error"}`);
    }
  },

  _registerPlaceholderExpansion() {
    try {
      const placeholderPlugin = PMMPCore.getPlugin("PlaceholderAPI");
      if (!placeholderPlugin?.runtime) {
        console.log("[PurePerms] PlaceholderAPI not available, skipping expansion registration");
        return;
      }

      const purePermsExpansion = new PurePermsExpansion(this.service);
      placeholderPlugin.runtime.registerExpansion(purePermsExpansion);
      console.log("[PurePerms] Registered PlaceholderAPI expansion with placeholders: %pureperms_rank%, %pureperms_prefix%, %pureperms_suffix%, %pureperms_group%, %pureperms_groups%");
    } catch (error) {
      console.warn("[PurePerms] Failed to register PlaceholderAPI expansion:", error?.message ?? error);
    }
  },

  getHelp() {
    return [
      `${Color.aqua}PurePerms Commands:${Color.reset}`,
      `${Color.white}/ppinfo ${Color.gray}- Plugin information`,
      `${Color.white}/groups ${Color.gray}- List groups`,
      `${Color.white}/usrinfo <player> [world] ${Color.gray}- Show user info`,
      `${Color.white}/grpinfo <group> [world] ${Color.gray}- Show group info`,
      `${Color.white}/setgroup <player> <group> [world] ${Color.gray}- Assign user group`,
      `${Color.white}/setuperm <player> <permission> [world] ${Color.gray}- Grant user permission`,
      `${Color.white}/unsetuperm <player> <permission> [world] ${Color.gray}- Deny user permission`,
      `${Color.white}/setgperm <group> <permission> [world] ${Color.gray}- Grant group permission`,
      `${Color.white}/unsetgperm <group> <permission> [world] ${Color.gray}- Deny group permission`,
    ];
  },
});
