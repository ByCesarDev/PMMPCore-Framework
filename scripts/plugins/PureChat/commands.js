import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  Player,
} from "@minecraft/server";
import { PURECHAT_PERMISSIONS } from "./config.js";

function resolveSender(origin) {
  const player = origin.initiator ?? origin.sourceEntity;
  if (player instanceof Player) {
    return {
      isPlayer: true,
      player,
      name: player.name,
      sendMessage: (msg) => player.sendMessage(msg),
    };
  }
  return {
    isPlayer: false,
    player: null,
    name: "CONSOLE",
    sendMessage: (msg) => console.log(`[PureChat] ${msg}`),
  };
}

function parseWorld(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "global" || v.toLowerCase() === "null") return null;
  return v;
}

function withSafety(sender, fn) {
  try {
    fn();
    return { status: CustomCommandStatus.Success };
  } catch (error) {
    sender.sendMessage(`§c[PureChat] ${error?.message ?? "Unknown error"}§r`);
    return { status: CustomCommandStatus.Success };
  }
}

function guard(service, sender, node) {
  if (!sender.isPlayer) return true;
  const perms = service.hasPermissionNode(sender.player, node);
  if (perms) return true;
  sender.sendMessage(`§c[PureChat] Missing permission: ${node}§r`);
  return false;
}

function applyPrefixOrSuffixValue(raw) {
  const v = String(raw ?? "").trim();
  if (!v) return "";
  // Bedrock command parser may reject `{`/`}`. Support both styles for compatibility.
  if (v === "BLANK" || v === "{BLANK}") return " ";
  return v.replaceAll("{BLANK}", " ").replaceAll("BLANK", " ");
}

function registerCommandSafe(registry, definition, callback) {
  registry.registerCommand(definition, callback);
  // Optional alias without namespace (if the runtime accepts it).
  const name = definition?.name;
  if (typeof name === "string" && name.includes(":")) {
    const alias = name.split(":").slice(1).join(":");
    if (alias) {
      try {
        registry.registerCommand({ ...definition, name: alias }, callback);
      } catch (_) {
        // Ignore if the runtime forbids non-namespaced commands or collides.
      }
    }
  }
}

function registerLegacyCommands(registry, service) {
  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:setprefix",
      description: "Set a players prefix",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.String, name: "player" },
        { type: CustomCommandParamType.String, name: "prefix" },
      ],
    },
    (origin, playerName, prefix) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(service, sender, PURECHAT_PERMISSIONS.setPrefix)) return;
        service.setPrefix(playerName, applyPrefixOrSuffixValue(prefix));
        sender.sendMessage(`§a[PureChat] Prefix set for ${playerName}.§r`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:setsuffix",
      description: "Set a players suffix",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.String, name: "player" },
        { type: CustomCommandParamType.String, name: "suffix" },
      ],
    },
    (origin, playerName, suffix) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(service, sender, PURECHAT_PERMISSIONS.setSuffix)) return;
        service.setSuffix(playerName, applyPrefixOrSuffixValue(suffix));
        sender.sendMessage(`§a[PureChat] Suffix set for ${playerName}.§r`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:setformat",
      description: "Set default chat format of a group",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.String, name: "group" },
        { type: CustomCommandParamType.String, name: "world_or_global" },
        { type: CustomCommandParamType.String, name: "format" },
      ],
    },
    (origin, group, worldOrGlobal, format) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(service, sender, PURECHAT_PERMISSIONS.setFormat)) return;
        service.setGroupFormat(group, parseWorld(worldOrGlobal), format);
        sender.sendMessage(`§a[PureChat] Chat format updated for group ${group}.§r`);
      });
    }
  );

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:setnametag",
      description: "Set default nametag of a group",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.String, name: "group" },
        { type: CustomCommandParamType.String, name: "world_or_global" },
        { type: CustomCommandParamType.String, name: "format" },
      ],
    },
    (origin, group, worldOrGlobal, format) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(service, sender, PURECHAT_PERMISSIONS.setNametag)) return;
        service.setGroupNametag(group, parseWorld(worldOrGlobal), format);
        sender.sendMessage(`§a[PureChat] Nametag format updated for group ${group}.§r`);
      });
    }
  );
}

function registerRootCommand(registry, service) {
  registry.registerEnum("pmmpcore:pchat_subcommand", [
    "setprefix",
    "setsuffix",
    "setformat",
    "setnametag",
    "preview",
  ]);
  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:pchat",
      description: "PureChat root command",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.Enum, name: "pmmpcore:pchat_subcommand" },
      ],
      optionalParameters: [
        { type: CustomCommandParamType.String, name: "arg1" },
        { type: CustomCommandParamType.String, name: "arg2" },
        { type: CustomCommandParamType.String, name: "arg3" },
      ],
    },
    (origin, subcommand, arg1, arg2, arg3) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        if (!guard(service, sender, PURECHAT_PERMISSIONS.command)) return;
        const op = String(subcommand ?? "").toLowerCase();
        if (op === "setprefix") {
          if (!guard(service, sender, PURECHAT_PERMISSIONS.setPrefix)) return;
          service.setPrefix(arg1, applyPrefixOrSuffixValue(arg2));
          sender.sendMessage(`§a[PureChat] Prefix set for ${arg1}.§r`);
          return;
        }
        if (op === "setsuffix") {
          if (!guard(service, sender, PURECHAT_PERMISSIONS.setSuffix)) return;
          service.setSuffix(arg1, applyPrefixOrSuffixValue(arg2));
          sender.sendMessage(`§a[PureChat] Suffix set for ${arg1}.§r`);
          return;
        }
        if (op === "setformat") {
          if (!guard(service, sender, PURECHAT_PERMISSIONS.setFormat)) return;
          service.setGroupFormat(arg1, parseWorld(arg2), arg3 ?? "");
          sender.sendMessage(`§a[PureChat] Chat format updated for group ${arg1}.§r`);
          return;
        }
        if (op === "setnametag") {
          if (!guard(service, sender, PURECHAT_PERMISSIONS.setNametag)) return;
          service.setGroupNametag(arg1, parseWorld(arg2), arg3 ?? "");
          sender.sendMessage(`§a[PureChat] Nametag format updated for group ${arg1}.§r`);
          return;
        }
        if (op === "preview") {
          if (!sender.isPlayer) throw new Error("Preview can only be used by players.");
          const info = service.resolvePlayerContext(sender.player, "Hello world");
          const permsInfo = service._getPermsDebug?.(sender.player) ?? null;
          sender.sendMessage(`§b[PureChat] Group: §f${info.groupName}`);
          if (permsInfo) sender.sendMessage(`§b[PureChat] PurePerms effectiveGroup: §f${permsInfo.effectiveGroup ?? "-"}§r`);
          sender.sendMessage(`§b[PureChat] Chat template: §f${info.chatTemplate}`);
          sender.sendMessage(`§b[PureChat] Nametag template: §f${info.nametagTemplate}`);
          return;
        }
        sender.sendMessage("§e[PureChat] Unknown subcommand. Use setprefix/setsuffix/setformat/setnametag/preview.§r");
      });
    }
  );
}

export function registerPureChatCommands(event, service) {
  const registry = event.customCommandRegistry;
  registerRootCommand(registry, service);
  registerLegacyCommands(registry, service);
  console.log("[PureChat] Commands registered (root + legacy compatibility).");
}
