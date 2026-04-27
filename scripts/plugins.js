// PMMPCore Plugin Loader
// Add your plugin imports here manually
// Format: import "./plugins/PluginName/main.js";

console.log("[PMMPCore] Loading plugins...");

import "./plugins/EconomyAPI/main.js";
import "./plugins/MultiWorld/main.js";
import "./plugins/PurePerms/main.js";

export const pluginList = ["EconomyAPI", "MultiWorld", "PurePerms"];

console.log("[PMMPCore] Plugin loader initialized - EconomyAPI, MultiWorld, PurePerms loaded");
