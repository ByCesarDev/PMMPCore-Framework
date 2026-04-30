export const PURECHAT_PLUGIN_NAME = "PureChat";
export const PURECHAT_SCHEMA_VERSION = 1;

export const PURECHAT_PERMISSIONS = {
  use: "pchat",
  coloredMessages: "pchat.coloredMessages",
  command: "pchat.command",
  setPrefix: "pchat.command.setprefix",
  setSuffix: "pchat.command.setsuffix",
  setNametag: "pchat.command.setnametag",
  setFormat: "pchat.command.setformat",
};

export const PURECHAT_DEFAULTS = {
  enableMultiworldChat: false,
  groups: {
    Guest: {
      chat: "&3&l{prefix}&e[Guest]&f&r {display_name} &7> {msg}",
      nametag: "&3&l{prefix}&e[Guest]&f&r {display_name}",
      worlds: {},
    },
    Admin: {
      chat: "&3&l{prefix}&c[Admin]&f&r {display_name} &7> {msg}",
      nametag: "&3&l{prefix}&c[Admin]&f&r {display_name}",
      worlds: {},
    },
    Owner: {
      chat: "&3&l{prefix}&a[Owner]&f&r {display_name} &7> {msg}",
      nametag: "&3&l{prefix}&a[Owner]&f&r {display_name}",
      worlds: {},
    },
    OP: {
      chat: "&3&l{prefix}&9[OP]&f&r {display_name} &7> {msg}",
      nametag: "&3&l{prefix}&9[OP]&f&r {display_name}",
      worlds: {},
    },
  },
  players: {},
};

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeWorld(worldName) {
  return worldName ? normalizeName(worldName) : null;
}
