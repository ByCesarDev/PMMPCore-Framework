// PMMPCore Plugin Loader
// Add your plugin imports here manually
// Format: import "./plugins/PluginName/main.js";

console.log("[PMMPCore] Loading plugins...");

import "./plugins/MultiWorld/main.js";
import "./plugins/PurePerms/main.js";
import "./plugins/PlaceholderAPI/main.js";
// FormAPI after PlaceholderAPI: provides UI helpers other plugins may soft-depend on.
import "./plugins/FormAPI/main.js";
import "./plugins/ScoreHud/main.js";
import "./plugins/EconomyAPI/main.js";
import "./plugins/EssentialsTP/main.js";
import "./plugins/PureChat/main.js";
import "./plugins/ExamplePlugin/main.js";

export const pluginList = ["MultiWorld", "PurePerms", "PlaceholderAPI", "FormAPI", "ScoreHud", "EconomyAPI", "EssentialsTP", "PureChat", "ExamplePlugin"];

console.log("[PMMPCore] Plugin loader initialized - MultiWorld, PurePerms, PlaceholderAPI, FormAPI, ScoreHud, EconomyAPI, EssentialsTP, PureChat, ExamplePlugin loaded");
