# 🧠 🧱 PROYECTO: **PMMPCore (Framework tipo PocketMine para Bedrock)**

## 🎯 Objetivo principal

Crear un sistema modular para **Minecraft Bedrock Edition** que permita:

* Simular plugins estilo **PocketMine-MP**
* Tener un **Core obligatorio**
* Instalar plugins de forma sencilla
* Crear un **ecosistema reutilizable**
* Permitir monetización (plugins y packs)

---

# 🔥 CONCEPTO CLAVE

> No es un addon cualquiera
> es un **framework modular dentro de Bedrock**

---

# 🧩 ARQUITECTURA GENERAL

```plaintext
PMMPCore/
 ├── core/
 ├── db/
 ├── api/
 ├── generated/
 │    └── plugins.js        ✅ (runtime real)
 ├── plugins/
 │    ├── EconomyAPI/
 │    ├── PurePerms/
 │    ├── Multiworld/
 │    └── ...
 ├── plugins.json           ❌ (solo builder)
 └── main.js
```

---

# ⚙️ COMPONENTES PRINCIPALES

## 🔹 1. PMMPCore (el núcleo)

Es el sistema base que:

* Maneja la base de datos
* Registra plugins
* Expone API global
* Controla ciclo de vida (`onEnable`, `onDisable`)
* Es dependencia obligatoria

---

## 🔹 2. Sistema de Plugins (simulado)

Debido a limitaciones de Bedrock:

* ❌ No carga plugins dinámicamente
* ✅ Usa **imports generados automáticamente**

---

## 🔹 3. plugins.json (SOLO BUILD)

```json
{
  "plugins": [
    "EconomyAPI",
    "PurePerms",
    "Multiworld"
  ]
}
```

👉 Este archivo:

* ❌ NO lo usa el juego
* ✅ SOLO lo usa el builder

---

## 🔹 4. Builder (pieza clave 🔥)

Script en Node.js que:

1. Lee `plugins.json`
2. Genera:

```js
// generated/plugins.js

import "../plugins/EconomyAPI/main.js";
import "../plugins/PurePerms/main.js";
import "../plugins/Multiworld/main.js";

export const pluginList = [
  "EconomyAPI",
  "PurePerms",
  "Multiworld"
];
```

👉 Este archivo SÍ lo usa Bedrock

---

## 🔹 5. Plugin Registry (PMMPCore)

```js
class PMMPCore {
  static plugins = new Map();

  static registerPlugin(plugin) {
    this.plugins.set(plugin.name, plugin);
  }

  static getPlugin(name) {
    return this.plugins.get(name);
  }

  static getPlugins() {
    return Array.from(this.plugins.values());
  }

  static enableAll() {
    for (const plugin of this.plugins.values()) {
      plugin.onEnable?.();
    }
  }
}
```

---

## 🔹 6. Carga de plugins

```js
import "./generated/plugins.js";

PMMPCore.enableAll();
```

👉 Esto simula un loader real

---

## 🔹 7. Plugins

Cada plugin vive en:

```plaintext
/plugins/Nombre/
```

Ejemplo:

```js
PMMPCore.registerPlugin({
  name: "EconomyAPI",
  version: "1.0.0",

  onEnable() {
    console.warn("[EconomyAPI] Enabled");
  }
});
```

---

# 🗄️ SISTEMA DE DATOS

## 🔹 Base: DynamicProperties

* Guardado dentro del mundo
* Compatible con cualquier usuario
* Sin servidores externos

---

## 🔹 Estrategias

* JSON compacto:

  ```js
  { m: 500, r: "admin" }
  ```
* Namespacing:

  ```
  core:player:Cesar
  ```
* Minimizar uso de espacio

---

# 🧠 API DEL CORE

Todos los plugins usan:

```js
PMMPCore.getPlugin("EconomyAPI")

PMMPCore.db.get(...)
PMMPCore.db.set(...)

PMMPCore.getPlugins()
```

---

# 🔗 DEPENDENCIAS

Ejemplo conceptual:

```js
{
  depend: ["PMMPCore"],
  softdepend: ["EconomyAPI"]
}
```

Validado en `enableAll()`

---

# 💬 COMANDO `/plugins` o `/pl`

```js
import { world } from "@minecraft/server";

world.beforeEvents.chatSend.subscribe((event) => {
  const msg = event.message.trim();

  if (msg === "/pl" || msg === "/plugins") {
    event.cancel = true;

    const plugins = PMMPCore.getPlugins();

    const list = plugins
      .map(p => `§a${p.name} §7v${p.version}`)
      .join("§r, ");

    event.sender.sendMessage(`§6Plugins (${plugins.length}): ${list}`);
  }
});
```

