import { PMMPCore } from "../../PMMPCore.js";
import { DEFAULT_GROUPS, PUREPERMS_CONFIG, PUREPERMS_SCHEMA_VERSION } from "./config.js";

const PLUGIN_NAME = "PurePerms";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asPlainObject(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return value;
}

function normalizeName(name) {
  return String(name ?? "").trim().toLowerCase();
}

function normalizeWorld(worldName) {
  return worldName ? String(worldName).trim().toLowerCase() : null;
}

export class PurePermsService {
  constructor() {
    this.cache = new Map();
  }

  initialize() {
    const data = this._getData();
    let changed = false;
    if (!data.meta || typeof data.meta !== "object") {
      data.meta = { schemaVersion: PUREPERMS_SCHEMA_VERSION };
      changed = true;
    }
    if (!data.config || typeof data.config !== "object") {
      data.config = clone(PUREPERMS_CONFIG);
      changed = true;
    }
    if (!data.groups || typeof data.groups !== "object") {
      data.groups = {};
      changed = true;
    }
    if (!data.users || typeof data.users !== "object") {
      data.users = {};
      changed = true;
    }
    changed = this._ensureDefaultGroups(data) || changed;

    if (changed) this._saveData(data);
  }

  reloadConfig() {
    const data = this._getData();
    // config.js is the source of truth on reload.
    data.config = clone(PUREPERMS_CONFIG);
    this._ensureDefaultGroups(data);
    this._saveData(data);
    return data.config;
  }

  getConfig() {
    return this._getData().config ?? clone(PUREPERMS_CONFIG);
  }

  getGroups() {
    const data = this._getData();
    if (this._ensureDefaultGroups(data)) {
      this._saveData(data);
    }
    return asPlainObject(data.groups, {});
  }

  getUsers() {
    const users = this._getData().users;
    return asPlainObject(users, {});
  }

  addGroup(groupName) {
    const raw = String(groupName ?? "").trim();
    if (!raw) throw new Error("Group name cannot be empty.");
    const data = this._getData();
    if (this._findGroupEntry(data.groups, raw)) {
      throw new Error(`Group '${raw}' already exists.`);
    }
    data.groups[raw] = { alias: raw.slice(0, 3).toLowerCase(), isDefault: false, inheritance: [], permissions: [], worlds: {} };
    this._saveData(data);
    return data.groups[raw];
  }

  removeGroup(groupName) {
    const data = this._getData();
    const found = this._findGroupEntry(data.groups, groupName);
    if (!found) throw new Error(`Group '${groupName}' not found.`);
    if (found.value.isDefault) throw new Error("Cannot remove default group.");
    const superadmin = new Set((data.config?.superadminRanks ?? []).map(normalizeName));
    if (superadmin.has(normalizeName(found.key))) throw new Error("Cannot remove a configured superadmin rank.");
    delete data.groups[found.key];

    for (const g of Object.values(data.groups)) {
      if (!Array.isArray(g.inheritance)) g.inheritance = [];
      g.inheritance = g.inheritance.filter((parent) => normalizeName(parent) !== normalizeName(found.key));
    }
    for (const user of Object.values(data.users)) {
      if (normalizeName(user.group) === normalizeName(found.key)) {
        user.group = this.getDefaultGroupName(data.groups);
      }
      if (user.worlds && typeof user.worlds === "object") {
        for (const worldEntry of Object.values(user.worlds)) {
          if (normalizeName(worldEntry.group) === normalizeName(found.key)) {
            delete worldEntry.group;
          }
        }
      }
    }
    this._saveData(data);
  }

  addParent(targetGroup, parentGroup) {
    const data = this._getData();
    const target = this._findGroupEntry(data.groups, targetGroup);
    const parent = this._findGroupEntry(data.groups, parentGroup);
    if (!target) throw new Error(`Target group '${targetGroup}' not found.`);
    if (!parent) throw new Error(`Parent group '${parentGroup}' not found.`);
    if (normalizeName(target.key) === normalizeName(parent.key)) throw new Error("A group cannot inherit itself.");
    if (!Array.isArray(target.value.inheritance)) target.value.inheritance = [];
    if (target.value.inheritance.some((g) => normalizeName(g) === normalizeName(parent.key))) {
      throw new Error(`'${target.key}' already inherits '${parent.key}'.`);
    }
    if (this._wouldCreateCycle(data.groups, target.key, parent.key)) {
      throw new Error("This inheritance would create a cycle.");
    }
    target.value.inheritance.push(parent.key);
    this._saveData(data);
  }

