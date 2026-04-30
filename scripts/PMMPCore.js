import { world, system, Player, CustomCommandStatus, CommandPermissionLevel } from "@minecraft/server";
import { PMMPDataProvider } from "./PMMPDataProvider.js";
import { RelationalEngine } from "./db/RelationalEngine.js";
import { MigrationService } from "./db/MigrationService.js";
import { ServiceRegistry } from "./core/ServiceRegistry.js";
import { EventBus } from "./core/events/EventBus.js";
import { CommandBus } from "./core/commands/CommandBus.js";
import { TaskScheduler } from "./core/scheduler/TaskScheduler.js";
import { TickCoordinator } from "./core/TickCoordinator.js";
import { ObservabilityService } from "./core/observability/ObservabilityService.js";
import { PurePermsPermissionService } from "./core/permissions/PurePermsPermissionService.js";

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
  static services = null;
  static apiVersion = "1.0.0";
  static apiSurface = Object.freeze({
    db: "stable",
    dataProvider: "stable",
    relationalEngine: "experimental",
    eventBus: "experimental",
    commandBus: "experimental",
    scheduler: "experimental",
    permissionService: "stable",
    migrationService: "experimental",
    observability: "internal",
  });

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

        plugin.context = this.getPluginContext(plugin.name, plugin.version || "1.0.0");
        if (plugin.onEnable && typeof plugin.onEnable === 'function') {
          plugin.onEnable();
          enabledCount++;
          this.pluginStates.set(plugin.name, {
            enabled: true,
            reason: "Enabled successfully",
          });
          this.emit("plugin.enabled", { pluginName: plugin.name, version: plugin.version || "1.0.0" });
          console.log(`${Color.green}[PMMPCore] ${plugin.name} enabled${Color.reset}`);
        } else {
          this.pluginStates.set(plugin.name, {
            enabled: true,
            reason: "No onEnable hook; marked as enabled",
          });
          this.emit("plugin.enabled", { pluginName: plugin.name, version: plugin.version || "1.0.0" });
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
          this.emit("plugin.disabled", { pluginName: plugin.name });
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
    this.services = new ServiceRegistry();
    const observability = this.services.register("observability", new ObservabilityService(), { stability: "internal" });
    const eventBus = this.services.register("eventBus", new EventBus(observability), { stability: "experimental" });
    const commandBus = this.services.register("commandBus", new CommandBus(observability), { stability: "experimental" });
    const scheduler = this.services.register("scheduler", new TaskScheduler(observability), { stability: "experimental" });
    this.services.register("permissionService", new PurePermsPermissionService(), { stability: "stable" });
    this.services.register("migrationService", new MigrationService(databaseManager, observability), { stability: "experimental" });
    this.services.register("tickCoordinator", new TickCoordinator({ scheduler, observability, db: databaseManager }), { stability: "internal" });
    this.services.register("storage", databaseManager, { stability: "stable" });
    this.initialized = true;
    console.log(`${Color.green}[PMMPCore] Core system initialized${Color.reset}`);
  }

  /** @returns {PMMPDataProvider | null} */
  static getDataProvider() {
    if (!this.db) return null;
    return new PMMPDataProvider(this.db);
  }

  /** @returns {RelationalEngine} */
  static createRelationalEngine() {
    if (!this.db) {
      throw new Error("PMMPCore is not initialized");
    }
    const engine = new RelationalEngine(this.db);
    const observability = this.services?.get("observability");
    engine.setQueryObserver?.((sample) => {
      observability?.recordQuery?.(sample.durationMs, sample.mode, sample.rowCount);
    });
    return engine;
  }

  static getServiceRegistry() {
    return this.services;
  }

  static getEventBus() {
    return this.services?.get("eventBus") ?? null;
  }

  static getCommandBus() {
    return this.services?.get("commandBus") ?? null;
  }

  static getScheduler() {
    return this.services?.get("scheduler") ?? null;
  }

  static getTickCoordinator() {
    return this.services?.get("tickCoordinator") ?? null;
  }

  static getPermissionService() {
    return this.services?.get("permissionService") ?? null;
  }

  static getMigrationService() {
    return this.services?.get("migrationService") ?? null;
  }

  static getLogger(scope = "core") {
    return this.services?.get("observability")?.getLogger(scope) ?? console;
  }

  static getApiMetadata() {
    return {
      version: this.apiVersion,
      surface: this.apiSurface,
      services: this.services?.summary?.() ?? [],
    };
  }

  static getPluginContext(pluginName, version = "1.0.0", apiStability = "stable") {
    return {
      pluginName,
      version,
      apiStability,
      getLogger: () => this.getLogger(pluginName),
      getEventBus: () => this.getEventBus(),
      getCommandBus: () => this.getCommandBus(),
      getScheduler: () => this.getScheduler(),
      getPermissionService: () => this.getPermissionService(),
      getDataProvider: () => this.getDataProvider(),
      createRelationalEngine: () => this.createRelationalEngine(),
      getStorage: () => this.db,
    };
  }

  static emit(type, payload = {}, options = {}) {
    return this.getEventBus()?.emit(type, payload, options) ?? null;
  }

  static registerPermissionBackend(service) {
    this.getPermissionService()?.setBackend?.(service);
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
