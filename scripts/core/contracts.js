/**
 * Contratos ligeros del core público.
 * En Bedrock Script API usamos clases/objetos y JSDoc en lugar de interfaces reales.
 */

/**
 * @typedef {"stable" | "experimental" | "internal"} ApiStability
 */

/**
 * @typedef {{
 *   id: string,
 *   pluginName?: string,
 *   label?: string,
 *   once?: boolean,
 *   handler: (event: import("./events/Event.js").CoreEvent) => void
 * }} EventSubscriptionDefinition
 */

/**
 * @typedef {{
 *   id: string,
 *   delay?: number,
 *   interval?: number | null,
 *   owner?: string,
 *   label?: string,
 *   callback: () => void
 * }} SchedulerTaskDefinition
 */

/**
 * @typedef {{
 *   pluginName: string,
 *   version?: string,
 *   apiStability?: ApiStability,
 *   getLogger: () => import("./observability/ObservabilityService.js").CoreLogger,
 *   getEventBus: () => import("./events/EventBus.js").EventBus,
 *   getCommandBus: () => import("./commands/CommandBus.js").CommandBus,
 *   getScheduler: () => import("./scheduler/TaskScheduler.js").TaskScheduler,
 *   getPermissionService: () => import("./permissions/PurePermsPermissionService.js").PurePermsPermissionService | null,
 *   getDataProvider: () => import("../PMMPDataProvider.js").PMMPDataProvider | null,
 *   createRelationalEngine: () => import("../db/RelationalEngine.js").RelationalEngine,
 *   getStorage: () => import("../DatabaseManager.js").DatabaseManager | null,
 * }} PluginContext
 */

export {};
