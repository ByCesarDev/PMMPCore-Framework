import { world, system } from "@minecraft/server";
import { PMMPCore } from "../../PMMPCore.js";
import { ESSENTIALSTP_DEFAULTS, ESSENTIALSTP_PLUGIN_NAME } from "./config.js";
import { clone, normalizeKey, normalizePlayerName, nowUnix, randomId, toSafeNumber } from "./state.js";

function asObject(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return value;
}

function locFromPlayer(player) {
  return {
    x: Math.floor(player.location.x),
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z),
    yaw: toSafeNumber(player.getRotation?.().y, 0),
    pitch: toSafeNumber(player.getRotation?.().x, 0),
    dimensionId: player.dimension?.id ?? "minecraft:overworld",
  };
}

export class EssentialsTPService {
  constructor() {
    this._rel = null;
    this._config = clone(ESSENTIALSTP_DEFAULTS);
  }

  initialize() {
    this._rel = PMMPCore.createRelationalEngine();
    this._ensureTables();
    this._config = this.getConfig();
    this.cleanupExpiredRequests();
  }

  getConfig() {
    const data = PMMPCore.db.getPluginData(ESSENTIALSTP_PLUGIN_NAME);
    const safe = asObject(data, {});
    safe.meta = asObject(safe.meta, {});
    safe.config = asObject(safe.config, {});
    safe.meta.schemaVersion = Number(safe.meta.schemaVersion ?? 1);
    safe.config = {
      ...clone(ESSENTIALSTP_DEFAULTS),
      ...safe.config,
      limits: { ...ESSENTIALSTP_DEFAULTS.limits, ...asObject(safe.config?.limits, {}) },
      requests: { ...ESSENTIALSTP_DEFAULTS.requests, ...asObject(safe.config?.requests, {}) },
      cooldowns: { ...ESSENTIALSTP_DEFAULTS.cooldowns, ...asObject(safe.config?.cooldowns, {}) },
      wild: { ...ESSENTIALSTP_DEFAULTS.wild, ...asObject(safe.config?.wild, {}) },
      costs: { ...ESSENTIALSTP_DEFAULTS.costs, ...asObject(safe.config?.costs, {}) },
      messaging: { ...ESSENTIALSTP_DEFAULTS.messaging, ...asObject(safe.config?.messaging, {}) },
    };
    PMMPCore.db.setPluginData(ESSENTIALSTP_PLUGIN_NAME, safe);
    return safe.config;
  }

  getPrefix() {
    return this._config.messaging?.prefix ?? "§b[EssentialsTP]§r";
  }

  getPlayerHomeCount(playerName) {
    const owner = normalizePlayerName(playerName);
    if (!owner) return 0;
    return this._rel.find("ess_tp_homes", { owner }).length;
  }

  getHome(playerName, name = "home") {
    const owner = normalizePlayerName(playerName);
    const homeName = normalizeKey(name);
    const row = this._rel.getRow("ess_tp_homes", `${owner}:${homeName}`);
    return row ?? null;
  }

  setHome(player, name = "home") {
    const owner = normalizePlayerName(player.name);
    const homeName = normalizeKey(name);
    if (!homeName) throw new Error("Home name cannot be empty.");
    if (homeName.length > Number(this._config.limits.maxHomeNameLength ?? 24)) {
      throw new Error(`Home name max length is ${this._config.limits.maxHomeNameLength}.`);
    }
    const existing = this.getHome(player.name, homeName);
    if (!existing && this.getPlayerHomeCount(owner) >= Number(this._config.limits.maxHomesPerPlayer ?? 5)) {
      throw new Error(`Home limit reached (${this._config.limits.maxHomesPerPlayer}).`);
    }

    const pos = locFromPlayer(player);
    const now = nowUnix();
    this._rel.upsert("ess_tp_homes", `${owner}:${homeName}`, {
      owner,
      name: homeName,
      dimensionId: pos.dimensionId,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw: pos.yaw,
      pitch: pos.pitch,
      createdAt: Number(existing?.createdAt ?? now),
      updatedAt: now,
    });
    PMMPCore.emit("essentialstp.home.set", { owner, home: homeName });
    return this.getHome(owner, homeName);
  }

