import { system } from "@minecraft/server";
import { PMMPCore } from "../../PMMPCore.js";
import { registerEconomyCommands } from "./commands.js";
import { ECONOMY_PLUGIN_NAME, ECONOMY_SCHEMA_VERSION } from "./config.js";
import { emitEconomyEvent } from "./events.js";
import { EconomyService } from "./service.js";

console.log("[EconomyAPI] Loading EconomyAPI plugin...");

PMMPCore.registerPlugin({
  name: ECONOMY_PLUGIN_NAME,
  version: "1.0.0",
  depend: ["PMMPCore", "PurePerms"],
  softdepend: ["PlaceholderAPI"],

  onEnable() {
    this.service = new EconomyService();
    this._intervals = [];
    PMMPCore.getMigrationService()?.register(ECONOMY_PLUGIN_NAME, ECONOMY_SCHEMA_VERSION, () => {
      const rel = PMMPCore.createRelationalEngine();
      rel.createTable("econ_accounts", {
        player: "text",
        wallet: "number",
        debt: "number",
        bank: "number",
        updatedAt: "int",
      });
      rel.createIndex("econ_accounts", "player");
      rel.createIndex("econ_accounts", "wallet");
      rel.createIndex("econ_accounts", "bank");
      rel.createTable("econ_transactions", {
        txId: "text",
        type: "text",
        from: "text",
        to: "text",
        amount: "number",
        createdAt: "int",
        meta: "json",
      });
      rel.createIndex("econ_transactions", "type");
      rel.createIndex("econ_transactions", "from");
      rel.createIndex("econ_transactions", "to");
      rel.createIndex("econ_transactions", "createdAt");
      PMMPCore.db.setPluginData(ECONOMY_PLUGIN_NAME, {
        meta: { schemaVersion: ECONOMY_SCHEMA_VERSION },
        config: this.service.getConfig(),
      });
    });

    // Register PlaceholderAPI expansion if available
    this._registerPlaceholderExpansion();

    this.runtime = {
      getMoney: (playerName) => this.service.getMoney(playerName),
      setMoney: (playerName, amount, actor = "system") => this.service.setMoney(playerName, amount, actor),
      addMoney: (playerName, amount, actor = "system") => this.service.addMoney(playerName, amount, actor),
      reduceMoney: (playerName, amount, actor = "system") => this.service.reduceMoney(playerName, amount, actor),
      payMoney: (from, to, amount, actor = "system") => this.service.payMoney(from, to, amount, actor),
      getDebt: (playerName) => this.service.getDebt(playerName),
      takeDebt: (playerName, amount, actor = "system") => this.service.takeDebt(playerName, amount, actor),
      returnDebt: (playerName, amount, actor = "system") => this.service.returnDebt(playerName, amount, actor),
      getBankMoney: (playerName) => this.service.getBankMoney(playerName),
      bankDeposit: (playerName, amount, actor = "system") => this.service.bankDeposit(playerName, amount, actor),
      bankWithdraw: (playerName, amount, actor = "system") => this.service.bankWithdraw(playerName, amount, actor),
      registerConsumer: (name) => this.service.registerConsumer(name),
      listConsumers: () => this.service.listConsumers(),
      getTopMoney: (page = 1) => this.service.getTopMoney(page),
      getStatus: (playerName) => this.service.getStatus(playerName),
      hasPermissionNode: (player, node) => {
        if (!player || !node) return true;
        const perms = PMMPCore.getPermissionService();
        if (!perms?.has) return true;
        return !!perms.has(player.name, node, player.dimension?.id ?? null, player);
      },
    };
  },

  onStartup(event) {
    registerEconomyCommands(event, this.service, this.runtime);
  },

  onWorldReady() {
    PMMPCore.getMigrationService()?.run(ECONOMY_PLUGIN_NAME);
    this.service.initialize();
    this.service.registerConsumer(ECONOMY_PLUGIN_NAME);
    this._startInterestJobs();
    PMMPCore.emit("economy.ready", emitEconomyEvent("economy.ready", { provider: ECONOMY_PLUGIN_NAME }));
    console.log("[EconomyAPI] Ready.");
  },

  onDisable() {
    for (const id of this._intervals) {
      try {
        system.clearRun(id);
      } catch (_) {}
    }
    this._intervals = [];
    PMMPCore.db.flush();
  },

  _registerPlaceholderExpansion() {
    try {
      const isEnabled = PMMPCore.getPluginState("PlaceholderAPI")?.enabled;
      const placeholderPlugin = isEnabled ? PMMPCore.getPlugin("PlaceholderAPI") : null;
      if (!placeholderPlugin?.runtime) {
        console.log("[EconomyAPI] PlaceholderAPI not available, skipping expansion registration");
        return;
      }

      placeholderPlugin.runtime.registerExpansion({
        identifier: "economy",
        version: "1.0.0",
        author: "PMMPCore Team",
        onPlaceholderRequest: (player, key) => {
          if (!player || !this.service) return null;
          const id = String(key ?? "").toLowerCase();
          const playerName = player.name;
          try {
            if (id === "money" || id === "balance" || id === "wallet") {
              const money = this.service.getMoney(playerName);
              return String(Math.round(money * 100) / 100);
            }
            if (id === "bank") {
              const bankMoney = this.service.getBankMoney(playerName);
              return String(Math.round(bankMoney * 100) / 100);
            }
            if (id === "debt") {
              const debt = this.service.getDebt(playerName);
              return String(Math.round(debt * 100) / 100);
            }
            if (id === "formatted") {
              const money = this.service.getMoney(playerName);
              return `$${Math.round(money * 100) / 100}`;
            }
            if (id === "formatted_commas") {
              const money = this.service.getMoney(playerName);
              const rounded = Math.round(money * 100) / 100;
              return `$${rounded.toLocaleString()}`;
            }
          } catch (error) {
            return "0";
          }
          return null;
        },
      });
      console.log("[EconomyAPI] Registered PlaceholderAPI expansion with placeholders: %economy_money%, %economy_wallet%, %economy_bank%, %economy_debt%, %economy_formatted%");
    } catch (error) {
      console.warn("[EconomyAPI] Failed to register PlaceholderAPI expansion:", error?.message ?? error);
    }
  },

  _startInterestJobs() {
    const cfg = this.service.getConfig();
    const debtTicks = Math.max(20, Number(cfg.timeForIncreaseDebt ?? 10) * 1200);
    const bankTicks = Math.max(20, Number(cfg.timeForIncreaseMoney ?? 10) * 1200);

    const debtInterval = system.runInterval(() => {
      try {
        const touched = this.service.applyDebtInterest();
        if (touched > 0) PMMPCore.db.flush();
      } catch (error) {
        console.warn(`[EconomyAPI] Debt interest error: ${error?.message ?? "unknown error"}`);
      }
    }, debtTicks);
    this._intervals.push(debtInterval);

    const bankInterval = system.runInterval(() => {
      try {
        const touched = this.service.applyBankInterest();
        if (touched > 0) PMMPCore.db.flush();
      } catch (error) {
        console.warn(`[EconomyAPI] Bank interest error: ${error?.message ?? "unknown error"}`);
      }
    }, bankTicks);
    this._intervals.push(bankInterval);
  },
});
