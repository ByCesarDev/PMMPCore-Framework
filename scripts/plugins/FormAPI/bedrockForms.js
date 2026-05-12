import {
  ActionFormData,
  MessageFormData,
  ModalFormData,
} from "@minecraft/server-ui";

/**
 * @typedef {import("@minecraft/server").RawMessage | string} UiText
 */

/**
 * @typedef {{ status: "ok"; buttonId: string; index: number }} FormResultButtonOk
 * @typedef {{ status: "ok"; confirm: boolean; choice: "left" | "right" }} FormResultConfirmOk
 * @typedef {{ status: "ok"; values: Record<string, string | boolean | number> }} FormResultModalOk
 * @typedef {{ status: "canceled" }} FormResultCanceled
 * @typedef {{ status: "rejected"; reason: string }} FormResultRejected
 * @typedef {{ status: "invalid"; code: string; message?: string; fieldErrors?: Record<string, string> }} FormResultInvalid
 * @typedef {FormResultButtonOk | FormResultConfirmOk | FormResultModalOk | FormResultCanceled | FormResultRejected | FormResultInvalid} FormResult
 */

/** @param {FormResult} r @returns {r is FormResultButtonOk | FormResultConfirmOk | FormResultModalOk} */
export function isFormOk(r) {
  return r.status === "ok";
}

/**
 * @param {unknown} err
 * @returns {FormResultRejected}
 */
export function normalizeFormError(err) {
  const reason =
    typeof err === "object" && err !== null && "reason" in err && typeof err.reason === "string"
      ? err.reason
      : typeof err === "object" && err !== null && "message" in err && typeof err.message === "string"
        ? mapMessageToReason(err.message)
        : "Unknown";
  return { status: "rejected", reason };
}

