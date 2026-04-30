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

Referencia completa: **[DATABASE_GUIDE.es.md](DATABASE_GUIDE.es.md)** (modelo de persistencia, `RelationalEngine`, SQL, WAL, límites, resolución de problemas).

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

### Caché, buffer dirty y flush

- No uses `PMMPCore.db` (ni `world.getDynamicProperty`) dentro de `onStartup` / arranque temprano: Bedrock lanza *"cannot be used in early execution"*. Usa `world.afterEvents.worldLoad` (o el mismo patrón diferido que EconomyAPI) para la primera lectura/escritura.
- `get()` devuelve un **clon** de objetos/arrays; los cambios no se guardan hasta que llames otra vez a `set()` (o helpers como `setPluginData`).
- La base de datos mantiene caché en RAM y claves **dirty**; `flush()` persiste todo en Dynamic Properties. El core hace auto-flush periódico; puedes llamar **`PMMPCore.db.flush()`** tras operaciones críticas si necesitas persistencia inmediata.
- **`PMMPCore.getDataProvider()`** devuelve una fachada estilo PocketMine (`loadPlayer`, `savePlayer`, `flush`, etc.).
- **`PMMPCore.createRelationalEngine()`** devuelve el motor relacional opcional (tablas, índices, subconjunto SQL) sobre el mismo `DatabaseManager`. También puedes importar desde `scripts/db/index.js`.

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

## 8. Integración de permisos con PurePerms

Si tu plugin expone comandos o acciones administrativas, define nodos de permiso explícitos y valídalos a través de PurePerms.

Reglas recomendadas:

- publicar nodos por feature/subcomando;
- mantener nombres predecibles;
- no meter defaults de permisos de otro plugin dentro del config base de PurePerms;
- si hace falta experiencia plug-and-play, sembrar defaults desde el plugin dueño del feature.

### 8.1 Nomenclatura recomendada

Usar nodos con scope del plugin:

- `pperms.command.myplugin.help`
- `pperms.command.myplugin.info`
- `pperms.command.myplugin.create`
- `pperms.command.myplugin.delete`

Esto mantiene el sistema ordenado y evita colisiones.

### 8.2 Guard de permisos en comandos

Patrón recomendado:

```javascript
function getPurePermsService() {
  const plugin = PMMPCore.getPlugin("PurePerms");
  return plugin?.service ?? null;
}

function guardPermission(player, node) {
  const purePerms = getPurePermsService();
  if (!purePerms) return true; // politica fallback si PurePerms no existe
  const allowed = purePerms.hasPermission(player.name, node, player.dimension?.id ?? null, player);
  if (!allowed) {
    player.sendMessage(`[MyPlugin] You do not have permission: ${node}`);
  }
  return allowed;
}
```

Y antes de cada acción:

```javascript
if (!guardPermission(player, "pperms.command.myplugin.create")) {
  return { status: CustomCommandStatus.Success };
}
```

### 8.3 Permission seed controlado por el plugin

Si tu plugin necesita defaults sensatos para funcionar de entrada, es mejor usar un `permission seed` del propio plugin en vez de editar los defaults de PurePerms.

Ventajas:

- PurePerms sigue siendo genérico;
- cada plugin es dueño de sus nodos;
- solo se agregan permisos faltantes;
- el admin mantiene control manual sobre rangos.

Ejemplo conceptual:

```javascript
const MYPLUGIN_PERMISSION_SEED = {
  Guest: ["pperms.command.myplugin.help", "pperms.command.myplugin.info"],
  Admin: ["pperms.command.myplugin.create", "pperms.command.myplugin.delete"],
};
```

En startup, el plugin puede:

1. detectar si PurePerms está cargado;
2. leer permisos actuales del grupo;
3. agregar solo nodos faltantes;
4. evitar sobreescribir decisiones manuales del administrador.

### 8.4 Reglas para un seed idempotente

Un buen permission seed debe ser:

- **idempotente**: correr varias veces no cambia nada después de la primera;
- **no destructivo**: no borrar ni pisar permisos existentes automáticamente;
- **acotado**: sembrar solo nodos del propio plugin;
- **opcional**: si PurePerms no está, debe saltarse sin romper startup.

## 9. Dependencias entre plugins

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

## 10. Rendimiento

- Evitar escaneos completos del mundo por tick.
- Limitar loops por presupuesto por ciclo.
- Cachear resultados frecuentes.
- En generación de terreno, preferir operaciones por volumen/rango.

## 11. Manejo de errores

- En callbacks de eventos/comandos, envolver operaciones riesgosas en `try/catch`.
- No silenciar errores críticos sin log.
- Distinguir warning recuperable de error bloqueante.

## 12. Checklist de salida

- [ ] Registra correctamente en PMMPCore.
- [ ] No rompe startup si falla una dependencia opcional.
- [ ] Comandos registrados en `onStartup(event)`.
- [ ] Nodos de permisos documentados y validados si el plugin protege acciones.
- [ ] Datos persistidos con namespace claro.
- [ ] Logs útiles de debugging.
- [ ] Documentación mínima en `docs/`.

## 13. Convenciones sugeridas

- Nombres de plugins en PascalCase (`MyPlugin`).
- Comandos en minúsculas.
- Mensajes con prefijo corto (`[MyPlugin]`).
- Separar lógica en módulos si crece el archivo.

## 14. Diseño modular recomendado

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

