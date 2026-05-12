import { CommandPermissionLevel, CustomCommandStatus, Player } from "@minecraft/server";
import * as Forms from "./formsApi.js";
import { FORM_API_CONFIG } from "./config.js";

function registerCommandSafe(registry, definition, callback) {
  try {
    registry.registerCommand(definition, callback);
  } catch (e) {
    console.warn(`[FormAPI] registerCommand failed: ${definition?.name} ${e?.message ?? e}`);
    return;
  }
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
    return { ok: true, player };
  }
  return { ok: false, player: null };
}

function guardPermission(sender, runtime) {
  const node = FORM_API_CONFIG.demoCommand.permission;
  if (!sender.player || !node) return true;
  if (runtime?.hasPermissionNode?.(sender.player, node)) return true;
  sender.player.sendMessage(`§cMissing permission: ${node}§r`);
  return false;
}

/**
 * Bedrock custom command callbacks must return `CustomCommandResult`, not a Promise.
 * Async handlers are rejected by the native bridge ("Arrow function return value expected type: CustomCommandResult").
 *
 * @param {import("@minecraft/server").Player} player
 */
async function runFormApiDemo(player) {
  const menu = await Forms.showButtonMenu(player, {
    title: "FormAPI demo",
    body: "Choose next step.",
    buttons: [
      { id: "full", text: "Full flow (confirm + modal)" },
      { id: "menu_only", text: "Menu only" },
    ],
  });

  if (Forms.isFormOk(menu)) {
    if (menu.buttonId === "menu_only") {
      player.sendMessage("§aFormAPI: menu finished.§r");
      return;
    }
  } else {
    player.sendMessage(`§7FormAPI demo ended: ${menu.status}§r`);
    return;
  }

  const confirm = await Forms.showConfirm(player, {
    title: "Confirm",
    body: "Continue to the modal step?",
    buttonLeft: "Yes",
    buttonRight: "No",
    confirmSide: "left",
  });

  if (!Forms.isFormOk(confirm) || !confirm.confirm) {
    player.sendMessage("§7FormAPI demo stopped at confirm.§r");
    return;
  }

  const modal = await Forms.showModal(player, {
    title: "Profile",
    submitLabel: "Done",
    fields: [
      { type: "label", text: "Enter a short profile." },
      {
        type: "textField",
        id: "name",
        label: "Display name",
        placeholder: "Steve",
        required: true,
        maxLength: 32,
      },
      {
        type: "toggle",
        id: "vip",
        label: "VIP",
        options: { defaultValue: false },
      },
      {
        type: "dropdown",
        id: "team",
        label: "Team",
        items: ["Red", "Blue", "Green"],
        options: { defaultValueIndex: 0 },
      },
      {
        type: "slider",
        id: "score",
        label: "Score",
        min: 0,
        max: 100,
        options: { defaultValue: 50, valueStep: 5 },
      },
    ],
  });

  if (Forms.isFormOk(modal)) {
    player.sendMessage(`§aFormAPI modal OK: §f${JSON.stringify(modal.values)}§r`);
  } else if (modal.status === "invalid") {
    player.sendMessage(`§cValidation: §f${JSON.stringify(modal.fieldErrors ?? modal)}§r`);
  } else {
    player.sendMessage(`§7Modal: ${modal.status}§r`);
  }
}

/**
 * @param {{ hasPermissionNode?: (player: Player, node: string) => boolean }} runtime
 */
export function registerFormApiCommands(event, runtime) {
  if (!FORM_API_CONFIG.plugin.enabled || !FORM_API_CONFIG.demoCommand.enabled) return;

  const registry = event.customCommandRegistry;

  registerCommandSafe(
    registry,
    {
      name: "pmmpcore:formapi_demo",
      description: "Open FormAPI demo (menu → confirm → modal)",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const sender = resolveSender(origin);
      if (!sender.ok || !sender.player) {
        console.warn("[FormAPI] formapi_demo requires a player.");
        return { status: CustomCommandStatus.Success };
      }
      if (!guardPermission(sender, runtime)) {
        return { status: CustomCommandStatus.Success };
      }

      void runFormApiDemo(sender.player).catch((e) => {
        console.warn(`[FormAPI] formapi_demo: ${e?.message ?? e}`);
      });

      return { status: CustomCommandStatus.Success };
    }
  );
}
