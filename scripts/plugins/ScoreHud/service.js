import { DisplaySlotId, ObjectiveSortOrder, world } from "@minecraft/server";
import { PMMPCore } from "../../PMMPCore.js";
import { getPlaceholderApiRuntime } from "../PlaceholderAPI/runtime.js";
import { SCOREHUD_DEFAULTS, SCOREHUD_DEFAULTS_HASH, SCOREHUD_PLUGIN_NAME, SCOREHUD_SCHEMA_VERSION } from "./config.js";
import { asObject, clone, normalizePlayerName } from "./state.js";

function sanitizeObjectiveId(raw) {
  const s = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  return s.length > 0 ? s.slice(0, 32) : "pmmpcore_sh";
}

function stripPlaceholdersWhenNoApi(text) {
  return String(text ?? "").replace(/%[a-z0-9_]+%/gi, "");
}

export class ScoreHudService {
  constructor() {
    this._config = clone(SCOREHUD_DEFAULTS);
    this._lastObjectiveId = null;
  }

  /**
   * Check if the saved configuration needs migration based on defaults hash.
   */
  needsMigration(savedData) {
    const meta = asObject(savedData?.meta, {});
    return meta.defaultsHash !== SCOREHUD_DEFAULTS_HASH;
  }

  /**
   * Smart merge of old configuration with new defaults.
   * Preserves user customizations while applying updates.
   */
  migrateConfig(oldData) {
    const oldConfig = asObject(oldData?.config, {});
    const oldMeta = asObject(oldData?.meta, {});
    
    console.log(`[ScoreHud] Starting config migration from hash ${oldMeta.defaultsHash || 'none'} to ${SCOREHUD_DEFAULTS_HASH}`);
    
    // Start with fresh defaults
    const newConfig = clone(SCOREHUD_DEFAULTS);
    
    // Preserve basic config if user modified it (but not title - always use defaults)
    const basicKeys = ['enabled', 'updateIntervalTicks', 'objectiveId', 'maxLineLength', 'maxLines'];
    for (const key of basicKeys) {
      if (oldConfig[key] !== undefined && oldConfig[key] !== SCOREHUD_DEFAULTS[key]) {
        newConfig[key] = oldConfig[key];
        console.log(`[ScoreHud] Preserved custom ${key}: ${oldConfig[key]}`);
      }
    }
    
    // Smart merge for lines array
    const oldLines = Array.isArray(oldConfig.lines) ? oldConfig.lines : [];
    const newLines = [...SCOREHUD_DEFAULTS.lines];
    const preservedLines = [];
    
    // Add user-modified lines that aren't in defaults AND weren't explicitly removed
    for (const oldLine of oldLines) {
      // Skip lines that are in defaults (they'll be added automatically)
      if (SCOREHUD_DEFAULTS.lines.includes(oldLine)) {
        continue;
      }
      
      // Check if this line contains obsolete placeholders that should be removed
      const hasObsoletePlaceholders = oldLine.includes('%player_money%') || 
                                    oldLine.includes('%player_rank%') ||
                                    oldLine.includes('%rank%');
      
      // Check if this line was likely removed from defaults (not just custom)
      // Only preserve lines that look genuinely custom (not default formatting)
      const isLikelyDefaultLine = oldLine.includes('%pureperms_') || 
                                 oldLine.includes('%economy_') ||
                                 oldLine.includes('%server_') || 
                                 oldLine.includes('%time_') ||
                                 oldLine.includes('----') ||
                                 oldLine.includes('====');
      
      // Remove lines with obsolete placeholders or default-like lines
      if (hasObsoletePlaceholders) {
        console.log(`[ScoreHud] Removed obsolete placeholder line: ${oldLine}`);
      } else if (isLikelyDefaultLine) {
        console.log(`[ScoreHud] Removed default-like line: ${oldLine}`);
      } else {
        preservedLines.push(oldLine);
        console.log(`[ScoreHud] Preserved custom line: ${oldLine}`);
      }
    }
    
    // Combine: defaults + preserved genuinely custom lines
    newConfig.lines = [...newLines, ...preservedLines];
    
    // Preserve messaging customizations
    if (oldConfig.messaging && oldConfig.messaging.prefix !== SCOREHUD_DEFAULTS.messaging.prefix) {
      newConfig.messaging = { ...SCOREHUD_DEFAULTS.messaging, ...oldConfig.messaging };
      console.log(`[ScoreHud] Preserved custom prefix: ${oldConfig.messaging.prefix}`);
    }
    
    // Update metadata
    const newMeta = {
      ...oldMeta,
      schemaVersion: SCOREHUD_SCHEMA_VERSION,
      defaultsHash: SCOREHUD_DEFAULTS_HASH,
      migratedAt: Date.now(),
      previousHash: oldMeta.defaultsHash,
    };
    
    console.log(`[ScoreHud] Migration completed. Lines: ${newConfig.lines.length} (was ${oldLines.length})`);
    
    return {
      meta: newMeta,
      config: newConfig,
    };
  }

