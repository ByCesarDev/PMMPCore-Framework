import { world } from "@minecraft/server";
import { PlaceholderExpansion } from "./PlaceholderExpansion.js";

class GeneralExpansion extends PlaceholderExpansion {
  constructor() {
    super({
      identifier: "general",
      version: "1.0.0",
      author: "PMMPCore Team",
    });
  }

  onPlaceholderRequest(_player, key) {
    const id = String(key ?? "").toLowerCase();
    if (id === "online_players") return String(world.getAllPlayers().length);
    if (id === "max_players") return "0";
    if (id === "random_number") return String(1 + Math.floor(Math.random() * 100));
    if (id === "server_time") return new Date().toLocaleTimeString("en-GB", { hour12: false });
    if (id === "server_date") return new Date().toISOString().slice(0, 10);
    return null;
  }
}

export { GeneralExpansion };
