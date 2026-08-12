import { system } from "@minecraft/server";

/**
 * PMMPCoreClient v1.0 — Cliente SDK Oficial para Behavior Packs (.mcpack) externos e independientes.
 * Protocol Version: 1
 */
export class PMMPCoreClient {
  static protocolVersion = 1;
  static _connected = false;
  static _coreVersion = null;

  static isConnected() {
    return this._connected;
  }

  static getCoreVersion() {
    return this._coreVersion;
  }

  /**
   * Registra el Addon externo en PMMPCore-Framework.
   * @param {{ name: string, version?: string, description?: string, depend?: string[], softdepend?: string[] }} manifest
   * @returns {Promise<{ success: boolean, coreVersion?: string, error?: string }>}
   */
  static register(manifest) {
    const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    return new Promise((resolve) => {
      let timeoutId;
      const sub = system.afterEvents.scriptEventReceive.subscribe((event) => {
        if (event.id === "pmmpcore:handshake_ack") {
          try {
            const data = JSON.parse(event.message);
            if (data.requestId === requestId) {
              system.afterEvents.scriptEventReceive.unsubscribe(sub);
              if (timeoutId) system.clearRun(timeoutId);
              if (data.success) {
                PMMPCoreClient._connected = true;
                PMMPCoreClient._coreVersion = data.coreVersion || "1.0.0";
                resolve({ success: true, coreVersion: data.coreVersion });
              } else {
                PMMPCoreClient._connected = false;
                resolve({ success: false, error: data.error || "Handshake rejected by PMMPCore" });
              }
            }
          } catch (_) {}
        }
      });

      system.sendScriptEvent("pmmpcore:register_plugin", JSON.stringify({
        requestId,
        name: manifest.name,
        version: manifest.version || "1.0.0",
        description: manifest.description || "External PMMPCore Addon",
        depend: manifest.depend || [],
        softdepend: manifest.softdepend || [],
        protocolVersion: PMMPCoreClient.protocolVersion,
      }));

      timeoutId = system.runTimeout(() => {
        system.afterEvents.scriptEventReceive.unsubscribe(sub);
        PMMPCoreClient._connected = false;
        resolve({ success: false, error: "PMMPCore Core Pack not responding" });
      }, 40);
    });
  }

  /**
   * Obtiene un valor de la base de datos centralizada de PMMPCore.
   * @param {string} key
   * @returns {Promise<unknown>}
   */
  static get(key) {
    const requestId = `db_get_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    return new Promise((resolve) => {
      let timeoutId;
      const sub = system.afterEvents.scriptEventReceive.subscribe((event) => {
        if (event.id === "pmmpcore:db_response") {
          try {
            const data = JSON.parse(event.message);
            if (data.requestId === requestId) {
              system.afterEvents.scriptEventReceive.unsubscribe(sub);
              if (timeoutId) system.clearRun(timeoutId);
              resolve(data.value ?? null);
            }
          } catch (_) {}
        }
      });

      system.sendScriptEvent("pmmpcore:db_get", JSON.stringify({
        requestId,
        key,
      }));

      timeoutId = system.runTimeout(() => {
        system.afterEvents.scriptEventReceive.unsubscribe(sub);
        resolve(null);
      }, 40);
    });
  }

  /**
   * Guarda un valor en la base de datos centralizada de PMMPCore.
   * @param {string} key
   * @param {unknown} value
   */
  static set(key, value) {
    system.sendScriptEvent("pmmpcore:db_set", JSON.stringify({
      key,
      value,
    }));
  }

  /**
   * Ejecuta una consulta SQL en la base de datos relacional del mundo.
   * @param {string} sql
   * @returns {Promise<unknown[]>}
   */
  static querySql(sql) {
    const requestId = `sql_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    return new Promise((resolve, reject) => {
      let timeoutId;
      const sub = system.afterEvents.scriptEventReceive.subscribe((event) => {
        if (event.id === "pmmpcore:sql_response") {
          try {
            const data = JSON.parse(event.message);
            if (data.requestId === requestId) {
              system.afterEvents.scriptEventReceive.unsubscribe(sub);
              if (timeoutId) system.clearRun(timeoutId);
              if (data.success) {
                resolve(data.rows || []);
              } else {
                reject(new Error(data.error || "SQL query failed"));
              }
            }
          } catch (_) {}
        }
      });

      system.sendScriptEvent("pmmpcore:sql_query", JSON.stringify({
        requestId,
        sql,
      }));

      timeoutId = system.runTimeout(() => {
        system.afterEvents.scriptEventReceive.unsubscribe(sub);
        reject(new Error("SQL query timeout: PMMPCore Core Pack did not respond"));
      }, 40);
    });
  }

  /**
   * Guarda o actualiza una fila en la base de datos relacional.
   * @param {string} table
   * @param {string} id
   * @param {Record<string, unknown>} data
   */
  static upsertSql(table, id, data) {
    system.sendScriptEvent("pmmpcore:sql_upsert", JSON.stringify({
      table,
      id,
      data,
    }));
  }

  /**
   * Consulta si un jugador posee un permiso específico en el PermissionService central.
   * @param {string} playerName
   * @param {string} node
   * @param {string} [worldName]
   * @returns {Promise<boolean>}
   */
  static hasPermission(playerName, node, worldName = null) {
    const requestId = `perm_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    return new Promise((resolve) => {
      let timeoutId;
      const sub = system.afterEvents.scriptEventReceive.subscribe((event) => {
        if (event.id === "pmmpcore:perm_response") {
          try {
            const data = JSON.parse(event.message);
            if (data.requestId === requestId) {
              system.afterEvents.scriptEventReceive.unsubscribe(sub);
              if (timeoutId) system.clearRun(timeoutId);
              resolve(!!data.allowed);
            }
          } catch (_) {}
        }
      });

      system.sendScriptEvent("pmmpcore:perm_check", JSON.stringify({
        requestId,
        playerName,
        node,
        worldName,
      }));

      timeoutId = system.runTimeout(() => {
        system.afterEvents.scriptEventReceive.unsubscribe(sub);
        resolve(false);
      }, 40);
    });
  }

  /**
   * Emite un evento global en el EventBus central de PMMPCore.
   * @param {string} eventName
   * @param {Record<string, unknown>} payload
   */
  static emitEvent(eventName, payload = {}) {
    system.sendScriptEvent("pmmpcore:event_emit", JSON.stringify({
      event: eventName,
      payload,
    }));
  }

  /**
   * Suscribe a un evento global transmitido por el EventBus de PMMPCore.
   * @param {string} eventName
   * @param {(payload: any) => void} callback Recibe directamente el payload sin envoltorio de red
   * @returns {() => void} Función de desuscripción
   */
  static onEvent(eventName, callback) {
    const sub = system.afterEvents.scriptEventReceive.subscribe((event) => {
      if (event.id === "pmmpcore:bus_event") {
        try {
          const data = JSON.parse(event.message);
          if (data.event === eventName) {
            callback(data.payload ?? {});
          }
        } catch (_) {}
      }
    });

    return () => {
      system.afterEvents.scriptEventReceive.unsubscribe(sub);
    };
  }
}
