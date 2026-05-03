import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  Player,
} from "@minecraft/server";
import { ESSENTIALSTP_PERMISSIONS } from "./config.js";

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
  return { isPlayer: false, player: null, name: "CONSOLE", send: (msg) => console.log(`[EssentialsTP] ${msg}`) };
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

export function registerEssentialsTPCommands(event, service, runtime) {
  const registry = event.customCommandRegistry;

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:sethome",
      description: "Set a home location",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      optionalParameters: [{ type: CustomCommandParamType.String, name: "name" }],
    },
    (origin, name = "home") => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.sethome, service)) return;
        const row = service.setHome(sender.player, name);
        sender.send(`${service.getPrefix()} Home '${row.name}' saved.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:home",
      description: "Teleport to one of your homes",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      optionalParameters: [{ type: CustomCommandParamType.String, name: "name" }],
    },
    (origin, name = "home") => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.home, service)) return;
        const row = service.teleportHome(sender.player, name);
        sender.send(`${service.getPrefix()} Teleported to home '${row.name}'.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:delhome",
      description: "Delete one of your homes",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      optionalParameters: [{ type: CustomCommandParamType.String, name: "name" }],
    },
    (origin, name = "home") => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.delhome, service)) return;
        if (!service.deleteHome(sender.name, name)) throw new Error(`Home '${name}' does not exist.`);
        sender.send(`${service.getPrefix()} Home '${name}' deleted.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:back",
      description: "Teleport to your previous location",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.back, service)) return;
        service.teleportBack(sender.player);
        sender.send(`${service.getPrefix()} Teleported back.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:setwarp",
      description: "Set a global warp",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.String, name: "name" }],
    },
    (origin, name) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.setwarp, service)) return;
        const row = service.setWarp(sender.player, name);
        sender.send(`${service.getPrefix()} Warp '${row.name}' saved.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:warp",
      description: "Teleport to a warp",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.String, name: "name" }],
    },
    (origin, name) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.warp, service)) return;
        const row = service.teleportWarp(sender.player, name);
        sender.send(`${service.getPrefix()} Teleported to warp '${row.name}'.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:delwarp",
      description: "Delete a global warp",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.String, name: "name" }],
    },
    (origin, name) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.delwarp, service)) return;
        if (!service.deleteWarp(name)) throw new Error(`Warp '${name}' does not exist.`);
        sender.send(`${service.getPrefix()} Warp '${name}' deleted.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:setspawn",
      description: "Set spawn for current dimension",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.setspawn, service)) return;
        const row = service.setSpawn(sender.player);
        sender.send(`${service.getPrefix()} Spawn updated for ${row.dimensionId}.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:spawn",
      description: "Teleport to spawn",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.spawn, service)) return;
        service.teleportSpawn(sender.player);
        sender.send(`${service.getPrefix()} Teleported to spawn.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:wild",
      description: "Teleport to a random safe location",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.wild, service)) return;
        const row = service.teleportWild(sender.player);
        let wildNote = "";
        if (row.usedLandingPad) wildNote = " (pad)";
        else if (row.usedUnsafeFallback) wildNote = " (fallback)";
        sender.send(`${service.getPrefix()} Wild teleport: ${row.x}, ${row.y}, ${row.z}${wildNote}`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:tpa",
      description: "Request teleport to another player",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.String, name: "player" }],
    },
    (origin, playerName) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.tpa, service)) return;
        const target = service.getOnlinePlayer(playerName);
        if (!target) throw new Error(`Player '${playerName}' is offline.`);
        const row = service.createRequest(sender.player, target, "tpa");
        sender.send(`${service.getPrefix()} Request sent to ${target.name}.`);
        target.sendMessage(`${service.getPrefix()} ${sender.name} requested to teleport to you. Use /tpaccept or /tpdeny.`);
        target.sendMessage(`${service.getPrefix()} Request id: ${row.id} (expires in ${service.getConfig().requests.timeoutSeconds}s).`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:tpahere",
      description: "Request another player to teleport to you",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.String, name: "player" }],
    },
    (origin, playerName) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.tpahere, service)) return;
        const target = service.getOnlinePlayer(playerName);
        if (!target) throw new Error(`Player '${playerName}' is offline.`);
        const row = service.createRequest(sender.player, target, "tpahere");
        sender.send(`${service.getPrefix()} tpahere request sent to ${target.name}.`);
        target.sendMessage(`${service.getPrefix()} ${sender.name} wants you to teleport to them. Use /tpaccept or /tpdeny.`);
        target.sendMessage(`${service.getPrefix()} Request id: ${row.id} (expires in ${service.getConfig().requests.timeoutSeconds}s).`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:tpaccept",
      description: "Accept a teleport request",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      optionalParameters: [{ type: CustomCommandParamType.String, name: "player" }],
    },
    (origin, playerName = null) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.tpaccept, service)) return;
        const result = service.acceptRequest(sender.player, playerName);
        if (!result.ok) throw new Error(result.reason);
        const requester = service.getOnlinePlayer(result.request.requester);
        sender.send(`${service.getPrefix()} Teleport request accepted.`);
        requester?.sendMessage(`${service.getPrefix()} ${sender.name} accepted your request.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:tpdeny",
      description: "Deny a teleport request",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      optionalParameters: [{ type: CustomCommandParamType.String, name: "player" }],
    },
    (origin, playerName = null) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.tpdeny, service)) return;
        const denied = service.denyRequest(sender.player.name, playerName);
        if (!denied) throw new Error("No matching pending request.");
        const requester = service.getOnlinePlayer(denied.requester);
        sender.send(`${service.getPrefix()} Request denied.`);
        requester?.sendMessage(`${service.getPrefix()} ${sender.name} denied your teleport request.`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:tpcancel",
      description: "Cancel one of your pending requests",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      optionalParameters: [{ type: CustomCommandParamType.String, name: "player" }],
    },
    (origin, playerName = null) => {
      const sender = resolveSender(origin);
      return withSafety(sender, service, () => {
        if (!sender.isPlayer) throw new Error("This command can only be used by players.");
        if (!guard(runtime, sender, ESSENTIALSTP_PERMISSIONS.tpcancel, service)) return;
        const ok = service.cancelRequest(sender.name, playerName);
        if (!ok) throw new Error("No matching pending request to cancel.");
        sender.send(`${service.getPrefix()} Pending request cancelled.`);
      });
    }
  );
}
