import { PMMPCore, Color } from "../../PMMPCore.js";
import {
  world,
  system,
  Player,
  CustomCommandStatus,
  CommandPermissionLevel,
  CustomCommandParamType,
} from "@minecraft/server";

console.log("[EconomyAPI] Loading EconomyAPI plugin...");

PMMPCore.registerPlugin({
  name: "EconomyAPI",
  version: "1.0.0",
  depend: ["PMMPCore"],

  onEnable() {
    console.log("[EconomyAPI] Starting economy system...");

    this.defaultBalance = 1000;
    this.currencySymbol = "$";
    this.databaseInitialized = false;

    console.log("[EconomyAPI] Economy system enabled!");
  },

  onDisable() {
    console.log("[EconomyAPI] Economy system disabled");
  },

  getHelp() {
    return [
      `${Color.aqua}EconomyAPI Commands:${Color.reset}`,
      `${Color.white}/economy:balance ${Color.gray}- Check your account balance`,
      `${Color.white}/economy:pay <player> <amount> ${Color.gray}- Send money to another player`,
      `${Color.white}/economy:eco <give|take|set> <player> <amount> ${Color.gray}- Admin commands (OP only)}`,
      "",
      `${Color.yellow}Examples:${Color.reset}`,
      `${Color.gray}/economy:balance ${Color.white}- Shows your current balance`,
      `${Color.gray}/economy:pay Steve 500 ${Color.white}- Send $500 to Steve`,
      `${Color.gray}/economy:eco give Alex 1000 ${Color.white}- Give Alex $1000 (Admin)`,
      `${Color.gray}/economy:eco set Bob 0 ${Color.white}- Set Bob's balance to $0 (Admin)`,
    ];
  },

  initializeDatabase() {
    PMMPCore.db.setPluginData("EconomyAPI", {
      defaultBalance: this.defaultBalance,
      currencySymbol: this.currencySymbol,
      totalMoney: 0,
      accounts: {},
    });
  },

  getBalance(playerName) {
    const playerData = PMMPCore.db.getPlayerData(playerName);
    return playerData.economy?.balance || this.defaultBalance;
  },

  setBalance(playerName, amount) {
    const playerData = PMMPCore.db.getPlayerData(playerName);
    if (!playerData.economy) {
      playerData.economy = {};
    }

    const oldBalance = playerData.economy.balance || this.defaultBalance;
    playerData.economy.balance = Math.max(0, amount);

    PMMPCore.db.setPlayerData(playerName, playerData);

    const pluginData = PMMPCore.db.getPluginData("EconomyAPI");
    pluginData.totalMoney = (pluginData.totalMoney || 0) - oldBalance + amount;
    PMMPCore.db.setPluginData("EconomyAPI", { totalMoney: pluginData.totalMoney });

    return playerData.economy.balance;
  },

  addMoney(playerName, amount) {
    const currentBalance = this.getBalance(playerName);
    return this.setBalance(playerName, currentBalance + amount);
  },

  removeMoney(playerName, amount) {
    const currentBalance = this.getBalance(playerName);
    return this.setBalance(playerName, currentBalance - amount);
  },

  formatMoney(amount) {
    return `${this.currencySymbol}${amount.toLocaleString()}`;
  },

  onStartup(event) {
    console.log("[EconomyAPI] Startup hook - registering commands and scheduling DB init...");
    this.setupCommands(event);

    world.afterEvents.worldLoad.subscribe(() => {
      if (this.databaseInitialized) return;
      system.run(() => {
        this.initializeDatabase();
        this.databaseInitialized = true;
        console.log("[EconomyAPI] Database initialized after world load.");
      });
    });
  },

  setupCommands(event) {
    event.customCommandRegistry.registerEnum("pmmpcore:money_action", ["give", "take", "set"]);

    event.customCommandRegistry.registerCommand(
      {
        name: "pmmpcore:balance",
        description: "Check your balance",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const player = origin.initiator ?? origin.sourceEntity;
        if (!player || !(player instanceof Player)) {
          return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
        }

        const balance = this.getBalance(player.name);
        const formatted = this.formatMoney(balance);
        player.sendMessage(`§aYour balance: §e${formatted}`);

        return { status: CustomCommandStatus.Success };
      }
    );

    event.customCommandRegistry.registerCommand(
      {
        name: "pmmpcore:pay",
        description: "Pay money to another player",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        mandatoryParameters: [
          { type: CustomCommandParamType.String, name: "target" },
          { type: CustomCommandParamType.Integer, name: "amount" },
        ],
      },
      (origin, targetName, amount) => {
        const player = origin.initiator ?? origin.sourceEntity;
        if (!player || !(player instanceof Player)) {
          return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
        }

        if (amount === undefined || Number.isNaN(amount) || amount <= 0) {
          player.sendMessage(`§cInvalid amount!`);
          return { status: CustomCommandStatus.Success };
        }

        if (!targetName || typeof targetName !== "string" || targetName.trim().length === 0) {
          player.sendMessage(`§cInvalid target player!`);
          return { status: CustomCommandStatus.Success };
        }

        if (this.getBalance(player.name) < amount) {
          player.sendMessage(`§cYou don't have enough money!`);
          return { status: CustomCommandStatus.Success };
        }

        this.removeMoney(player.name, amount);
        this.addMoney(targetName, amount);

        player.sendMessage(`§aYou paid §e${this.formatMoney(amount)} §ato §b${targetName}`);

        const target = world.getAllPlayers().find((p) => p.name === targetName);
        if (target) {
          target.sendMessage(`§aYou received §e${this.formatMoney(amount)} §afrom §b${player.name}`);
        }

        return { status: CustomCommandStatus.Success };
      }
    );

    event.customCommandRegistry.registerCommand(
      {
        name: "pmmpcore:money",
        description: "Economy admin commands",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: false,
        mandatoryParameters: [
          { type: CustomCommandParamType.Enum, name: "pmmpcore:money_action" },
          { type: CustomCommandParamType.String, name: "target" },
          { type: CustomCommandParamType.Integer, name: "amount" },
        ],
      },
      (origin, action, targetName, amount) => {
        const player = origin.initiator ?? origin.sourceEntity;
        if (!player || !(player instanceof Player)) {
          return { status: CustomCommandStatus.Failure, message: "Only players can use this command." };
        }

        if (amount === undefined || Number.isNaN(amount) || amount < 0) {
          player.sendMessage(`§cInvalid amount!`);
          return { status: CustomCommandStatus.Success };
        }

        let newBalance;
        switch (action) {
          case "give":
            newBalance = this.addMoney(targetName, amount);
            player.sendMessage(
              `§aGave §e${this.formatMoney(amount)} §ato §b${targetName}. New balance: §e${this.formatMoney(newBalance)}`
            );
            break;
          case "take":
            newBalance = this.removeMoney(targetName, amount);
            player.sendMessage(
              `§aTook §e${this.formatMoney(amount)} §afrom §b${targetName}. New balance: §e${this.formatMoney(newBalance)}`
            );
            break;
          case "set":
            newBalance = this.setBalance(targetName, amount);
            player.sendMessage(`§aSet §b${targetName}'s §abalance to §e${this.formatMoney(newBalance)}`);
            break;
          default:
            player.sendMessage(`§cInvalid action! Use give, take, or set.`);
        }

        return { status: CustomCommandStatus.Success };
      }
    );
  },
});
