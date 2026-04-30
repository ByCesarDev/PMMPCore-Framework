import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  Player,
} from "@minecraft/server";
import { PMMPCore } from "../../PMMPCore.js";
import { ECONOMY_PERMISSIONS } from "./config.js";

function registerCommandSafe(registry, definition, callback) {
  registry.registerCommand(definition, callback);
  const name = definition?.name;
  if (typeof name === "string" && name.includes(":")) {
    const alias = name.split(":").slice(1).join(":");
    if (alias) {
      try {
        registry.registerCommand({ ...definition, name: alias }, callback);
      } catch (_) {}
    }
  }
}

function resolveSender(origin) {
  const player = origin.initiator ?? origin.sourceEntity;
  if (player instanceof Player) {
    return { isPlayer: true, player, name: player.name, send: (msg) => player.sendMessage(msg) };
  }
  return { isPlayer: false, player: null, name: "CONSOLE", send: (msg) => console.log(`[EconomyAPI] ${msg}`) };
}

function withSafety(sender, fn) {
  try {
    fn();
    return { status: CustomCommandStatus.Success };
  } catch (error) {
    PMMPCore.emit("economy.transaction.failed", {
      actor: sender.name,
      reason: error?.message ?? "Unknown error",
    });
    sender.send(`§c[EconomyAPI] ${error?.message ?? "Unknown error"}§r`);
    return { status: CustomCommandStatus.Success };
  }
}

function hasPermission(runtime, sender, node) {
  if (!sender.isPlayer) return true;
  return runtime?.hasPermissionNode?.(sender.player, node) ?? true;
}

function guard(runtime, sender, node) {
  if (hasPermission(runtime, sender, node)) return true;
  sender.send(`§c[EconomyAPI] Missing permission: ${node}§r`);
  return false;
}

