import { PMMPCore } from "../../PMMPCore.js";
import {
  PURECHAT_DEFAULTS,
  PURECHAT_PERMISSIONS,
  PURECHAT_PLUGIN_NAME,
  PURECHAT_SCHEMA_VERSION,
  clone,
  normalizeName,
  normalizeWorld,
} from "./config.js";
import { buildChatMessage, buildNametag, stripAmpersandColors } from "./formatter.js";
import { resolveFactionContext } from "./factionsAdapter.js";

function asObject(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return value;
}

export class PureChatService {
  constructor() {
    this._state = null;
    this._mwDimensionCache = new Map();
  }

  initialize() {
    const state = this._getState();
    this._ensureDefaults(state);
    this._saveState(state);
  }

  getState() {
    return this._getState();
  }

  setPrefix(playerName, prefix) {
    const state = this._getState();
    const name = String(playerName ?? "").trim();
    if (!name) throw new Error("Player name cannot be empty.");
    if (!state.players[name]) state.players[name] = {};
    state.players[name].prefix = String(prefix ?? "");
    this._saveState(state);
  }

  setSuffix(playerName, suffix) {
    const state = this._getState();
    const name = String(playerName ?? "").trim();
    if (!name) throw new Error("Player name cannot be empty.");
    if (!state.players[name]) state.players[name] = {};
    state.players[name].suffix = String(suffix ?? "");
    this._saveState(state);
  }

  setGroupFormat(groupName, worldName, format) {
    const state = this._getState();
    const groupKey = this._resolveGroupKey(groupName, state.groups);
    if (!groupKey) throw new Error(`Group '${groupName}' not found.`);
    const target = state.groups[groupKey];
    if (worldName) {
      const key = normalizeWorld(worldName);
      target.worlds = asObject(target.worlds, {});
      target.worlds[key] = asObject(target.worlds[key], {});
      target.worlds[key].chat = String(format ?? "");
    } else {
      target.chat = String(format ?? "");
    }
    this._saveState(state);
  }

  setGroupNametag(groupName, worldName, format) {
    const state = this._getState();
    const groupKey = this._resolveGroupKey(groupName, state.groups);
    if (!groupKey) throw new Error(`Group '${groupName}' not found.`);
    const target = state.groups[groupKey];
    if (worldName) {
      const key = normalizeWorld(worldName);
      target.worlds = asObject(target.worlds, {});
      target.worlds[key] = asObject(target.worlds[key], {});
      target.worlds[key].nametag = String(format ?? "");
    } else {
      target.nametag = String(format ?? "");
    }
    this._saveState(state);
  }

  applyNametag(player) {
    const resolved = this.resolvePlayerContext(player, "");
    const nametag = buildNametag(resolved.nametagTemplate, resolved.placeholders);
    try {
      player.nameTag = nametag;
      return nametag;
    } catch (_) {
      return null;
    }
  }

  formatChatForPlayer(player, rawMessage) {
    const canUseColor = this.hasPermissionNode(player, PURECHAT_PERMISSIONS.coloredMessages);
    const safeMessage = canUseColor ? String(rawMessage ?? "") : stripAmpersandColors(rawMessage ?? "");
    const resolved = this.resolvePlayerContext(player, safeMessage);
    return buildChatMessage(resolved.chatTemplate, resolved.placeholders);
  }

  hasPermissionNode(player, node) {
    return this._hasPermission(player, node);
  }

  resolvePlayerContext(player, message) {
    const worldName = this._resolveWorldName(player?.dimension?.id);
    const perms = PMMPCore.getPermissionService();
    let groupName = "Guest";
    try {
      // PermissionService.resolve() returns permission sets, not group info.
      // Use getUserInfo() (PurePerms-backed) to resolve effective group.
      const info = perms?.getUserInfo?.(player?.name, worldName);
      groupName = info?.effectiveGroup ?? info?.group ?? "Guest";
    } catch (_) {}

    const state = this._getState();
    const groupKey = this._resolveGroupKey(groupName, state.groups) ?? "Guest";
    const groupData = asObject(state.groups[groupKey], {});
    const worldKey = normalizeWorld(worldName);
    const worldOverride = state.enableMultiworldChat ? asObject(groupData.worlds?.[worldKey], null) : null;
    const playerData = asObject(state.players?.[player?.name], {});
    const prefix = String(playerData.prefix ?? "");
    const suffix = String(playerData.suffix ?? "");
    const faction = resolveFactionContext(player);
    const placeholders = {
      // Important: `player.nameTag` may already contain rank/prefix formatting.
      // `{display_name}` must remain the raw player name to avoid duplicating rank tags in chat templates.
      display_name: player?.name || "Unknown",
      nametag: player?.nameTag || player?.name || "Unknown",
      msg: String(message ?? ""),
      prefix,
      suffix,
      world: worldName ?? "",
      fac_name: faction.fac_name ?? "",
      fac_rank: faction.fac_rank ?? "",
    };

    return {
      groupName: groupKey,
      worldName,
      chatTemplate: String(worldOverride?.chat ?? groupData.chat ?? PURECHAT_DEFAULTS.groups.Guest.chat),
      nametagTemplate: String(worldOverride?.nametag ?? groupData.nametag ?? PURECHAT_DEFAULTS.groups.Guest.nametag),
      placeholders,
    };
  }

