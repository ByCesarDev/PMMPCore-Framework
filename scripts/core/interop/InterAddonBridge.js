import { system } from "@minecraft/server";
import { Color } from "../../PMMPCore.js";

/**
 * InterAddonBridge — Canal de mensajería y puente de interoperabilidad para Behavior Packs externos.
 * Escucha /scriptevent pmmpcore:* y permite a Addons independientes (.mcpack) interactuar
 * con el Core (Auto-Registro, Persistencia DB/SQL, Permisos, Eventos).
 */
export class InterAddonBridge {
  /**
   * @param {import("../../PMMPCore.js").PMMPCore} coreRef
   */
  constructor(coreRef) {
    this.core = coreRef;
    this.externalPlugins = new Map();
    this.pendingRegistrations = new Map();
    this.subscribed = false;
    this.graceTimer = null;
  }

  listen() {
    if (this.subscribed) return;
    this.subscribed = true;

    system.afterEvents.scriptEventReceive.subscribe((event) => {
      if (!event.id || !event.id.startsWith("pmmpcore:")) return;

      const channel = event.id.slice("pmmpcore:".length);
      let payload = {};
      try {
        if (event.message) {
          payload = JSON.parse(event.message);
        }
      } catch (e) {
        console.warn(`[InterAddonBridge] Failed to parse scriptEvent payload for channel '${channel}': ${e.message}`);
        return;
      }

      this.handleChannel(channel, payload, event);
    });

    console.log(`${Color.green}[InterAddonBridge] Listening for external addon scriptEvents (pmmpcore:*)${Color.reset}`);
  }

  handleChannel(channel, payload, rawEvent) {
    switch (channel) {
      case "handshake":
      case "register_plugin":
        this.handleRegister(payload);
        break;

      case "db_get":
        this.handleDbGet(payload);
        break;

      case "db_set":
        this.handleDbSet(payload);
        break;

      case "sql_query":
        this.handleSqlQuery(payload);
        break;

      case "sql_upsert":
        this.handleSqlUpsert(payload);
        break;

      case "perm_check":
        this.handlePermCheck(payload);
        break;

      case "event_emit":
        this.handleEventEmit(payload);
        break;

      case "handshake_ack":
      case "db_response":
      case "sql_response":
      case "perm_response":
      case "bus_event":
        // Canales de respuesta salientes del Core hacia Addons — ignorados en InterAddonBridge
        break;

      default:
        console.warn(`${Color.yellow}[InterAddonBridge] Unknown channel: pmmpcore:${channel}${Color.reset}`);
        break;
    }
  }

  handleRegister(payload) {
    const pluginName = payload.name || payload.plugin;
    if (!pluginName) {
      console.warn(`[InterAddonBridge] Invalid registration request: missing plugin name`);
      return;
    }

    const manifest = {
      name: pluginName,
      version: payload.version || "1.0.0",
      description: payload.description || "External Behavior Pack Addon",
      depend: Array.isArray(payload.depend) ? payload.depend : [],
      softdepend: Array.isArray(payload.softdepend) ? payload.softdepend : [],
      isExternal: true,
      registeredAt: Date.now(),
    };

    if (payload.requestId) {
      this.pendingRegistrations.set(pluginName, {
        manifest,
        requestId: payload.requestId,
      });
    } else {
      this.externalPlugins.set(pluginName, manifest);
      if (typeof this.core.registerExternalPlugin === "function") {
        this.core.registerExternalPlugin(manifest, true);
      }
    }

    this.processPendingRegistrations();
  }

  processPendingRegistrations() {
    for (const [pluginName, item] of Array.from(this.pendingRegistrations.entries())) {
      const result = this.core.registerExternalPlugin(item.manifest, false);

      if (result?.success) {
        this.externalPlugins.set(pluginName, item.manifest);
        this.pendingRegistrations.delete(pluginName);

        if (item.requestId) {
          try {
            system.sendScriptEvent("pmmpcore:handshake_ack", JSON.stringify({
              requestId: item.requestId,
              success: true,
              coreVersion: this.core.apiVersion,
              pluginName,
            }));
          } catch (_) {}
        }
      }
    }

    if (this.pendingRegistrations.size > 0 && !this.graceTimer) {
      this.graceTimer = system.runTimeout(() => {
        this.graceTimer = null;
        this.flushPendingRegistrations(true);
      }, 10);
    }
  }

