# PMMPCore - Guía de Creación de Plugins

Idioma: [English](PLUGIN_DEVELOPMENT_GUIDE.md) | **Español**

## 1. Objetivo de esta guía

Explica cómo crear plugins compatibles con PMMPCore respetando el contrato del core y evitando errores comunes de Bedrock Script API.

## 2. Requisitos

- Conocimiento de JavaScript para Bedrock Script API.
- Entender comandos custom (`customCommandRegistry`).
- Respetar ciclo de vida de PMMPCore.

## 3. Estructura mínima

Crear carpeta:

```text
scripts/plugins/MyPlugin/
```

Archivo principal:

```text
scripts/plugins/MyPlugin/main.js
```

## 4. Plantilla base

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

Nota:

- Si declaras `depend: ["PMMPCore"]`, PMMPCore lo trata como estricto y bloqueará el plugin si el core no está inicializado.

## 5. Integración en runtime

Agregar import en `scripts/plugins.js`:

```javascript
import "./plugins/MyPlugin/main.js";
```

Si existe `pluginList`, agregar también el nombre.

## 6. Uso de base de datos

### API general

- `PMMPCore.db.get(key)`
- `PMMPCore.db.set(key, value)`
- `PMMPCore.db.delete(key)`

### API por plugin

- `PMMPCore.db.getPluginData("MyPlugin")`
- `PMMPCore.db.setPluginData("MyPlugin", { ... })`
- `PMMPCore.db.setPluginData("MyPlugin", "setting", value)`

Buenas prácticas:

- Namespacing por plugin.
- Guardar en batch cuando sea posible.
- Evitar escribir por tick sin necesidad real.

## 7. Comandos: Recomendaciones prácticas

- Usar prefijo `pmmpcore:`.
- Bedrock exige formato `namespace:value`.
- Definir bien `mandatoryParameters` y `optionalParameters`.
- Usar `CustomCommandParamType.Enum` para opciones estables y autocompletado.
- Dividir trabajo pesado en ticks.
- Mensajes de error claros y accionables.

### 7.1 Patrón básico (`help`, `info`, acciones)

Patrón recomendado:

- `/pmmpcore:myplugin help`
- `/pmmpcore:myplugin info`
- `/pmmpcore:myplugin <action> ...`

Con un solo comando raíz y subcomandos en enum:

- experiencia consistente;
- autocompletado;
- handlers desacoplados por acción.

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

## 9. Rendimiento

- Evitar escaneos completos del mundo por tick.
- Limitar loops por presupuesto por ciclo.
- Cachear resultados frecuentes.
- En generación de terreno, preferir operaciones por volumen/rango.

## 10. Manejo de errores

- En callbacks de eventos/comandos, envolver operaciones riesgosas en `try/catch`.
- No silenciar errores críticos sin log.
- Distinguir warning recuperable de error bloqueante.

## 11. Checklist de salida

- [ ] Registra correctamente en PMMPCore.
- [ ] No rompe startup si falla una dependencia opcional.
- [ ] Comandos registrados en `onStartup(event)`.
- [ ] Datos persistidos con namespace claro.
- [ ] Logs útiles de debugging.
- [ ] Documentación mínima en `docs/`.

## 12. Convenciones sugeridas

- Nombres de plugins en PascalCase (`MyPlugin`).
- Comandos en minúsculas.
- Mensajes con prefijo corto (`[MyPlugin]`).
- Separar lógica en módulos si crece el archivo.

## 13. Diseño modular recomendado

Evitar un `main.js` gigante. Preferir módulos por responsabilidad.

Estructura sugerida:

```text
scripts/plugins/MyPlugin/
  main.js
  commands.js
  service.js
  state.js
  config.js
```

Responsabilidades:

- `main.js`: registro del plugin + hooks de ciclo de vida.
- `commands.js`: registro y handlers de comandos.
- `service.js`: lógica de negocio.
- `state.js`: estado compartido en runtime.
- `config.js`: constantes y enums.

Regla práctica:

- handlers de comandos llaman servicios, no lógica de negocio extensa inline;
- persistencia centralizada en capa de servicio;
- evitar imports circulares.