  removeParent(targetGroup, parentGroup) {
    const data = this._getData();
    const target = this._findGroupEntry(data.groups, targetGroup);
    if (!target) throw new Error(`Target group '${targetGroup}' not found.`);
    const before = (target.value.inheritance ?? []).length;
    target.value.inheritance = (target.value.inheritance ?? []).filter((g) => normalizeName(g) !== normalizeName(parentGroup));
    if (before === target.value.inheritance.length) {
      throw new Error(`'${targetGroup}' does not inherit '${parentGroup}'.`);
    }
    this._saveData(data);
  }

  setDefaultGroup(groupName, worldName = null) {
    const data = this._getData();
    const found = this._findGroupEntry(data.groups, groupName);
    if (!found) throw new Error(`Group '${groupName}' not found.`);

    const worldKey = normalizeWorld(worldName);
    if (!worldKey) {
      for (const group of Object.values(data.groups)) group.isDefault = false;
      found.value.isDefault = true;
    } else {
      if (!found.value.worlds) found.value.worlds = {};
      found.value.worlds[worldKey] = found.value.worlds[worldKey] ?? { permissions: [], isDefault: false };
      for (const group of Object.values(data.groups)) {
        if (!group.worlds) continue;
        for (const w of Object.keys(group.worlds)) group.worlds[w].isDefault = false;
      }
      found.value.worlds[worldKey].isDefault = true;
    }
    this._saveData(data);
  }

  getDefaultGroupName(groups = null) {
    const source = groups ?? this.getGroups();
    const entry = Object.entries(source).find(([, value]) => value?.isDefault);
    return entry ? entry[0] : "Guest";
  }

  setGroupPermission(groupName, permission, worldName = null, enabled = true) {
    const data = this._getData();
    const found = this._findGroupEntry(data.groups, groupName);
    if (!found) throw new Error(`Group '${groupName}' not found.`);
    this._setPermissionArray(found.value, permission, worldName, enabled);
    this._saveData(data);
  }

  setUserPermission(playerName, permission, worldName = null, enabled = true) {
    const data = this._getData();
    const user = this._ensureUser(data.users, playerName, data.groups);
    this._setPermissionArray(user, permission, worldName, enabled);
    this._saveData(data);
  }

  setUserGroup(playerName, groupName, worldName = null, changedByConsole = false, actor = null) {
    const data = this._getData();
    const found = this._findGroupEntry(data.groups, groupName);
    if (!found) throw new Error(`Group '${groupName}' not found.`);
    const user = this._ensureUser(data.users, playerName, data.groups);
    const rankName = normalizeName(found.key);
    const superadmin = new Set((data.config?.superadminRanks ?? []).map(normalizeName));
    const currentIsSuperadmin = superadmin.has(normalizeName(user.group));
    const isNativeOpActor = this._isBedrockOperator(actor);
    if (!changedByConsole && !isNativeOpActor && (superadmin.has(rankName) || currentIsSuperadmin)) {
      throw new Error("Superadmin ranks can only be changed from console.");
    }
    const worldKey = normalizeWorld(worldName);
    if (!worldKey) {
      user.group = found.key;
    } else {
      if (!user.worlds) user.worlds = {};
      if (!user.worlds[worldKey]) user.worlds[worldKey] = { permissions: [] };
      user.worlds[worldKey].group = found.key;
    }
    this._saveData(data);
  }

  syncNativeOperatorGroup(playerActor) {
    if (!playerActor || typeof playerActor !== "object") return false;
    if (!this._isBedrockOperator(playerActor)) return false;
    const data = this._getData();
    const opGroup = this._findGroupEntry(data.groups, "OP");
    if (!opGroup) return false;
    const user = this._ensureUser(data.users, playerActor.name, data.groups);
    if (normalizeName(user.group) === normalizeName(opGroup.key)) return false;
    user.group = opGroup.key;
    this._saveData(data);
    return true;
  }

  getGroupInfo(groupName, worldName = null) {
    const groups = this.getGroups();
    const found = this._findGroupEntry(groups, groupName);
    if (!found) throw new Error(`Group '${groupName}' not found.`);
    const worldKey = normalizeWorld(worldName);
    const worldData = worldKey ? found.value.worlds?.[worldKey] ?? null : null;
    return { name: found.key, ...clone(found.value), worldData: clone(worldData) };
  }

  getUserInfo(playerName, worldName = null) {
    const data = this._getData();
    const user = this._ensureUser(data.users, playerName, data.groups);
    const worldKey = normalizeWorld(worldName);
    const worldData = worldKey ? user.worlds?.[worldKey] ?? null : null;
    const groupName = worldData?.group ?? user.group ?? this.getDefaultGroupName(data.groups);
    return { name: playerName, ...clone(user), effectiveGroup: groupName, worldData: clone(worldData) };
  }

  listGroupPermissions(groupName, page = 1, worldName = null) {
    const info = this.getGroupInfo(groupName, worldName);
    const perms = this._resolveGroupPermissions(info.name, normalizeWorld(worldName), this.getGroups());
    return this._paginate(perms, page, 8);
  }

