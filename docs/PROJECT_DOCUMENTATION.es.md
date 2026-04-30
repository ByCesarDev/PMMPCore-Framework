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

- Inicializar DB.
- Inicializar PMMPCore.
- Registrar comandos globales del core.
- Ejecutar `enableAll()` y luego `onStartup(event)` solo en plugins habilitados.

### 3.2 `scripts/PMMPCore.js`

Responsable de:

- Registrar plugins (Map interno).
- Mantener estado de plugins (`enabled` / `blocked`) con razón.
- Validar dependencias (`depend`, `softdepend`).
- Ejecutar ciclo de vida (`onEnable` / `onDisable`).
- Exponer acceso a DB (`PMMPCore.db`).

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

## 4. Ciclo de vida de plugins

Contrato esperado:

- `onEnable()`: preparar estado y suscripciones.
- `onStartup(event)`: registrar comandos/dimensiones/objetos de startup.
- `onDisable()`: flush final y limpieza.

Orden:

1. `PMMPCore.enableAll()` llama `onEnable`.
2. `main.js` itera plugins y ejecuta `onStartup(event)` solo si `pluginState.enabled === true`.
3. En shutdown/reload, `PMMPCore.disableAll()` llama `onDisable`.

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

## 6. Comandos y seguridad básica

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

## 7. Persistencia y esquema de datos

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

## 8. Estructura recomendada para nuevos plugins

```text
scripts/plugins/MyPlugin/
  main.js
  (módulos internos opcionales)
```

Y registrar en:

- `scripts/plugins.js` (import).
- `pluginList` (si se usa para listados/diagnóstico).

## 9. Estado actual y alcance documental

Esta documentación cubre:

- Core PMMPCore.
- Contrato de plugins.
- MultiWorld (archivo dedicado).

Pendiente en detalle:

- EconomyAPI.
- PurePerms.

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

