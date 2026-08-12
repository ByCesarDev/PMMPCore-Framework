# Guía de Desarrollo de Addons Independientes (.mcpack) para PMMPCore

Idioma: **Español** | [English](INTER_ADDON_DEVELOPMENT_GUIDE.md)

Esta guía explica cómo crear y empaquetar un **Behavior Pack independiente** (`.mcpack`) que se conecte automáticamente a PMMPCore sin requerir modificaciones en el código fuente del paquete principal.

---

## 🎯 ¿Por qué usar Addons Independientes?

En lugar de pedir a los usuarios finales que modifiquen los archivos internos del framework, los Addons independientes permiten distribuir plugins como archivos `.mcpack` estándar de Minecraft Bedrock.

El usuario simplemente:
1. Descarga el archivo `.mcpack` del Addon (ejemplo: `PureChat.mcpack`, `ScoreHud.mcpack`).
2. Lo activa en los **Ajustes del Mundo** de Minecraft Bedrock.
3. El Addon realiza un Handshake automático a través de **InterAddonBridge** usando protocolo `protocolVersion: 1`.

---

## 🏗️ Estructura de un Addon Independiente

Un Addon independiente es un Behavior Pack estándar de Minecraft Bedrock con la siguiente estructura básica:

```text
MiAddonIndependiente/
├── manifest.json
├── pack_icon.png
└── scripts/
    ├── main.js
    └── PMMPCoreClient.js    <-- Módulo cliente SDK v1.0 incluido
```

### 1. `manifest.json`

Tu Addon debe declarar las dependencias necesarias de `@minecraft/server` y `@minecraft/server-ui`. Para addons que interceptan el chat como `PureChat`, se requiere la versión Beta de `@minecraft/server` (`"2.10.0-beta"`) y habilitar **Beta APIs** en los experimentos del mundo:

```json
{
  "format_version": 2,
  "header": {
    "name": "Mi Addon de Economía",
    "description": "Addon de economía independiente para PMMPCore",
    "uuid": "tu-uuid-aqui-1111-2222-333333333333",
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [
    {
      "description": "Script de mi addon",
      "type": "script",
      "language": "javascript",
      "uuid": "tu-uuid-aqui-4444-5555-666666666666",
      "version": [1, 0, 0],
      "entry": "scripts/main.js"
    }
  ],
  "dependencies": [
    {
      "module_name": "@minecraft/server",
      "version": "2.8.0"
    },
    {
      "module_name": "@minecraft/server-ui",
      "version": "2.1.0"
    }
  ]
}
```

---

### 2. `scripts/main.js` (Código del Addon)

Utiliza el cliente unificado `PMMPCoreClient.js` para registrar tu Addon y realizar sincronizaciones de estado en tiempo real:

```javascript
import { world, system } from "@minecraft/server";
import { PMMPCoreClient } from "./PMMPCoreClient.js";

console.log("[MiAddon] Inicializando addon independiente...");

// 1. Auto-registro en PMMPCore (Handshake v1)
PMMPCoreClient.register({
  name: "MiAddonEconomia",
  version: "1.0.0",
  description: "Addon distribuido como .mcpack",
  depend: ["PMMPCore"],
  softdepend: ["PurePerms"]
}).then((res) => {
  if (res.success) {
    console.log(`[MiAddon] Conectado exitosamente a PMMPCore v${res.coreVersion}`);
    
    // 2. Guardar estado con clave-valor (Replicación en DatabaseManager)
    PMMPCoreClient.set("miaddon:data", {
      meta: { revision: 1 },
      account: { player: "Steve", balance: 1500 }
    });
    
    // 3. Suscribirse a eventos de bus global retransmitidos desde PMMPCore
    PMMPCoreClient.onEvent("pureperms.data_changed", (payload) => {
      console.log(`[MiAddon] Evento de permisos recibido, revisión: ${payload.revision}`);
    });
  } else {
    console.warn(`[MiAddon] PMMPCore no encontrado: ${res.error}`);
  }
});
```

---

## 📡 Canales de Comunicación `scriptevent` (Protocolo v1)

El puente de comunicación **InterAddonBridge** procesa los siguientes canales mediante `/scriptevent`:

| Canal `scriptevent` | Payload JSON Esperado | Respuesta emitida por Core |
| :--- | :--- | :--- |
| `pmmpcore:register_plugin` | `{ "requestId": "req1", "name": "MiAddon", "version": "1.0.0", "protocolVersion": 1 }` | `pmmpcore:handshake_ack` |
| `pmmpcore:db_get` | `{ "requestId": "db1", "key": "pureperms:data" }` | `pmmpcore:db_response` |
| `pmmpcore:db_set` | `{ "key": "pureperms:data", "value": { ... }, "flush": true }` | N/A |
| `pmmpcore:sql_query` | `{ "requestId": "sql1", "sql": "SELECT * FROM items" }` | `pmmpcore:sql_response` |
| `pmmpcore:sql_upsert` | `{ "table": "items", "id": "1", "data": { ... } }` | `pmmpcore:sql_response` |
| `pmmpcore:perm_check` | `{ "requestId": "p1", "playerName": "Steve", "node": "admin.cmd" }` | `pmmpcore:perm_response` |
| `pmmpcore:event_emit` | `{ "event": "pureperms.data_changed", "payload": { ... } }` | `pmmpcore:bus_event` |

> ℹ️ **Nota de Protocolo**: Los canales de respuesta salientes (`handshake_ack`, `db_response`, `sql_response`, `perm_response`, `bus_event`) son procesados silenciosamente por los clientes SDK para evitar advertencias de canal en la consola del servidor.

---

## 🔄 Patrón de Caché en RAM con Revisiones Monotónicas

Para addons que requieren rendimiento a latencia cero (como `PureChat` o `ScoreHud`), se recomienda utilizar el patrón de **Revisión Monotónica**:

1. Cargar el estado inicial vía `PMMPCoreClient.get("pureperms:data")`.
2. Suscribirse a `PMMPCoreClient.onEvent("pureperms.data_changed", callback)`.
3. Validar `payload.revision > purePermsRevision` e incrementar el contador local en RAM para mantener sincronización síncrona en 0ms.
