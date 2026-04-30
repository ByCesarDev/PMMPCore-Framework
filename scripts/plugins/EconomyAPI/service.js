import { world } from "@minecraft/server";
import { PMMPCore } from "../../PMMPCore.js";
import { ECONOMY_DEFAULTS, ECONOMY_PLUGIN_NAME } from "./config.js";
import { clone, normalizePlayerName, nowUnix, roundMoney } from "./state.js";

function asObject(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return value;
}

export class EconomyService {
  constructor() {
    this._rel = null;
    this._config = clone(ECONOMY_DEFAULTS);
  }

  initialize() {
    this._rel = PMMPCore.createRelationalEngine();
    this._ensureTables();
    this._config = this.getConfig();
    this._ensureOnlineAccounts();
  }

  getConfig() {
    const data = PMMPCore.db.getPluginData(ECONOMY_PLUGIN_NAME);
    const safe = asObject(data, {});
    safe.meta = asObject(safe.meta, {});
    safe.config = asObject(safe.config, {});
    safe.consumers = Array.isArray(safe.consumers) ? safe.consumers : [];
    safe.meta.schemaVersion = Number(safe.meta.schemaVersion ?? 1);
    safe.config = { ...clone(ECONOMY_DEFAULTS), ...safe.config };
    PMMPCore.db.setPluginData(ECONOMY_PLUGIN_NAME, safe);
    return safe.config;
  }

  reloadConfig() {
    this._config = this.getConfig();
    PMMPCore.emit("economy.config.reloaded", { plugin: ECONOMY_PLUGIN_NAME });
    return this._config;
  }

  registerConsumer(name) {
    const data = PMMPCore.db.getPluginData(ECONOMY_PLUGIN_NAME);
    const safe = asObject(data, {});
    safe.consumers = Array.isArray(safe.consumers) ? safe.consumers : [];
    const clean = String(name ?? "").trim();
    if (!clean) return false;
    if (!safe.consumers.includes(clean)) safe.consumers.push(clean);
    PMMPCore.db.setPluginData(ECONOMY_PLUGIN_NAME, safe);
    return true;
  }

  listConsumers() {
    const data = PMMPCore.db.getPluginData(ECONOMY_PLUGIN_NAME);
    return Array.isArray(data?.consumers) ? [...data.consumers] : [];
  }

  ensureAccount(playerName) {
    const id = normalizePlayerName(playerName);
    if (!id) throw new Error("Player name cannot be empty.");
    const existing = this._rel.getRow("econ_accounts", id);
    if (existing) return existing;
    const created = {
      player: id,
      wallet: roundMoney(this._config.defaultMoney),
      debt: roundMoney(this._config.defaultDebt),
      bank: roundMoney(this._config.defaultBankMoney),
      updatedAt: nowUnix(),
    };
    this._rel.upsert("econ_accounts", id, created);
    this._recordTransaction("account_create", null, id, 0, { reason: "auto-create" });
    PMMPCore.emit("economy.account.created", { player: id, defaults: created });
    return this._rel.getRow("econ_accounts", id);
  }

  getAccount(playerName) {
    return this.ensureAccount(playerName);
  }

  getMoney(playerName) {
    return Number(this.ensureAccount(playerName).wallet ?? 0);
  }

  getDebt(playerName) {
    return Number(this.ensureAccount(playerName).debt ?? 0);
  }

  getBankMoney(playerName) {
    return Number(this.ensureAccount(playerName).bank ?? 0);
  }

  setMoney(playerName, amount, actor = "system") {
    const value = this._validateAmount(amount, true);
    const account = this.ensureAccount(playerName);
    const old = Number(account.wallet ?? 0);
    account.wallet = value;
    account.updatedAt = nowUnix();
    this._rel.upsert("econ_accounts", normalizePlayerName(playerName), account);
    this._recordTransaction("wallet_set", actor, account.player, value, { old });
    PMMPCore.emit("economy.wallet.changed", { player: account.player, oldBalance: old, newBalance: value, delta: roundMoney(value - old), actor });
    return value;
  }

