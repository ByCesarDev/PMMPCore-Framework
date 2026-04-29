export const PUREPERMS_CONFIG = {
  dataProvider: "dynamic-properties",
  defaultLanguage: "en",
  disableOp: false,
  enableMultiworldPerms: false,
  enableNoeulSixtyfour: false,
  noeulMinimumPwLength: 6,
  superadminRanks: ["OP"],
};

export const DEFAULT_GROUPS = {
  Guest: {
    alias: "gst",
    isDefault: true,
    inheritance: [],
    permissions: [
      "-essentials.kit",
      "-essentials.kit.other",
      "-pocketmine.command.me",
      "pchat.colored.format",
      "pchat.colored.nametag",
      "pocketmine.command.list",
      "pperms.command.ppinfo",
    ],
    worlds: {},
  },
  Mod: {
    alias: "mod",
    isDefault: false,
    inheritance: ["Guest"],
    permissions: [
      "pperms.command.ppinfo",
      "pperms.command.groups",
      "pperms.command.grpinfo",
      "pperms.command.usrinfo",
      "pperms.command.listgperms",
      "pperms.command.listuperms",
      "pperms.command.fperms",
    ],
    worlds: {},
  },
  Admin: {
    alias: "adm",
    isDefault: false,
    inheritance: ["Mod"],
    permissions: [
      "pperms.command.setgroup",
      "pperms.command.setuperm",
      "pperms.command.unsetuperm",
      "pperms.command.setgperm",
      "pperms.command.unsetgperm",
      "pperms.command.defgroup",
      "pperms.command.ppreload",
      "pperms.command.addparent",
      "pperms.command.rmparent",
    ],
    worlds: {},
  },
  OP: {
    alias: "op",
    isDefault: false,
    inheritance: ["Admin"],
    permissions: ["*"],
    worlds: {},
  },
};

export const PUREPERMS_SCHEMA_VERSION = 1;
