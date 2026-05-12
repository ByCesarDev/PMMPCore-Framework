export const SCOREHUD_PLUGIN_NAME = "ScoreHud";
/** Bumped when plugin data migrations change (see main.js MigrationService). */
export const SCOREHUD_SCHEMA_VERSION = 1;

/**
 * Simple hash function for detecting config changes.
 * Uses a basic string hash algorithm suitable for this use case.
 */
function calculateHash(obj) {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

export const SCOREHUD_PERMISSIONS = Object.freeze({
  use: "scorehud.use",
  reload: "scorehud.admin.reload",
});

/** Defaults mirror ScoreHud-style lines; favor server/time placeholders (sidebar is global on Bedrock). */
export const SCOREHUD_DEFAULTS = Object.freeze({
  enabled: true,
  /** Ticks between sidebar refreshes. */
  updateIntervalTicks: 20,
  /** Alphanumeric + underscore objective id (Bedrock-safe). */
  objectiveId: "pmmpcore_sh",
  /** Sidebar objective display title (supports formatting codes). */
  title: "§eMineHUB UHC",
  maxLineLength: 128,
  maxLines: 15,
  lines: Object.freeze([
    "§7---------------",
    "§3Player: %player_name%",
    "§5Online: %server_online_players%",
    "§eMoney: %economy_money%",
    "§6Rank: %pureperms_rank%",
    "§5Coords %player_x%, %player_y%, %player_z%",
    "§7--------------",
    "§fTPS: §e%server_tps%§r §8·§r §fLoad §e%server_load%%§r",
    "§eIP: §6%server_ip%",
    "§7--------------",
  ]),
  messaging: Object.freeze({
    prefix: "§b[ScoreHud]§r",
  }),
});

/** Hash of the current defaults for change detection. */
export const SCOREHUD_DEFAULTS_HASH = calculateHash(SCOREHUD_DEFAULTS);
