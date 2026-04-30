class TickCoordinator {
  constructor({ scheduler, observability, db = null }) {
    this.scheduler = scheduler;
    this.observability = observability;
    this.db = db;
  }

  tick() {
    const startedAt = Date.now();
    this.scheduler?.tick?.();
    this.observability?.recordTick?.(Date.now() - startedAt);
  }

  flushDatabase() {
    if (!this.db || typeof this.db.flush !== "function") return true;
    const startedAt = Date.now();
    const ok = this.db.flush();
    this.observability?.recordFlush?.(Date.now() - startedAt, this.db.getStats?.().dirtyKeys ?? 0, ok);
    return ok;
  }
}

export { TickCoordinator };