  deleteHome(playerName, name = "home") {
    const owner = normalizePlayerName(playerName);
    const homeName = normalizeKey(name);
    const ok = this._rel.deleteRow("ess_tp_homes", `${owner}:${homeName}`);
    if (ok) PMMPCore.emit("essentialstp.home.deleted", { owner, home: homeName });
    return ok;
  }

  listHomes(playerName) {
    const owner = normalizePlayerName(playerName);
    return this._rel.find("ess_tp_homes", { owner }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  setWarp(player, name) {
    const warpName = normalizeKey(name);
    if (!warpName) throw new Error("Warp name cannot be empty.");
    if (warpName.length > Number(this._config.limits.maxWarpNameLength ?? 24)) {
      throw new Error(`Warp name max length is ${this._config.limits.maxWarpNameLength}.`);
    }
    const pos = locFromPlayer(player);
    this._rel.upsert("ess_tp_warps", warpName, {
      name: warpName,
      dimensionId: pos.dimensionId,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw: pos.yaw,
      pitch: pos.pitch,
      createdBy: normalizePlayerName(player.name),
      updatedAt: nowUnix(),
    });
    return this._rel.getRow("ess_tp_warps", warpName);
  }

  getWarp(name) {
    return this._rel.getRow("ess_tp_warps", normalizeKey(name));
  }

  deleteWarp(name) {
    return this._rel.deleteRow("ess_tp_warps", normalizeKey(name));
  }

  listWarps() {
    return this._rel.findAll("ess_tp_warps").sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  setSpawn(player) {
    const pos = locFromPlayer(player);
    this._rel.upsert("ess_tp_spawns", pos.dimensionId, {
      dimensionId: pos.dimensionId,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw: pos.yaw,
      pitch: pos.pitch,
      updatedAt: nowUnix(),
      updatedBy: normalizePlayerName(player.name),
    });
    return this._rel.getRow("ess_tp_spawns", pos.dimensionId);
  }

  getSpawn(dimensionId = "minecraft:overworld") {
    return this._rel.getRow("ess_tp_spawns", dimensionId);
  }

  createRequest(fromPlayer, toPlayer, type = "tpa") {
    const requester = normalizePlayerName(fromPlayer.name);
    const target = normalizePlayerName(toPlayer.name);
    if (!requester || !target) throw new Error("Invalid players.");
    if (requester === target) throw new Error("Cannot request teleport to yourself.");

    this.cleanupExpiredRequests();

    const cooldownKey = type === "tpahere" ? "tpahere" : "tpa";
    this.checkCooldown(fromPlayer.name, cooldownKey);
    this.consumeCooldown(fromPlayer.name, cooldownKey);

    const createdAt = nowUnix();
    const expiresAt = createdAt + Number(this._config.requests.timeoutSeconds ?? 30);
    const id = randomId("tpr");
    const row = {
      id,
      requester,
      target,
      type: type === "tpahere" ? "tpahere" : "tpa",
      createdAt,
      expiresAt,
      status: "pending",
      updatedAt: createdAt,
    };
    this._rel.upsert("ess_tp_requests", id, row);
    PMMPCore.emit("essentialstp.request.created", row);
    return row;
  }

  listPendingRequestsForTarget(targetPlayerName) {
    const target = normalizePlayerName(targetPlayerName);
    if (!target) return [];
    const rows = this._rel.findComposite("ess_tp_requests", ["target", "status"], [target, "pending"]);
    const now = nowUnix();
    return rows
      .filter((row) => Number(row.expiresAt ?? 0) > now)
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
  }

  cancelRequest(requesterName, targetName = null) {
    const requester = normalizePlayerName(requesterName);
    if (!requester) return false;
    const rows = this._rel.findComposite("ess_tp_requests", ["requester", "status"], [requester, "pending"]);
    const now = nowUnix();
    const pick = rows
      .filter((row) => Number(row.expiresAt ?? 0) > now)
      .filter((row) => (targetName ? normalizePlayerName(row.target) === normalizePlayerName(targetName) : true))
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))[0];
    if (!pick) return false;
    pick.status = "cancelled";
    pick.updatedAt = now;
    this._rel.upsert("ess_tp_requests", pick.id, pick);
    return true;
  }

  denyRequest(targetPlayerName, requesterName = null) {
    const target = normalizePlayerName(targetPlayerName);
    if (!target) return null;
    const pending = this.listPendingRequestsForTarget(target);
    const pick = pending.find((row) =>
      requesterName ? normalizePlayerName(row.requester) === normalizePlayerName(requesterName) : true
    );
    if (!pick) return null;
    pick.status = "denied";
    pick.updatedAt = nowUnix();
    this._rel.upsert("ess_tp_requests", pick.id, pick);
    PMMPCore.emit("essentialstp.request.denied", pick);
    return pick;
  }

  acceptRequest(targetPlayer, requesterName = null) {
    const pending = this.listPendingRequestsForTarget(targetPlayer.name);
    const pick = pending.find((row) =>
      requesterName ? normalizePlayerName(row.requester) === normalizePlayerName(requesterName) : true
    );
    if (!pick) return { ok: false, reason: "No pending request." };

    const requester = this.getOnlinePlayer(pick.requester);
    if (!requester) {
      pick.status = "expired";
      pick.updatedAt = nowUnix();
      this._rel.upsert("ess_tp_requests", pick.id, pick);
      PMMPCore.emit("essentialstp.request.expired", pick);
      return { ok: false, reason: "Requester is offline." };
    }

    if (pick.type === "tpahere") {
      this.teleportPlayer(targetPlayer, locFromPlayer(requester), { cause: "tpahere.accept" });
    } else {
      this.teleportPlayer(requester, locFromPlayer(targetPlayer), { cause: "tpa.accept" });
    }

    pick.status = "accepted";
    pick.updatedAt = nowUnix();
    this._rel.upsert("ess_tp_requests", pick.id, pick);
    PMMPCore.emit("essentialstp.request.accepted", pick);
    return { ok: true, request: pick };
  }

  cleanupExpiredRequests() {
    const now = nowUnix();
    let touched = 0;
    for (const row of this._rel.find("ess_tp_requests", { status: "pending" })) {
      if (Number(row.expiresAt ?? 0) > now) continue;
      row.status = "expired";
      row.updatedAt = now;
      this._rel.upsert("ess_tp_requests", row.id, row);
      touched++;
      PMMPCore.emit("essentialstp.request.expired", row);
    }
    return touched;
  }

  recordBack(player, cause = "manual") {
    const playerData = PMMPCore.db.getPlayerData(player.name);
    playerData.essentialsTP = asObject(playerData.essentialsTP, {});
    playerData.essentialsTP.back = {
      ...locFromPlayer(player),
      updatedAt: nowUnix(),
      cause,
    };
    PMMPCore.db.setPlayerData(player.name, playerData);
    PMMPCore.emit("essentialstp.back.updated", {
      player: normalizePlayerName(player.name),
      cause,
    });
  }

  getBack(playerName) {
    const playerData = PMMPCore.db.getPlayerData(playerName);
    return playerData?.essentialsTP?.back ?? null;
  }

  teleportBack(player) {
    this.checkCooldown(player.name, "back");
    const back = this.getBack(player.name);
    if (!back) throw new Error("No back location available.");
    this.teleportPlayer(player, back, { cause: "back" });
    this.consumeCooldown(player.name, "back");
    return true;
  }

  teleportHome(player, homeName = "home") {
    this.checkCooldown(player.name, "home");
    this._chargeIfEnabled(player.name, "home");
    const home = this.getHome(player.name, homeName);
    if (!home) throw new Error(`Home '${homeName}' does not exist.`);
    this.teleportPlayer(player, home, { cause: "home" });
    this.consumeCooldown(player.name, "home");
    return home;
  }

  teleportWarp(player, warpName) {
    this.checkCooldown(player.name, "warp");
    this._chargeIfEnabled(player.name, "warp");
    const warp = this.getWarp(warpName);
    if (!warp) throw new Error(`Warp '${warpName}' does not exist.`);
    this.teleportPlayer(player, warp, { cause: "warp" });
    this.consumeCooldown(player.name, "warp");
    return warp;
  }

  teleportSpawn(player) {
    this.checkCooldown(player.name, "spawn");
    this._chargeIfEnabled(player.name, "spawn");
    const currentDimension = player.dimension?.id ?? "minecraft:overworld";
    const spawn = this.getSpawn(currentDimension) ?? this.getSpawn("minecraft:overworld");
    if (!spawn) throw new Error("No spawn has been configured.");
    this.teleportPlayer(player, spawn, { cause: "spawn" });
    this.consumeCooldown(player.name, "spawn");
    return spawn;
  }

  teleportWild(player) {
    this.checkCooldown(player.name, "wild");
    this._chargeIfEnabled(player.name, "wild");
    const dim = player.dimension;
    const maxX = Number(this._config.wild.maxX ?? 2000);
    const maxZ = Number(this._config.wild.maxZ ?? 2000);
    const minHr = Math.max(0, Number(this._config.wild.minHorizontalRadius ?? 0));
    const minY = Number(this._config.wild.minY ?? -64);
    const maxY = Number(this._config.wild.maxY ?? 319);
    const maxAttempts = Math.max(48, Math.max(1, Number(this._config.wild.maxAttempts ?? 64)));
    const originX = Math.floor(player.location.x);
    const originZ = Math.floor(player.location.z);

    for (let i = 0; i < maxAttempts; i++) {
      const { x, z } = this._wildRandomXZPolar(originX, originZ, maxX, maxZ, minHr);
      const hit = this._findSafeY(dim, x, z, minY, maxY);
      if (hit.ok) {
        this.teleportPlayer(player, { x, y: hit.y, z, dimensionId: dim.id }, { cause: "wild" });
        this.consumeCooldown(player.name, "wild");
        return {
          x,
          y: hit.y,
          z,
          dimensionId: dim.id,
          usedUnsafeFallback: false,
          usedLandingPad: false,
        };
      }
      this._wildDebug(`attempt ${i + 1}/${maxAttempts} (${x}, ${z}): ${hit.reason}`);

      const pad = this._wildMaterializeLandingSpot(dim, x, z, minY, maxY);
      if (pad) {
        this._wildDebug(`landingPad (${x},${pad.feetY},${z})`);
        this.teleportPlayer(player, { x, y: pad.feetY, z, dimensionId: dim.id }, { cause: "wild_prepared" });
        this.consumeCooldown(player.name, "wild");
        return {
          x,
          y: pad.feetY,
          z,
          dimensionId: dim.id,
          usedUnsafeFallback: false,
          usedLandingPad: true,
        };
      }
    }

    console.info(
      `[EssentialsTP][wild] safe search exhausted (${maxAttempts} tries near ${originX},${originZ}; polar max ±${maxX}/±${maxZ}${minHr ? ` minDist=${minHr}` : ""}). ` +
        `${this._config.wild?.debugLog ? "" : "Tip: wild.debugLog=true for each column reason. "}` +
        `${this._wildUnsafeFallbackEnabled() ? "Using fallback TP." : ""}`
    );

    if (this._wildUnsafeFallbackEnabled()) {
      const fb = this._wildUnsafeFallback(dim, player, maxX, maxZ, minY, maxY, minHr);
      console.info(
        `[EssentialsTP][wild] fallback TP (${fb.x}, ${fb.y}, ${fb.z})${fb.usedLandingPad ? " [pad]" : ""}`
      );
      this.teleportPlayer(player, { x: fb.x, y: fb.y, z: fb.z, dimensionId: dim.id }, { cause: fb.cause });
      this.consumeCooldown(player.name, "wild");
      return {
        x: fb.x,
        y: fb.y,
        z: fb.z,
        dimensionId: dim.id,
        usedUnsafeFallback: !fb.usedLandingPad,
        usedLandingPad: !!fb.usedLandingPad,
      };
    }

    throw new Error("Could not find a safe wild location.");
  }

  teleportPlayer(player, destination, { cause = "teleport" } = {}) {
    if (!player) throw new Error("Player is required.");
    const dimensionId = destination?.dimensionId ?? player.dimension?.id ?? "minecraft:overworld";
    try {
      world.getDimension(dimensionId);
    } catch (_) {
      throw new Error(`Destination dimension is unavailable: ${dimensionId}`);
    }
    const targetLoc = {
      x: toSafeNumber(destination?.x, player.location.x),
      y: toSafeNumber(destination?.y, player.location.y),
      z: toSafeNumber(destination?.z, player.location.z),
    };
    const rotation = {
      x: toSafeNumber(destination?.pitch, player.getRotation?.().x ?? 0),
      y: toSafeNumber(destination?.yaw, player.getRotation?.().y ?? 0),
    };
    this.recordBack(player, cause);
    const playerName = player.name;
    system.run(() => {
      const p = world.getAllPlayers().find((pl) => pl.name === playerName);
      if (!p) return;
      let dim;
      try {
        dim = world.getDimension(dimensionId);
      } catch (_) {
        PMMPCore.emit("essentialstp.teleport.failed", {
          player: normalizePlayerName(playerName),
          cause,
          reason: `dimension_unavailable:${dimensionId}`,
        });
        return;
      }
      try {
        p.teleport(targetLoc, { dimension: dim, rotation });
        PMMPCore.emit("essentialstp.teleport.performed", {
          player: normalizePlayerName(playerName),
          cause,
          destination: { ...targetLoc, dimensionId },
        });
      } catch (error) {
        console.warn(`[EssentialsTP] Teleport failed: ${error?.message ?? error}`);
        PMMPCore.emit("essentialstp.teleport.failed", {
          player: normalizePlayerName(playerName),
          cause,
          reason: error?.message ?? String(error),
        });
      }
    });
  }

  checkCooldown(playerName, key) {
    const now = nowUnix();
    const playerData = PMMPCore.db.getPlayerData(playerName);
    const map = asObject(playerData?.essentialsTP?.cooldowns, {});
    const field = normalizeKey(key);
    const prev = Number(map[field] ?? 0);
    const duration = Number(this._config.cooldowns[`${field}Seconds`] ?? 0);
    if (duration <= 0) return 0;
    const remaining = prev + duration - now;
    if (remaining > 0) {
      PMMPCore.emit("essentialstp.cooldown.blocked", {
        player: normalizePlayerName(playerName),
        key: field,
        remaining,
      });
      throw new Error(`Cooldown active for ${field}: ${remaining}s remaining.`);
    }
    return 0;
  }

  consumeCooldown(playerName, key) {
    const playerData = PMMPCore.db.getPlayerData(playerName);
    playerData.essentialsTP = asObject(playerData.essentialsTP, {});
    playerData.essentialsTP.cooldowns = asObject(playerData.essentialsTP.cooldowns, {});
    playerData.essentialsTP.cooldowns[normalizeKey(key)] = nowUnix();
    PMMPCore.db.setPlayerData(playerName, playerData);
  }

  getCooldownSnapshot(playerName) {
    const playerData = PMMPCore.db.getPlayerData(playerName);
    const map = asObject(playerData?.essentialsTP?.cooldowns, {});
    const now = nowUnix();
    const out = {};
    for (const [key, value] of Object.entries(map)) {
      const duration = Number(this._config.cooldowns[`${key}Seconds`] ?? 0);
      const remaining = Number(value ?? 0) + duration - now;
      out[key] = Math.max(0, remaining);
    }
    return out;
  }

  getOnlinePlayer(name) {
    const wanted = normalizePlayerName(name);
    return world.getAllPlayers().find((player) => normalizePlayerName(player.name) === wanted) ?? null;
  }

  _chargeIfEnabled(playerName, action) {
    const cfg = asObject(this._config.costs, {});
    if (!cfg.enabled) return true;
    const amount = Number(cfg[action] ?? 0);
    if (!(amount > 0)) return true;
    const economy = PMMPCore.getPlugin("EconomyAPI")?.runtime;
    if (!economy?.reduceMoney) return true;
    economy.reduceMoney(playerName, amount, ESSENTIALSTP_PLUGIN_NAME);
    return true;
  }

  _wildDebug(message) {
    if (!this._config.wild?.debugLog) return;
    console.warn(`[EssentialsTP][wild] ${message}`);
  }

  /**
   * Polar sample on ellipse |dx|≤maxX |dz|≤maxZ with sqrt(radius) for uniform disk (no cluster near player).
   * minR rejects samples closer than that horizontal distance (donut RTP).
   */
  _wildRandomXZPolar(originX, originZ, maxX, maxZ, minR) {
    const mx = Math.max(1, Math.abs(Number(maxX)));
    const mz = Math.max(1, Math.abs(Number(maxZ)));
    const mr = Math.max(0, Number(minR));
    const mrSq = mr * mr;
    const ox = Math.floor(originX);
    const oz = Math.floor(originZ);

    for (let attempt = 0; attempt < 20; attempt++) {
      const theta = Math.random() * Math.PI * 2;
      const sqrtU = Math.sqrt(Math.random());
      const dx = sqrtU * Math.cos(theta) * mx;
      const dz = sqrtU * Math.sin(theta) * mz;
      if (dx * dx + dz * dz >= mrSq) {
        return { x: ox + Math.floor(dx), z: oz + Math.floor(dz) };
      }
    }
    const theta = Math.random() * Math.PI * 2;
    const dx = Math.cos(theta) * mx;
    const dz = Math.sin(theta) * mz;
    return { x: ox + Math.floor(dx), z: oz + Math.floor(dz) };
  }

  _wildUnsafeFallbackEnabled() {
    return this._config.wild?.unsafeFallback !== false;
  }

  _wildLandingPadEnabled() {
    return this._config.wild?.prepareLandingPad !== false;
  }

  /** Stone under feet + 2 air blocks for body; try Script API then /setblock. */
  _wildPlaceLandingPadBlocks(dimension, x, z, floorY, feetY, hrMin, hrMax) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fy = Math.floor(floorY);
    const ft = Math.floor(feetY);
    const headY = ft + 1;
    if (headY > hrMax || fy < hrMin) return false;
    try {
      dimension.setBlockType({ x: ix, y: fy, z: iz }, "minecraft:stone");
      dimension.setBlockType({ x: ix, y: ft, z: iz }, "minecraft:air");
      dimension.setBlockType({ x: ix, y: headY, z: iz }, "minecraft:air");
      return true;
    } catch (_) {
      try {
        dimension.runCommand(`setblock ${ix} ${fy} ${iz} stone`);
        dimension.runCommand(`setblock ${ix} ${ft} ${iz} air`);
        dimension.runCommand(`setblock ${ix} ${headY} ${iz} air`);
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  /** Pick feet Y (surface if API works), write tiny pad; helps distant columns load/generate. */
  _wildMaterializeLandingSpot(dimension, x, z, minY, maxY) {
    if (!this._wildLandingPadEnabled()) return null;
    const { searchMin, searchMax, hrMin, hrMax } = this._wildVerticalSearchBounds(dimension, minY, maxY);
    if (searchMax < searchMin) return null;

    let feetY = null;
    try {
      if (typeof dimension.getTopmostBlock === "function") {
        const top = dimension.getTopmostBlock({ x, z }, searchMin);
        if (top?.location) feetY = Math.floor(top.location.y) + 1;
      }
    } catch (_) {}

    if (feetY == null || !Number.isFinite(feetY)) {
      feetY = Math.floor((searchMin + 1 + Math.min(searchMax + 1, hrMax - 2)) / 2);
    }

    feetY = Math.max(hrMin + 2, Math.min(hrMax - 2, feetY));
    feetY = Math.max(searchMin + 1, Math.min(Math.min(searchMax + 1, hrMax - 1), feetY));

    const floorY = feetY - 1;
    if (floorY < hrMin) return null;

    const ok = this._wildPlaceLandingPadBlocks(dimension, x, z, floorY, feetY, hrMin, hrMax);
    return ok ? { feetY } : null;
  }

  /** Random XZ; landing pad first, else legacy Y guess. */
  _wildUnsafeFallback(dimension, player, maxX, maxZ, minY, maxY, minHr = 0) {
    const ox = Math.floor(player.location.x);
    const oz = Math.floor(player.location.z);
    const { x, z } = this._wildRandomXZPolar(ox, oz, maxX, maxZ, minHr);

    const pad = this._wildMaterializeLandingSpot(dimension, x, z, minY, maxY);
    if (pad) {
      return { x, y: pad.feetY, z, usedLandingPad: true, cause: "wild_prepared" };
    }

    const { hrMin, hrMax } = this._wildVerticalSearchBounds(dimension, minY, maxY);
    let y = Math.floor(player.location.y);
    try {
      if (typeof dimension.getTopmostBlock === "function") {
        const top = dimension.getTopmostBlock({ x, z });
        if (top?.location) {
          const ty = Math.floor(top.location.y) + 1;
          if (Number.isFinite(ty) && ty >= hrMin && ty <= hrMax) y = ty;
        }
      }
    } catch (_) {}
    y = Math.max(hrMin + 1, Math.min(hrMax - 1, y));
    return { x, y, z, usedLandingPad: false, cause: "wild_fallback" };
  }

  _wildVerticalSearchBounds(dimension, minY, maxY) {
    let hrMin = -64;
    let hrMax = 319;
    try {
      const hr = dimension.heightRange;
      if (hr && Number.isFinite(hr.min) && Number.isFinite(hr.max)) {
        hrMin = hr.min;
        hrMax = hr.max;
      }
    } catch (_) {}
    const searchMin = Math.max(minY, hrMin);
    // Floor at y probes block above at y+1; both must stay inside dimension bounds.
    const searchMax = Math.min(maxY, hrMax - 1);
    return { searchMin, searchMax, hrMin, hrMax };
  }

  _wildIsAirLike(typeId) {
    return String(typeId ?? "").includes("air");
  }

  _wildIsFluidFloor(typeId) {
    const id = String(typeId ?? "");
    return id.includes("water") || id.includes("lava");
  }

  /** Grass, flowers, snow_layer, etc. — passable for player body but not a floor by itself. */
  _wildIsReplaceableVegetation(typeId) {
    const id = String(typeId ?? "");
    if (id.includes("grass_block")) return false;
    const markers = [
      "short_grass",
      "tall_grass",
      "fern",
      "large_fern",
      "snow_layer",
      "sapling",
      "dead_bush",
      "vine",
      "carpet",
      "pressure_plate",
      "torch",
      "redstone_torch",
      "flower",
      "dandelion",
      "poppy",
      "cornflower",
      "lily_of_the_valley",
      "wither_rose",
      "sunflower",
      "lilac",
      "rose_bush",
      "peony",
      "flowering_azalea",
      "azalea_leaves",
      "moss_carpet",
      "spore_blossom",
      "hanging_roots",
      "small_dripleaf",
      "big_dripleaf",
      "seagrass",
      "glow_lichen",
      "sweet_berry_bush",
    ];
    return markers.some((m) => id.includes(m));
  }

  /** Space where the player body may stand (air-like + common Bedrock replaceable plants). */
  _wildIsPassableHeadspaceBlock(block) {
    if (!block) return false;
    try {
      if (block.isAir === true) return true;
    } catch (_) {}
    const id = String(block.typeId ?? "");
    if (this._wildIsFluidFloor(id)) return false;
    if (this._wildIsAirLike(id)) return true;
    if (this._wildIsReplaceableVegetation(id)) return true;
    if (id.includes("leaves")) return true;
    return false;
  }

  /** Block that can support the player (not fluid, not empty/replaceable filler only). */
  _wildIsWildFloorCandidate(block) {
    if (!block) return false;
    const id = String(block.typeId ?? "");
    if (this._wildIsFluidFloor(id)) return false;
    try {
      // Bedrock often reports isSolid=false for normal terrain; only treat true as definitive yes.
      if (block.isSolid === true) return true;
    } catch (_) {}
    if (this._wildIsAirLike(id)) return false;
    if (this._wildIsReplaceableVegetation(id)) return false;
    return true;
  }

  /**
   * @returns {{ ok: true, y: number } | { ok: false, reason: string }}
   */
  _findSafeY(dimension, x, z, minY, maxY) {
    const { searchMin, searchMax, hrMax } = this._wildVerticalSearchBounds(dimension, minY, maxY);
    if (searchMax < searchMin) {
      return { ok: false, reason: `invalid_vertical_bounds(searchMin=${searchMin},searchMax=${searchMax})` };
    }

    let note = "scan_not_run";

    try {
      if (typeof dimension.getTopmostBlock === "function") {
        const top = dimension.getTopmostBlock({ x, z });
        if (top?.location) {
          const tid = top.typeId ?? "?";
          if (!this._wildIsWildFloorCandidate(top)) {
            note = `top_not_floor(typeId=${tid})`;
          } else {
            const fy = Math.floor(top.location.y);
            if (fy < searchMin || fy > searchMax) {
              note = `top_y_out_of_range(fy=${fy},allowed=${searchMin}..${searchMax})`;
            } else {
              const feetY = fy + 1;
              if (feetY > hrMax) {
                note = `feet_above_dimension(feetY=${feetY},hrMax=${hrMax})`;
              } else {
                let atFeet;
                let aboveHead;
                try {
                  atFeet = dimension.getBlock({ x, y: feetY, z });
                  const headY = feetY + 1;
                  aboveHead = headY <= hrMax ? dimension.getBlock({ x, y: headY, z }) : null;
                } catch (err) {
                  note = `getBlock_threw(${err?.message ?? err})`;
                  atFeet = null;
                  aboveHead = null;
                }
                if (!atFeet) {
                  note = "feet_block_missing_or_chunk";
                } else {
                  const feetOk = this._wildIsPassableHeadspaceBlock(atFeet);
                  const headOk = !aboveHead || this._wildIsPassableHeadspaceBlock(aboveHead);
                  if (feetOk && headOk) {
                    return { ok: true, y: feetY };
                  }
                  note = `headspace_rejected(feet=${atFeet.typeId ?? "?"},head=${aboveHead?.typeId ?? "none"})`;
                }
              }
            }
          }
        } else {
          note = "topmost_missing_or_unloaded";
        }
      } else {
        note = "no_getTopmostBlock_api";
      }
    } catch (err) {
      note = `getTopmostBlock_threw(${err?.message ?? err})`;
    }

    for (let y = searchMax; y >= searchMin; y--) {
      let block;
      let up;
      try {
        block = dimension.getBlock({ x, y, z });
        up = dimension.getBlock({ x, y: y + 1, z });
      } catch (_) {
        continue;
      }
      if (!block || !up) continue;
      if (!this._wildIsWildFloorCandidate(block)) continue;
      if (!this._wildIsPassableHeadspaceBlock(up)) continue;
      return { ok: true, y: y + 1 };
    }

    return { ok: false, reason: `${note};column_scan_exhausted` };
  }

  _ensureTables() {
    this._rel.createTable("ess_tp_homes", {
      owner: "text",
      name: "text",
      dimensionId: "text",
      x: "number",
      y: "number",
      z: "number",
      yaw: "number",
      pitch: "number",
      createdAt: "int",
      updatedAt: "int",
    });
    this._rel.createIndex("ess_tp_homes", "owner");
    this._rel.createIndex("ess_tp_homes", "name");
    this._rel.createCompositeIndex("ess_tp_homes", ["owner", "name"]);

    this._rel.createTable("ess_tp_requests", {
      requester: "text",
      target: "text",
      type: "text",
      createdAt: "int",
      expiresAt: "int",
      status: "text",
      updatedAt: "int",
    });
    this._rel.createIndex("ess_tp_requests", "target");
    this._rel.createIndex("ess_tp_requests", "requester");
    this._rel.createIndex("ess_tp_requests", "status");
    this._rel.createIndex("ess_tp_requests", "expiresAt");
    this._rel.createCompositeIndex("ess_tp_requests", ["target", "status"]);
    this._rel.createCompositeIndex("ess_tp_requests", ["requester", "status"]);

    this._rel.createTable("ess_tp_warps", {
      name: "text",
      dimensionId: "text",
      x: "number",
      y: "number",
      z: "number",
      yaw: "number",
      pitch: "number",
      createdBy: "text",
      updatedAt: "int",
    });
    this._rel.createIndex("ess_tp_warps", "name");

    this._rel.createTable("ess_tp_spawns", {
      dimensionId: "text",
      x: "number",
      y: "number",
      z: "number",
      yaw: "number",
      pitch: "number",
      updatedAt: "int",
      updatedBy: "text",
    });
    this._rel.createIndex("ess_tp_spawns", "dimensionId");
  }
}
