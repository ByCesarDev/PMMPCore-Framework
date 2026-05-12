import { CommandPermissionLevel, CustomCommandStatus, Player } from "@minecraft/server";
import { SCOREHUD_PERMISSIONS } from "./config.js";

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
  return { isPlayer: false, player: null, name: "CONSOLE", send: (msg) => console.log(`[ScoreHud] ${msg}`) };
}

function withSafety(sender, service, fn) {
  try {
    fn();
    return { status: CustomCommandStatus.Success };
  } catch (error) {
    const message = error?.message ?? "Unknown error";
    sender.send(`${service.getPrefix()} §c${message}§r`);
    return { status: CustomCommandStatus.Success };
  }
}

function guard(runtime, sender, node, service) {
  if (!sender.isPlayer) return true;
  if (runtime?.hasPermissionNode?.(sender.player, node)) return true;
  sender.send(`${service.getPrefix()} §cMissing permission: ${node}§r`);
  return false;
}

export function registerScoreHudCommands(event, service, runtime) {
  const registry = event.customCommandRegistry;

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:scorehud",
      description: "Toggle ScoreHud visibility preference (stored per player)",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, SCOREHUD_PERMISSIONS.use, service)) return;
        const cur = service.isHudEnabledForPlayer(sender.player.name);
        service.setHudEnabled(sender.player.name, !cur);
        sender.send(
          `${service.getPrefix()} ${!cur ? "§aEnabled§r" : "§7Disabled§r"} §8(saved; sidebar is global on Bedrock).§r`
        );
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:scorehudreload",
      description: "Reload ScoreHud config from database",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!guard(runtime, sender, SCOREHUD_PERMISSIONS.reload, service)) return;
        service.reloadFromDisk();
        runtime?.onReloaded?.();
        sender.send(`${service.getPrefix()} §aConfig reloaded.§r`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:scorehuddebug",
      description: "Debug ScoreHud configuration state",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!guard(runtime, sender, SCOREHUD_PERMISSIONS.reload, service)) return;
        const debug = service.debugConfigState();
        sender.send(`${service.getPrefix()} §aDebug info printed to console.§r`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:scorehudmigrate",
      description: "Force ScoreHud configuration migration",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!guard(runtime, sender, SCOREHUD_PERMISSIONS.reload, service)) return;
        const success = service.forceMigration();
        if (success) {
          runtime?.onReloaded?.();
          sender.send(`${service.getPrefix()} §aMigration completed successfully.§r`);
        } else {
          sender.send(`${service.getPrefix()} §cMigration failed. Check console.§r`);
        }
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:scorehudreset",
      description: "Reset ScoreHud configuration to defaults",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!guard(runtime, sender, SCOREHUD_PERMISSIONS.reload, service)) return;
        const success = service.resetToDefaults();
        if (success) {
          runtime?.onReloaded?.();
          sender.send(`${service.getPrefix()} §aConfiguration reset to defaults.§r`);
        } else {
          sender.send(`${service.getPrefix()} §cReset failed. Check console.§r`);
        }
      });
    }
  );
}
