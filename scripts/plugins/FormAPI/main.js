import { PMMPCore } from "../../PMMPCore.js";
import { FORM_API_CONFIG, FORM_API_PLUGIN_NAME } from "./config.js";
import { FormAPIService } from "./service.js";
import { setFormApiService } from "./runtime.js";
import { registerFormApiCommands } from "./commands.js";

console.log("[FormAPI] Loading FormAPI plugin...");

PMMPCore.registerPlugin({
  name: FORM_API_PLUGIN_NAME,
  version: "1.0.0",
  depend: ["PMMPCore"],

  onEnable() {
    if (!FORM_API_CONFIG.plugin.enabled) {
      console.warn("[FormAPI] Plugin disabled in config.");
      setFormApiService(null);
      return;
    }

    const logger = this.context?.getLogger?.() ?? console;
    this.service = new FormAPIService(FORM_API_CONFIG, logger);
    setFormApiService(this.service);
    this.service.start();

    this.runtime = {
      hasPermissionNode: (player, node) => {
        if (!player || !node) return true;
        const perms = PMMPCore.getPermissionService();
        if (!perms?.has) return true;
        return !!perms.has(player.name, node, player.dimension?.id ?? null, player);
      },
    };

    console.log("[FormAPI] Enabled.");
  },

  onStartup(event) {
    if (!this.service) return;
    registerFormApiCommands(event, this.runtime);
  },

  onDisable() {
    try {
      this.service?.stop?.();
    } catch (_) {}
    setFormApiService(null);
    console.log("[FormAPI] Disabled.");
  },
});
