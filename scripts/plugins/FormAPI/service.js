import { world, system } from "@minecraft/server";
import {
  executeButtonMenu,
  executeConfirm,
  executeModal,
} from "./bedrockForms.js";

/**
 * @typedef {import("./bedrockForms.js").FormResult} FormResult
 * @typedef {import("./bedrockForms.js").ModalFieldSpec} ModalFieldSpec
 * @typedef {import("./config.js").FormApiConfig} FormApiConfig
 */

export class FormAPIService {
  /**
   * @param {FormApiConfig} config
   * @param {{ debug?: (s: string) => void; warn?: (s: string) => void }} logger
   */
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    /** @type {Map<string, Array<{ resolve: (r: FormResult) => void; task: () => Promise<FormResult> }>>} */
    this._queues = new Map();
    /** @type {Set<string>} */
    this._running = new Set();
  }

  start() {
    world.afterEvents.playerLeave.subscribe(({ player }) => {
      this._drainPlayer(player.id);
    });
  }

  stop() {
    for (const id of [...this._queues.keys()]) {
      this._drainPlayer(id);
    }
  }

  /** @param {string} playerId */
  _drainPlayer(playerId) {
    const q = this._queues.get(playerId);
    if (!q?.length) return;
    while (q.length) {
      const item = q.shift();
      item.resolve({ status: "rejected", reason: "PlayerQuit" });
    }
    this._queues.delete(playerId);
  }

  /**
   * @param {import("@minecraft/server").Player} player
   * @param {() => Promise<FormResult>} task
   * @returns {Promise<FormResult>}
   */
  submit(player, task) {
    return new Promise((resolve) => {
      const id = player.id;
      let q = this._queues.get(id);
      if (!q) {
        q = [];
        this._queues.set(id, q);
      }
      q.push({ resolve, task });
      if (!this._running.has(id)) {
        this._running.add(id);
        system.run(() => {
          this._processPlayerQueue(player).finally(() => {
            this._running.delete(id);
          });
        });
      }
    });
  }

  /**
   * @param {import("@minecraft/server").Player} player
   */
  async _processPlayerQueue(player) {
    const id = player.id;
    while (this._queues.get(id)?.length) {
      const q = this._queues.get(id);
      const item = q?.shift();
      if (!item) break;
      const result = await this._runWithTimeout(item.task);
      item.resolve(result);
    }
    if (this._queues.get(id)?.length === 0) {
      this._queues.delete(id);
    }
  }

  /**
   * @param {() => Promise<FormResult>} task
   * @returns {Promise<FormResult>}
   */
  async _runWithTimeout(task) {
    const ms = this.config.queue.timeoutMs;
    const tickDelay = Math.max(1, Math.ceil(ms / 50));
    const timeoutResult = /** @type {FormResult} */ ({
      status: "rejected",
      reason: "Timeout",
    });
    return await Promise.race([
      task(),
      new Promise((resolve) => {
        system.runTimeout(() => resolve(timeoutResult), tickDelay);
      }),
    ]);
  }

  /**
   * @param {import("@minecraft/server").Player} player
   * @param {Parameters<typeof executeButtonMenu>[1]} spec
   */
  showButtonMenu(player, spec) {
    const limits = this.config.limits;
    const logger = this.logger;
    return this.submit(player, () => executeButtonMenu(player, spec, limits, logger));
  }

  /**
   * @param {import("@minecraft/server").Player} player
   * @param {Parameters<typeof executeConfirm>[1]} spec
   */
  showConfirm(player, spec) {
    const logger = this.logger;
    return this.submit(player, () => executeConfirm(player, spec, logger));
  }

  /**
   * @param {import("@minecraft/server").Player} player
   * @param {Parameters<typeof executeModal>[1]} spec
   */
  showModal(player, spec) {
    const logger = this.logger;
    return this.submit(player, () => executeModal(player, spec, logger));
  }
}
