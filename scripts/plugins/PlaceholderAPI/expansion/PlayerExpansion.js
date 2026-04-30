import { PlaceholderExpansion } from "./PlaceholderExpansion.js";

class PlayerExpansion extends PlaceholderExpansion {
  constructor() {
    super({
      identifier: "player",
      version: "1.0.0",
      author: "PMMPCore Team",
    });
  }

  onPlaceholderRequest(player, key) {
    if (!player) return null;
    const id = String(key ?? "").toLowerCase();
    if (id === "name") return String(player.name ?? "");
    if (id === "display_name") return String(player.nameTag ?? player.name ?? "");
    if (id === "health") return String(Math.floor(player.getComponent("health")?.currentValue ?? 0));
    if (id === "max_health") return String(Math.floor(player.getComponent("health")?.defaultValue ?? 20));
    if (id === "x") return String(Math.floor(player.location?.x ?? 0));
    if (id === "y") return String(Math.floor(player.location?.y ?? 0));
    if (id === "z") return String(Math.floor(player.location?.z ?? 0));
    if (id === "world") return String(player.dimension?.id ?? "unknown");
    if (id === "ip") return "n/a";
    if (id === "ping") return "n/a";
    return null;
  }
}

export { PlayerExpansion };