  getGroupOverview(groupName, worldName = null) {
    const state = this._getState();
    const key = this._resolveGroupKey(groupName, state.groups);
    if (!key) throw new Error(`Group '${groupName}' not found.`);
    const g = state.groups[key];
    const wk = normalizeWorld(worldName);
    const ov = asObject(g.worlds?.[wk], {});
    return {
      group: key,
      chat: worldName ? String(ov.chat ?? g.chat ?? "") : String(g.chat ?? ""),
      nametag: worldName ? String(ov.nametag ?? g.nametag ?? "") : String(g.nametag ?? ""),
      world: worldName ?? null,
    };
  }

  _getPermsDebug(player) {
    try {
      const perms = PMMPCore.getPermissionService();
      const worldName = this._resolveWorldName(player?.dimension?.id);
      return perms?.getUserInfo?.(player?.name, worldName) ?? null;
    } catch (_) {
      return null;
    }
  }

  _hasPermission(player, node) {
    try {
      const perms = PMMPCore.getPermissionService();
      if (!player || !perms?.has) return false;
      const worldName = this._resolveWorldName(player.dimension?.id);
      return !!perms.has(player.name, node, worldName, player);
    } catch (_) {
      return false;
    }
  }

  _resolveWorldName(dimensionId) {
    if (!dimensionId) return "";
    if (dimensionId === "minecraft:overworld") return "overworld";
    if (dimensionId === "minecraft:nether") return "nether";
    if (dimensionId === "minecraft:the_end") return "end";
    if (this._mwDimensionCache.has(dimensionId)) return this._mwDimensionCache.get(dimensionId);

    const db = PMMPCore.db;
    if (!db) return dimensionId;
    const index = db.getWorldIndex?.() ?? [];
    for (const worldName of index) {
      const data = db.getWorld?.(worldName);
      if (data?.dimensionId === dimensionId) {
        this._mwDimensionCache.set(dimensionId, worldName);
        return worldName;
      }
    }
    return dimensionId;
  }

  _resolveGroupKey(groupName, groups) {
    const n = normalizeName(groupName);
    return Object.keys(groups ?? {}).find((k) => normalizeName(k) === n) ?? null;
  }

  _getState() {
    if (this._state) return this._state;
    const raw = PMMPCore.db.getPluginData(PURECHAT_PLUGIN_NAME);
    const state = asObject(raw, {});
    this._ensureDefaults(state);
    this._state = state;
    return this._state;
  }

  _saveState(state) {
    this._state = state;
    PMMPCore.db.setPluginData(PURECHAT_PLUGIN_NAME, state);
    PMMPCore.db.flush();
  }

  _ensureDefaults(state) {
    state.meta = asObject(state.meta, {});
    state.meta.schemaVersion = Number(state.meta.schemaVersion ?? PURECHAT_SCHEMA_VERSION);
    state.enableMultiworldChat = !!(state.enableMultiworldChat ?? PURECHAT_DEFAULTS.enableMultiworldChat);
    state.groups = asObject(state.groups, {});
    state.players = asObject(state.players, {});
    for (const [groupName, defaults] of Object.entries(PURECHAT_DEFAULTS.groups)) {
      const target = asObject(state.groups[groupName], {});
      target.chat = String(target.chat ?? defaults.chat);
      target.nametag = String(target.nametag ?? defaults.nametag);
      target.worlds = asObject(target.worlds, {});
      state.groups[groupName] = target;
    }
  }
}
