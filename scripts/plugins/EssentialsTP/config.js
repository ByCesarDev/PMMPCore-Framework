export const ESSENTIALSTP_PLUGIN_NAME = "EssentialsTP";
export const ESSENTIALSTP_SCHEMA_VERSION = 1;

export const ESSENTIALSTP_PERMISSIONS = Object.freeze({
  home: "essentialstp.command.home",
  sethome: "essentialstp.command.sethome",
  delhome: "essentialstp.command.delhome",
  back: "essentialstp.command.back",
  wild: "essentialstp.command.wild",
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
    wildSeconds: 5,
    backSeconds: 5,
    tpaSeconds: 5,
    tpahereSeconds: 5,
  },
  wild: {
    maxX: 2000,
    maxZ: 2000,
    /** Minimum horizontal distance from you (flat XZ). 0 = allow nearby; try 400–800 for always-far jumps. */
    minHorizontalRadius: 0,
    minY: -64,
    maxY: 319,
    maxAttempts: 64,
    /** Place stone under feet + air for body (helps distant/unloaded columns via generation). */
    prepareLandingPad: true,
    /** Log each failed attempt to scripting console (Content Log). */
    debugLog: false,
    /** If no safe column is found, still TP to random XZ with best-effort Y (surface or player height). */
    unsafeFallback: true,
  },
  costs: {
    enabled: false,
    home: 0,
    spawn: 0,
    warp: 0,
    wild: 0,
    back: 0,
    tpa: 0,
    tpahere: 0,
  },
  messaging: {
    prefix: "§b[EssentialsTP]§r",
  },
});