  initialize() {
    this._config = this.getConfig();
  }

  getPrefix() {
    return this._config.messaging?.prefix ?? SCOREHUD_DEFAULTS.messaging.prefix;
  }

  getConfig() {
    const data = PMMPCore.db.getPluginData(SCOREHUD_PLUGIN_NAME);
    let safe = asObject(data, {});
    
    // Check if we need to migrate
    if (this.needsMigration(safe)) {
      console.log("[ScoreHud] Configuration migration detected, applying smart merge...");
      try {
        safe = this.migrateConfig(safe);
        PMMPCore.db.setPluginData(SCOREHUD_PLUGIN_NAME, safe);
        console.log("[ScoreHud] Migration completed successfully");
      } catch (error) {
        console.error("[ScoreHud] Migration failed, using fallback:", error?.message ?? error);
        // Fallback to normal processing
      }
    }
    
    // Normal processing (with migration result if applicable)
    safe.meta = asObject(safe.meta, {});
    safe.config = asObject(safe.config, {});
    safe.meta.schemaVersion = Number(safe.meta.schemaVersion ?? 1);
    
    // Ensure defaultsHash is set for future migrations
    if (!safe.meta.defaultsHash) {
      safe.meta.defaultsHash = SCOREHUD_DEFAULTS_HASH;
    }
    
    const lines = Array.isArray(safe.config?.lines)
      ? safe.config.lines.map((l) => String(l ?? "")).filter((l) => l.length > 0)
      : [...SCOREHUD_DEFAULTS.lines];
    safe.config = {
      ...clone(SCOREHUD_DEFAULTS),
      ...safe.config,
      title: SCOREHUD_DEFAULTS.title, // Always use default title
      lines: lines.length > 0 ? lines : [...SCOREHUD_DEFAULTS.lines],
      messaging: { ...SCOREHUD_DEFAULTS.messaging, ...asObject(safe.config?.messaging, {}) },
    };
    safe.config.objectiveId = sanitizeObjectiveId(safe.config.objectiveId ?? SCOREHUD_DEFAULTS.objectiveId);
    safe.config.updateIntervalTicks = Math.max(1, Math.floor(Number(safe.config.updateIntervalTicks ?? SCOREHUD_DEFAULTS.updateIntervalTicks)));
    safe.config.maxLineLength = Math.max(8, Math.min(128, Math.floor(Number(safe.config.maxLineLength ?? SCOREHUD_DEFAULTS.maxLineLength))));
    safe.config.maxLines = Math.max(1, Math.min(15, Math.floor(Number(safe.config.maxLines ?? SCOREHUD_DEFAULTS.maxLines))));
    
    PMMPCore.db.setPluginData(SCOREHUD_PLUGIN_NAME, safe);
    return safe.config;
  }

  reloadFromDisk() {
    const prevId = sanitizeObjectiveId(this._config?.objectiveId);
    this._config = this.getConfig();
    const nextId = sanitizeObjectiveId(this._config.objectiveId);
    if (prevId !== nextId) {
      try {
        world.scoreboard.clearObjectiveAtDisplaySlot(DisplaySlotId.Sidebar);
      } catch (_) {}
      try {
        const old = world.scoreboard.getObjective(prevId);
        if (old) world.scoreboard.removeObjective(prevId);
      } catch (_) {}
      this._lastObjectiveId = null;
    }
  }

