# PMMPCore - Guía de Creación de Plugins

Idioma: [English](PLUGIN_DEVELOPMENT_GUIDE.md) | **Español**

## 1) Objetivo y público

Esta guía enseña a construir plugins sólidos para PMMPCore:

- uso correcto del lifecycle
- comandos y permisos
- persistencia y migraciones
- diseño modular y dependencias
- checklist de pruebas y release

Si eres nuevo en el framework, léela completa antes de arrancar tu plugin.

---

## 2) Requisitos previos

- JavaScript para Bedrock Script API
- nociones de `customCommandRegistry`
- lectura base de:
  - `docs/API_PUBLIC_GUIDE.es.md`
  - `docs/DATABASE_GUIDE.es.md`
  - `docs/PLUGIN_MIGRATION_GUIDE.es.md`

---

## 3) Lifecycle explicado en detalle

### `onLoad()`

Úsalo para:

- constantes
- parseo de config
- wiring local de módulos

Evita:

- lecturas/escrituras de Dynamic Properties
- inicialización dependiente del mundo

### `onEnable()`

Úsalo para:

- suscripciones
- setup de estado runtime
- registro de migraciones
- creación de contexto del plugin

### `onStartup(event)`

Úsalo para:

- registro de enums de comandos
- registro de comandos
- tareas de bootstrap de startup

Evita DB aquí.

### `onWorldReady()`

Úsalo para:

- primeras lecturas/escrituras DB
- hidratación de cachés en memoria
- ejecución de migraciones
- setup del motor relacional (si aplica)

### `onDisable()`

Úsalo para:

- desuscribir handlers
- limpiar tareas runtime
- flush final opcional

---

## 4) Estructura recomendada de carpetas

```text
scripts/plugins/MyPlugin/
  main.js
  commands.js
  service.js
  state.js
  config.js
```

Responsabilidades:

- `main.js`: registro + hooks lifecycle
- `commands.js`: registro y routing de comandos
- `service.js`: lógica de negocio + persistencia
- `state.js`: estado compartido (maps/flags/caches)
- `config.js`: constantes y ajustes

---

## 5) Plantilla base (patrón seguro)

```javascript
import { PMMPCore } from "../../api/index.js";
import { registerMyPluginCommands } from "./commands.js";
import { MyPluginService } from "./service.js";

PMMPCore.registerPlugin({
  name: "MyPlugin",
  version: "1.0.0",
  depend: ["PMMPCore"],
  softdepend: [],

  onEnable() {
    this.context = PMMPCore.getPluginContext("MyPlugin", "1.0.0");
    this.service = new MyPluginService();
    this.service.registerMigrations();
  },

  onStartup(event) {
    registerMyPluginCommands(event, this.service);
  },

  onWorldReady() {
    this.service.runMigrations();
    this.service.hydrate();
  },

  onDisable() {
    this.service?.shutdown();
    PMMPCore.db.flush();
  },
});
```

---

## 6) Integración en runtime

Agregar import en `scripts/plugins.js`:

```javascript
import "./plugins/MyPlugin/main.js";
```

Si el repo usa `pluginList`, agrega el nombre para diagnósticos.

---

## 7) Persistencia (KV primero, relacional cuando haga falta)

Ruta principal:

- `PMMPCore.db` (stable)

Operaciones:

- `get`, `set`, `delete`, `has`
- `getPluginData`, `setPluginData`
- `flush`

Comportamiento importante:

- `get()` devuelve clones
- mutar un objeto leído no persiste hasta `set()`
- escrituras pueden quedar en buffer hasta `flush()`

Cuándo usar `flush()`:

- mutaciones administrativas críticas
- batches que deben sobrevivir cierres abruptos

Usa `RelationalEngine` solo si realmente necesitas consultas/indexes avanzados.

---

## 8) Comandos: patrón completo práctico

Guías:

- comandos namespaced (`pmmpcore:...`)
- un comando raíz con subcomandos enum
- validar fuente (`origin.initiator ?? origin.sourceEntity`)
- respuestas claras y accionables

Ejemplo:

```javascript
import {
  Player,
  CustomCommandStatus,
  CommandPermissionLevel,
  CustomCommandParamType,
} from "@minecraft/server";

export function registerMyPluginCommands(event, service) {
  event.customCommandRegistry.registerEnum("pmmpcore:myplugin_subcommand", [
    "help",
    "info",
    "reload",
  ]);

  event.customCommandRegistry.registerCommand(
    {
      name: "pmmpcore:myplugin",
      description: "MyPlugin command root",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.Enum, name: "pmmpcore:myplugin_subcommand" }],
    },
    (origin, subcommand) => {
      const player = origin.initiator ?? origin.sourceEntity;
      if (!(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can run this command." };
      }
      return service.handleCommand(player, (subcommand ?? "help").toLowerCase());
    }
  );
}
```

