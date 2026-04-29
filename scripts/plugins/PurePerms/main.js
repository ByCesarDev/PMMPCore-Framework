import { PMMPCore, Color } from "../../PMMPCore.js";
import { world } from "@minecraft/server";
import { registerPurePermsCommands } from "./commands.js";
import { PurePermsService } from "./service.js";

console.log("[PurePerms] Loading PurePerms plugin...");

PMMPCore.registerPlugin({
  name: "PurePerms",
  version: "1.0.0",
  depend: ["PMMPCore"],

  onEnable() {
    this.service = new PurePermsService();
    this.service.initialize();
    this._subscriptions = [];
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
    console.log("[PurePerms] PurePerms system disabled.");
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
