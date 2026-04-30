import { world, system } from "@minecraft/server";
import { PMMPCore } from "../../PMMPCore.js";
import { registerPureChatCommands } from "./commands.js";
import { PURECHAT_PERMISSIONS, PURECHAT_PLUGIN_NAME, PURECHAT_SCHEMA_VERSION } from "./config.js";
import { PureChatService } from "./service.js";

console.log("[PureChat] Loading PureChat plugin...");

PMMPCore.registerPlugin({
  name: PURECHAT_PLUGIN_NAME,
  version: "1.0.0",
  depend: ["PMMPCore", "PurePerms"],

  onEnable() {
    this.service = new PureChatService();
    this._subs = [];
    this._ready = false;

    PMMPCore.getMigrationService()?.register(PURECHAT_PLUGIN_NAME, PURECHAT_SCHEMA_VERSION, () => {
      this.service.initialize();
    });

    const chatSub = world.beforeEvents.chatSend.subscribe((event) => {
      try {
        if (!this._ready) return;
        const player = event.sender;
        if (!player) return;
        if (!this.service.hasPermissionNode(player, PURECHAT_PERMISSIONS.use)) return;
        const line = this.service.formatChatForPlayer(player, event.message);
        event.cancel = true;
        world.sendMessage(line);
      } catch (error) {
        console.warn(`[PureChat] Chat pipeline error: ${error?.message ?? "unknown error"}`);
      }
    });
    this._subs.push(chatSub);

    const spawnSub = world.afterEvents.playerSpawn.subscribe((event) => {
      if (!this._ready) return;
      system.run(() => {
        try {
          this.service.applyNametag(event.player);
        } catch (error) {
          console.warn(`[PureChat] NameTag update error: ${error?.message ?? "unknown error"}`);
        }
      });
    });
    this._subs.push(spawnSub);
  },

  onStartup(event) {
    registerPureChatCommands(event, this.service);
  },

  onWorldReady() {
    try {
      PMMPCore.getMigrationService()?.run(PURECHAT_PLUGIN_NAME);
      this.service.initialize();
      this._ready = true;
      PMMPCore.emit("purechat.ready", { provider: PURECHAT_PLUGIN_NAME });
      console.log("[PureChat] Ready.");
    } catch (error) {
      console.warn(`[PureChat] World-ready initialization failed: ${error?.message ?? "unknown error"}`);
    }
  },

  onDisable() {
    if (Array.isArray(this._subs)) {
      for (const sub of this._subs) {
        try {
          sub?.unsubscribe?.();
        } catch (_) {}
      }
    }
    this._subs = [];
    this._ready = false;
  },
});
