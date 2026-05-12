# FormAPI — Bedrock UI helpers

Language: **English** | [Español](FORM_API_DOCUMENTATION.es.md)

This manual is the **full consumer guide** for the FormAPI plugin: prerequisites, wiring a new plugin, every function parameter, result shapes, validation, queues, commands, troubleshooting, and copy-paste examples.

---

## Table of contents

1. [What FormAPI provides](#what-formapi-provides)
2. [Prerequisites](#prerequisites)
3. [Pack wiring checklist](#pack-wiring-checklist)
4. [Imports and folder paths](#imports-and-folder-paths)
5. [Dependencies in `PMMPCore.registerPlugin`](#dependencies-in-pmmpcoreregisterplugin)
6. [When is FormAPI available at runtime?](#when-is-formapi-available-at-runtime)
7. [Unified result model (`FormResult`)](#unified-result-model-formresult)
8. [Handling results in code](#handling-results-in-code)
9. [`showButtonMenu`](#showbuttonmenuplayer-spec)
10. [`showConfirm`](#showconfirmplayer-spec)
11. [`showModal`](#showmodalplayer-spec)
12. [Modal field types (reference)](#modal-field-types-reference)
13. [Returned value types per field](#returned-value-types-per-field)
14. [Built-in modal validation](#built-in-modal-validation)
15. [`validateModalValues`](#validatemodalvaluesvalues-fields)
16. [Queue and timeouts](#queue-and-timeouts)
17. [Custom commands and async (mandatory pattern)](#custom-commands-and-async-mandatory-pattern)
18. [Full examples](#full-examples)
19. [FormAPI plugin `config.js`](#formapi-plugin-configjs)
20. [Demo command](#demo-command)
21. [Bedrock limitations](#bedrock-limitations)
22. [Troubleshooting](#troubleshooting)
23. [Source files map](#source-files-map)

---

## What FormAPI provides

FormAPI wraps `@minecraft/server-ui` (`ActionFormData`, `MessageFormData`, `ModalFormData`) with:

| Feature | Benefit |
|--------|---------|
| **Unified `FormResult`** | Same `status` pattern for menu, confirm, and modal; no mix of thrown errors vs return values for normal UI flows. |
| **Per-player FIFO queue** | Serialized `show*` calls per player reduce `UserBusy` compared to firing multiple parallel `form.show()` calls. |
| **Stable ids** | Button menus map slot index to `buttonId`; modal maps `formValues` indices to your field `id` strings. |
| **Declarative modal `fields`** | Ordered array → `ModalFormData` builder + normalization to a flat `values` object. |
| **Optional validation** | `required`, `maxLength`, slider range checks → `status: "invalid"` with `fieldErrors`. |

It does **not** replace learning Bedrock rules (one UI at a time, allowed execution contexts). It helps you stay consistent.

---

## Prerequisites

- PMMPCore behavior pack with **`@minecraft/server-ui`** declared (this repo uses **2.0.0** in root [`manifest.json`](../../manifest.json)).
- FormAPI plugin **loaded and enabled** (see [When is FormAPI available](#when-is-formapi-available-at-runtime)).
- Familiarity with PMMPCore plugin lifecycle ([`PLUGIN_DEVELOPMENT_GUIDE.md`](../PLUGIN_DEVELOPMENT_GUIDE.md)).

---

## Pack wiring checklist

Use this when **adding a new plugin** that opens forms:

1. Create `scripts/plugins/<YourPlugin>/main.js` (and optional `commands.js`, `config.js`, …).
2. Register the plugin with `PMMPCore.registerPlugin({ … })` (see [Dependencies](#dependencies-in-pmmpcoreregisterplugin)).
3. Add **`import "./plugins/<YourPlugin>/main.js"`** to [`scripts/plugins.js`](../../scripts/plugins.js).
4. Ensure **`FormAPI` appears earlier** in `plugins.js` than plugins that call `formsApi.js`, so the FormAPI service exists before consumers run `onEnable`. This repo loads FormAPI immediately after PlaceholderAPI (see comment in `plugins.js`).
5. Register commands that open forms inside **`onStartup(event)`** (same pattern as other PMMPCore plugins).
6. Open forms only from **allowed contexts** (custom commands via the async helper pattern, `system.run`, event callbacks—not from restricted phases).

---

## Imports and folder paths

Public API module (stable import path):

`scripts/plugins/FormAPI/formsApi.js`

Exports: `showButtonMenu`, `showConfirm`, `showModal`, `isFormOk`, `normalizeFormError`, `validateModalValues`.

From a plugin file under `scripts/plugins/<Name>/main.js`, use **one level up** into `plugins/`:

```javascript
import {
  showButtonMenu,
  showConfirm,
  showModal,
  isFormOk,
} from "../FormAPI/formsApi.js";
```

From a nested file such as `scripts/plugins/<Name>/ui/shop.js`, go up until you reach `plugins/`:

```javascript
import { showButtonMenu } from "../../FormAPI/formsApi.js";
```

The path is **always relative** to your file; Bedrock resolves ES modules at pack load time.

---

## Dependencies in `PMMPCore.registerPlugin`

```javascript
PMMPCore.registerPlugin({
  name: "MyPlugin",
  version: "1.0.0",
  depend: ["PMMPCore"],
  softdepend: ["FormAPI"], // use FormAPI if present; handle missing service if you support running without it
```

| Declaration | When to use |
|-------------|-------------|
| `depend: ["PMMPCore"]` | Always for PMMPCore plugins. |
| `softdepend: ["FormAPI"]` | Your plugin runs without FormAPI but **enables UI features** when FormAPI is loaded. Name `"FormAPI"` must match [`FORM_API_PLUGIN_NAME`](../../scripts/plugins/FormAPI/config.js). |
| `depend: ["PMMPCore", "FormAPI"]` | Hard dependency: your plugin **must not enable** unless FormAPI exists (stricter). |

Importing `formsApi.js` does not create the queue—the **FormAPI plugin’s `onEnable`** registers `FormAPIService`. If FormAPI is disabled in config or missing from `plugins.js`, `show*` resolves to `{ status: "invalid", code: "formapi_not_initialized", … }`.

---

## When is FormAPI available at runtime?

- [`formsApi.js`](../../scripts/plugins/FormAPI/formsApi.js) reads a singleton set in [`runtime.js`](../../scripts/plugins/FormAPI/runtime.js) when FormAPI’s `onEnable` runs.
- If the singleton is missing, every `show*` call returns **`formapi_not_initialized`** (still a normal object, not an exception).

Checklist:

1. `scripts/plugins.js` imports `./plugins/FormAPI/main.js`.
2. `FORM_API_CONFIG.plugin.enabled` is `true` in [`config.js`](../../scripts/plugins/FormAPI/config.js).
3. PMMPCore enabled FormAPI without errors during `enableAll`.

---

## Unified result model (`FormResult`)

Every `await show*(player, spec)` resolves to a **`FormResult`** discriminated by `status`:

| `status` | Meaning |
|----------|---------|
| **`ok`** | Player submitted the dialog successfully and validation passed (for modal when validation is on). |
| **`canceled`** | Player dismissed the UI or left without a definitive selection (`selection` undefined, `canceled` true, etc.—normalized per form type). |
| **`rejected`** | Engine/runtime rejection while showing or waiting; inspect **`reason`** (`string`). Common values include `PlayerQuit`, `ServerShutdown`, `MalformedResponse`, patterns matching `UserBusy`, **`Timeout`** (queue watchdog), or engine-specific messages truncated/mapped in [`bedrockForms.js`](../../scripts/plugins/FormAPI/bedrockForms.js). |
| **`invalid`** | Caller spec error **or** modal validation failure **or** `formapi_not_initialized`. |

Helpers:

- **`isFormOk(result)`** — `true` only when `status === "ok"` (TypeScript/JSDoc narrowing).
- **`normalizeFormError(err)`** — maps caught exceptions to `{ status: "rejected", reason }` (used internally).

Normal UI outcomes **do not throw** from FormAPI executors; errors from `form.show()` are caught and turned into `rejected`.

### Payloads when `status === "ok"`

| Function | Payload fields |
|----------|----------------|
| `showButtonMenu` | **`buttonId`** (`string`): id from the pressed button object. **`index`** (`number`): zero-based button index. |
| `showConfirm` | **`confirm`** (`boolean`): whether the “confirm” side was pressed. **`choice`**: `"left"` \| `"right"` (physical button1 vs button2). See [`confirmSide`](#showconfirmplayer-spec). |
| `showModal` | **`values`**: object keyed by each value field’s **`id`**. Structure-only rows (`header`, `label`, `divider`) do not produce keys. |

---

## Handling results in code

Recommended pattern:

```javascript
const r = await showButtonMenu(player, { /* … */ });

if (!isFormOk(r)) {
  if (r.status === "canceled") {
    // user backed out
    return;
  }
  if (r.status === "invalid") {
    console.warn(r.code, r.message, r.fieldErrors);
    return;
  }
  // rejected
  console.warn(r.reason);
  return;
}

// r.buttonId, r.index available here
```

For modals with validation disabled you may still get `invalid` only from bad specs (duplicate ids, etc.), not from field rules.

---

## `showButtonMenu(player, spec)`

Maps to **`ActionFormData`**.

### `spec` shape

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | `string` \| `RawMessage` | No | Dialog title. |
| `body` | `string` \| `RawMessage` | No | Body text under the title. |
| `buttons` | `array` | **Yes** | Non-empty list of button descriptors. |

Each **button**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | **Yes** | Stable identifier returned as `buttonId`. Must be unique in the array. |
| `text` | `string` \| `RawMessage` | **Yes** | Label shown on the button. |
| `iconPath` | `string` | No | Pack texture path for icon (Bedrock `button(text, iconPath)` semantics). |

### Limits and validation

- At least **one** button; otherwise `{ status: "invalid", code: "no_buttons" }`.
- Duplicate **`id`** → `invalid` (`duplicate_button_id`).
- More than **`FORM_API_CONFIG.limits.maxButtons`** (default **30**) → `invalid` (`too_many_buttons`).

### Example

```javascript
const r = await showButtonMenu(player, {
  title: "Shop",
  body: "Pick a category.",
  buttons: [
    { id: "blocks", text: "Blocks", iconPath: "textures/items/brick" },
    { id: "food", text: "Food" },
  ],
});
```

---

## `showConfirm(player, spec)`

Maps to **`MessageFormData`** (two buttons).

### `spec` shape

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | `string` \| `RawMessage` | No | Dialog title. |
| `body` | `string` \| `RawMessage` | No | Main message body. |
| `buttonLeft` | `string` \| `RawMessage` | **Yes** | **Button 1** (Bedrock `button1`; typically shown on the left). |
| `buttonRight` | `string` \| `RawMessage` | **Yes** | **Button 2** (`button2`). |
| `confirmSide` | `"left"` \| `"right"` | No | Which side counts as “confirm” for the boolean **`confirm`**. Default **`"left"`**. |

Semantics:

- Bedrock returns **`selection`** `0` for button1 / **`1`** for button2.
- **`choice`**: `"left"` when `selection === 0`, `"right"` when `selection === 1`.
- **`confirm`** is `true` when the player pressed the side matching **`confirmSide`**.

### Example

```javascript
const r = await showConfirm(player, {
  title: "Delete home?",
  body: "This cannot be undone.",
  buttonLeft: "Delete",
  buttonRight: "Keep",
  confirmSide: "left",
});
```

---

## `showModal(player, spec)`

Maps to **`ModalFormData`**.

### `spec` shape

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | `string` \| `RawMessage` | No | Form title. |
| `submitLabel` | `string` \| `RawMessage` | No | Primary submit action label (`submitButton`). |
| `fields` | `array` | **Yes** | Ordered list of field specs (see next section). |
| `validate` | `boolean` | No | Default **`true`**. Set **`false`** to skip built-in validation after submit (you still get `values`; you can call `validateModalValues` yourself). |

Field order matters: it must match the order you expect for debugging and for **`formValues`** indexing internally.

---

## Modal field types (reference)

### Structural (no `id`, no entry in `values`)

| `type` | Properties |
|--------|------------|
| **`header`** | `text` — section header row. |
| **`label`** | `text` — static label row. |
| **`divider`** | none |

### Value fields (each requires unique **`id`**)

| `type` | Properties |
|--------|------------|
| **`textField`** | `id`, `label`, `placeholder`, optional `required`, `maxLength`, `options` (`ModalFormDataTextFieldOptions`). |
| **`toggle`** | `id`, `label`, optional `required`, `options` (`ModalFormDataToggleOptions`). |
| **`dropdown`** | `id`, `label`, **`items`** (array of strings or values coerced to string for display), optional `required`, `options` (`ModalFormDataDropdownOptions` — `defaultValueIndex`, `tooltip`, …). |
| **`slider`** | `id`, `label`, **`min`**, **`max`**, optional `required`, `options` (`ModalFormDataSliderOptions` — `defaultValue`, `valueStep`, `tooltip`). |

`options` objects follow **`@minecraft/server-ui` 2.0.0** Bedrock typings (defaults, tooltips, slider step, etc.).

---

## Returned value types per field

After submit, `values[id]` types:

| Field type | JS type in `values` | Notes |
|------------|---------------------|--------|
| `textField` | **`string`** | Empty string possible if not required. |
| `toggle` | **`boolean`** | |
| `dropdown` | **`string`** | **Selected item’s text**, not the numeric index (FormAPI resolves index → `items[i]` string). |
| `slider` | **`number`** | |

---

## Built-in modal validation

When **`validate !== false`** (default), after Bedrock returns `formValues`, FormAPI builds `values` then runs [`validateModalValues`](../../scripts/plugins/FormAPI/bedrockForms.js):

| Rule | Fields |
|------|--------|
| Required non-empty **trimmed** string | `textField` with `required: true` |
| Max length | `textField` with `maxLength` |
| Required non-empty selection | `dropdown` with `required: true` (checks `undefined` / `""`) |
| Numeric range | `slider`: value must be **between `min` and `max`** (inclusive) |

On failure: **`{ status: "invalid", code: "validation_failed", fieldErrors: { [id]: message } }`** — no `ok` payload.

---

## `validateModalValues(values, fields)`

Exported for **manual** validation (e.g. after `validate: false`, or re-checking on the server):

```javascript
const { ok, fieldErrors } = validateModalValues(values, fieldSpecsArray);
```

Same rules as built-in validation.

---

## Queue and timeouts

Implementation: [`service.js`](../../scripts/plugins/FormAPI/service.js).

- **One FIFO queue per player id** (`player.id`).
- Concurrent `show*` calls **enqueue**; each waits until the previous task’s promise settles.
- **`playerLeave`**: pending queue entries resolve **`{ status: "rejected", reason: "PlayerQuit" }`**.
- **`queue.timeoutMs`** (default **180000** ms): each task is racing against `system.runTimeout`. If time expires first → **`{ status: "rejected", reason: "Timeout" }`** and the queue advances (the underlying dialog might still be open—keep timeouts high for normal play).

---

## Custom commands and async (mandatory pattern)

Bedrock **`CustomCommandRegistry.registerCommand`** callbacks must return **`CustomCommandResult`** (or `undefined`) **synchronously**. Returning a **`Promise`** (including **`async` handlers**) causes native errors such as:

`Arrow function return value expected type: CustomCommandResult | undefined`

**Correct pattern:** synchronous handler returns success immediately; async work runs on the side:

```javascript
(origin) => {
  const player = origin.sourceEntity;
  if (!(player instanceof Player)) {
    return { status: CustomCommandStatus.Success };
  }
  void runMyUiFlow(player).catch((e) => console.warn(e));
  return { status: CustomCommandStatus.Success };
}

async function runMyUiFlow(player) {
  const a = await showButtonMenu(player, { /* … */ });
  if (!isFormOk(a)) return;
  const b = await showConfirm(player, { /* … */ });
  if (!isFormOk(b) || !b.confirm) return;
  const c = await showModal(player, { /* … */ });
  // …
}
```

---

## Full examples

### Minimal button menu

```javascript
import { showButtonMenu, isFormOk } from "../FormAPI/formsApi.js";

async function askWarp(player) {
  const r = await showButtonMenu(player, {
    title: "Warp",
    body: "Where to?",
    buttons: [
      { id: "spawn", text: "Spawn" },
      { id: "home", text: "Home" },
    ],
  });
  if (!isFormOk(r)) return null;
  return r.buttonId;
}
```

### Chained menu → confirm → modal

```javascript
import { showButtonMenu, showConfirm, showModal, isFormOk } from "../FormAPI/formsApi.js";

async function editProfileFlow(player) {
  const pick = await showButtonMenu(player, {
    title: "Profile",
    body: "Choose an action.",
    buttons: [
      { id: "edit", text: "Edit profile" },
      { id: "cancel", text: "Cancel" },
    ],
  });
  if (!isFormOk(pick) || pick.buttonId !== "edit") return;

  const ok = await showConfirm(player, {
    title: "Continue?",
    body: "Open the profile form?",
    buttonLeft: "Yes",
    buttonRight: "No",
    confirmSide: "left",
  });
  if (!isFormOk(ok) || !ok.confirm) return;

  const form = await showModal(player, {
    title: "Profile",
    submitLabel: "Save",
    fields: [
      { type: "label", text: "Your display name" },
      {
        type: "textField",
        id: "name",
        label: "Name",
        placeholder: "Player",
        required: true,
        maxLength: 24,
      },
      {
        type: "toggle",
        id: "notify",
        label: "Notifications",
        options: { defaultValue: true },
      },
    ],
  });

  if (!isFormOk(form)) {
    if (form.status === "invalid" && form.fieldErrors) {
      player.sendMessage(`Fix: ${JSON.stringify(form.fieldErrors)}`);
    }
    return;
  }

  player.sendMessage(`Saved: ${form.values.name}, notify=${form.values.notify}`);
}
```

### RawMessage titles (optional)

If you use translation objects, import **`RawMessage`** from `@minecraft/server` and pass them wherever `string` is accepted:

```javascript
import { RawMessage } from "@minecraft/server";

title: { translate: "some.key" }, // RawMessage
```

---

## FormAPI plugin `config.js`

[`scripts/plugins/FormAPI/config.js`](../../scripts/plugins/FormAPI/config.js):

| Key | Role |
|-----|------|
| `plugin.enabled` | If **`false`**, FormAPI `onEnable` exits early and **does not** register the UI service (`formsApi` calls return `formapi_not_initialized`). The plugin module still loads from `plugins.js`. |
| `demoCommand.enabled` | Registers `/pmmpcore:formapi_demo`. |
| `demoCommand.permission` | PurePerms node for demo (**`pmmpcore.formapi.demo`**). |
| `limits.maxButtons` | Cap for `showButtonMenu`. |
| `queue.timeoutMs` | Per-task watchdog (see [Queue](#queue-and-timeouts)). |
| `debug` | Reserved / logging hooks (minimal use today). |

---

## Demo command

When enabled:

- **`/pmmpcore:formapi_demo`** or **`/formapi_demo`**
- Requires permission **`pmmpcore.formapi.demo`** via PurePerms (when permission service present).

Runs the sample chain documented in [`commands.js`](../../scripts/plugins/FormAPI/commands.js).

---

## Bedrock limitations

- **One server-side UI per player at a time** in practice. FormAPI serializes **your** scripts’ calls; it does not cancel vanilla dialogs or other packs’ UI.
- **`show()`** in restricted execution contexts fails—trigger UI from **custom commands** (with the sync pattern), **`system.run`**, **`system.runTimeout`**, or **events** Bedrock allows.
- **Custom commands:** never use **`async`** directly as the command callback (see [above](#custom-commands-and-async-mandatory-pattern)).

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `formapi_not_initialized` | FormAPI plugin not loaded, disabled in config, or load order wrong. |
| `UserBusy` / busy-related `rejected` | Another UI open (chat, inventory, other script). Queue helps sequential calls but not overlapping systems. |
| `Timeout` | `queue.timeoutMs` too low for slow players; increase in config. |
| `Validation: {"field":"Required."}` | Modal field marked `required` but empty; fill field or relax validation. |
| Native error about **CustomCommandResult** | Command handler is `async` or returns a Promise—fix pattern (see [Custom commands](#custom-commands-and-async-mandatory-pattern)). |
| Dropdown value unexpected | Values are **strings** of the selected **item label**, not indices. |

---

## Source files map

| File | Role |
|------|------|
| [`formsApi.js`](../../scripts/plugins/FormAPI/formsApi.js) | Public exports; guards when service missing. |
| [`bedrockForms.js`](../../scripts/plugins/FormAPI/bedrockForms.js) | Builders, normalization, validation. |
| [`service.js`](../../scripts/plugins/FormAPI/service.js) | Queue + timeout wrapper. |
| [`runtime.js`](../../scripts/plugins/FormAPI/runtime.js) | Singleton pointer. |
| [`config.js`](../../scripts/plugins/FormAPI/config.js) | Tunables. |
| [`commands.js`](../../scripts/plugins/FormAPI/commands.js) | Demo command implementation. |

---

## See also

- [`PLUGIN_DEVELOPMENT_GUIDE.md`](../PLUGIN_DEVELOPMENT_GUIDE.md) — lifecycle and `plugins.js`.
- [`API_PUBLIC_GUIDE.md`](../API_PUBLIC_GUIDE.md) — PMMPCore API surface.
