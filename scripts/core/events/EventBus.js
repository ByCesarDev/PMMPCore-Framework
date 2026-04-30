import { CoreEvent, EventPriority } from "./Event.js";

class EventBus {
  constructor(observability = null) {
    this.observability = observability;
    this.listeners = new Map();
    this._counter = 0;
  }

  on(type, handler, options = {}) {
    const key = String(type);
    const entry = {
      id: options.id || `${key}:${++this._counter}`,
      priority: typeof options.priority === "number" ? options.priority : EventPriority.normal,
      once: !!options.once,
      pluginName: options.pluginName || "core",
      handler,
    };
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(entry);
    this.listeners.get(key).sort((a, b) => b.priority - a.priority);
    return entry.id;
  }

  once(type, handler, options = {}) {
    return this.on(type, handler, { ...options, once: true });
  }

  off(type, id) {
    const key = String(type);
    const entries = this.listeners.get(key);
    if (!entries) return false;
    const before = entries.length;
    this.listeners.set(
      key,
      entries.filter((entry) => entry.id !== id)
    );
    return this.listeners.get(key).length !== before;
  }

  emit(type, payload = {}, options = {}) {
    const event = type instanceof CoreEvent ? type : new CoreEvent(type, payload, options);
    const entries = [...(this.listeners.get(event.type) ?? [])];
    const startedAt = Date.now();
    for (const entry of entries) {
      try {
        entry.handler(event);
      } catch (error) {
        this.observability?.error?.("eventbus", `Listener failed for ${event.type}`, {
          listenerId: entry.id,
          pluginName: entry.pluginName,
          error: error?.message ?? String(error),
        });
      }
      if (entry.once) {
        this.off(event.type, entry.id);
      }
      if (event.propagationStopped) {
        break;
      }
    }
    this.observability?.recordEventDispatch?.(event.type, Date.now() - startedAt, entries.length);
    return event;
  }

  listenerSummary() {
    return Array.from(this.listeners.entries()).map(([type, entries]) => ({
      type,
      listeners: entries.length,
      plugins: [...new Set(entries.map((entry) => entry.pluginName || "core"))],
    }));
  }
}

export { EventBus };
