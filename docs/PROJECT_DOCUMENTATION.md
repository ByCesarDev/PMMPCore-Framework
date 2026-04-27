# PMMPCore - Documentacion del Proyecto

## 1. Vision general

PMMPCore es un framework para Minecraft Bedrock que busca estandarizar el desarrollo modular de funcionalidades tipo "plugin", dentro de las limitaciones de la Script API.

Objetivos:

- Unificar arquitectura y ciclo de vida.
- Reducir acoplamiento entre modulos.
- Centralizar persistencia y comandos.
- Facilitar mantenimiento y escalabilidad.

## 2. Limitaciones de Bedrock y decisiones de diseno

### Limitaciones relevantes

- No hay carga dinamica de scripts en runtime.
- El acceso a archivos es limitado/no disponible en entorno de juego.
- Persistencia principal mediante Dynamic Properties.

### Decisiones de arquitectura

- Carga estatica de plugins desde `scripts/plugins.js`.
- Registro de plugins en `PMMPCore.registerPlugin(...)`.
- Startup coordinado desde `scripts/main.js`.
- Persistencia centralizada via `DatabaseManager`.

## 3. Componentes del sistema

### 3.1 `scripts/main.js`

Responsable de:

- Inicializar DB.
- Inicializar PMMPCore.
- Registrar comandos globales del core.
- Ejecutar `enableAll()` y luego hooks `onStartup(event)` de cada plugin.

### 3.2 `scripts/PMMPCore.js`

Responsable de:

- Registrar plugins (`Map` interna).
- Validar dependencias (`depend`, `softdepend`).
- Ejecutar ciclo de vida de plugins (`onEnable`/`onDisable`).
- Exponer acceso a DB (`PMMPCore.db`).

### 3.3 `scripts/DatabaseManager.js`

Responsable de:

- Lectura/escritura de datos con namespace `pmmpcore:*`.
- API generica (`get`, `set`, `delete`, `has`).
- Helpers de plugin/player.
- API sharded de MultiWorld (`mw:index`, `mw:world:*`, `mw:chunks:*`).

### 3.4 `scripts/plugins.js`

Responsable de:

- Importar todos los plugins activos de forma explicita.
- Definir la "lista oficial" cargada en runtime.

## 4. Ciclo de vida de plugins

Contrato esperado:

- `onEnable()`: preparar estado y suscripciones runtime.
- `onStartup(event)`: registrar comandos/dimensiones/objetos que requieren startup.
- `onDisable()`: flush/limpieza final.

Orden:

1. `PMMPCore.enableAll()` llama `onEnable`.
2. `main.js` recorre plugins y ejecuta `onStartup(event)`.
3. Al apagar/recargar, `PMMPCore.disableAll()` llama `onDisable`.

## 5. Modelo de dependencias

### `depend`

- Dependencia obligatoria.
- Si falta, el plugin no se habilita.

### `softdepend`

- Dependencia opcional.
- Si falta, solo genera warning.

Buenas practicas:

- Mantener `depend: ["PMMPCore"]` en plugins del ecosistema.
- Verificar plugin opcional antes de usar su API.

## 6. Comandos y seguridad basica

Se recomienda:

- Nombres namespaced: `pmmpcore:<comando>`.
- Resolver origen con `origin.initiator ?? origin.sourceEntity`.
- Validar `instanceof Player` cuando aplica.
- En mutaciones sensibles, ejecutar desde `system.run(...)`.

## 7. Persistencia y esquema de datos

### Namespace

Todas las claves bajo `pmmpcore:*`.

### Ejemplos de claves

- `pmmpcore:player:<name>`
- `pmmpcore:plugin:<pluginName>`
- `pmmpcore:mw:index`
- `pmmpcore:mw:world:<worldName>`
- `pmmpcore:mw:chunks:<worldName>`

### Recomendaciones

- Guardar estructuras compactas.
- Evitar writes innecesarios por tick.
- Usar flush controlado en operaciones masivas.

## 8. Estructura recomendada para nuevos plugins

```text
scripts/plugins/MyPlugin/
  main.js
  (modulos internos opcionales)
```

Y registrar en:

- `scripts/plugins.js` (import).
- `pluginList` (si se usa para listing/diagnostico).

## 9. Estado actual y alcance de documentacion

Esta documentacion cubre:

- Core PMMPCore.
- Contrato de plugins.
- MultiWorld (documentado en archivo dedicado).

Pendiente de documentar en detalle:

- EconomyAPI.
- PurePerms.

## 10. Roadmap operativo resumido

### Corto plazo

- Seguir optimizando generacion de MultiWorld tipo `normal`.
- Endurecer rutas de error y observabilidad.

### Mediano plazo

- Scaffolding para plugins nuevos.
- Tests de regresion de comandos criticos.

### Largo plazo

- Version estable del framework.
- Documentacion completa de todos los plugins base.
