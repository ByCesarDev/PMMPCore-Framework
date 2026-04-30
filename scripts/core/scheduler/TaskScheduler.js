class TaskScheduler {
  constructor(observability = null) {
    this.observability = observability;
    this.tasks = new Map();
    this.tickBudgetMs = 8;
    this.currentTick = 0;
    this._nextId = 0;
  }

  schedule(callback, options = {}) {
    const id = options.id || `task:${++this._nextId}`;
    this.tasks.set(id, {
      id,
      callback,
      delay: Math.max(0, options.delay ?? 0),
      interval: options.interval ?? null,
      owner: options.owner || "core",
      label: options.label || id,
      cancelled: false,
    });
    return id;
  }

  cancel(id) {
    const task = this.tasks.get(id);
    if (!task) return false;
    task.cancelled = true;
    this.tasks.delete(id);
    return true;
  }

  tick() {
    this.currentTick++;
    const startedAt = Date.now();
    for (const [id, task] of Array.from(this.tasks.entries())) {
      if (task.cancelled) {
        this.tasks.delete(id);
        continue;
      }
      if (task.delay > 0) {
        task.delay--;
        continue;
      }
      const taskStartedAt = Date.now();
      try {
        task.callback();
      } catch (error) {
        this.observability?.error?.("scheduler", `Task failed: ${task.label}`, {
          owner: task.owner,
          error: error?.message ?? String(error),
        });
      }
      this.observability?.recordTask?.(Date.now() - taskStartedAt, task.owner, task.label);
      if (typeof task.interval === "number" && task.interval > 0) {
        task.delay = task.interval;
      } else {
        this.tasks.delete(id);
      }
      if (Date.now() - startedAt > this.tickBudgetMs) {
        break;
      }
    }
  }

  summary() {
    return Array.from(this.tasks.values()).map((task) => ({
      id: task.id,
      owner: task.owner,
      label: task.label,
      delay: task.delay,
      interval: task.interval,
    }));
  }
}

export { TaskScheduler };
