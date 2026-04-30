export const PLACEHOLDER_PLUGIN_NAME = "PlaceholderAPI";
export const PLACEHOLDER_SCHEMA_VERSION = 1;

export const PLACEHOLDER_PERMISSIONS = Object.freeze({
  admin: "placeholderapi.admin",
  parse: "placeholderapi.parse",
  test: "placeholderapi.test",
  list: "placeholderapi.list",
});

export const PLACEHOLDER_CONFIG_DEFAULTS = Object.freeze({
  debug: false,
  maxParseInputLength: 240,
  cacheTtl: {
    generalMs: 1000,
    serverMs: 1000,
    timeMs: 1000,
    playerMs: 250,
  },
  enabledExpansions: {
    general: true,
    player: true,
    server: true,
    time: true,
  },
});
