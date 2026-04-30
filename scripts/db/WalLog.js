import { world } from "@minecraft/server";

const WAL_SHARD_0 = "pmmpcore:wal:0";
const WAL_SHARD_1 = "pmmpcore:wal:1";

/**
 * WAL mínimo: snapshot serializado en 1–2 claves; se vacía tras flush exitoso.
 */
class WalLog {
  /**
   * @param {Array<{ suffix: string, value: unknown }>} snapshot
   */
  writeSnapshot(snapshot) {
    let payload = JSON.stringify(snapshot);
    if (payload.length > 28000) {
      const truncated = snapshot.slice(0, Math.max(1, Math.floor(snapshot.length / 2)));
      payload = JSON.stringify(truncated);
      console.warn("[WalLog] snapshot truncated to fit DynamicProperty limit");
    }
    try {
      world.setDynamicProperty(WAL_SHARD_0, payload);
      world.setDynamicProperty(WAL_SHARD_1, undefined);
    } catch (e) {
      try {
        world.setDynamicProperty(WAL_SHARD_1, payload);
        world.setDynamicProperty(WAL_SHARD_0, undefined);
      } catch (e2) {
        console.error(`[WalLog] writeSnapshot: ${e2.message}`);
      }
    }
  }

  clear() {
    try {
      world.setDynamicProperty(WAL_SHARD_0, undefined);
      world.setDynamicProperty(WAL_SHARD_1, undefined);
    } catch (e) {
      console.error(`[WalLog] clear: ${e.message}`);
    }
  }

  /**
   * @returns {Array<{ suffix: string, value: unknown }>|null}
   */
  readAny() {
    for (const k of [WAL_SHARD_0, WAL_SHARD_1]) {
      try {
        const raw = world.getDynamicProperty(k);
        if (raw === undefined || raw === null) continue;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

export { WalLog, WAL_SHARD_0, WAL_SHARD_1 };