  listUserPermissions(playerName, page = 1, worldName = null) {
    const worldKey = normalizeWorld(worldName);
    const perms = this.resolvePermissions(playerName, worldKey);
    return this._paginate(perms, page, 8);
  }

  resolvePermissions(playerName, worldName = null) {
    const worldKey = normalizeWorld(worldName);
    const cacheKey = `${normalizeName(playerName)}::${worldKey ?? "global"}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const data = this._getData();
    const user = this._ensureUser(data.users, playerName, data.groups);
    const groupName = user.worlds?.[worldKey]?.group ?? user.group ?? this.getDefaultGroupName(data.groups);
    const groupPerms = this._resolveGroupPermissions(groupName, worldKey, data.groups);
    const userPerms = this._collectPermissionSet(user.permissions ?? [], user.worlds?.[worldKey]?.permissions ?? []);
    const merged = this._mergePermissionSets(groupPerms, userPerms);
    this.cache.set(cacheKey, merged);
    return merged;
  }

  hasPermission(playerName, permissionNode, worldName = null, playerActor = null) {
    const config = this.getConfig();
    if (!config.disableOp && this._isBedrockOperator(playerActor)) {
      return true;
    }
    const node = normalizeName(permissionNode);
    const set = this.resolvePermissions(playerName, worldName);
    if (set.denied.has("*") || set.denied.has(node)) return false;
    if (set.allowed.has("*") || set.allowed.has(node)) return true;
    return false;
  }

  findPermissionsByPrefix(prefix = "") {
    const needle = normalizeName(prefix);
    const data = this._getData();
    const all = new Set();
    const add = (perm) => {
      if (typeof perm !== "string" || !perm.trim()) return;
      const clean = perm.trim().startsWith("-") ? perm.trim().slice(1) : perm.trim();
      if (!needle || normalizeName(clean).startsWith(needle)) all.add(clean);
    };

    for (const group of Object.values(data.groups)) {
      for (const p of group.permissions ?? []) add(p);
      for (const worldData of Object.values(group.worlds ?? {})) {
        for (const p of worldData.permissions ?? []) add(p);
      }
    }
    for (const user of Object.values(data.users)) {
      for (const p of user.permissions ?? []) add(p);
      for (const worldData of Object.values(user.worlds ?? {})) {
        for (const p of worldData.permissions ?? []) add(p);
      }
    }
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }

  updateNoeulAccount(playerName, mode, password) {
    const data = this._getData();
    const user = this._ensureUser(data.users, playerName, data.groups);
    if (!user.noeul) user.noeul = { registered: false, password: "" };
    if (mode === "register") {
      if (user.noeul.registered) throw new Error("Noeul account already registered.");
      if (String(password ?? "").length < (data.config?.noeulMinimumPwLength ?? 6)) {
        throw new Error(`Password must be at least ${data.config?.noeulMinimumPwLength ?? 6} characters.`);
      }
      user.noeul = { registered: true, password: String(password) };
    } else if (mode === "login") {
      if (!user.noeul.registered) throw new Error("Noeul account is not registered.");
      if (user.noeul.password !== String(password ?? "")) throw new Error("Invalid Noeul password.");
      user.noeul.lastLogin = Date.now();
    } else {
      throw new Error("Mode must be login or register.");
    }
    this._saveData(data);
  }

  clearCache() {
    this.cache.clear();
  }

  _getData() {
    const raw = PMMPCore.db.get(`plugin:${PLUGIN_NAME}`);
    const safe = asPlainObject(raw, {});
    safe.meta = asPlainObject(safe.meta, {});
    safe.config = asPlainObject(safe.config, {});
    safe.groups = asPlainObject(safe.groups, {});
    safe.users = asPlainObject(safe.users, {});
    return safe;
  }

  _saveData(data) {
    // Persist full payload to avoid merge issues with malformed legacy values.
    PMMPCore.db.set(`plugin:${PLUGIN_NAME}`, data);
    this.clearCache();
  }

  _hasDefaultGroup(groups) {
    return Object.values(groups).some((g) => g?.isDefault);
  }

  _ensureDefaultGroups(data) {
    let changed = false;
    if (Object.keys(data.groups).length === 0) {
      data.groups = clone(DEFAULT_GROUPS);
      changed = true;
    }
    for (const [groupName, groupData] of Object.entries(DEFAULT_GROUPS)) {
      if (!this._findGroupEntry(data.groups, groupName)) {
        data.groups[groupName] = clone(groupData);
        changed = true;
      }
    }
    if (!this._hasDefaultGroup(data.groups)) {
      data.groups.Guest = data.groups.Guest ?? clone(DEFAULT_GROUPS.Guest);
      data.groups.Guest.isDefault = true;
      changed = true;
    }
    return changed;
  }

  _findGroupEntry(groups, groupName) {
    const key = Object.keys(groups ?? {}).find((k) => normalizeName(k) === normalizeName(groupName));
    return key ? { key, value: groups[key] } : null;
  }

  _ensureUser(users, playerName, groups) {
    const raw = String(playerName ?? "").trim();
    if (!raw) throw new Error("Player name cannot be empty.");
    const key = Object.keys(users).find((k) => normalizeName(k) === normalizeName(raw)) ?? raw;
    if (!users[key]) {
      users[key] = { group: this.getDefaultGroupName(groups), permissions: [], worlds: {} };
    }
    if (!users[key].group) users[key].group = this.getDefaultGroupName(groups);
    if (!Array.isArray(users[key].permissions)) users[key].permissions = [];
    if (!users[key].worlds || typeof users[key].worlds !== "object") users[key].worlds = {};
    return users[key];
  }

  _setPermissionArray(entity, permission, worldName, enabled) {
    const raw = String(permission ?? "").trim();
    if (!raw) throw new Error("Permission cannot be empty.");
    const positive = raw.startsWith("-") ? raw.slice(1) : raw;
    const normalizedPos = normalizeName(positive);
    const encoded = enabled ? positive : `-${positive}`;
    const worldKey = normalizeWorld(worldName);

    const target = !worldKey
      ? entity
      : (() => {
          if (!entity.worlds) entity.worlds = {};
          if (!entity.worlds[worldKey]) entity.worlds[worldKey] = { permissions: [] };
          return entity.worlds[worldKey];
        })();
    if (!Array.isArray(target.permissions)) target.permissions = [];
    target.permissions = target.permissions.filter((p) => normalizeName(String(p).replace(/^-/, "")) !== normalizedPos);
    target.permissions.push(encoded);
  }

  _resolveGroupPermissions(groupName, worldName, groups) {
    const visited = new Set();
    const stack = [groupName];
    let result = { allowed: new Set(), denied: new Set() };

    while (stack.length > 0) {
      const current = stack.shift();
      const entry = this._findGroupEntry(groups, current);
      if (!entry) continue;
      const key = normalizeName(entry.key);
      if (visited.has(key)) continue;
      visited.add(key);

      const local = this._collectPermissionSet(entry.value.permissions ?? [], entry.value.worlds?.[worldName]?.permissions ?? []);
      result = this._mergePermissionSets(result, local);

      for (const parent of entry.value.inheritance ?? []) stack.push(parent);
    }
    return result;
  }

  _collectPermissionSet(globalPerms = [], worldPerms = []) {
    const result = { allowed: new Set(), denied: new Set() };
    const add = (perm) => {
      if (typeof perm !== "string") return;
      const raw = perm.trim();
      if (!raw) return;
      if (raw.startsWith("-")) result.denied.add(normalizeName(raw.slice(1)));
      else result.allowed.add(normalizeName(raw));
    };
    for (const p of globalPerms) add(p);
    for (const p of worldPerms) add(p);
    return result;
  }

  _mergePermissionSets(base, extra) {
    const allowed = new Set(base.allowed);
    const denied = new Set(base.denied);
    for (const d of extra.denied) {
      denied.add(d);
      allowed.delete(d);
    }
    for (const a of extra.allowed) {
      if (!denied.has(a)) allowed.add(a);
    }
    return { allowed, denied };
  }

  _wouldCreateCycle(groups, targetGroup, parentGroup) {
    const targetNeedle = normalizeName(targetGroup);
    const queue = [parentGroup];
    const seen = new Set();
    while (queue.length > 0) {
      const current = queue.shift();
      const found = this._findGroupEntry(groups, current);
      if (!found) continue;
      const key = normalizeName(found.key);
      if (key === targetNeedle) return true;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const parent of found.value.inheritance ?? []) queue.push(parent);
    }
    return false;
  }

  _paginate(valuesSet, page, pageSize) {
    const values = Array.from(valuesSet.allowed)
      .sort((a, b) => a.localeCompare(b))
      .map((v) => v)
      .concat(Array.from(valuesSet.denied).sort((a, b) => a.localeCompare(b)).map((v) => `-${v}`));
    const totalPages = Math.max(1, Math.ceil(values.length / pageSize));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (safePage - 1) * pageSize;
    return { entries: values.slice(start, start + pageSize), page: safePage, totalPages, total: values.length };
  }

  _isBedrockOperator(playerActor) {
    if (!playerActor || typeof playerActor !== "object") return false;
    try {
      const level = playerActor.commandPermissionLevel;
      if (typeof level === "number") {
        return level >= 1;
      }
      if (typeof level === "string") {
        const normalized = level.toLowerCase();
        return normalized === "gamedirectors" || normalized === "admin" || normalized === "host" || normalized === "owner";
      }
    } catch (_) {}
    return false;
  }
}
