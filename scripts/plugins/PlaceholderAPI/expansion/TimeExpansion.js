import { PlaceholderExpansion } from "./PlaceholderExpansion.js";

class TimeExpansion extends PlaceholderExpansion {
  constructor() {
    super({
      identifier: "time",
      version: "1.0.0",
      author: "PMMPCore Team",
    });
  }

  onPlaceholderRequest(_player, key) {
    const now = new Date();
    const id = String(key ?? "").toLowerCase();
    if (id === "current") return now.toLocaleTimeString("en-GB", { hour12: false });
    if (id === "date") return now.toISOString().slice(0, 10);
    if (id === "datetime") return `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString("en-GB", { hour12: false })}`;
    if (id === "timestamp") return String(Math.floor(now.getTime() / 1000));
    return null;
  }
}

export { TimeExpansion };
