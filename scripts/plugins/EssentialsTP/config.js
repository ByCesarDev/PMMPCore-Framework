export const ESSENTIALSTP_PLUGIN_NAME = "EssentialsTP";
/** Bumped when plugin data migrations change (see main.js MigrationService). */
export const ESSENTIALSTP_SCHEMA_VERSION = 1;

export const ESSENTIALSTP_PERMISSIONS = Object.freeze({
  home: "essentialstp.command.home",
  sethome: "essentialstp.command.sethome",
  delhome: "essentialstp.command.delhome",
  back: "essentialstp.command.back",
  setspawn: "essentialstp.command.setspawn",
  spawn: "essentialstp.command.spawn",
  warp: "essentialstp.command.warp",
  setwarp: "essentialstp.admin.setwarp",
  delwarp: "essentialstp.admin.delwarp",
  tpa: "essentialstp.command.tpa",
  tpahere: "essentialstp.command.tpahere",
  tpaccept: "essentialstp.command.tpaccept",
  tpdeny: "essentialstp.command.tpdeny",
  tpcancel: "essentialstp.command.tpcancel",
});

export const ESSENTIALSTP_DEFAULTS = Object.freeze({
  limits: {
    maxHomesPerPlayer: 5,
    maxHomeNameLength: 24,
    maxWarpNameLength: 24,
  },
  requests: {
    timeoutSeconds: 30,
  },
  cooldowns: {
    homeSeconds: 5,
    spawnSeconds: 5,
    warpSeconds: 5,
    backSeconds: 5,
    tpaSeconds: 5,
    tpahereSeconds: 5,
  },
  costs: {
    enabled: false,
    home: 0,
    spawn: 0,
    warp: 0,
    back: 0,
    tpa: 0,
    tpahere: 0,
  },
  messaging: {
    prefix: "§b[EssentialsTP]§r",
  },
});
