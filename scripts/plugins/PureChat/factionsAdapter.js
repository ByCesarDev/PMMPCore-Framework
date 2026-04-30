import { PMMPCore } from "../../PMMPCore.js";

export function resolveFactionContext(player) {
  const empty = { fac_name: "", fac_rank: "" };
  try {
    const plugin = PMMPCore.getPlugin("Factions") ?? PMMPCore.getPlugin("FactionsPro");
    if (!plugin) return empty;

    const service = plugin.service ?? plugin.api ?? null;
    if (!service) return empty;

    if (typeof service.getPlayerFactionContext === "function") {
      const ctx = service.getPlayerFactionContext(player?.name);
      return {
        fac_name: ctx?.name ?? "",
        fac_rank: ctx?.rank ?? "",
      };
    }

    return empty;
  } catch (_) {
    return empty;
  }
}
