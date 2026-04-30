const AMPERSAND_COLOR_REGEX = /&([0-9a-fk-or])/gi;
const MESSAGE_COLOR_REGEX = /&[0-9a-fk-or]/gi;

export function toSectionColors(text) {
  return String(text ?? "").replace(AMPERSAND_COLOR_REGEX, "§$1");
}

export function stripAmpersandColors(text) {
  return String(text ?? "").replace(MESSAGE_COLOR_REGEX, "");
}

export function applyTemplate(template, data) {
  let out = String(template ?? "");
  for (const [key, value] of Object.entries(data ?? {})) {
    const replacement = String(value ?? "");
    // Compatibility: support both `{placeholder}` and `<<placeholder>>`.
    out = out.replaceAll(`{${key}}`, replacement);
    out = out.replaceAll(`<<${key}>>`, replacement);
  }
  return out;
}

export function buildChatMessage(template, context) {
  const resolved = applyTemplate(template, context);
  return toSectionColors(resolved);
}

export function buildNametag(template, context) {
  const resolved = applyTemplate(template, context);
  return toSectionColors(resolved);
}