  isHudEnabledForPlayer(playerName) {
    const key = normalizePlayerName(playerName);
    if (!key) return true;
    const playerData = PMMPCore.db.getPlayerData(playerName);
    const sh = asObject(playerData?.scoreHud, {});
    if (sh.enabled === false) return false;
    return true;
  }

  setHudEnabled(playerName, enabled) {
    const playerData = PMMPCore.db.getPlayerData(playerName);
    playerData.scoreHud = asObject(playerData.scoreHud, {});
    playerData.scoreHud.enabled = !!enabled;
    PMMPCore.db.setPlayerData(playerName, playerData);
  }

  /** First online player with HUD on (stable sort); player placeholders use this context. */
  getPlaceholderContextPlayer() {
    const players = world.getAllPlayers().filter((p) => this.isHudEnabledForPlayer(p.name));
    players.sort((a, b) => normalizePlayerName(a.name).localeCompare(normalizePlayerName(b.name)));
    return players[0] ?? null;
  }

  parseLine(template, contextPlayer) {
    const rt = getPlaceholderApiRuntime();
    if (rt?.parse) {
      try {
        return rt.parse(String(template ?? ""), contextPlayer, {});
      } catch (_) {
        return stripPlaceholdersWhenNoApi(template);
      }
    }
    return stripPlaceholdersWhenNoApi(template);
  }

