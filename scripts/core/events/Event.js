class CoreEvent {
  constructor(type, payload = {}, options = {}) {
    this.type = String(type);
    this.payload = payload ?? {};
    this.timestamp = Date.now();
    this.cancelable = !!options.cancelable;
    this.cancelled = false;
    this.propagationStopped = false;
  }

  cancel() {
    if (this.cancelable) {
      this.cancelled = true;
    }
  }

  stopPropagation() {
    this.propagationStopped = true;
  }
}

const EventPriority = Object.freeze({
  lowest: 0,
  low: 25,
  normal: 50,
  high: 75,
  highest: 100,
});

export { CoreEvent, EventPriority };
