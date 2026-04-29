import { Player, CustomCommandStatus, CommandPermissionLevel, CustomCommandParamType } from "@minecraft/server";
import { sendError, sendInfo, sendListHeader, sendSuccess } from "./messages.js";

const COMMANDS = [
  "addgroup",
  "addparent",
  "defgroup",
  "fperms",
  "groups",
  "grpinfo",
  "listgperms",
  "listuperms",
  "ppinfo",
  "ppsudo",
  "ppreload",
  "rmgroup",
  "rmparent",
  "setgperm",
  "setgroup",
  "setuperm",
  "unsetgperm",
  "unsetuperm",
  "usrinfo",
];

function resolveSender(origin) {
  const player = origin.initiator ?? origin.sourceEntity;
  if (player && player instanceof Player) {
    return {
      isPlayer: true,
      name: player.name,
      player,
      dimension: player.dimension,
      sendMessage: (message) => player.sendMessage(message),
    };
  }
  return {
    isPlayer: false,
    name: "CONSOLE",
    dimension: null,
    sendMessage: (message) => console.log(`[PurePerms] ${message}`),
  };
}

function worldNameFromSender(sender) {
  if (!sender.isPlayer) return null;
  return sender.dimension?.id ?? null;
}

function hasCommandPermission(service, sender, node) {
  if (!sender.isPlayer) return true;
  return service.hasPermission(sender.name, node, worldNameFromSender(sender), sender.player);
}

function guardCommandPermission(service, sender, node) {
  if (hasCommandPermission(service, sender, node)) return true;
  sendError(sender, `You do not have permission: ${node}`);
  return false;
}

function safe(handler, sender) {
  try {
    handler();
    return { status: CustomCommandStatus.Success };
  } catch (error) {
    sendError(sender, error.message ?? "Unknown error.");
    return { status: CustomCommandStatus.Success };
  }
}

function registerSimpleCommand(registry, name, description, mandatoryParameters, callback) {
  registry.registerCommand(
    {
      name: `pmmpcore:${name}`,
      description,
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters,
      optionalParameters: [{ type: CustomCommandParamType.String, name: "world" }],
    },
    callback
  );
}

