import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  Player,
} from "@minecraft/server";
import { PLACEHOLDER_PERMISSIONS } from "./config.js";

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
    return { isPlayer: true, player, send: (msg) => player.sendMessage(msg) };
  }
  return { isPlayer: false, player: null, send: (msg) => console.log(`[PlaceholderAPI] ${msg}`) };
}

function withSafety(sender, fn) {
  try {
    fn();
    return { status: CustomCommandStatus.Success };
  } catch (error) {
    sender.send(`§c[PlaceholderAPI] ${error?.message ?? "Unknown error"}§r`);
    return { status: CustomCommandStatus.Success };
  }
}

function hasPermission(service, sender, node) {
  if (!sender.isPlayer) return true;
  return service?.hasPermissionNode?.(sender.player, node) ?? true;
}

function joinArgs(...args) {
  return args
    .filter((x) => x !== undefined && x !== null)
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0)
    .join(" ");
}

export function registerPlaceholderCommands(event, runtime) {
  const registry = event.customCommandRegistry;
  registry.registerEnum("pmmpcore:papi_subcommand", ["reload", "list", "parse", "test"]);

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:papi",
      description: "PlaceholderAPI root command",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.Enum, name: "pmmpcore:papi_subcommand" }],
      optionalParameters: [
        { type: CustomCommandParamType.String, name: "arg1" },
        { type: CustomCommandParamType.String, name: "arg2" },
        { type: CustomCommandParamType.String, name: "arg3" },
        { type: CustomCommandParamType.String, name: "arg4" },
        { type: CustomCommandParamType.String, name: "arg5" },
        { type: CustomCommandParamType.String, name: "arg6" },
      ],
    },
    (origin, subcommand, arg1, arg2, arg3, arg4, arg5, arg6) => {
      const sender = resolveSender(origin);
      return withSafety(sender, () => {
        const op = String(subcommand ?? "").toLowerCase();
        if (op === "reload") {
          if (!hasPermission(runtime, sender, PLACEHOLDER_PERMISSIONS.admin)) throw new Error(`Missing permission: ${PLACEHOLDER_PERMISSIONS.admin}`);
          runtime.reload();
          sender.send("§a[PlaceholderAPI] Configuration reloaded.§r");
          return;
        }
        if (op === "list") {
          if (!hasPermission(runtime, sender, PLACEHOLDER_PERMISSIONS.list)) throw new Error(`Missing permission: ${PLACEHOLDER_PERMISSIONS.list}`);
          const expansions = runtime.listExpansions();
          sender.send(`§b[PlaceholderAPI] Expansions (${expansions.length}):§r`);
          for (const entry of expansions) {
            sender.send(`§7- §f${entry.identifier} §7v${entry.version} §8by ${entry.author}`);
          }
          return;
        }
        if (op === "parse") {
          if (!hasPermission(runtime, sender, PLACEHOLDER_PERMISSIONS.parse)) throw new Error(`Missing permission: ${PLACEHOLDER_PERMISSIONS.parse}`);
          const input = joinArgs(arg1, arg2, arg3, arg4, arg5, arg6);
          if (!input) throw new Error("Usage: /papi parse <text>");
          const output = runtime.parse(input, sender.player);
          sender.send(`§b[PlaceholderAPI] §f${output}`);
          return;
        }
        if (op === "test") {
          if (!hasPermission(runtime, sender, PLACEHOLDER_PERMISSIONS.test)) throw new Error(`Missing permission: ${PLACEHOLDER_PERMISSIONS.test}`);
          const expansion = String(arg1 ?? "").trim().toLowerCase();
          const key = String(arg2 ?? "").trim().toLowerCase();
          if (!expansion || !key) throw new Error("Usage: /papi test <expansion> <placeholder>");
          const output = runtime.parse(`%${expansion}_${key}%`, sender.player);
          sender.send(`§b[PlaceholderAPI] Test result: §f${output}`);
          return;
        }
        throw new Error("Unknown subcommand. Use reload/list/parse/test.");
      });
    }
  );
}
