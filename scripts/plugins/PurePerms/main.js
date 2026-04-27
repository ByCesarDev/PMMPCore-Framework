import { PMMPCore, Color } from "../../PMMPCore.js";
import { world, system, Player, CustomCommandStatus, CommandPermissionLevel } from "@minecraft/server";

console.log("[PurePerms] Loading PurePerms plugin...");

PMMPCore.registerPlugin({
  name: "PurePerms",
  version: "1.0.0",
  depend: ["PMMPCore"],

  onEnable() {
    console.log("[PurePerms] PurePerms system enabled!");
  },

  onDisable() {
    console.log("[PurePerms] PurePerms system disabled");
  },

});