export function registerEconomyCommands(event, service, runtime) {
  const registry = event.customCommandRegistry;
  registry.registerEnum("pmmpcore:bank_subcommand", ["deposit", "withdraw", "mymoney"]);
  registry.registerEnum("pmmpcore:bankadmin_subcommand", ["takemoney", "givemoney"]);

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:mymoney",
      description: "Shows your money",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.mymoney)) return;
        sender.send(`§a[EconomyAPI] Money: §f${service.getMoney(sender.name)}`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:mydebt",
      description: "Shows your debt",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.mydebt)) return;
        sender.send(`§e[EconomyAPI] Debt: §f${service.getDebt(sender.name)}`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:takedebt",
      description: "Borrow money as debt",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.Float, name: "money" }],
    },
    (origin, money) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.takedebt)) return;
        const debt = service.takeDebt(sender.name, money, sender.name);
        sender.send(`§a[EconomyAPI] Debt accepted. New debt: §f${debt}`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:returndebt",
      description: "Return debt",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.Float, name: "money" }],
    },
    (origin, money) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.returndebt)) return;
        const debt = service.returnDebt(sender.name, money, sender.name);
        sender.send(`§a[EconomyAPI] Debt returned. Remaining debt: §f${debt}`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:topmoney",
      description: "Shows top money players",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      optionalParameters: [{ type: CustomCommandParamType.Integer, name: "page" }],
    },
    (origin, page = 1) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.topmoney)) return;
        const result = service.getTopMoney(page);
        sender.send(`§b[EconomyAPI] Top money page ${result.page}/${result.totalPages}`);
        for (const [idx, row] of result.entries.entries()) {
          sender.send(`§7#${(result.page - 1) * 5 + idx + 1} §f${row.player}: §a${row.wallet}`);
        }
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:pay",
      description: "Pay money to another player",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.String, name: "player" },
        { type: CustomCommandParamType.Float, name: "money" },
      ],
    },
    (origin, playerName, money) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.pay)) return;
        service.payMoney(sender.name, playerName, money, sender.name);
        sender.send(`§a[EconomyAPI] Paid ${money} to ${playerName}.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:seemoney",
      description: "Shows player's money",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.String, name: "player" }],
    },
    (origin, playerName) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.seemoney)) return;
        sender.send(`§a[EconomyAPI] ${playerName}: §f${service.getMoney(playerName)}`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:mystatus",
      description: "Shows wallet/debt/bank status",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.mystatus)) return;
        const status = service.getStatus(sender.name);
        sender.send(`§b[EconomyAPI] Wallet: §f${status.wallet}`);
        sender.send(`§b[EconomyAPI] Debt: §f${status.debt}`);
        sender.send(`§b[EconomyAPI] Bank: §f${status.bank}`);
        sender.send(`§b[EconomyAPI] Net worth: §f${status.netWorth}`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:setmoney",
      description: "Set player's money",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.String, name: "player" },
        { type: CustomCommandParamType.Float, name: "money" },
      ],
    },
    (origin, playerName, money) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.setmoney)) return;
        service.setMoney(playerName, money, sender.name);
        sender.send(`§a[EconomyAPI] Set ${playerName} money to ${money}.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:givemoney",
      description: "Give money to player",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.String, name: "player" },
        { type: CustomCommandParamType.Float, name: "money" },
      ],
    },
    (origin, playerName, money) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.givemoney)) return;
        const next = service.addMoney(playerName, money, sender.name);
        sender.send(`§a[EconomyAPI] ${playerName} new money: ${next}.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:takemoney",
      description: "Take money from player",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.String, name: "player" },
        { type: CustomCommandParamType.Float, name: "money" },
      ],
    },
    (origin, playerName, money) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.takemoney)) return;
        const next = service.reduceMoney(playerName, money, sender.name);
        sender.send(`§a[EconomyAPI] ${playerName} new money: ${next}.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:economys",
      description: "Shows plugins using EconomyAPI",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.economys)) return;
        const list = service.listConsumers();
        sender.send(`§b[EconomyAPI] Consumers (${list.length}): §f${list.join(", ") || "none"}`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:moneysave",
      description: "Flush economy data to storage",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.moneysave)) return;
        service.moneysave();
        sender.send("§a[EconomyAPI] Data flushed.");
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:moneyload",
      description: "Replay WAL if needed and refresh economy state",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.moneyload)) return;
        service.moneyload();
        sender.send("§a[EconomyAPI] Data replay completed.");
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:bank",
      description: "Bank command",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.Enum, name: "pmmpcore:bank_subcommand" }],
      optionalParameters: [{ type: CustomCommandParamType.Float, name: "money" }],
    },
    (origin, subcommand, money = 0) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.bank)) return;
        const op = String(subcommand ?? "").toLowerCase();
        if (op === "mymoney") {
          sender.send(`§b[EconomyAPI] Bank money: §f${service.getBankMoney(sender.name)}`);
          return;
        }
        if (op === "deposit") {
          const next = service.bankDeposit(sender.name, money, sender.name);
          sender.send(`§a[EconomyAPI] Deposit complete. Bank: §f${next}`);
          return;
        }
        if (op === "withdraw") {
          const next = service.bankWithdraw(sender.name, money, sender.name);
          sender.send(`§a[EconomyAPI] Withdraw complete. Bank: §f${next}`);
          return;
        }
        throw new Error("Unknown bank subcommand.");
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:bankadmin",
      description: "Bank admin command",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.Enum, name: "pmmpcore:bankadmin_subcommand" },
        { type: CustomCommandParamType.String, name: "player" },
        { type: CustomCommandParamType.Float, name: "money" },
      ],
    },
    (origin, subcommand, playerName, money) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(runtime, sender, ECONOMY_PERMISSIONS.bankadmin)) return;
        const op = String(subcommand ?? "").toLowerCase();
        if (op === "givemoney") {
          const next = service.bankGive(playerName, money, sender.name);
          sender.send(`§a[EconomyAPI] ${playerName} bank money: §f${next}`);
          return;
        }
        if (op === "takemoney") {
          const next = service.bankTake(playerName, money, sender.name);
          sender.send(`§a[EconomyAPI] ${playerName} bank money: §f${next}`);
          return;
        }
        throw new Error("Unknown bankadmin subcommand.");
      });
    }
  );
}