  /**
   * Apply sidebar lines. Must run outside restricted execution (e.g. inside system.run).
   * Bedrock sidebar is global: all viewers see the same objective.
   */
  refreshSidebarGlobal() {
    const cfg = this._config;
    if (!cfg.enabled) {
      this._clearSidebarDisplay();
      return;
    }

    const viewers = world.getAllPlayers().filter((p) => this.isHudEnabledForPlayer(p.name));
    if (viewers.length === 0) {
      this._clearSidebarDisplay();
      return;
    }

    const objectiveId = sanitizeObjectiveId(cfg.objectiveId);
    const title = String(cfg.title ?? SCOREHUD_DEFAULTS.title).slice(0, 128);
    const maxLen = cfg.maxLineLength;
    const maxLines = cfg.maxLines;
    const contextPlayer = this.getPlaceholderContextPlayer();

    let objective = world.scoreboard.getObjective(objectiveId);
    try {
      if (!objective) {
        objective = world.scoreboard.addObjective(objectiveId, title);
      } else {
        // Update title of existing objective
        try {
          const oldObjective = objective;
          const participants = oldObjective.getScores();
          world.scoreboard.removeObjective(objectiveId);
          objective = world.scoreboard.addObjective(objectiveId, title);
          // Restore all participants
          for (const entry of participants) {
            try {
              objective.setScore(entry.participant.displayName ?? entry.participant.name ?? "unknown", entry.score);
            } catch (_) {}
          }
        } catch (e) {
          console.warn(`[ScoreHud] Failed to update objective title: ${e?.message ?? e}`);
        }
      }
    } catch (e) {
      console.warn(`[ScoreHud] addObjective failed: ${e?.message ?? e}`);
      return;
    }

    if (this._lastObjectiveId && this._lastObjectiveId !== objectiveId) {
      try {
        const old = world.scoreboard.getObjective(this._lastObjectiveId);
        if (old) world.scoreboard.removeObjective(this._lastObjectiveId);
      } catch (_) {}
    }
    this._lastObjectiveId = objectiveId;

    let templates = (Array.isArray(cfg.lines) ? cfg.lines : [...SCOREHUD_DEFAULTS.lines]).slice(0, maxLines);
    if (templates.length === 0) templates = [...SCOREHUD_DEFAULTS.lines];
    const resolved = [];
    const seen = new Set();
    const nLines = templates.length;
    for (let i = 0; i < templates.length; i++) {
      let line = this.parseLine(templates[i], contextPlayer);
      line = line.replace(/\r?\n/g, " ").slice(0, maxLen);
      if (!line.length) line = " ";
      let key = line;
      let n = 0;
      while (seen.has(key)) {
        n += 1;
        const pad = n <= maxLen ? "·".repeat(Math.min(n, maxLen)) : `·${n}`;
        key = (line + pad).slice(0, maxLen);
      }
      seen.add(key);
      resolved.push({ display: key, score: nLines - i });
    }

    try {
      const keep = new Set(resolved.map((r) => r.display));
      for (const entry of objective.getScores()) {
        const part = entry?.participant;
        if (!part) continue;
        const dn = String(part.displayName ?? "");
        if (!keep.has(dn)) objective.removeParticipant(part);
      }
    } catch (_) {}

    for (const row of resolved) {
      try {
        objective.setScore(row.display, row.score);
      } catch (e) {
        console.warn(`[ScoreHud] setScore failed: ${e?.message ?? e}`);
      }
    }

    try {
      world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
        objective,
        sortOrder: ObjectiveSortOrder.Descending,
      });
    } catch (e) {
      console.warn(`[ScoreHud] setObjectiveAtDisplaySlot failed: ${e?.message ?? e}`);
    }
  }

  _clearSidebarDisplay() {
    try {
      world.scoreboard.clearObjectiveAtDisplaySlot(DisplaySlotId.Sidebar);
    } catch (_) {}
  }

  /**
   * Force migration regardless of hash comparison (for debugging)
   */
  forceMigration() {
    console.log("[ScoreHud] Force migration requested...");
    const data = PMMPCore.db.getPluginData(SCOREHUD_PLUGIN_NAME);
    try {
      const migrated = this.migrateConfig(data);
      PMMPCore.db.setPluginData(SCOREHUD_PLUGIN_NAME, migrated);
      console.log("[ScoreHud] Force migration completed");
      this._config = this.getConfig(); // Reload config
      return true;
    } catch (error) {
      console.error("[ScoreHud] Force migration failed:", error?.message ?? error);
      return false;
    }
  }

  /**
   * Reset configuration completely to defaults
   */
  resetToDefaults() {
    console.log("[ScoreHud] Reset to defaults requested...");
    try {
      // Create fresh configuration from defaults
      const freshConfig = {
        meta: {
          schemaVersion: SCOREHUD_SCHEMA_VERSION,
          defaultsHash: SCOREHUD_DEFAULTS_HASH,
          resetAt: Date.now(),
        },
        config: clone(SCOREHUD_DEFAULTS),
      };
      
      // Save fresh configuration
      PMMPCore.db.setPluginData(SCOREHUD_PLUGIN_NAME, freshConfig);
      console.log("[ScoreHud] Configuration reset to defaults completed");
      
      // Reload config
      this._config = this.getConfig();
      return true;
    } catch (error) {
      console.error("[ScoreHud] Reset to defaults failed:", error?.message ?? error);
      return false;
    }
  }

  /**
   * Debug current configuration state
   */
  debugConfigState() {
    const data = PMMPCore.db.getPluginData(SCOREHUD_PLUGIN_NAME);
    const meta = asObject(data?.meta, {});
    const config = asObject(data?.config, {});
    
    console.log("[ScoreHud] Debug Info:");
    console.log("  Current defaults hash:", SCOREHUD_DEFAULTS_HASH);
    console.log("  Saved defaults hash:", meta.defaultsHash || 'none');
    console.log("  Schema version:", meta.schemaVersion || 'none');
    console.log("  Needs migration:", this.needsMigration(data));
    console.log("  Saved lines count:", Array.isArray(config.lines) ? config.lines.length : 0);
    console.log("  Default lines count:", SCOREHUD_DEFAULTS.lines.length);
    
    return data;
  }

  shutdownCleanup() {
    this._clearSidebarDisplay();
    const id = sanitizeObjectiveId(this._config?.objectiveId);
    try {
      if (id && world.scoreboard.getObjective(id)) world.scoreboard.removeObjective(id);
    } catch (_) {}
    this._lastObjectiveId = null;
  }
}
