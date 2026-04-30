# Guía de migración de plugins a PMMPCore API v1

Idioma: **Español** | [English](PLUGIN_MIGRATION_GUIDE.md)

Esta guía te ayuda a migrar plugins existentes (patrones legacy) al estilo PMMPCore v1 con el menor riesgo de regresiones.

---

## 1) Por qué migrar

Migrar a patrones v1 te da:

- acceso seguro al mundo por lifecycle (`onWorldReady`)
- persistencia centralizada (`PMMPCore.db` + migraciones opcionales)
- abstracción estable de permisos (`getPermissionService()`)
- mejor separación de responsabilidades en comandos (`onStartup`)
- mayor mantenibilidad y compatibilidad entre plugins del ecosistema

---

## 2) Mapa rápido legacy -> v1

- Lecturas DB en arranque temprano -> mover a `onWorldReady()`
- Dynamic Properties directas -> usar `PMMPCore.db`
- Internals directos de PurePerms -> usar `PMMPCore.getPermissionService()`
- Intervalos/timeouts ad-hoc -> usar `PMMPCore.getScheduler()`
- Cambios de esquema implícitos -> migraciones explícitas con `MigrationService`
- Startup mezclado -> separar:
  - `onStartup(event)` para comandos/enums
  - `onWorldReady()` para hidratación y lógica con I/O de mundo

---

## 3) Estrategia de migración (orden recomendado)

1. **Estabiliza lifecycle primero**
2. **Migra la persistencia**
3. **Migra permisos**
4. **Introduce migraciones**
5. **Adopta scheduler/event bus si aporta valor**
6. **Pasa checklist final de validación**

Este orden reduce errores silenciosos de data/permisos.

---

## 4) Playbook paso a paso

## Paso A: Normalizar registro del plugin

Mantén `PMMPCore.registerPlugin(...)`, asegurando:

- `name` y `version`
- `depend: ["PMMPCore"]` para dependencia estricta

En `onEnable()`, crea contexto:

```javascript
this.context = PMMPCore.getPluginContext("MyPlugin", "1.0.0");
```

## Paso B: Mover cada cosa a su fase correcta

### Se queda en `onStartup(event)`

- registro de enums de comandos
- registro de comandos
- bootstrap sin I/O de mundo

### Se mueve a `onWorldReady()`

- primeras lecturas/escrituras DB
- warmup de motor relacional
- hidratación de data y precargas
- ejecución de migraciones

Razón: evitar errores de early-execution.

## Paso C: Sustituir persistencia directa

### Antes (legacy)

```javascript
world.setDynamicProperty("myplugin:data", JSON.stringify(data));
```

### Después (v1)

```javascript
PMMPCore.db.setPluginData("MyPlugin", "data", data);
PMMPCore.db.flush();
```

Reglas:

- no mutar el resultado de `get()` sin volver a `set()`
- usar flush tras escrituras críticas que deben sobrevivir cierres abruptos

## Paso D: Migrar permisos al contrato estable

### Antes

- llamadas directas a internals/backends de PurePerms

### Después

```javascript
const perms = PMMPCore.getPermissionService();
const allowed = perms?.has(player.name, "pperms.command.myplugin.admin", player.dimension?.id ?? null, player);
```

Beneficios:

- menos acoplamiento al backend
- checks más uniformes
- fallback más limpio

## Paso E: Añadir migraciones de esquema/data

Registrar en `onEnable()`, ejecutar en `onWorldReady()`:

```javascript
onEnable() {
  PMMPCore.getMigrationService()?.register("MyPlugin", 1, () => {
    PMMPCore.db.setPluginData("MyPlugin", "schema", { version: 1 });
  });
}

onWorldReady() {
  PMMPCore.getMigrationService()?.run("MyPlugin");
}
```

Buenas prácticas:

- migraciones idempotentes
- evitar operaciones destructivas salvo necesidad real
- loggear versión aplicada

## Paso F: Modernización opcional

Adoptar:

- `getScheduler()` para trabajo delayed/repeating con presupuesto por tick
- `getEventBus()` para eventos desacoplados entre plugins

---

## 5) Ejemplos reales de fallos y solución

## Caso 1: crash por early execution

Síntoma:

- `cannot be used in early execution`

Solución:

- mover DB de `onStartup` a `onWorldReady`
- dejar en startup solo registro de comandos

## Caso 2: regresión de permisos tras refactor

Síntoma:

- admins pierden acceso o checks inconsistentes

Solución:

- helper único con `PMMPCore.getPermissionService()`
- mantener nombres de nodos estables
- auditar guardas comando por comando

## Caso 3: cambios de data entre versiones

Síntoma:

- mundos viejos cargan con null/parcial

Solución:

- migraciones versionadas
- transformar claves legacy en pasos controlados
- defaults explícitos de compatibilidad

---

## 6) Checklist de validación de migración

- [ ] Plugin carga y se habilita sin warnings inesperados de dependencias
- [ ] No hay acceso a DB/mundo en fases tempranas
- [ ] Comandos se registran en `onStartup(event)` y funcionan
- [ ] Hidratación de datos en `onWorldReady()`
- [ ] Permisos vía `getPermissionService()`
- [ ] Migraciones registradas y ejecutadas una sola vez por versión
- [ ] Escrituras críticas llaman `PMMPCore.db.flush()` cuando corresponde
- [ ] `/diag` muestra estado sano tras cargar plugin

---

## 7) Errores comunes

- Migrar lógica de comando pero olvidar enums
- Ejecutar migraciones antes de world-ready
- Mezclar Dynamic Properties directas con `PMMPCore.db` en el mismo dominio de datos
- Migraciones no idempotentes que duplican datos en reinicios

---

## 8) Estrategia de rollout recomendada

1. Crear rama de migración.
2. Migrar por subsistemas (comandos, data, permisos).
3. Validar cada subsistema al terminar.
4. Ejecutar smoke test end-to-end en mundo.
5. Publicar con release notes claras (cambios de lifecycle/data/permisos).

---

## 9) FAQ

### ¿Debo migrar todo de una sola vez?

No. Es más seguro por fases: lifecycle, persistencia, permisos y luego servicios opcionales.

### ¿Puedo mantener claves legacy mientras migro?

Sí, de forma temporal. Añade lecturas de compatibilidad y mueve datos con migraciones versionadas.

### ¿Cuál es el fallo más común en migración?

Ejecutar lógica de DB en startup temprano. La hidratación debe ir en `onWorldReady()`.

### ¿Las migraciones deberían llamar APIs de otros plugins?

Mejor evitarlo. Mantén migraciones deterministas y enfocadas en datos propios del plugin.

### ¿Cómo valido que la migración es segura?

Prueba primera carga, prueba reinicio y prueba rollback/forward usando `/diag` más smoke tests de comandos.