  flushPendingRegistrations(isFinal = false) {
    this.processPendingRegistrations();

    if (isFinal) {
      for (const [pluginName, item] of Array.from(this.pendingRegistrations.entries())) {
        const result = this.core.registerExternalPlugin(item.manifest, true);
        this.pendingRegistrations.delete(pluginName);

        if (item.requestId) {
          try {
            system.sendScriptEvent("pmmpcore:handshake_ack", JSON.stringify({
              requestId: item.requestId,
              success: false,
              error: result?.error || "Dependency validation failed",
              coreVersion: this.core.apiVersion,
              pluginName,
            }));
          } catch (_) {}
        }
      }
    }
  }

  handleDbGet(payload) {
    if (!payload.requestId || !payload.key) return;
    const value = this.core.db?.get(payload.key) ?? null;
    try {
      system.sendScriptEvent("pmmpcore:db_response", JSON.stringify({
        requestId: payload.requestId,
        success: true,
        key: payload.key,
        value,
      }));
    } catch (e) {
      console.error(`[InterAddonBridge] db_get error: ${e.message}`);
    }
  }

  handleDbSet(payload) {
    if (!payload.key) return;
    this.core.db?.set(payload.key, payload.value);
    if (payload.flush) {
      this.core.db?.flush();
    }
    if (payload.requestId) {
      try {
        system.sendScriptEvent("pmmpcore:db_response", JSON.stringify({
          requestId: payload.requestId,
          success: true,
          key: payload.key,
        }));
      } catch (_) {}
    }
  }

  handleSqlQuery(payload) {
    if (!payload.requestId || !payload.sql) return;
    try {
      const rel = this.core.createRelationalEngine();
      const rows = rel.executeQuery(payload.sql);
      system.sendScriptEvent("pmmpcore:sql_response", JSON.stringify({
        requestId: payload.requestId,
        success: true,
        rows,
      }));
    } catch (e) {
      try {
        system.sendScriptEvent("pmmpcore:sql_response", JSON.stringify({
          requestId: payload.requestId,
          success: false,
          error: e.message,
        }));
      } catch (_) {}
    }
  }

  handleSqlUpsert(payload) {
    if (!payload.table || !payload.id || !payload.data) return;
    try {
      const rel = this.core.createRelationalEngine();
      rel.upsert(payload.table, payload.id, payload.data);
      if (payload.requestId) {
        system.sendScriptEvent("pmmpcore:sql_response", JSON.stringify({
          requestId: payload.requestId,
          success: true,
        }));
      }
    } catch (e) {
      if (payload.requestId) {
        try {
          system.sendScriptEvent("pmmpcore:sql_response", JSON.stringify({
            requestId: payload.requestId,
            success: false,
            error: e.message,
          }));
        } catch (_) {}
      }
    }
  }

  handlePermCheck(payload) {
    if (!payload.requestId || !payload.playerName || !payload.node) return;
    try {
      const perms = this.core.getPermissionService();
      const allowed = perms ? perms.has(payload.playerName, payload.node, payload.worldName || "") : true;
      system.sendScriptEvent("pmmpcore:perm_response", JSON.stringify({
        requestId: payload.requestId,
        allowed,
      }));
    } catch (e) {
      try {
        system.sendScriptEvent("pmmpcore:perm_response", JSON.stringify({
          requestId: payload.requestId,
          allowed: false,
          error: e.message,
        }));
      } catch (_) {}
    }
  }

  handleEventEmit(payload) {
    const eventName = payload.event || payload.eventType || payload.name;
    const data = payload.payload || payload.data || {};
    if (!eventName) return;

    this.core.emit(eventName, data, payload.options || {});

    try {
      system.sendScriptEvent("pmmpcore:bus_event", JSON.stringify({
        event: eventName,
        payload: data,
      }));
    } catch (_) {}
  }

  getExternalPlugins() {
    return Array.from(this.externalPlugins.values());
  }
}