function mapMessageToReason(message) {
  const m = String(message);
  if (m.includes("PlayerQuit")) return "PlayerQuit";
  if (m.includes("ServerShutdown")) return "ServerShutdown";
  if (m.includes("MalformedResponse")) return "MalformedResponse";
  if (m.includes("UserBusy")) return "UserBusy";
  return m.slice(0, 120);
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {{ title?: UiText; body?: UiText; buttons: { id: string; text: UiText; iconPath?: string }[] }} spec
 * @param {{ maxButtons: number }} limits
 * @param {{ warn?: (s: string) => void }} logger
 * @returns {Promise<FormResult>}
 */
export async function executeButtonMenu(player, spec, limits, logger) {
  const buttons = spec.buttons ?? [];
  const ids = buttons.map((b) => b.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) {
    return { status: "invalid", code: "duplicate_button_id", message: `Duplicate ids: ${dup.join(", ")}` };
  }
  if (buttons.length === 0) {
    return { status: "invalid", code: "no_buttons", message: "At least one button is required." };
  }
  if (buttons.length > limits.maxButtons) {
    return {
      status: "invalid",
      code: "too_many_buttons",
      message: `Max ${limits.maxButtons} buttons allowed.`,
    };
  }

  const form = new ActionFormData();
  if (spec.title !== undefined) form.title(spec.title);
  if (spec.body !== undefined) form.body(spec.body);
  for (const b of buttons) {
    form.button(b.text, b.iconPath);
  }

  try {
    const res = await form.show(player);
    if (res.canceled || res.selection === undefined) {
      return { status: "canceled" };
    }
    const idx = res.selection;
    const picked = buttons[idx];
    if (!picked) {
      return { status: "invalid", code: "selection_out_of_range", message: String(idx) };
    }
    return { status: "ok", buttonId: picked.id, index: idx };
  } catch (e) {
    logger?.warn?.(`[FormAPI] ActionForm: ${e?.message ?? e}`);
    return normalizeFormError(e);
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {{ title?: UiText; body?: UiText; buttonLeft: UiText; buttonRight: UiText; confirmSide?: "left" | "right" }} spec
 * @param {{ warn?: (s: string) => void }} logger
 * @returns {Promise<FormResult>}
 */
export async function executeConfirm(player, spec, logger) {
  const form = new MessageFormData();
  if (spec.title !== undefined) form.title(spec.title);
  if (spec.body !== undefined) form.body(spec.body);
  form.button1(spec.buttonLeft);
  form.button2(spec.buttonRight);

  const confirmSide = spec.confirmSide ?? "left";

  try {
    const res = await form.show(player);
    if (res.canceled || res.selection === undefined) {
      return { status: "canceled" };
    }
    const sel = res.selection;
    const choice = sel === 0 ? "left" : "right";
    const confirm = confirmSide === "left" ? sel === 0 : sel === 1;
    return { status: "ok", confirm, choice };
  } catch (e) {
    logger?.warn?.(`[FormAPI] MessageForm: ${e?.message ?? e}`);
    return normalizeFormError(e);
  }
}

/**
 * @typedef {{
 *   type: "header";
 *   text: UiText;
 * }} ModalFieldHeader
 * @typedef {{
 *   type: "label";
 *   text: UiText;
 * }} ModalFieldLabel
 * @typedef {{
 *   type: "divider";
 * }} ModalFieldDivider
 * @typedef {{
 *   type: "textField";
 *   id: string;
 *   label: UiText;
 *   placeholder: UiText;
 *   required?: boolean;
 *   maxLength?: number;
 *   options?: import("@minecraft/server-ui").ModalFormDataTextFieldOptions;
 * }} ModalFieldText
 * @typedef {{
 *   type: "toggle";
 *   id: string;
 *   label: UiText;
 *   required?: boolean;
 *   options?: import("@minecraft/server-ui").ModalFormDataToggleOptions;
 * }} ModalFieldToggle
 * @typedef {{
 *   type: "dropdown";
 *   id: string;
 *   label: UiText;
 *   items: (UiText)[];
 *   required?: boolean;
 *   options?: import("@minecraft/server-ui").ModalFormDataDropdownOptions;
 * }} ModalFieldDropdown
 * @typedef {{
 *   type: "slider";
 *   id: string;
 *   label: UiText;
 *   min: number;
 *   max: number;
 *   required?: boolean;
 *   options?: import("@minecraft/server-ui").ModalFormDataSliderOptions;
 * }} ModalFieldSlider
 * @typedef {ModalFieldHeader | ModalFieldLabel | ModalFieldDivider | ModalFieldText | ModalFieldToggle | ModalFieldDropdown | ModalFieldSlider} ModalFieldSpec
 */

/**
 * @param {Record<string, string | boolean | number>} values
 * @param {ModalFieldSpec[]} fields
 * @returns {{ ok: boolean; fieldErrors: Record<string, string> }}
 */
export function validateModalValues(values, fields) {
  /** @type {Record<string, string>} */
  const fieldErrors = {};

  for (const f of fields) {
    if (!("id" in f) || !f.id) continue;
    const id = f.id;
    const v = values[id];

    if (f.type === "textField") {
      const s = typeof v === "string" ? v.trim() : "";
      if (f.required && !s) fieldErrors[id] = "Required.";
      if (f.maxLength && s.length > f.maxLength) fieldErrors[id] = `Max ${f.maxLength} characters.`;
    }
    if (f.type === "dropdown") {
      if (f.required && (v === undefined || v === "")) fieldErrors[id] = "Required.";
    }
    if (f.type === "slider") {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isNaN(n)) {
        if (f.required) fieldErrors[id] = "Invalid number.";
      } else {
        if (n < f.min || n > f.max) fieldErrors[id] = `Must be between ${f.min} and ${f.max}.`;
      }
    }
  }

  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {{ title?: UiText; submitLabel?: UiText; fields: ModalFieldSpec[]; validate?: boolean }} spec
 * @param {{ warn?: (s: string) => void }} logger
 * @returns {Promise<FormResult>}
 */
export async function executeModal(player, spec, logger) {
  const fields = spec.fields ?? [];
  const form = new ModalFormData();
  if (spec.title !== undefined) form.title(spec.title);
  if (spec.submitLabel !== undefined) form.submitButton(spec.submitLabel);

  /** @type {string[]} */
  const valueIds = [];

  for (const f of fields) {
    switch (f.type) {
      case "header":
        form.header(f.text);
        break;
      case "label":
        form.label(f.text);
        break;
      case "divider":
        form.divider();
        break;
      case "textField":
        valueIds.push(f.id);
        form.textField(f.label, f.placeholder, f.options);
        break;
      case "toggle":
        valueIds.push(f.id);
        form.toggle(f.label, f.options);
        break;
      case "dropdown":
        valueIds.push(f.id);
        form.dropdown(f.label, f.items.map((x) => String(x)), f.options);
        break;
      case "slider":
        valueIds.push(f.id);
        form.slider(f.label, f.min, f.max, f.options);
        break;
      default:
        return { status: "invalid", code: "unknown_field_type", message: JSON.stringify(f) };
    }
  }

  try {
    const res = await form.show(player);
    if (res.canceled) {
      return { status: "canceled" };
    }
    const raw = res.formValues ?? [];
    /** @type {Record<string, string | boolean | number>} */
    const values = {};
    for (let i = 0; i < valueIds.length; i++) {
      const id = valueIds[i];
      const val = raw[i];
      const field = fields.find((x) => "id" in x && x.id === id);
      if (field?.type === "dropdown") {
        const idx = typeof val === "number" ? val : parseInt(String(val), 10);
        values[id] = field.items[idx] !== undefined ? String(field.items[idx]) : "";
      } else if (field?.type === "textField") {
        values[id] = typeof val === "string" ? val : String(val ?? "");
      } else if (field?.type === "toggle") {
        values[id] = !!val;
      } else if (field?.type === "slider") {
        values[id] = typeof val === "number" ? val : Number(val);
      }
    }

    const doValidate = spec.validate !== false;
    if (doValidate) {
      const v = validateModalValues(values, fields);
      if (!v.ok) {
        return { status: "invalid", code: "validation_failed", fieldErrors: v.fieldErrors };
      }
    }

    return { status: "ok", values };
  } catch (e) {
    logger?.warn?.(`[FormAPI] ModalForm: ${e?.message ?? e}`);
    return normalizeFormError(e);
  }
}