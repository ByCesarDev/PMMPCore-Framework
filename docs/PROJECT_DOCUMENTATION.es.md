# PMMPCore - Documentación del Proyecto

Idioma: [English](PROJECT_DOCUMENTATION.md) | **Español**

## 1. Resumen general

PMMPCore es un framework para Minecraft Bedrock que estandariza el desarrollo modular de funcionalidades tipo plugin dentro de los límites de la Script API.

Objetivos:

- Unificar arquitectura y ciclo de vida.
- Reducir acoplamiento entre módulos.
- Centralizar persistencia y comandos.
- Facilitar mantenimiento y escalabilidad.

## 2. Limitaciones de Bedrock y decisiones de diseño

### Limitaciones relevantes

- No existe carga dinámica real de scripts en runtime.
- Acceso a archivos limitado o no disponible en juego.
- Persistencia principal vía Dynamic Properties.

### Decisiones de arquitectura

- Carga estática de plugins desde `scripts/plugins.js`.
- Registro de plugins en `PMMPCore.registerPlugin(...)`.
- Inicio coordinado desde `scripts/main.js`.
- Persistencia centralizada vía `DatabaseManager`.

## 3. Componentes del sistema

### 3.1 `scripts/main.js`

Responsable de:

- Inicializar la DB compartida (`DatabaseManager`).
- Inicializar `PMMPCore` y su service registry.
- Registrar comandos de diagnóstico del core.
- Ejecutar `enableAll()` y hooks de fase temprana.
- Diferir inicialización **dependiente del mundo** a `world.afterEvents.worldLoad` (porque Dynamic Properties no están disponibles en “early execution”).

### 3.2 `scripts/PMMPCore.js`

Responsable de:

- Registrar plugins (Map interno).
- Mantener estado de plugins (`enabled` / `blocked`) con razón.
- Validar dependencias (`depend`, `softdepend`).
- Ejecutar ciclo de vida (`onEnable` / `onDisable`).
- Exponer acceso a DB (`PMMPCore.db`) y servicios públicos (EventBus, Scheduler, PermissionService, MigrationService, etc).

### 3.3 `scripts/DatabaseManager.js`

Responsable de:

- Único acceso a Dynamic Properties para datos de aplicación bajo `pmmpcore:*` (caché LRU, dirty, `flush()`, WAL opcional al iniciar flush).
- API genérica (`get`, `set`, `delete`, `has`); `get` devuelve clones de objetos/arrays.
- Helpers de plugin/jugador.
- API shard de MultiWorld (`mw:index`, `mw:world:*`, `mw:chunks:*`).
- `listPropertySuffixes(prefix)` para motores internos.
- El motor relacional/SQL está en `scripts/db/RelationalEngine.js` y solo usa `DatabaseManager`; `PMMPCore.getDataProvider()` expone `scripts/PMMPDataProvider.js`.
- Documentación de referencia: [DATABASE_GUIDE.es.md](DATABASE_GUIDE.es.md).

### 3.4 `scripts/plugins.js`

Responsable de:

- Importar explícitamente plugins activos.
- Definir la lista oficial cargada en runtime.

### 3.5 `scripts/api/index.js` (superficie de API pública)

Este archivo es el **barrel de exportación público** pensado para autores de plugins (dentro del ecosistema PMMPCore). Re-exporta APIs estables y experimentales para evitar imports profundos.

Ver: `docs/API_PUBLIC_GUIDE.es.md`.

## 4. Ciclo de vida de plugins

Contrato esperado:

- `onLoad()` (opcional): bootstrap ligero; **sin I/O de mundo**.
- `onEnable()`: activar hooks/suscripciones; todavía evitar I/O pesado del mundo.
- `onStartup(event)`: registrar comandos/enums/dimensiones de Bedrock (tareas seguras en fase temprana).
- `onWorldReady()` (recomendado): primer punto **seguro con mundo** (migraciones, leer/escribir `PMMPCore.db`, warmup de RelationalEngine).
- `onDisable()`: limpieza y lógica final sensible a flush.

Orden:

1. (Opcional) `PMMPCore.loadAll()` llama `onLoad` (si existe).
2. `PMMPCore.enableAll()` llama `onEnable`.
3. `main.js` ejecuta `onStartup(event)` solo para plugins habilitados.
4. En `world.afterEvents.worldLoad`, el core emite `world.ready` y llama `onWorldReady()` para plugins habilitados.
5. En shutdown/reload, `PMMPCore.disableAll()` llama `onDisable`.