---

## Resultado

```plaintext
Plugins (3): EconomyAPI v1.0.0, PurePerms v1.2.0, Multiworld v0.9.0
```

---

# 🧱 SISTEMAS DEL CORE

PMMPCore debe incluir o exponer:

* 🗄️ Database Manager
* 👤 User wrapper (opcional)
* 🔐 Permisos (o base para PurePerms)
* 💰 Economía (o integración)
* 🧾 Command Manager
* 🔄 Event Bus interno
* ⚡ Scheduler centralizado

---

# 🚀 ROADMAP DE PLUGINS

## 🔹 Fase 1

1. Multiworld
2. PurePerms
3. CommandManager
4. PureChat

## 🔹 Fase 2

5. EconomyAPI
6. WarpGUI
7. Portals

## 🔹 Fase 3

8. SignShop
9. CPlots

## 🔹 Fase 4

10. ScoreHub
11. WelcomeMessage

---

# 💰 MONETIZACIÓN

## Gratis

* PMMPCore
* plugins básicos

## Premium

* EconomyAPI Pro
* PlotSystem
* AntiCheat

## Packs

* Survival Pack
* RPG Pack
* Prison Pack

---

# ⚠️ LIMITACIONES CLAVE

Debido a Bedrock:

* ❌ No acceso a archivos
* ❌ No carga dinámica real
* ❌ No plugins drop-in reales

👉 Solución:

✔ Builder
✔ imports JS generados

---

# 💡 EXPERIENCIA DEL USUARIO

## Modo básico

* instala plugins manualmente

## Modo PRO (ideal)

* selecciona plugins
* builder genera addon
* instala
* listo

---

# 🧠 DIFERENCIA CLAVE

No estás haciendo:

❌ un addon común

Estás haciendo:

> 🔥 un sistema modular tipo servidor dentro de Bedrock

---

# 🚀 VISIÓN FINAL

Esto puede convertirse en:

* estándar tipo PMMP para Bedrock
* ecosistema de plugins
* base para otros devs
* sistema comercial

---

# 💬 RESUMEN FINAL

👉 PMMPCore es:

* el núcleo
* la base de datos
* el sistema de plugins
* la API compartida
* el runtime completo

👉 Plugins son:

* módulos independientes
* dependientes del Core
* cargados vía JS generado

👉 Builder es:

* el puente entre config y ejecución


### 🚀 Publishing & Monetization

**PMMPCore** no es solo un framework; es una plataforma diseñada para que los desarrolladores puedan distribuir y monetizar sus creaciones de manera profesional.

#### 📦 ¿Cómo publicar mi plugin?
Para asegurar la calidad y estabilidad del ecosistema, todos los plugins que deseen usar el sello oficial de **PMMPCore** deberán seguir este flujo:

1.  **Registro:** Sube tu plugin a nuestra web oficial (próximamente).
2.  **Revisión:** Nuestro equipo verificará que el código sea seguro y no interfiera con el rendimiento del Core.
3.  **Distribución:** Una vez aprobado, nosotros nos encargamos de publicarlo en **CurseForge** (y su sincronización automática con **MCPEDL**).

#### 💰 Modelo de Monetización (90/10)
Creemos en el trabajo de los creadores. Por eso, hemos establecido un modelo de reparto de ingresos altamente competitivo:

* **90% para el Autor:** El desarrollador del plugin recibe la gran mayoría de las ganancias generadas por descargas y puntos en CurseForge.
* **10% para el Core:** Esta pequeña comisión se reinvierte en el mantenimiento de los servidores de la web, actualizaciones del Core y soporte técnico.
* **Reconocimiento Total:** Al publicar en CurseForge, serás añadido oficialmente como **Contribuidor**, garantizando que tu nombre y créditos de creación estén siempre visibles en las plataformas de descarga.

#### 🔐 Permisos y Licencias
* **PMMPCore (El Núcleo):** Distribuido bajo la **Licencia MIT**. Es libre de usar, modificar y estudiar.
* **Plugins Externos:** El uso de las APIs avanzadas de PMMPCore requiere un token de validación o permiso de afiliación gestionado a través de nuestra plataforma. Esto garantiza que el ecosistema se mantenga libre de fragmentación y versiones piratas que puedan dañar los mundos de los usuarios.

> **Nota:** Los plugins creados de forma independiente y no afiliados no podrán usar las marcas registradas de PMMPCore ni acceder al sistema de distribución automática.