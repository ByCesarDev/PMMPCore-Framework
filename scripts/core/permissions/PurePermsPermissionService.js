import { world } from "@minecraft/server";

function normalizeName(name) {
  return String(name ?? "").trim().toLowerCase();
}

function normalizeWorld(worldName) {
  const value = String(worldName ?? "").trim().toLowerCase();
  if (value === "minecraft:overworld" || value === "overworld") return "overworld";
  if (value === "minecraft:nether" || value === "nether") return "nether";
  if (value === "minecraft:the_end" || value === "the_end" || value === "end") return "end";
  return value || null;
}

export class PurePermsPermissionService {
  constructor(purePermsService = null, dbRef = null) {
    this.backend = purePermsService;
    this.db = dbRef;
  }

  setBackend(service) {
    this.backend = service;
  }

  setDb(dbRef) {
    this.db = dbRef;
  }

  isReady() {
    return !!this.backend || !!this.db;
  }

  has(playerName, node, worldName = null, playerActor = null) {
    if (this.backend) {
      return !!this.backend.hasPermission(playerName, node, worldName, playerActor);
    }
    return this._hasFromSnapshot(playerName, node, worldName, playerActor);
  }

  _hasFromSnapshot(playerName, node, worldName = null, playerActor = null) {
    try {
      const data = this.db?.get("pureperms:data");
      if (!data || typeof data !== "object") return false;

      const actor = playerActor || world.getAllPlayers().find((p) => normalizeName(p.name) === normalizeName(playerName));
      const config = data.config || {};
      const disableOp = !!config.disableOp;

      if (!disableOp && actor) {
        const level = actor.commandPermissionLevel;
        if (typeof level === "number" && level >= 1) return true;
        if (typeof level === "string" && ["gamedirectors", "admin", "host", "owner"].includes(level.toLowerCase())) return true;
        if (typeof actor.isOp === "function" && actor.isOp()) return true;
        if (typeof actor.isOp === "boolean" && actor.isOp) return true;
      }

      const cleanNode = normalizeName(node);
      const set = this._resolvePermissionsFromData(data, playerName, worldName);
      if (set.denied.has("*") || set.denied.has(cleanNode)) return false;
      if (set.allowed.has("*") || set.allowed.has(cleanNode)) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  _resolvePermissionsFromData(data, playerName, worldName) {
    const worldKey = normalizeWorld(worldName);
    const users = data.users || {};
    const groups = data.groups || {};

    const userKey = Object.keys(users).find((k) => normalizeName(k) === normalizeName(playerName));
    const user = userKey ? users[userKey] : null;

    let defaultGroupName = "Guest";
    const defEntry = Object.entries(groups).find(([, g]) => g && g.isDefault);
    if (defEntry) defaultGroupName = defEntry[0];

    const groupName = user?.worlds?.[worldKey]?.group ?? user?.group ?? defaultGroupName;
    const groupPerms = this._resolveGroupPermissions(groupName, worldKey, groups);
    const userPerms = this._collectPermissionSet(user?.permissions ?? [], user?.worlds?.[worldKey]?.permissions ?? []);
    return this._mergePermissionSets(groupPerms, userPerms);
  }

  _resolveGroupPermissions(groupName, worldName, groups, visited = new Set()) {
    const key = normalizeName(groupName);
    if (!key || visited.has(key)) return { allowed: new Set(), denied: new Set() };
    visited.add(key);

    const entry = Object.entries(groups).find(([k]) => normalizeName(k) === key);
    if (!entry) return { allowed: new Set(), denied: new Set() };

    const [, groupData] = entry;
    let accumulated = { allowed: new Set(), denied: new Set() };

    for (const parent of groupData.inheritance ?? []) {
      const parentSet = this._resolveGroupPermissions(parent, worldName, groups, visited);
      accumulated = this._mergePermissionSets(accumulated, parentSet);
    }

    const current = this._collectPermissionSet(groupData.permissions ?? [], groupData.worlds?.[worldName]?.permissions ?? []);
    return this._mergePermissionSets(accumulated, current);
  }

  _collectPermissionSet(...sources) {
    const allowed = new Set();
    const denied = new Set();
    for (const list of sources) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (typeof item !== "string" || !item.trim()) continue;
        const clean = item.trim();
        if (clean.startsWith("-")) {
          const perm = normalizeName(clean.slice(1));
          denied.add(perm);
          allowed.delete(perm);
        } else {
          const perm = normalizeName(clean);
          allowed.add(perm);
          denied.delete(perm);
        }
      }
    }
    return { allowed, denied };
  }

  _mergePermissionSets(base, override) {
    const allowed = new Set(base.allowed);
    const denied = new Set(base.denied);
    for (const item of override.denied) {
      denied.add(item);
      allowed.delete(item);
    }
    for (const item of override.allowed) {
      allowed.add(item);
      denied.delete(item);
    }
    return { allowed, denied };
  }

  resolve(playerName, worldName = null) {
    if (this.backend) {
      return this.backend.resolvePermissions(playerName, worldName);
    }
    const data = this.db?.get("pureperms:data");
    if (!data) return { allowed: new Set(), denied: new Set() };
    return this._resolvePermissionsFromData(data, playerName, worldName);
  }

  getUserInfo(playerName, worldName = null) {
    if (this.backend) return this.backend.getUserInfo(playerName, worldName);
    const data = this.db?.get("pureperms:data");
    if (!data) return null;
    const user = data.users?.[playerName];
    if (!user) return null;
    return { name: playerName, ...user };
  }

  getGroupInfo(groupName, worldName = null) {
    if (this.backend) return this.backend.getGroupInfo(groupName, worldName);
    const data = this.db?.get("pureperms:data");
    if (!data) return null;
    const g = data.groups?.[groupName];
    if (!g) return null;
    return { name: groupName, ...g };
  }

  setUserGroup(playerName, groupName, worldName = null, changedByConsole = false, actor = null) {
    if (!this.backend) throw new Error("Permission backend is not ready");
    return this.backend.setUserGroup(playerName, groupName, worldName, changedByConsole, actor);
  }

  setUserPermission(playerName, node, worldName = null, enabled = true) {
    if (!this.backend) throw new Error("Permission backend is not ready");
    return this.backend.setUserPermission(playerName, node, worldName, enabled);
  }

  setGroupPermission(groupName, node, worldName = null, enabled = true) {
    if (!this.backend) throw new Error("Permission backend is not ready");
    return this.backend.setGroupPermission(groupName, node, worldName, enabled);
  }

  listPermissionNodes(prefix = "") {
    if (this.backend) return this.backend.findPermissionsByPrefix(prefix);
    return [];
  }
}
