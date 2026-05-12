# FormAPI — Ayudas de UI para Bedrock

Idioma: [English](FORM_API_DOCUMENTATION.md) | **Español**

Este manual es la **guía completa para quien consume** el plugin FormAPI: requisitos, cableado de un plugin nuevo, parámetros de cada función, forma de los resultados, validación, colas, comandos, solución de problemas y ejemplos listos para copiar.

---

## Índice

1. [Qué aporta FormAPI](#qué-aporta-formapi)
2. [Requisitos previos](#requisitos-previos)
3. [Checklist de cableado en el pack](#checklist-de-cableado-en-el-pack)
4. [Imports y rutas de carpetas](#imports-y-rutas-de-carpetas)
5. [Dependencias en `PMMPCore.registerPlugin`](#dependencias-en-pmmpcoreregisterplugin)
6. [Cuándo está disponible FormAPI en runtime](#cuándo-está-disponible-formapi-en-runtime)
7. [Modelo unificado de resultado (`FormResult`)](#modelo-unificado-de-resultado-formresult)
8. [Tratar resultados en código](#tratar-resultados-en-código)
9. [`showButtonMenu`](#showbuttonmenuplayer-spec)
10. [`showConfirm`](#showconfirmplayer-spec)
11. [`showModal`](#showmodalplayer-spec)
12. [Tipos de campo del modal (referencia)](#tipos-de-campo-del-modal-referencia)
13. [Tipos devueltos por campo](#tipos-devueltos-por-campo)
14. [Validación integrada del modal](#validación-integrada-del-modal)
15. [`validateModalValues`](#validatemodalvaluesvalues-fields)
16. [Cola y timeouts](#cola-y-timeouts)
17. [Comandos personalizados y async (patrón obligatorio)](#comandos-personalizados-y-async-patrón-obligatorio)
18. [Ejemplos completos](#ejemplos-completos)
19. [`config.js` del plugin FormAPI](#configjs-del-plugin-formapi)
20. [Comando de demostración](#comando-de-demostración)
21. [Limitaciones de Bedrock](#limitaciones-de-bedrock)
22. [Solución de problemas](#solución-de-problemas)
23. [Mapa de archivos fuente](#mapa-de-archivos-fuente)

---

## Qué aporta FormAPI

FormAPI envuelve `@minecraft/server-ui` (`ActionFormData`, `MessageFormData`, `ModalFormData`) y ofrece:

| Característica | Beneficio |
|----------------|-----------|
| **`FormResult` unificado** | Mismo patrón `status` para menú, confirmación y modal; sin mezclar excepciones y retornos en flujos UI normales. |
| **Cola FIFO por jugador** | Las llamadas `show*` por jugador se serializan y reducen choques con `UserBusy` frente a varios `form.show()` en paralelo. |
| **Ids estables** | El menú mapea índice → `buttonId`; el modal mapea índices de `formValues` a tus `id` en string. |
| **`fields` declarativos** | Array ordenado → constructor `ModalFormData` + objeto plano `values`. |
| **Validación opcional** | `required`, `maxLength`, rangos del slider → `status: "invalid"` con `fieldErrors`. |

**No** sustituye conocer las reglas de Bedrock (una UI a la vez, contextos de ejecución permitidos). Ayuda a mantener el código ordenado.

---

## Requisitos previos

- Behavior pack PMMPCore con **`@minecraft/server-ui`** declarado (este repo usa **2.0.0** en [`manifest.json`](../../manifest.json)).
- Plugin FormAPI **cargado y habilitado** (véase [disponibilidad](#cuándo-está-disponible-formapi-en-runtime)).
- Familiaridad con el ciclo de vida de plugins PMMPCore ([`PLUGIN_DEVELOPMENT_GUIDE.es.md`](../PLUGIN_DEVELOPMENT_GUIDE.es.md)).

---

## Checklist de cableado en el pack

Para **añadir un plugin nuevo** que abra formularios:

1. Crear `scripts/plugins/<TuPlugin>/main.js` (y opcionalmente `commands.js`, `config.js`, …).
2. Registrar el plugin con `PMMPCore.registerPlugin({ … })` (véase [Dependencias](#dependencias-en-pmmpcoreregisterplugin)).
3. Añadir **`import "./plugins/<TuPlugin>/main.js"`** en [`scripts/plugins.js`](../../scripts/plugins.js).
4. Asegurar que **`FormAPI` cargue antes** que los plugins que llaman a `formsApi.js`, para que el servicio exista durante `onEnable`. En este repo, FormAPI va justo después de PlaceholderAPI (comentario en `plugins.js`).
5. Registrar comandos que abran UI en **`onStartup(event)`** (igual que otros plugins PMMPCore).
6. Abrir formularios solo desde **contextos permitidos** (comandos con el patrón async auxiliar, `system.run`, callbacks de eventos — no en fases restringidas).

---

## Imports y rutas de carpetas

Módulo público estable:

`scripts/plugins/FormAPI/formsApi.js`

Exporta: `showButtonMenu`, `showConfirm`, `showModal`, `isFormOk`, `normalizeFormError`, `validateModalValues`.

Desde `scripts/plugins/<Nombre>/main.js`:

```javascript
import {
  showButtonMenu,
  showConfirm,
  showModal,
  isFormOk,
} from "../FormAPI/formsApi.js";
```

Desde un subdirectorio, por ejemplo `scripts/plugins/<Nombre>/ui/tienda.js`:

```javascript
import { showButtonMenu } from "../../FormAPI/formsApi.js";
```

La ruta es **siempre relativa** al archivo actual; Bedrock resuelve los ES modules al cargar el pack.

---

## Dependencias en `PMMPCore.registerPlugin`

```javascript
PMMPCore.registerPlugin({
  name: "MiPlugin",
  version: "1.0.0",
  depend: ["PMMPCore"],
  softdepend: ["FormAPI"], // opcional: usar FormAPI solo si está cargado
```

| Declaración | Cuándo usarla |
|-------------|----------------|
| `depend: ["PMMPCore"]` | Siempre en plugins PMMPCore. |
| `softdepend: ["FormAPI"]` | Tu plugin puede ejecutarse sin FormAPI pero **activa la UI** cuando FormAPI está cargado. El nombre **`"FormAPI"`** debe coincidir con [`FORM_API_PLUGIN_NAME`](../../scripts/plugins/FormAPI/config.js). |
| `depend: ["PMMPCore", "FormAPI"]` | Dependencia dura: tu plugin **no debería habilitarse** sin FormAPI (más estricto). |

Importar `formsApi.js` **no** crea la cola: el **`onEnable`** del plugin FormAPI registra `FormAPIService`. Si FormAPI falta en `plugins.js` o está desactivado en config, `show*` devuelve **`formapi_not_initialized`**.

---

## Cuándo está disponible FormAPI en runtime

- [`formsApi.js`](../../scripts/plugins/FormAPI/formsApi.js) usa un singleton definido en [`runtime.js`](../../scripts/plugins/FormAPI/runtime.js) cuando el `onEnable` de FormAPI termina bien.
- Si no hay servicio, cada `show*` devuelve **`formapi_not_initialized`** (objeto normal, sin lanzar excepción).

Checklist:

1. `scripts/plugins.js` importa `./plugins/FormAPI/main.js`.
2. `FORM_API_CONFIG.plugin.enabled === true` en [`config.js`](../../scripts/plugins/FormAPI/config.js).
3. PMMPCore habilitó FormAPI sin errores en `enableAll`.

---

## Modelo unificado de resultado (`FormResult`)

Cada `await show*(player, spec)` devuelve un **`FormResult`** discriminado por `status`:

| `status` | Significado |
|----------|-------------|
| **`ok`** | El jugador envió el diálogo correctamente y la validación pasó (modal con validación activada). |
| **`canceled`** | Cerró la UI o no hubo selección definitiva. |
| **`rejected`** | Rechazo del motor o del runtime al mostrar o esperar; revisa **`reason`** (`string`). Valores habituales: `PlayerQuit`, `ServerShutdown`, `MalformedResponse`, patrones tipo `UserBusy`, **`Timeout`** (vigilancia de cola), etc., según [`bedrockForms.js`](../../scripts/plugins/FormAPI/bedrockForms.js). |
| **`invalid`** | Spec inválida **o** fallo de validación del modal **o** `formapi_not_initialized`. |

Helpers:

- **`isFormOk(result)`** — `true` solo si `status === "ok"`.
- **`normalizeFormError(err)`** — convierte excepciones en `{ status: "rejected", reason }` (uso interno).

Los flujos UI normales **no lanzan** desde los ejecutores de FormAPI; errores de `form.show()` se capturan y pasan a `rejected`.

### Payloads si `status === "ok"`

| Función | Campos del payload |
|---------|---------------------|
| `showButtonMenu` | **`buttonId`** (`string`): `id` del botón pulsado. **`index`** (`number`): índice base 0. |
| `showConfirm` | **`confirm`** (`boolean`): si se pulsó el lado configurado como confirmación. **`choice`**: `"left"` \| `"right"`. Ver [`confirmSide`](#showconfirmplayer-spec). |
| `showModal` | **`values`**: objeto con clave = **`id`** de cada campo con valor. Filas solo visuales (`header`, `label`, `divider`) no generan claves. |

---

## Tratar resultados en código

Patrón recomendado:

```javascript
const r = await showButtonMenu(player, { /* … */ });

if (!isFormOk(r)) {
  if (r.status === "canceled") {
    return;
  }
  if (r.status === "invalid") {
    console.warn(r.code, r.message, r.fieldErrors);
    return;
  }
  console.warn(r.reason);
  return;
}

// Aquí: r.buttonId, r.index
```

---

## `showButtonMenu(player, spec)`

Equivale a **`ActionFormData`**.

### Forma de `spec`

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `title` | `string` \| `RawMessage` | No | Título. |
| `body` | `string` \| `RawMessage` | No | Texto bajo el título. |
| `buttons` | `array` | **Sí** | Lista no vacía de botones. |

Cada **botón**:

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `id` | `string` | **Sí** | Identificador devuelto como `buttonId`. Único en el array. |
| `text` | `string` \| `RawMessage` | **Sí** | Texto del botón. |
| `iconPath` | `string` | No | Textura del pack para icono (semántica Bedrock `button(text, iconPath)`). |

### Límites

- Sin botones → `{ status: "invalid", code: "no_buttons" }`.
- **`id`** duplicados → `duplicate_button_id`.
- Más de **`limits.maxButtons`** (por defecto **30**) → `too_many_buttons`.

---

## `showConfirm(player, spec)`

Equivale a **`MessageFormData`** (dos botones).

### Forma de `spec`

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `title` | `string` \| `RawMessage` | No | Título. |
| `body` | `string` \| `RawMessage` | No | Cuerpo del mensaje. |
| `buttonLeft` | `string` \| `RawMessage` | **Sí** | **Botón 1** (`button1`; suele mostrarse a la izquierda). |
| `buttonRight` | `string` \| `RawMessage` | **Sí** | **Botón 2** (`button2`). |
| `confirmSide` | `"left"` \| `"right"` | No | Qué lado cuenta como “confirmación” para **`confirm`**. Por defecto **`"left"`**. |

Semántica:

- Bedrock devuelve **`selection`** `0` para botón1 / **`1`** para botón2.
- **`choice`**: `"left"` si `selection === 0`, `"right"` si es `1`.
- **`confirm`** es `true` si el jugador pulsó el lado indicado en **`confirmSide`**.

---

## `showModal(player, spec)`

Equivale a **`ModalFormData`**.

### Forma de `spec`

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `title` | `string` \| `RawMessage` | No | Título del formulario. |
| `submitLabel` | `string` \| `RawMessage` | No | Texto del botón principal (`submitButton`). |
| `fields` | `array` | **Sí** | Lista ordenada de especificaciones de campo (siguiente sección). |
| `validate` | `boolean` | No | Por defecto **`true`**. Pon **`false`** para omitir validación integrada tras enviar (sigues recibiendo `values`; puedes llamar tú a `validateModalValues`). |

El **orden** de `fields` importa para depuración y para el índice interno frente a `formValues`.

---

## Tipos de campo del modal (referencia)

### Solo estructura (sin `id`, no aparecen en `values`)

| `type` | Propiedades |
|--------|----------------|
| **`header`** | `text` |
| **`label`** | `text` |
| **`divider`** | (ninguna) |

### Campos con valor (`id` único cada uno)

| `type` | Propiedades |
|--------|-------------|
| **`textField`** | `id`, `label`, `placeholder`, opcional `required`, `maxLength`, `options` (`ModalFormDataTextFieldOptions`). |
| **`toggle`** | `id`, `label`, opcional `required`, `options` (`ModalFormDataToggleOptions`). |
| **`dropdown`** | `id`, `label`, **`items`** (array de strings o valores que se muestran como texto), opcional `required`, `options` (`ModalFormDataDropdownOptions`). |
| **`slider`** | `id`, `label`, **`min`**, **`max`**, opcional `required`, `options` (`ModalFormDataSliderOptions`). |

Los objetos **`options`** siguen los tipos de Bedrock **`@minecraft/server-ui` 2.0.0** (valores por defecto, tooltips, `valueStep`, etc.).

---

## Tipos devueltos por campo

Tras enviar, `values[id]` queda así:

| Tipo de campo | Tipo en JS | Notas |
|---------------|------------|--------|
| `textField` | **`string`** | Puede ser cadena vacía si no es obligatorio. |
| `toggle` | **`boolean`** | |
| `dropdown` | **`string`** | Texto del **ítem elegido**, no el índice numérico (FormAPI resuelve índice → `items[i]`). |
| `slider` | **`number`** | |

---

## Validación integrada del modal

Si **`validate !== false`** (por defecto sí), tras obtener `formValues` de Bedrock se construye `values` y se ejecuta [`validateModalValues`](../../scripts/plugins/FormAPI/bedrockForms.js):

| Regla | Campos |
|-------|--------|
| Texto obligatorio no vacío tras **trim** | `textField` con `required: true` |
| Longitud máxima | `textField` con `maxLength` |
| Obligatorio con valor | `dropdown` con `required: true` |
| Rango numérico | `slider` entre **`min`** y **`max`** (inclusive) |

Si falla: **`{ status: "invalid", code: "validation_failed", fieldErrors: { [id]: mensaje } }`**.

---

## `validateModalValues(values, fields)`

Exportada para validación **manual** (por ejemplo con `validate: false`):

```javascript
const { ok, fieldErrors } = validateModalValues(values, misFields);
```

Mismas reglas que la validación integrada.

---

## Cola y timeouts

Implementación: [`service.js`](../../scripts/plugins/FormAPI/service.js).

- **Una cola FIFO por id de jugador**.
- Varios `show*` encadenados con `await` **esperan** a que termine la tarea anterior **del mismo jugador**.
- **`playerLeave`**: las entradas pendientes resuelven **`{ status: "rejected", reason: "PlayerQuit" }`**.
- **`queue.timeoutMs`** (por defecto **180000** ms): cada tarea compite con `system.runTimeout`. Si vence el tiempo primero → **`{ status: "rejected", reason: "Timeout" }`** y la cola sigue (el diálogo podría seguir abierto; usa timeouts altos en partida normal).

---

## Comandos personalizados y async (patrón obligatorio)

Los callbacks de **`CustomCommandRegistry.registerCommand`** deben devolver **`CustomCommandResult`** (o `undefined`) **de forma síncrona**. Si devuelves una **`Promise`** (p. ej. handler **`async`**), el motor nativo falla con algo como:

`Arrow function return value expected type: CustomCommandResult | undefined`

**Patrón correcto:** el manejador devuelve éxito al instante; el trabajo async va aparte:

```javascript
(origin) => {
  const player = origin.sourceEntity;
  if (!(player instanceof Player)) {
    return { status: CustomCommandStatus.Success };
  }
  void runMiFlujoUi(player).catch((e) => console.warn(e));
  return { status: CustomCommandStatus.Success };
}

async function runMiFlujoUi(player) {
  const a = await showButtonMenu(player, { /* … */ });
  if (!isFormOk(a)) return;
  const b = await showConfirm(player, { /* … */ });
  if (!isFormOk(b) || !b.confirm) return;
  const c = await showModal(player, { /* … */ });
}
```

---

## Ejemplos completos

### Menú mínimo

```javascript
import { showButtonMenu, isFormOk } from "../FormAPI/formsApi.js";

async function preguntarWarp(player) {
  const r = await showButtonMenu(player, {
    title: "Warp",
    body: "¿Adónde?",
    buttons: [
      { id: "spawn", text: "Spawn" },
      { id: "home", text: "Home" },
    ],
  });
  if (!isFormOk(r)) return null;
  return r.buttonId;
}
```

### Cadena menú → confirmación → modal

```javascript
import { showButtonMenu, showConfirm, showModal, isFormOk } from "../FormAPI/formsApi.js";

async function flujoPerfil(player) {
  const pick = await showButtonMenu(player, {
    title: "Perfil",
    body: "Elige una acción.",
    buttons: [
      { id: "edit", text: "Editar perfil" },
      { id: "cancel", text: "Cancelar" },
    ],
  });
  if (!isFormOk(pick) || pick.buttonId !== "edit") return;

  const ok = await showConfirm(player, {
    title: "¿Continuar?",
    body: "¿Abrir el formulario?",
    buttonLeft: "Sí",
    buttonRight: "No",
    confirmSide: "left",
  });
  if (!isFormOk(ok) || !ok.confirm) return;

  const form = await showModal(player, {
    title: "Perfil",
    submitLabel: "Guardar",
    fields: [
      { type: "label", text: "Tu nombre visible" },
      {
        type: "textField",
        id: "name",
        label: "Nombre",
        placeholder: "Jugador",
        required: true,
        maxLength: 24,
      },
      {
        type: "toggle",
        id: "notify",
        label: "Notificaciones",
        options: { defaultValue: true },
      },
    ],
  });

  if (!isFormOk(form)) {
    if (form.status === "invalid" && form.fieldErrors) {
      player.sendMessage(`Corrige: ${JSON.stringify(form.fieldErrors)}`);
    }
    return;
  }

  player.sendMessage(`Guardado: ${form.values.name}, notify=${form.values.notify}`);
}
```

### `RawMessage` en títulos (opcional)

```javascript
import { RawMessage } from "@minecraft/server";

title: { translate: "alguna.clave" },
```

---

## `config.js` del plugin FormAPI

[`scripts/plugins/FormAPI/config.js`](../../scripts/plugins/FormAPI/config.js):

| Clave | Rol |
|-------|-----|
| `plugin.enabled` | Si **`false`**, `onEnable` termina sin registrar el servicio (`formsApi` → `formapi_not_initialized`). El módulo sigue cargándose desde `plugins.js`. |
| `demoCommand.enabled` | Registra `/pmmpcore:formapi_demo`. |
| `demoCommand.permission` | Nodo PurePerms del demo (**`pmmpcore.formapi.demo`**). |
| `limits.maxButtons` | Tope para `showButtonMenu`. |
| `queue.timeoutMs` | Vigilancia por tarea ([Cola](#cola-y-timeouts)). |
| `debug` | Reservado / logging (uso mínimo actual). |

---

## Comando de demostración

Si está activado:

- **`/pmmpcore:formapi_demo`** o **`/formapi_demo`**
- Permiso **`pmmpcore.formapi.demo`** con PurePerms (si hay servicio de permisos).

Implementación de referencia en [`commands.js`](../../scripts/plugins/FormAPI/commands.js).

---

## Limitaciones de Bedrock

- En la práctica **una UI servidor por jugador**. La cola ordena **tu** código; no cierra diálogos de vanilla ni de otros scripts.
- **`show()`** en contextos restringidos falla: dispara la UI desde comandos (patrón de arriba), **`system.run`**, eventos permitidos.
- **Comandos:** no uses **`async`** directamente como callback del comando ([patrón](#comandos-personalizados-y-async-patrón-obligatorio)).

---

## Solución de problemas

| Síntoma | Causa probable |
|---------|----------------|
| `formapi_not_initialized` | FormAPI no cargado, desactivado en config, u orden de carga incorrecto. |
| `UserBusy` / `rejected` relacionado | Otra UI abierta (chat, inventario, otro script). La cola ayuda en secuencia, no con sistemas solapados. |
| `Timeout` | `queue.timeoutMs` demasiado bajo; súbelo. |
| `Validation: {"campo":"Required."}` | Campo `required` vacío; rellénalo o afloja validación. |
| Error nativo **CustomCommandResult** | Callback del comando es `async` o devuelve Promise. |
| Valor de dropdown inesperado | Los valores son **strings** del texto del ítem elegido, no el índice. |

---

## Mapa de archivos fuente

| Archivo | Rol |
|---------|-----|
| [`formsApi.js`](../../scripts/plugins/FormAPI/formsApi.js) | Export público; comprueba si hay servicio. |
| [`bedrockForms.js`](../../scripts/plugins/FormAPI/bedrockForms.js) | Constructores, normalización, validación. |
| [`service.js`](../../scripts/plugins/FormAPI/service.js) | Cola y timeout. |
| [`runtime.js`](../../scripts/plugins/FormAPI/runtime.js) | Singleton. |
| [`config.js`](../../scripts/plugins/FormAPI/config.js) | Ajustes. |
| [`commands.js`](../../scripts/plugins/FormAPI/commands.js) | Comando demo. |

---

## Ver también

- [`PLUGIN_DEVELOPMENT_GUIDE.es.md`](../PLUGIN_DEVELOPMENT_GUIDE.es.md) — ciclo de vida y `plugins.js`.
- [`API_PUBLIC_GUIDE.es.md`](../API_PUBLIC_GUIDE.es.md) — superficie pública PMMPCore.
