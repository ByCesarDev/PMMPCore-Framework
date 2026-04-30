/**
 * Codec identidad: valores JSON serializables ↔ string en DynamicProperty.
 */
class JsonCodec {
  encode(value) {
    return JSON.stringify(value);
  }

  decode(raw) {
    if (raw === undefined || raw === null) return null;
    if (typeof raw !== "string") return null;
    return JSON.parse(raw);
  }
}

export { JsonCodec };