---

## 9) Integración de permisos

Prioriza la abstracción estable:

```javascript
const perms = PMMPCore.getPermissionService();
```

Nomenclatura recomendada de nodos:

- `pperms.command.myplugin.help`
- `pperms.command.myplugin.info`
- `pperms.command.myplugin.reload`
- `pperms.command.myplugin.admin`

Buenas prácticas:

- nodo por acción
- prefijo consistente
- helper central `guardPermission(...)`
- seed opcional idempotente desde tu plugin

---

## 10) Dependencias y soft dependencies

Ejemplo:

```javascript
depend: ["PMMPCore"],
softdepend: ["EconomyAPI"]
```

Patrón:

```javascript
const economy = PMMPCore.getPlugin("EconomyAPI");
if (!economy) {
  // ruta fallback
}
```

Reglas:

- hard dep -> fail-fast
- soft dep -> degradación elegante

---

## 11) Migraciones de datos

Registrar en `onEnable()`, ejecutar en `onWorldReady()`:

```javascript
registerMigrations() {
  PMMPCore.getMigrationService()?.register("MyPlugin", 1, () => {
    PMMPCore.db.setPluginData("MyPlugin", "schema", { version: 1 });
  });
}

runMigrations() {
  PMMPCore.getMigrationService()?.run("MyPlugin");
}
```

Reglas:

- idempotentes
- poco destructivas
- versionadas y con logs

---

## 12) Rendimiento y watchdog safety

- evita scans completos por tick
- divide trabajo pesado en varios ticks
- cachea consultas repetidas
- usa scheduler (`getScheduler()`) para tareas repetitivas/diferidas
- evita escrituras síncronas masivas en un frame

---

## 13) Manejo de errores y observabilidad

Patrón:

- `try/catch` en handlers de riesgo
- logs con prefijo de plugin
- distinguir warning recuperable vs error bloqueante

Formato sugerido:

- `[MyPlugin][warn] ...`
- `[MyPlugin][error] ...`

Para diagnóstico de plataforma, usar `/pmmpcore:diag`.

---

## 14) Checklist de pruebas antes de release

- [ ] Plugin registra y habilita correctamente.
- [ ] Comandos disponibles y validados.
- [ ] Permisos aplican como se espera.
- [ ] Sin acceso DB en fases tempranas.
- [ ] Migraciones corren en primera carga y no-op en la segunda.
- [ ] Escrituras críticas sobreviven reinicio (puntos de flush verificados).
- [ ] Dependencias opcionales no rompen funcionalidad base.
- [ ] Documentación del plugin actualizada.

---

## 15) Errores comunes y corrección

- **Error:** DB en `onStartup` -> **Solución:** mover a `onWorldReady`
- **Error:** callbacks de comando gigantes -> **Solución:** routing hacia capa service
- **Error:** Dynamic Properties directas -> **Solución:** `PMMPCore.db`
- **Error:** nodos de permiso sin scope -> **Solución:** prefijo por plugin

---

## 16) Estándar mínimo de documentación por plugin

Cada plugin debe incluir:

- objetivo/alcance
- referencia de comandos
- nodos de permisos
- propiedades de configuración
- notas de migración (si cambia esquema)
- troubleshooting básico

---

## 17) FAQ

### ¿Todos los plugins deben usar todos los servicios de PMMPCore?

No. Usa solo lo necesario. Empieza minimal (`db`, comandos, permisos) y agrega scheduler/eventos cuando aporte valor real.

### ¿Dónde debe vivir la lógica de negocio?

En `service.js` (o equivalente). Los handlers de comandos deben ser delgados y centrados en routing/validación.

### ¿Puedo escribir en DB cada tick?

Puedes, pero casi siempre es mala idea. Mantén estado en memoria y persiste por lotes controlados.

### ¿Debo llamar `PMMPCore.db.flush()` todo el tiempo?

Úsalo tras escrituras críticas y en límites controlados (acciones admin, operaciones sensibles a cierre), no en cada acción sin criterio.

### ¿Qué tan detallada debe ser la doc de un plugin?

Lo suficiente para que un dev nuevo pueda instalar, configurar, usar comandos, entender permisos y resolver fallos sin leer el código primero.