### Advertencia de “early execution” (crítico)

Bedrock falla si llamas `world.getDynamicProperty` / `world.setDynamicProperty` demasiado temprano (por ejemplo dentro de `beforeEvents.startup` o algunos flujos de `onStartup`). Como `PMMPCore.db` depende de Dynamic Properties, **las primeras lecturas/escrituras deben diferirse** a `world.afterEvents.worldLoad` o más tarde.

Esto está documentado en detalle en: `docs/DATABASE_GUIDE.es.md` (sección “Cuándo puedes llamar a la DB”).

## 5. Modelo de dependencias

### `depend`

- Dependencia obligatoria.
- Si falta, el plugin no se habilita.
- `PMMPCore` se valida como dependencia estricta cuando se declara.

### `softdepend`

- Dependencia opcional.
- Si falta, solo genera warning.

Buenas prácticas:

- Mantener `depend: ["PMMPCore"]` en complementos del ecosistema.
- Verificar plugin opcional antes de usar su API.

## 6. Comandos, permisos y seguridad básica

Recomendado:

- Nombres con namespace: `pmmpcore:<command>`.
- En Bedrock, comandos custom deben ser `namespace:value`.
- Resolver origen con `origin.initiator ?? origin.sourceEntity`.
- Validar `instanceof Player` cuando aplique.
- Mutaciones sensibles dentro de `system.run(...)`.

Comandos core actuales:

- `pmmpcore:plugins`
- `pmmpcore:pl`
- `pmmpcore:pluginstatus <plugin>`
- `pmmpcore:info`
- `pmmpcore:pmmphelp`
- `pmmpcore:diag` (diagnóstico de plataforma: servicios, eventos, scheduler, métricas)
- `pmmpcore:selftest` (smoke tests: KV + capa relacional)

Para comandos de plugins, se recomienda el `CommandBus` (experimental) para registrar/validar/ejecutar de forma consistente.

## 7. Servicios del core (alto nivel)

PMMPCore provee un service registry (interno) y expone servicios a través del facade `PMMPCore`.

Servicios comunes:

- **Persistencia**: `PMMPCore.db` (stable), `PMMPCore.getDataProvider()` (stable), `PMMPCore.createRelationalEngine()` (experimental)
- **Permisos**: `PMMPCore.getPermissionService()` (stable), backend por defecto PurePerms
- **Migraciones**: `PMMPCore.getMigrationService()` (experimental) para upgrades versionados por plugin
- **Eventos**: `PMMPCore.getEventBus()` (experimental)
- **Scheduler**: `PMMPCore.getScheduler()` (experimental), coordinado por `TickCoordinator`
- **Observabilidad**: `PMMPCore.getLogger()` y métricas internas (duración de flush/query/ticks)

## 8. Persistencia y esquema de datos

### Namespace

Todas las claves bajo `pmmpcore:*`.

### Ejemplos de claves

- `pmmpcore:player:<name>`
- `pmmpcore:plugin:<pluginName>`
- `pmmpcore:mw:index`
- `pmmpcore:mw:world:<worldName>`
- `pmmpcore:mw:chunks:<worldName>`

Recomendaciones:

- Guardar estructuras compactas.
- Evitar escrituras innecesarias por tick.
- Usar flush controlado en operaciones masivas.

## 9. Estructura recomendada para nuevos plugins

```text
scripts/plugins/MyPlugin/
  main.js
  (módulos internos opcionales)
```

Y registrar en:

- `scripts/plugins.js` (import).
- `pluginList` (si se usa para listados/diagnóstico).

## 10. Por dónde seguir

Siguiente lectura recomendada:

- **Navegación / arranque**: `README.es.md` y `docs/README.es.md`
- **API pública**: `docs/API_PUBLIC_GUIDE.es.md`
- **Base de datos/persistencia**: `docs/DATABASE_GUIDE.es.md`
- **Guía de autores de plugins**: `docs/PLUGIN_DEVELOPMENT_GUIDE.es.md`
- **Manuales de plugins**: `docs/plugins/`

## 10. Hoja de ruta operativa resumida

### Corto plazo

- Seguir optimizando generación `normal` en MultiWorld.
- Endurecer rutas de error y observabilidad.

### Mediano plazo

- Scaffolding para nuevos plugins.
- Pruebas de regresión de comandos críticos.

### Largo plazo

- Versión estable del framework.
- Documentación completa de complementos base.

