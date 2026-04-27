import { world, system, Player, CustomCommandStatus, CommandPermissionLevel } from "@minecraft/server";

const Color = {
  red: "\xA7c",
  aqua: "\xA7b",
  green: "\xA7a",
  darkRed: "\xA74",
  purple: "\xA75",
  yellow: "\xA7e",
  gray: "\xA77",
  darkGray: "\xA78",
  white: "\xA7f",
  bold: "\xA7l",
  reset: "\xA7r",
};

class PMMPCore {
  static plugins = new Map();
  static pluginStates = new Map();
  static db = null;
  static initialized = false;

  static registerPlugin(plugin) {
    if (!plugin.name) {
      console.warn(`${Color.red}[PMMPCore] Plugin without name detected${Color.reset}`);
      return false;
    }

    if (this.plugins.has(plugin.name)) {
      console.warn(`${Color.red}[PMMPCore] Plugin ${plugin.name} already registered${Color.reset}`);
      return false;
    }

    this.plugins.set(plugin.name, plugin);
    this.pluginStates.set(plugin.name, {
      enabled: false,
      reason: "Registered",
    });
    console.log(`${Color.green}[PMMPCore] Plugin ${plugin.name} v${plugin.version || '1.0.0'} registered${Color.reset}`);
    return true;
  }

  static getPlugin(name) {
    return this.plugins.get(name);
  }

  static getPlugins() {
    return Array.from(this.plugins.values());
  }

  static getPluginState(name) {
    return this.pluginStates.get(name) || { enabled: false, reason: "Unknown plugin state" };
  }

  static getPluginSummaries() {
    return this.getPlugins().map((plugin) => ({
      ...plugin,
      state: this.getPluginState(plugin.name),
    }));
  }

  static enableAll() {
    if (!this.initialized || !this.db) {
      console.error(`${Color.red}[PMMPCore] Core not initialized. Aborting plugin enable phase.${Color.reset}`);
      for (const plugin of this.plugins.values()) {
        this.pluginStates.set(plugin.name, {
          enabled: false,
          reason: "PMMPCore is not initialized",
        });
      }
      return;
    }

    let enabledCount = 0;
    let errorCount = 0;

    for (const plugin of this.plugins.values()) {
      try {
        if (!this.validateDependencies(plugin)) {
          this.pluginStates.set(plugin.name, {
            enabled: false,
            reason: "Dependency validation failed",
          });
          errorCount++;
          continue;
        }

        if (plugin.onEnable && typeof plugin.onEnable === 'function') {
          plugin.onEnable();
          enabledCount++;
          this.pluginStates.set(plugin.name, {
            enabled: true,
            reason: "Enabled successfully",
          });
          console.log(`${Color.green}[PMMPCore] ${plugin.name} enabled${Color.reset}`);
        } else {
          this.pluginStates.set(plugin.name, {
            enabled: true,
            reason: "No onEnable hook; marked as enabled",
          });
        }
      } catch (error) {
        this.pluginStates.set(plugin.name, {
          enabled: false,
          reason: `Enable error: ${error.message}`,
        });
        errorCount++;
        console.error(`${Color.red}[PMMPCore] Error enabling ${plugin.name}: ${error.message}${Color.reset}`);
      }
    }

    console.log(`${Color.aqua}[PMMPCore] Plugin loading complete: ${enabledCount} enabled, ${errorCount} errors${Color.reset}`);
  }

  static disableAll() {
    let disabledCount = 0;

    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.onDisable && typeof plugin.onDisable === 'function') {
          plugin.onDisable();
          disabledCount++;
          this.pluginStates.set(plugin.name, {
            enabled: false,
            reason: "Disabled successfully",
          });
          console.log(`${Color.yellow}[PMMPCore] ${plugin.name} disabled${Color.reset}`);
        }
      } catch (error) {
        console.error(`${Color.red}[PMMPCore] Error disabling ${plugin.name}: ${error.message}${Color.reset}`);
      }
    }

    console.log(`${Color.aqua}[PMMPCore] ${disabledCount} plugins disabled${Color.reset}`);
  }

  static initialize(databaseManager) {
    if (this.initialized) {
      console.warn(`${Color.yellow}[PMMPCore] Already initialized${Color.reset}`);
      return;
    }

    this.db = databaseManager;
    this.initialized = true;
    console.log(`${Color.green}[PMMPCore] Core system initialized${Color.reset}`);
  }

  static validateDependencies(plugin) {
    if (!plugin.depend && !plugin.softdepend) return true;

    const errors = [];
    const warnings = [];

    if (plugin.depend) {
      for (const dep of plugin.depend) {
        if (dep === "PMMPCore") {
          if (!this.initialized || !this.db) {
            errors.push(`PMMPCore is required but not initialized`);
          }
          continue;
        }
        if (!this.plugins.has(dep)) {
          errors.push(`Missing required dependency: ${dep}`);
        }
      }
    }

    if (plugin.softdepend) {
      for (const dep of plugin.softdepend) {
        if (dep === "PMMPCore") {
          continue;
        }
        if (!this.plugins.has(dep)) {
          warnings.push(`Missing optional dependency: ${dep}`);
        }
      }
    }

    if (errors.length > 0) {
      console.error(`${Color.red}[PMMPCore] ${plugin.name} failed dependency check: ${errors.join(', ')}${Color.reset}`);
      return false;
    }

    if (warnings.length > 0) {
      console.warn(`${Color.yellow}[PMMPCore] ${plugin.name} warnings: ${warnings.join(', ')}${Color.reset}`);
    }

    return true;
  }
}

world.afterEvents.worldLoad.subscribe(() => {
  console.log(`${Color.aqua}[PMMPCore] World loaded - initializing plugin system${Color.reset}`);
});

export { PMMPCore, Color };