  addMoney(playerName, amount, actor = "system") {
    const inc = this._validateAmount(amount, false);
    const account = this.ensureAccount(playerName);
    const old = Number(account.wallet ?? 0);
    account.wallet = roundMoney(old + inc);
    account.updatedAt = nowUnix();
    this._rel.upsert("econ_accounts", normalizePlayerName(playerName), account);
    this._recordTransaction("wallet_add", actor, account.player, inc, { old, next: account.wallet });
    PMMPCore.emit("economy.wallet.changed", { player: account.player, oldBalance: old, newBalance: account.wallet, delta: inc, actor });
    return account.wallet;
  }

  reduceMoney(playerName, amount, actor = "system") {
    const dec = this._validateAmount(amount, false);
    const account = this.ensureAccount(playerName);
    const old = Number(account.wallet ?? 0);
    const next = roundMoney(old - dec);
    if (next < 0) throw new Error("Insufficient money.");
    account.wallet = next;
    account.updatedAt = nowUnix();
    this._rel.upsert("econ_accounts", normalizePlayerName(playerName), account);
    this._recordTransaction("wallet_reduce", actor, account.player, dec, { old, next });
    PMMPCore.emit("economy.wallet.changed", { player: account.player, oldBalance: old, newBalance: next, delta: roundMoney(-dec), actor });
    return next;
  }

  payMoney(fromPlayer, toPlayer, amount, actor = "system") {
    const from = normalizePlayerName(fromPlayer);
    const to = normalizePlayerName(toPlayer);
    if (!from || !to) throw new Error("Invalid player names.");
    if (from === to) throw new Error("Cannot pay yourself.");
    const value = this._validateAmount(amount, false);
    this.reduceMoney(from, value, actor);
    this.addMoney(to, value, actor);
    this._recordTransaction("wallet_pay", from, to, value, { actor });
    PMMPCore.emit("economy.transfer.completed", { from, to, amount: value, actor });
    return true;
  }

  takeDebt(playerName, amount, actor = "system") {
    const value = this._validateAmount(amount, false);
    if (value > Number(this._config.onceDebtLimit)) throw new Error(`Debt at once limit is ${this._config.onceDebtLimit}.`);
    const account = this.ensureAccount(playerName);
    const oldDebt = Number(account.debt ?? 0);
    const nextDebt = roundMoney(oldDebt + value);
    if (nextDebt > Number(this._config.debtLimit)) throw new Error(`Debt limit is ${this._config.debtLimit}.`);
    account.debt = nextDebt;
    account.wallet = roundMoney(Number(account.wallet ?? 0) + value);
    account.updatedAt = nowUnix();
    this._rel.upsert("econ_accounts", normalizePlayerName(playerName), account);
    this._recordTransaction("debt_take", actor, account.player, value, { oldDebt, nextDebt });
    PMMPCore.emit("economy.debt.changed", { player: account.player, oldDebt, newDebt: nextDebt, delta: value, actor });
    PMMPCore.emit("economy.wallet.changed", { player: account.player, oldBalance: roundMoney(Number(account.wallet) - value), newBalance: account.wallet, delta: value, actor });
    return nextDebt;
  }

  returnDebt(playerName, amount, actor = "system") {
    const value = this._validateAmount(amount, false);
    const account = this.ensureAccount(playerName);
    const oldDebt = Number(account.debt ?? 0);
    if (oldDebt <= 0) throw new Error("No debt to return.");
    const pay = Math.min(value, oldDebt);
    if (Number(account.wallet ?? 0) < pay) throw new Error("Insufficient wallet money.");
    account.debt = roundMoney(oldDebt - pay);
    account.wallet = roundMoney(Number(account.wallet ?? 0) - pay);
    account.updatedAt = nowUnix();
    this._rel.upsert("econ_accounts", normalizePlayerName(playerName), account);
    this._recordTransaction("debt_return", actor, account.player, pay, { oldDebt, newDebt: account.debt });
    PMMPCore.emit("economy.debt.changed", { player: account.player, oldDebt, newDebt: account.debt, delta: roundMoney(-pay), actor });
    return account.debt;
  }

