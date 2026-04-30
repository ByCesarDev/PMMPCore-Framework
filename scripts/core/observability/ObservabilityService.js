class CoreLogger {
  constructor(scope = "core") {
    this.scope = scope;
  }

  _fmt(level, message, context = null) {
    const ctx = context ? ` ${JSON.stringify(context)}` : "";
    return `[PMMPCore][${this.scope}][${level}] ${message}${ctx}`;
  }

  debug(message, context = null) {
    console.log(this._fmt("debug", message, context));
  }

  info(message, context = null) {
    console.log(this._fmt("info", message, context));
  }

  warn(message, context = null) {
    console.warn(this._fmt("warn", message, context));
  }

  error(message, context = null) {
    console.error(this._fmt("error", message, context));
  }
}

class ObservabilityService {
  constructor() {
    this.metrics = {
      ticks: [],
      flushes: [],
      queries: [],
      tasks: [],
      events: [],
    };
  }

  getLogger(scope) {
    return new CoreLogger(scope);
  }

  info(scope, message, context = null) {
    this.getLogger(scope).info(message, context);
  }

  warn(scope, message, context = null) {
    this.getLogger(scope).warn(message, context);
  }

  error(scope, message, context = null) {
    this.getLogger(scope).error(message, context);
  }

  _pushMetric(bucket, metric) {
    this.metrics[bucket].push(metric);
    if (this.metrics[bucket].length > 50) {
      this.metrics[bucket].shift();
    }
  }

  recordTick(durationMs) {
    this._pushMetric("ticks", { durationMs, at: Date.now() });
  }

  recordFlush(durationMs, dirtyKeys, ok) {
    this._pushMetric("flushes", { durationMs, dirtyKeys, ok, at: Date.now() });
  }

  recordQuery(durationMs, kind, rowCount = 0) {
    this._pushMetric("queries", { durationMs, kind, rowCount, at: Date.now() });
  }

  recordTask(durationMs, owner, label) {
    this._pushMetric("tasks", { durationMs, owner, label, at: Date.now() });
  }

  recordEventDispatch(type, durationMs, listeners) {
    this._pushMetric("events", { type, durationMs, listeners, at: Date.now() });
  }

  snapshot() {
    const last = (bucket) => this.metrics[bucket][this.metrics[bucket].length - 1] ?? null;
    return {
      lastTick: last("ticks"),
      lastFlush: last("flushes"),
      lastQuery: last("queries"),
      lastTask: last("tasks"),
      lastEvent: last("events"),
    };
  }
}

export { ObservabilityService, CoreLogger };
