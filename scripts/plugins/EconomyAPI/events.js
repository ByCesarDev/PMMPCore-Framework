function emitEconomyEvent(type, payload = {}) {
  return {
    type,
    payload,
    at: Date.now(),
  };
}

export { emitEconomyEvent };
