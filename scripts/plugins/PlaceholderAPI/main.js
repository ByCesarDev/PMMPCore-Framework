import { PMMPCore } from "../../PMMPCore.js";
import { PLACEHOLDER_CONFIG_DEFAULTS, PLACEHOLDER_PLUGIN_NAME, PLACEHOLDER_SCHEMA_VERSION } from "./config.js";
import { registerPlaceholderCommands } from "./commands.js";
import { PlaceholderService } from "./service.js";
import { GeneralExpansion } from "./expansion/GeneralExpansion.js";
import { PlayerExpansion } from "./expansion/PlayerExpansion.js";
import { ServerExpansion } from "./expansion/ServerExpansion.js";
import { TimeExpansion } from "./expansion/TimeExpansion.js";
import { setPlaceholderApiRuntime } from "./runtime.js";

function buildConfig() {
  return {
    debug: PLACEHOLDER_CONFIG_DEFAULTS.debug,
    maxParseInputLength: PLACEHOLDER_CONFIG_DEFAULTS.maxParseInputLength,
    cacheTtl: { ...PLACEHOLDER_CONFIG_DEFAULTS.cacheTtl },
    enabledExpansions: { ...PLACEHOLDER_CONFIG_DEFAULTS.enabledExpansions },
  };
}

console.log("[PlaceholderAPI] Loading PlaceholderAPI plugin...");

PMMPCore.registerPlugin({
  name: PLACEHOLDER_PLUGIN_NAME,
  version: "1.0.0",
  depend: ["PMMPCore"],

  onEnable() {
    this._config = buildConfig();
    this.service = new PlaceholderService({
      logger: this.context?.getLogger?.() ?? console,
      config: this._config,
    });

    const metricsProvider = () => {
      const observability = PMMPCore.getServiceRegistry()?.get("observability")?.snapshot?.() ?? {};
      const tickMs = Number(observability?.lastTick?.durationMs ?? 0);
      const tps = tickMs > 0 ? Math.max(1, Math.min(20, Number((1000 / tickMs).toFixed(2)))) : 20;
      const loadPercent = tickMs > 0 ? Math.min(100, Math.max(0, Number(((tickMs / 50) * 100).toFixed(2)))) : 0;
      return { tps, loadPercent };
    };

    if (this._config.enabledExpansions.general) this.service.registerExpansion(new GeneralExpansion(), ["default"]);
    if (this._config.enabledExpansions.player) this.service.registerExpansion(new PlayerExpansion());
    if (this._config.enabledExpansions.server) this.service.registerExpansion(new ServerExpansion({ getMetrics: metricsProvider }));
    if (this._config.enabledExpansions.time) this.service.registerExpansion(new TimeExpansion());

    const runtime = {
      parse: (text, player = null, context = {}) => this.service.parse(text, player, context),
      registerExpansion: (expansion, aliases = []) => this.service.registerExpansion(expansion, aliases),
      unregisterExpansion: (identifier) => this.service.unregisterExpansion(identifier),
      listExpansions: () => this.service.listExpansions(),
      hasPermissionNode: (player, node) => {
        if (!player || !node) return true;
        const perms = PMMPCore.getPermissionService();
        if (!perms?.has) return true;
        const worldName = player.dimension?.id ?? null;
        return !!perms.has(player.name, node, worldName, player);
      },
      reload: () => {
        this._config = buildConfig();
        this.service.setConfig(this._config);
      },
    };

    this.runtime = runtime;
    setPlaceholderApiRuntime(runtime);
    PMMPCore.getMigrationService()?.register(PLACEHOLDER_PLUGIN_NAME, PLACEHOLDER_SCHEMA_VERSION, () => {});
  },

  onStartup(event) {
    registerPlaceholderCommands(event, this.runtime);
  },

  onWorldReady() {
    PMMPCore.getMigrationService()?.run(PLACEHOLDER_PLUGIN_NAME);
    PMMPCore.emit("placeholderapi.ready", { provider: PLACEHOLDER_PLUGIN_NAME });
  },

  onDisable() {
    setPlaceholderApiRuntime(null);
    this.runtime = null;
    this.service = null;
  },
});
