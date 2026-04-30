import { world } from "@minecraft/server";
import { PlaceholderExpansion } from "./PlaceholderExpansion.js";

class ServerExpansion extends PlaceholderExpansion {
  constructor({ getMetrics } = {}) {
    super({
      identifier: "server",
      version: "1.0.0",
      author: "PMMPCore Team",
    });
    this.getMetrics = typeof getMetrics === "function" ? getMetrics : () => ({});
  }

  onPlaceholderRequest(_player, key) {
    const id = String(key ?? "").toLowerCase();
    const metrics = this.getMetrics() ?? {};
    if (id === "name" || id === "motd") return String(world.getDefaultSpawnLocation ? "PMMPCore Bedrock Server" : "Bedrock Server");
    if (id === "ip") return "0.0.0.0";
    if (id === "port") return "19132";
    if (id === "max_players") return "0";
    if (id === "online_players") return String(world.getAllPlayers().length);
    if (id === "version") return "bedrock-script-api";
    if (id === "tps") return String(metrics.tps ?? 20);
    if (id === "load") return String(metrics.loadPercent ?? 0);
    return null;
  }
}

export { ServerExpansion };