  bankDeposit(playerName, amount, actor = "system") {
    const value = this._validateAmount(amount, false);
    const account = this.ensureAccount(playerName);
    if (Number(account.wallet ?? 0) < value) throw new Error("Insufficient wallet money.");
    const oldBank = Number(account.bank ?? 0);
    account.wallet = roundMoney(Number(account.wallet ?? 0) - value);
    account.bank = roundMoney(oldBank + value);
    account.updatedAt = nowUnix();
    this._rel.upsert("econ_accounts", normalizePlayerName(playerName), account);
    this._recordTransaction("bank_deposit", actor, account.player, value, { oldBank, newBank: account.bank });
    PMMPCore.emit("economy.bank.changed", { player: account.player, oldBank, newBank: account.bank, delta: value, actor });
    return account.bank;
  }

  bankWithdraw(playerName, amount, actor = "system") {
    const value = this._validateAmount(amount, false);
    const account = this.ensureAccount(playerName);
    const oldBank = Number(account.bank ?? 0);
    if (oldBank < value) throw new Error("Insufficient bank money.");
    account.bank = roundMoney(oldBank - value);
    account.wallet = roundMoney(Number(account.wallet ?? 0) + value);
    account.updatedAt = nowUnix();
    this._rel.upsert("econ_accounts", normalizePlayerName(playerName), account);
    this._recordTransaction("bank_withdraw", actor, account.player, value, { oldBank, newBank: account.bank });
    PMMPCore.emit("economy.bank.changed", { player: account.player, oldBank, newBank: account.bank, delta: roundMoney(-value), actor });
    return account.bank;
  }

  bankGive(playerName, amount, actor = "system") {
    const value = this._validateAmount(amount, false);
    const account = this.ensureAccount(playerName);
    const oldBank = Number(account.bank ?? 0);
    account.bank = roundMoney(oldBank + value);
    account.updatedAt = nowUnix();
    this._rel.upsert("econ_accounts", normalizePlayerName(playerName), account);
    this._recordTransaction("bank_give", actor, account.player, value, { oldBank, newBank: account.bank });
    PMMPCore.emit("economy.bank.changed", { player: account.player, oldBank, newBank: account.bank, delta: value, actor });
    return account.bank;
  }

  bankTake(playerName, amount, actor = "system") {
    const value = this._validateAmount(amount, false);
    const account = this.ensureAccount(playerName);
    const oldBank = Number(account.bank ?? 0);
    if (oldBank < value) throw new Error("Insufficient bank money.");
    account.bank = roundMoney(oldBank - value);
    account.updatedAt = nowUnix();
    this._rel.upsert("econ_accounts", normalizePlayerName(playerName), account);
    this._recordTransaction("bank_take", actor, account.player, value, { oldBank, newBank: account.bank });
    PMMPCore.emit("economy.bank.changed", { player: account.player, oldBank, newBank: account.bank, delta: roundMoney(-value), actor });
    return account.bank;
  }

  getTopMoney(page = 1) {
    const rows = this._rel.findAll("econ_accounts");
    const includeOp = !!this._config.addOpAtRank;
    const perms = PMMPCore.getPermissionService();
    const sorted = rows
      .filter((row) => row?.player)
      .filter((row) => {
        if (includeOp) return true;
        const info = perms?.getUserInfo?.(row.player, null);
        const group = String(info?.effectiveGroup ?? info?.group ?? "guest").toLowerCase();
        return group !== "op";
      })
      .sort((a, b) => Number(b.wallet ?? 0) - Number(a.wallet ?? 0));
    const pageSize = Math.max(1, Number(this._config.topPageSize ?? 5));
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (safePage - 1) * pageSize;
    return {
      page: safePage,
      totalPages,
      entries: sorted.slice(start, start + pageSize),
      total: sorted.length,
    };
  }

