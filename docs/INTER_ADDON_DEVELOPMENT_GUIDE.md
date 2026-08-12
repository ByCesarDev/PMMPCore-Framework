# Standalone Addon (.mcpack) Development Guide for PMMPCore

Language: [Español](INTER_ADDON_DEVELOPMENT_GUIDE.es.md) | **English**

This guide explains how to build and package a **standalone Behavior Pack** (`.mcpack`) that automatically connects to PMMPCore without requiring any code modifications in the core framework.

---

## 🎯 Why Use Standalone Addons?

Instead of asking end users to modify framework source files, standalone addons allow you to distribute plugins as standard Minecraft Bedrock `.mcpack` files.

The user simply:
1. Downloads the Addon `.mcpack` file (e.g., `PureChat.mcpack`, `ScoreHud.mcpack`).
2. Enables it in Minecraft Bedrock's **World Settings**.
3. The Addon performs an automatic Handshake via **InterAddonBridge** using protocol `protocolVersion: 1`.

---

## 🏗️ Standalone Addon Structure

A standalone Addon is a standard Minecraft Bedrock Behavior Pack with the following structure:

```text
MyStandaloneAddon/
├── manifest.json
├── pack_icon.png
└── scripts/
    ├── main.js
    └── PMMPCoreClient.js    <-- Included SDK client module v1.0
```

### 1. `manifest.json`

Your Addon declares required dependencies on `@minecraft/server` and `@minecraft/server-ui`. For addons that intercept chat like `PureChat`, use the Beta module version (`"2.10.0-beta"`) and enable **Beta APIs** in world settings:

```json
{
  "format_version": 2,
  "header": {
    "name": "My Economy Addon",
    "description": "Standalone economy addon for PMMPCore",
    "uuid": "your-uuid-here-1111-2222-333333333333",
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [
    {
      "description": "Addon entry script",
      "type": "script",
      "language": "javascript",
      "uuid": "your-uuid-here-4444-5555-666666666666",
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

### 2. `scripts/main.js` (Addon Logic)

Use `PMMPCoreClient.js` to register your Addon and perform state replication:

```javascript
import { world, system } from "@minecraft/server";
import { PMMPCoreClient } from "./PMMPCoreClient.js";

console.log("[MyAddon] Initializing standalone addon...");

// 1. Handshake auto-registration (Protocol v1)
PMMPCoreClient.register({
  name: "MyEconomyAddon",
  version: "1.0.0",
  description: "Standalone PMMPCore Addon",
  depend: ["PMMPCore"],
  softdepend: ["PurePerms"]
}).then((res) => {
  if (res.success) {
    console.log(`[MyAddon] Connected to PMMPCore v${res.coreVersion}`);
    
    // 2. State replication via key-value DatabaseManager
    PMMPCoreClient.set("myaddon:data", {
      meta: { revision: 1 },
      account: { player: "Steve", balance: 1500 }
    });
    
    // 3. Listen to global bus events re-broadcast by PMMPCore
    PMMPCoreClient.onEvent("pureperms.data_changed", (payload) => {
      console.log(`[MyAddon] Permission event received, revision: ${payload.revision}`);
    });
  } else {
    console.warn(`[MyAddon] PMMPCore connection failed: ${res.error}`);
  }
});
```

---

## 📡 Communication Channels `scriptevent` (Protocol v1)

The **InterAddonBridge** processes the following `/scriptevent` channels:

| Channel `scriptevent` | Expected JSON Payload | Response Emitted by Core |
| :--- | :--- | :--- |
| `pmmpcore:register_plugin` | `{ "requestId": "req1", "name": "MyAddon", "version": "1.0.0", "protocolVersion": 1 }` | `pmmpcore:handshake_ack` |
| `pmmpcore:db_get` | `{ "requestId": "db1", "key": "pureperms:data" }` | `pmmpcore:db_response` |
| `pmmpcore:db_set` | `{ "key": "pureperms:data", "value": { ... }, "flush": true }` | N/A |
| `pmmpcore:sql_query` | `{ "requestId": "sql1", "sql": "SELECT * FROM items" }` | `pmmpcore:sql_response` |
| `pmmpcore:sql_upsert` | `{ "table": "items", "id": "1", "data": { ... } }` | `pmmpcore:sql_response` |
| `pmmpcore:perm_check` | `{ "requestId": "p1", "playerName": "Steve", "node": "admin.cmd" }` | `pmmpcore:perm_response` |
| `pmmpcore:event_emit` | `{ "event": "pureperms.data_changed", "payload": { ... } }` | `pmmpcore:bus_event` |

> ℹ️ **Protocol Note**: Response channels (`handshake_ack`, `db_response`, `sql_response`, `perm_response`, `bus_event`) are processed silently by SDK clients without logging unknown channel warnings.