export function registerPurePermsCommands(event, service) {
  const registry = event.customCommandRegistry;
  registry.registerEnum("pmmpcore:ppsudo_mode", ["login", "register"]);

  registerSimpleCommand(registry, "addgroup", "Adds a new group to the groups list.", [
    { type: CustomCommandParamType.String, name: "group" },
  ], (origin, group) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.addgroup")) return;
      service.addGroup(group);
      sendSuccess(sender, `Group '${group}' created.`);
    }, sender);
  });

  registerSimpleCommand(registry, "addparent", "Adds a group to another group inheritance list.", [
    { type: CustomCommandParamType.String, name: "target_group" },
    { type: CustomCommandParamType.String, name: "parent_group" },
  ], (origin, targetGroup, parentGroup) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.addparent")) return;
      service.addParent(targetGroup, parentGroup);
      sendSuccess(sender, `Group '${targetGroup}' now inherits '${parentGroup}'.`);
    }, sender);
  });

  registerSimpleCommand(registry, "defgroup", "Allows you to set default group.", [
    { type: CustomCommandParamType.String, name: "group" },
  ], (origin, group, worldName) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.defgroup")) return;
      service.setDefaultGroup(group, worldName);
      sendSuccess(sender, worldName ? `Default group for world '${worldName}' set to '${group}'.` : `Default group set to '${group}'.`);
    }, sender);
  });

  registerSimpleCommand(registry, "fperms", "Allows you to find permissions for a specific plugin.", [
    { type: CustomCommandParamType.String, name: "prefix" },
  ], (origin, prefix) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.fperms")) return;
      const perms = service.findPermissionsByPrefix(prefix);
      if (perms.length === 0) {
        sendInfo(sender, `No permissions found for prefix '${prefix}'.`);
        return;
      }
      sendListHeader(sender, `Permission search '${prefix}'`, 1, 1);
      for (const perm of perms.slice(0, 40)) sendInfo(sender, perm);
      if (perms.length > 40) sendInfo(sender, `Showing 40/${perms.length} results.`);
    }, sender);
  });

  registerSimpleCommand(registry, "groups", "Shows a list of all groups.", [], (origin) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.groups")) return;
      const groups = service.getGroups();
      const names = Object.keys(groups);
      sendInfo(sender, `Groups (${names.length}): ${names.join(", ") || "none"}`);
    }, sender);
  });

  registerSimpleCommand(registry, "grpinfo", "Shows info about a group.", [
    { type: CustomCommandParamType.String, name: "group" },
  ], (origin, group, worldName) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.grpinfo")) return;
      const info = service.getGroupInfo(group, worldName);
      sendInfo(sender, `Group: ${info.name}`);
      sendInfo(sender, `Alias: ${info.alias ?? "-"}`);
      sendInfo(sender, `Default: ${info.isDefault ? "yes" : "no"}`);
      sendInfo(sender, `Inheritance: ${(info.inheritance ?? []).join(", ") || "none"}`);
      sendInfo(sender, `Permissions: ${(info.permissions ?? []).length}`);
      if (worldName) sendInfo(sender, `World perms (${worldName}): ${(info.worldData?.permissions ?? []).length}`);
    }, sender);
  });

  registerSimpleCommand(registry, "listgperms", "Shows permissions from a group.", [
    { type: CustomCommandParamType.String, name: "group" },
    { type: CustomCommandParamType.Integer, name: "page" },
  ], (origin, group, page, worldName) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.listgperms")) return;
      const result = service.listGroupPermissions(group, page, worldName);
      sendListHeader(sender, `Group permissions: ${group}`, result.page, result.totalPages);
      for (const perm of result.entries) sendInfo(sender, perm);
      if (result.entries.length === 0) sendInfo(sender, "No permissions found.");
    }, sender);
  });

  registerSimpleCommand(registry, "listuperms", "Shows permissions from a user.", [
    { type: CustomCommandParamType.String, name: "player" },
    { type: CustomCommandParamType.Integer, name: "page" },
  ], (origin, playerName, page, worldName) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.listuperms")) return;
      const result = service.listUserPermissions(playerName, page, worldName);
      sendListHeader(sender, `User permissions: ${playerName}`, result.page, result.totalPages);
      for (const perm of result.entries) sendInfo(sender, perm);
      if (result.entries.length === 0) sendInfo(sender, "No permissions found.");
    }, sender);
  });

  registerSimpleCommand(registry, "ppinfo", "Shows info about PurePerms.", [], (origin) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.ppinfo")) return;
      const config = service.getConfig();
      const groups = Object.keys(service.getGroups()).length;
      const users = Object.keys(service.getUsers()).length;
      sendInfo(sender, "PurePerms for PMMPCore");
      sendInfo(sender, `Groups: ${groups} | Users: ${users}`);
      sendInfo(sender, `Multiworld perms: ${config.enableMultiworldPerms ? "enabled" : "disabled"}`);
      sendInfo(sender, `Noeul: ${config.enableNoeulSixtyfour ? "enabled" : "disabled"}`);
    }, sender);
  });

  registry.registerCommand(
    {
      name: "pmmpcore:ppsudo",
      description: "Registers or logs into your Noeul account.",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.Enum, name: "pmmpcore:ppsudo_mode" },
        { type: CustomCommandParamType.String, name: "password" },
      ],
    },
    (origin, mode, password) => {
      const sender = resolveSender(origin);
      return safe(() => {
        if (!sender.isPlayer) throw new Error("/ppsudo can only be used by players.");
        if (!guardCommandPermission(service, sender, "pperms.command.ppsudo")) return;
        service.updateNoeulAccount(sender.name, mode, password);
        sendSuccess(sender, mode === "register" ? "Noeul account registered." : "Noeul login successful.");
      }, sender);
    }
  );

  registerSimpleCommand(registry, "ppreload", "Reloads all PurePerms configurations.", [], (origin) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.ppreload")) return;
      service.reloadConfig();
      sendSuccess(sender, "PurePerms configuration reloaded.");
    }, sender);
  });

  registerSimpleCommand(registry, "rmgroup", "Removes a group from the groups list.", [
    { type: CustomCommandParamType.String, name: "group" },
  ], (origin, group) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.rmgroup")) return;
      service.removeGroup(group);
      sendSuccess(sender, `Group '${group}' removed.`);
    }, sender);
  });

  registerSimpleCommand(registry, "rmparent", "Removes a group from another inheritance list.", [
    { type: CustomCommandParamType.String, name: "target_group" },
    { type: CustomCommandParamType.String, name: "parent_group" },
  ], (origin, targetGroup, parentGroup) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.rmparent")) return;
      service.removeParent(targetGroup, parentGroup);
      sendSuccess(sender, `Parent '${parentGroup}' removed from '${targetGroup}'.`);
    }, sender);
  });

  registerSimpleCommand(registry, "setgperm", "Adds a permission to the group.", [
    { type: CustomCommandParamType.String, name: "group" },
    { type: CustomCommandParamType.String, name: "permission" },
  ], (origin, group, permission, worldName) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.setgperm")) return;
      service.setGroupPermission(group, permission, worldName, true);
      sendSuccess(sender, `Permission '${permission}' added to group '${group}'.`);
    }, sender);
  });

  registerSimpleCommand(registry, "setgroup", "Sets group for the user.", [
    { type: CustomCommandParamType.String, name: "player" },
    { type: CustomCommandParamType.String, name: "group" },
  ], (origin, playerName, groupName, worldName) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.setgroup")) return;
      service.setUserGroup(playerName, groupName, worldName, !sender.isPlayer, sender.player ?? null);
      sendSuccess(sender, `Player '${playerName}' assigned to group '${groupName}'.`);
    }, sender);
  });

  registerSimpleCommand(registry, "setuperm", "Adds a permission to the user.", [
    { type: CustomCommandParamType.String, name: "player" },
    { type: CustomCommandParamType.String, name: "permission" },
  ], (origin, playerName, permission, worldName) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.setuperm")) return;
      service.setUserPermission(playerName, permission, worldName, true);
      sendSuccess(sender, `Permission '${permission}' added to '${playerName}'.`);
    }, sender);
  });

  registerSimpleCommand(registry, "unsetgperm", "Removes a permission from the group.", [
    { type: CustomCommandParamType.String, name: "group" },
    { type: CustomCommandParamType.String, name: "permission" },
  ], (origin, group, permission, worldName) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.unsetgperm")) return;
      service.setGroupPermission(group, permission, worldName, false);
      sendSuccess(sender, `Permission '${permission}' denied for group '${group}'.`);
    }, sender);
  });

  registerSimpleCommand(registry, "unsetuperm", "Removes a permission from the user.", [
    { type: CustomCommandParamType.String, name: "player" },
    { type: CustomCommandParamType.String, name: "permission" },
  ], (origin, playerName, permission, worldName) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.unsetuperm")) return;
      service.setUserPermission(playerName, permission, worldName, false);
      sendSuccess(sender, `Permission '${permission}' denied for '${playerName}'.`);
    }, sender);
  });

  registerSimpleCommand(registry, "usrinfo", "Shows info about a user.", [
    { type: CustomCommandParamType.String, name: "player" },
  ], (origin, playerName, worldName) => {
    const sender = resolveSender(origin);
    return safe(() => {
      if (!guardCommandPermission(service, sender, "pperms.command.usrinfo")) return;
      const info = service.getUserInfo(playerName, worldName);
      sendInfo(sender, `User: ${playerName}`);
      sendInfo(sender, `Group: ${info.effectiveGroup}`);
      sendInfo(sender, `Direct permissions: ${(info.permissions ?? []).length}`);
      if (worldName) {
        sendInfo(sender, `World '${worldName}' group: ${info.worldData?.group ?? "(not set)"}`);
        sendInfo(sender, `World '${worldName}' perms: ${(info.worldData?.permissions ?? []).length}`);
      }
    }, sender);
  });

  console.log(`[PurePerms] Registered ${COMMANDS.length} commands.`);
}
