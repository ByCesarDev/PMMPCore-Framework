# PMMPCore - Guia para Crear Plugins

## 1. Objetivo de esta guia

Esta guia explica como crear plugins compatibles con PMMPCore, siguiendo el contrato del core y evitando errores comunes de Bedrock Script API.

## 2. Requisitos

- Conocer JavaScript para Bedrock Script API.
- Entender comandos custom (`customCommandRegistry`).
- Respetar el ciclo de vida de plugins de PMMPCore.

## 3. Estructura minima

Crear carpeta:

```text
scripts/plugins/MyPlugin/
```

Archivo principal:

```text
scripts/plugins/MyPlugin/main.js
```

## 4. Plantilla base de plugin

```javascript
import { PMMPCore } from "../../PMMPCore.js";
import { Player, CustomCommandStatus, CommandPermissionLevel } from "@minecraft/server";

PMMPCore.registerPlugin({
  name: "MyPlugin",
  version: "1.0.0",
  depend: ["PMMPCore"],
  softdepend: [],

  onEnable() {
    console.log("[MyPlugin] Enabled");
  },

  onStartup(event) {
    event.customCommandRegistry.registerCommand(
      {
        name: "pmmpcore:myplugin_ping",
        description: "Basic health command",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const source = origin.initiator ?? origin.sourceEntity;
        if (!(source instanceof Player)) {
          return { status: CustomCommandStatus.Failure, message: "Only players can run this command." };
        }
        source.sendMessage("MyPlugin OK");
        return { status: CustomCommandStatus.Success };
      }
    );
  },

  onDisable() {
    console.log("[MyPlugin] Disabled");
  },
});
```

## 5. Integracion en runtime

Agregar import en `scripts/plugins.js`:

```javascript
import "./plugins/MyPlugin/main.js";
```

Si existe `pluginList`, agregar tambien el nombre del plugin.

## 6. Uso de base de datos

### API general

- `PMMPCore.db.get(key)`
- `PMMPCore.db.set(key, value)`
- `PMMPCore.db.delete(key)`

### API por plugin

- `PMMPCore.db.getPluginData("MyPlugin")`
- `PMMPCore.db.setPluginData("MyPlugin", { ... })`
- `PMMPCore.db.setPluginData("MyPlugin", "setting", value)`

### Recomendaciones

- Namespacing por plugin en estructuras internas.
- Guardar en lote cuando sea posible.
- Evitar escribir cada tick salvo necesidad real.

## 7. Comandos: recomendaciones practicas

- Usa prefijo `pmmpcore:`.
- Define `mandatoryParameters`/`optionalParameters` correctamente.
- Si el comando hace trabajo pesado, dividir en ticks.
- Mensajes de error claros y accionables para el jugador.

## 8. Dependencias entre plugins

Ejemplo:

```javascript
depend: ["PMMPCore"],
softdepend: ["EconomyAPI"]
```

Antes de usar API de otro plugin:

```javascript
const economy = PMMPCore.getPlugin("EconomyAPI");
if (!economy) {
  // fallback o mensaje
}
```

## 9. Buenas practicas de rendimiento

- Evitar scans completos del mundo por tick.
- Limitar loops con presupuestos por ciclo.
- Cachear resultados de operaciones frecuentes.
- En generacion de terreno, preferir operaciones por volumen/rango.

## 10. Manejo de errores

- En callbacks de eventos/comandos, envolver operaciones riesgosas en `try/catch`.
- No silenciar errores criticos sin log.
- Diferenciar warning recuperable de error bloqueante.

## 11. Checklist de salida para un plugin nuevo

- [ ] Se registra correctamente en PMMPCore.
- [ ] No rompe startup si falla una dependencia opcional.
- [ ] Comandos registrados en `onStartup(event)`.
- [ ] Datos persistidos con namespace claro.
- [ ] Logs utiles para depuracion.
- [ ] Documentacion minima del plugin agregada en `docs/`.

## 12. Convenciones sugeridas

- Nombres de plugin en PascalCase (`MyPlugin`).
- Comandos en lowercase.
- Mensajes con prefijo corto del plugin (`[MyPlugin]`).
- Separar logica en modulos si el archivo crece demasiado.