  getStatus(playerName) {
    const account = this.ensureAccount(playerName);
    return {
      player: account.player,
      wallet: Number(account.wallet ?? 0),
      debt: Number(account.debt ?? 0),
      bank: Number(account.bank ?? 0),
      netWorth: roundMoney(Number(account.wallet ?? 0) + Number(account.bank ?? 0) - Number(account.debt ?? 0)),
    };
  }

  moneysave() {
    return PMMPCore.db.flush();
  }

  moneyload() {
    PMMPCore.db.replayWalIfAny?.();
    return true;
  }

  applyDebtInterest() {
    const rate = Number(this._config.percentOfIncreaseDebt ?? 0);
    if (rate <= 0) return 0;
    let count = 0;
    for (const row of this._rel.findAll("econ_accounts")) {
      const debt = Number(row.debt ?? 0);
      if (debt <= 0) continue;
      const inc = roundMoney((debt * rate) / 100);
      if (inc <= 0) continue;
      row.debt = roundMoney(debt + inc);
      row.updatedAt = nowUnix();
      this._rel.upsert("econ_accounts", row.player, row);
      this._recordTransaction("debt_interest", "system", row.player, inc, { rate });
      PMMPCore.emit("economy.debt.changed", { player: row.player, oldDebt: debt, newDebt: row.debt, delta: inc, actor: "system" });
      count++;
    }
    return count;
  }

  applyBankInterest() {
    const rate = Number(this._config.bankIncreaseMoneyRate ?? 0);
    if (rate <= 0) return 0;
    let count = 0;
    for (const row of this._rel.findAll("econ_accounts")) {
      const bank = Number(row.bank ?? 0);
      if (bank <= 0) continue;
      const inc = roundMoney((bank * rate) / 100);
      if (inc <= 0) continue;
      row.bank = roundMoney(bank + inc);
      row.updatedAt = nowUnix();
      this._rel.upsert("econ_accounts", row.player, row);
      this._recordTransaction("bank_interest", "system", row.player, inc, { rate });
      PMMPCore.emit("economy.bank.changed", { player: row.player, oldBank: bank, newBank: row.bank, delta: inc, actor: "system" });
      count++;
    }
    return count;
  }

  _recordTransaction(type, from, to, amount, meta = {}) {
    const txId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    this._rel.upsert("econ_transactions", txId, {
      txId,
      type,
      from: from ?? "",
      to: to ?? "",
      amount: roundMoney(amount),
      createdAt: nowUnix(),
      meta: clone(meta),
    });
  }

  _ensureTables() {
    this._rel.createTable("econ_accounts", {
      player: "text",
      wallet: "number",
      debt: "number",
      bank: "number",
      updatedAt: "int",
    });
    this._rel.createIndex("econ_accounts", "player");
    this._rel.createIndex("econ_accounts", "wallet");
    this._rel.createIndex("econ_accounts", "bank");

    this._rel.createTable("econ_transactions", {
      txId: "text",
      type: "text",
      from: "text",
      to: "text",
      amount: "number",
      createdAt: "int",
      meta: "json",
    });
    this._rel.createIndex("econ_transactions", "type");
    this._rel.createIndex("econ_transactions", "from");
    this._rel.createIndex("econ_transactions", "to");
    this._rel.createIndex("econ_transactions", "createdAt");
  }

  _ensureOnlineAccounts() {
    for (const player of world.getAllPlayers()) {
      this.ensureAccount(player.name);
    }
    PMMPCore.db.flush();
  }

  _validateAmount(value, allowZero) {
    const n = Number(value);
    if (!Number.isFinite(n) || Number.isNaN(n)) throw new Error("Amount must be a number.");
    if (n < 0) throw new Error("Amount cannot be negative.");
    if (!allowZero && n <= 0) throw new Error("Amount must be greater than zero.");
    return roundMoney(n);
  }
}
