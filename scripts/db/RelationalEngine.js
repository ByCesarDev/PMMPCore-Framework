/**
 * Motor relacional + SQL subset sobre DatabaseManager (sin tocar DynamicProperty).
 * Fases D–G: tablas, índices, SQL, JOIN, GROUP BY, cache de consultas, vistas materializadas.
 */

const P = "rtable:";
const ROW_THRESHOLD = 28000;
const ASYNC_ROW_THRESHOLD = 200;

/** @param {unknown[]} arr @param {number} n */
function sampleArray(arr, n) {
  if (arr.length <= n) return [...arr];
  const out = [];
  const step = Math.max(1, Math.floor(arr.length / n));
  for (let i = 0; i < arr.length && out.length < n; i += step) out.push(arr[i]);
  return out;
}

function tokenizeSql(sql) {
  const tokens = [];
  let i = 0;
  const s = sql.trim();
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] === "'" || s[i] === '"') {
      const q = s[i++];
      let buf = "";
      while (i < s.length && s[i] !== q) buf += s[i++];
      if (i < s.length) i++;
      tokens.push(buf);
      continue;
    }
    if (s[i] === ",") {
      i++;
      continue;
    }
    let j = i;
    while (j < s.length && !/\s|,/.test(s[j])) j++;
    const tok = s.slice(i, j);
    if (tok.length) tokens.push(tok);
    i = j;
  }
  return tokens;
}

class RelationalEngine {
  /**
   * @param {import("../DatabaseManager.js").DatabaseManager} db
   */
  constructor(db) {
    this.db = db;
    /** @type {Map<string, unknown[]>} */
    this._queryCache = new Map();
    this._queryCacheEnabled = true;
  }

  _invalidateQueryCache() {
    if (this._queryCacheEnabled) this._queryCache.clear();
  }

  _metaKey(table) {
    return `${P}${table}:meta`;
  }

  _indexKey(table, field) {
    return `${P}${table}:index:${field}`;
  }

  _cidxKey(table, fieldsJoined) {
    return `${P}${table}:cidx:${fieldsJoined}`;
  }

  _rowShardKey(table, id, shard) {
    return `${P}${table}:row:${id}:${shard}`;
  }

  _rowMetaKey(table, id) {
    return `${P}${table}:rowmeta:${id}`;
  }

  createTable(name, schema = {}) {
    const existing = this.getMeta(name);
    const meta = existing || { schema: {}, indexes: [], compositeIndexes: [] };
    if (!existing) meta.schema = schema && typeof schema === "object" ? schema : {};
    this.db.set(this._metaKey(name), meta);
  }

  getMeta(table) {
    return this.db.get(this._metaKey(table));
  }

  _setMeta(table, meta) {
    this.db.set(this._metaKey(table), meta);
  }

  createIndex(table, field) {
    const meta = this.getMeta(table);
    if (!meta) throw new Error(`Unknown table: ${table}`);
    if (!meta.indexes.includes(field)) {
      meta.indexes.push(field);
      this._setMeta(table, meta);
    }
    if (!this.db.get(this._indexKey(table, field))) {
      this.db.set(this._indexKey(table, field), {});
    }
  }

  /** @param {string} table @param {string[]} fields */
  createCompositeIndex(table, fields) {
    const meta = this.getMeta(table);
    if (!meta) throw new Error(`Unknown table: ${table}`);
    meta.compositeIndexes = meta.compositeIndexes || [];
    const key = fields.join("|");
    if (!meta.compositeIndexes.some((f) => f.join("|") === key)) {
      meta.compositeIndexes.push([...fields]);
      this._setMeta(table, meta);
    }
    this.db.set(this._cidxKey(table, key), {});
  }

  /**
   * @param {string} table
   * @param {string|null} id
   * @returns {Record<string, unknown>|null}
   */
  getRow(table, id) {
    if (id == null) return null;
    const meta = this.db.get(this._rowMetaKey(table, id));
    if (!meta || typeof meta.shards !== "number") return null;
    if (meta.shards === 1) {
      const v = this.db.get(this._rowShardKey(table, id, 0));
      if (v === null || v === undefined) return null;
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      }
      return typeof v === "object" ? /** @type {Record<string, unknown>} */ (v) : null;
    }
    let acc = "";
    for (let i = 0; i < meta.shards; i++) {
      const part = this.db.get(this._rowShardKey(table, id, i));
      if (typeof part === "string") acc += part;
    }
    try {
      return JSON.parse(acc);
    } catch {
      return null;
    }
  }

  /**
   * @param {string} table
   * @param {string} id
   * @param {Record<string, unknown>} data
   */
  upsert(table, id, data) {
    this._invalidateQueryCache();
    const oldRow = this.getRow(table, id);
    const row = { id, ...data };
    const json = JSON.stringify(row);

    if (json.length > ROW_THRESHOLD) {
      const shards = [];
      for (let i = 0; i < json.length; i += ROW_THRESHOLD) {
        shards.push(json.slice(i, i + ROW_THRESHOLD));
      }
      for (let i = 0; i < shards.length; i++) {
        this.db.set(this._rowShardKey(table, id, i), shards[i]);
      }
      const prevMeta = this.db.get(this._rowMetaKey(table, id));
      const oldCount = prevMeta?.shards ?? 0;
      for (let i = shards.length; i < oldCount; i++) {
        this.db.delete(this._rowShardKey(table, id, i));
      }
      this.db.set(this._rowMetaKey(table, id), { shards: shards.length });
    } else {
      this.db.set(this._rowShardKey(table, id, 0), row);
      const prevMeta = this.db.get(this._rowMetaKey(table, id));
      const oldCount = prevMeta?.shards ?? 1;
      for (let i = 1; i < oldCount; i++) {
        this.db.delete(this._rowShardKey(table, id, i));
      }
      this.db.set(this._rowMetaKey(table, id), { shards: 1 });
    }

    this._updateIndexes(table, oldRow, row);
    return row;
  }

  /**
   * @param {Record<string, unknown>|null} oldRow
   * @param {Record<string, unknown>|null} newRow
   */
  _updateIndexes(table, oldRow, newRow) {
    const meta = this.getMeta(table);
    if (!meta) return;

    for (const field of meta.indexes || []) {
      const idxKey = this._indexKey(table, field);
      const index = this.db.get(idxKey) || {};
      if (oldRow && oldRow.id != null) {
        const v = String(oldRow[field]);
        const arr = index[v] || [];
        const ix = arr.indexOf(oldRow.id);
        if (ix >= 0) {
          arr.splice(ix, 1);
          if (arr.length === 0) delete index[v];
          else index[v] = arr;
        }
      }
      if (newRow && newRow.id != null) {
        const v = String(newRow[field]);
        if (!index[v]) index[v] = [];
        if (!index[v].includes(newRow.id)) index[v].push(newRow.id);
      }
      this.db.set(idxKey, index);
    }

    for (const fields of meta.compositeIndexes || []) {
      const ck = fields.join("|");
      const idxKey = this._cidxKey(table, ck);
      const index = this.db.get(idxKey) || {};
      if (oldRow && oldRow.id != null) {
        const k = fields.map((f) => String(oldRow[f])).join("|");
        const arr = index[k] || [];
        const ix = arr.indexOf(oldRow.id);
        if (ix >= 0) {
          arr.splice(ix, 1);
          if (arr.length === 0) delete index[k];
          else index[k] = arr;
        }
      }
      if (newRow && newRow.id != null) {
        const k = fields.map((f) => String(newRow[f])).join("|");
        if (!index[k]) index[k] = [];
        if (!index[k].includes(newRow.id)) index[k].push(newRow.id);
      }
      this.db.set(idxKey, index);
    }
  }

  deleteRow(table, id) {
    const oldRow = this.getRow(table, id);
    if (!oldRow) return false;
    this._invalidateQueryCache();
    this._updateIndexes(table, oldRow, null);
    const meta = this.db.get(this._rowMetaKey(table, id));
    const n = meta?.shards ?? 1;
    for (let i = 0; i < n; i++) {
      this.db.delete(this._rowShardKey(table, id, i));
    }
    this.db.delete(this._rowMetaKey(table, id));
    return true;
  }

  findAll(table) {
    const prefix = `${P}${table}:rowmeta:`;
    const sufs = this.db.listPropertySuffixes(prefix);
    const ids = [...new Set(sufs.map((s) => s.slice(prefix.length)))];
    return ids.map((id) => this.getRow(table, id)).filter(Boolean);
  }

  /**
   * @param {string} table
   * @param {Record<string, unknown>} queryObj un campo
   */
  find(table, queryObj) {
    const entries = Object.entries(queryObj);
    if (entries.length === 0) return this.findAll(table);
    const [field, value] = entries[0];
    const index = this.db.get(this._indexKey(table, field));
    if (!index) {
      throw new Error(`No index on field "${field}" for table "${table}"`);
    }
    const ids = index[String(value)] || [];
    return ids.map((id) => this.getRow(table, id)).filter(Boolean);
  }

  /**
   * @param {string} table
   * @param {string[]} fields
   * @param {unknown[]} values
   */
  findComposite(table, fields, values) {
    const ck = fields.join("|");
    const index = this.db.get(this._cidxKey(table, ck));
    if (!index) throw new Error(`No composite index ${ck} on ${table}`);
    const k = values.map(String).join("|");
    const ids = index[k] || [];
    return ids.map((id) => this.getRow(table, id)).filter(Boolean);
  }

  migrate(version, fn) {
    const cur = this.db.get(`${P}__version`) || 0;
    if (cur >= version) return;
    fn(this);
    this.db.set(`${P}__version`, version);
  }

  analyze(table) {
    const rows = this.findAll(table);
    const sample = rows.length > 1000 ? sampleArray(rows, 100) : rows;
    /** @type {Record<string, Record<string, number>>} */
    const stats = {};
    for (const r of sample) {
      for (const k of Object.keys(r)) {
        if (!stats[k]) stats[k] = {};
        const v = String(r[k]);
        stats[k][v] = (stats[k][v] || 0) + 1;
      }
    }
    const meta = this.getMeta(table);
    if (meta) {
      meta.stats = stats;
      meta._sampleSize = sample.length;
      this._setMeta(table, meta);
    }
  }

  _selectivity(table, field, value) {
    const meta = this.getMeta(table);
    const st = meta?.stats?.[field];
    if (!st) return 1;
    const total = Object.values(st).reduce((a, b) => a + b, 0) || 1;
    const c = st[String(value)] || 0;
    return c / total;
  }

  _hasIndex(table, field) {
    const meta = this.getMeta(table);
    return !!(meta?.indexes || []).includes(field);
  }

  _parseWhereClause(tokens, startIdx) {
    /** @type {( { field: string, op: string, value: string } | "AND" | "OR" )[]} */
    const out = [];
    let i = startIdx;
    while (i < tokens.length) {
      const up = tokens[i].toUpperCase();
      if (["ORDER", "LIMIT", "OFFSET", "GROUP", "JOIN", "INNER", "FROM"].includes(up)) break;
      if (up === "AND" || up === "OR") {
        out.push(up);
        i++;
        continue;
      }
      const field = tokens[i++];
      if (i >= tokens.length) break;
      const op = tokens[i++];
      if (i >= tokens.length) break;
      const value = tokens[i++];
      if (["=", ">", "<", ">=", "<=", "!="].includes(op)) {
        out.push({ field, op, value: String(value) });
      } else {
        break;
      }
    }
    return { where: out, next: i };
  }

  /**
   * @returns {{ fields: string[], table: string, where: any[], orderBy: { field: string, dir: string } | null, limit: number | null, offset: number | null, joins: { table: string, left: string, right: string }[], groupBy: string | null, aggregates: { fn: string, field?: string, alias: string }[] }}
   */
  _parseSelect(sql) {
    const tokens = tokenizeSql(sql);
    let i = 0;
    if (!tokens.length || tokens[0].toUpperCase() !== "SELECT") {
      throw new Error("Only SELECT is supported");
    }
    i++;
    const fields = [];
    while (i < tokens.length && tokens[i].toUpperCase() !== "FROM") {
      const t = tokens[i++];
      if (t !== "*") fields.push(t.replace(/,/g, ""));
    }
    if (tokens[i]?.toUpperCase() !== "FROM") throw new Error("Expected FROM");
    i++;
    const table = tokens[i++];
    const joins = [];
    let where = [];
    let orderBy = null;
    let limit = null;
    let offset = null;
    let groupBy = null;
    const aggregates = [];

    while (i < tokens.length) {
      const up = tokens[i].toUpperCase();
      if (up === "INNER") {
        i++;
        if (tokens[i]?.toUpperCase() !== "JOIN") throw new Error("Expected JOIN");
        i++;
        const jt = tokens[i++];
        if (tokens[i]?.toUpperCase() !== "ON") throw new Error("Expected ON");
        i++;
        const left = tokens[i++];
        if (tokens[i] !== "=") throw new Error("Expected = in JOIN");
        i++;
        const right = tokens[i++];
        joins.push({ table: jt, left, right });
        continue;
      }
      if (up === "JOIN") {
        i++;
        const jt = tokens[i++];
        if (tokens[i]?.toUpperCase() !== "ON") throw new Error("Expected ON");
        i++;
        const left = tokens[i++];
        if (tokens[i] !== "=") throw new Error("Expected = in JOIN");
        i++;
        const right = tokens[i++];
        joins.push({ table: jt, left, right });
        continue;
      }
      if (up === "WHERE") {
        i++;
        const pw = this._parseWhereClause(tokens, i);
        where = pw.where;
        i = pw.next;
        continue;
      }
      if (up === "ORDER") {
        i++;
        if (tokens[i]?.toUpperCase() !== "BY") throw new Error("Expected BY");
        i++;
        const field = tokens[i++];
        let dir = "ASC";
        if (tokens[i] && ["ASC", "DESC"].includes(tokens[i].toUpperCase())) {
          dir = tokens[i++].toUpperCase();
        }
        orderBy = { field, dir };
        continue;
      }
      if (up === "LIMIT") {
        i++;
        limit = parseInt(tokens[i++], 10);
        continue;
      }
      if (up === "OFFSET") {
        i++;
        offset = parseInt(tokens[i++], 10);
        continue;
      }
      if (up === "GROUP") {
        i++;
        if (tokens[i]?.toUpperCase() !== "BY") throw new Error("Expected BY after GROUP");
        i++;
        groupBy = tokens[i++];
        continue;
      }
      break;
    }

    for (const f of fields) {
      if (/^COUNT\(\*\)$/i.test(f)) aggregates.push({ fn: "COUNT", alias: "count" });
      const sm = /^SUM\((\w+)\)$/i.exec(f);
      if (sm) aggregates.push({ fn: "SUM", field: sm[1], alias: `sum_${sm[1]}` });
    }

    return { fields, table, where, orderBy, limit, offset, joins, groupBy, aggregates };
  }

  _cmpOp(rowVal, op, target) {
    const nRow = Number(rowVal);
    const nT = Number(target);
    const useNum = !Number.isNaN(nRow) && !Number.isNaN(nT);
    const a = useNum ? nRow : rowVal;
    const b = useNum ? nT : target;
    switch (op) {
      case "=":
        return a == b;
      case "!=":
        return a != b;
      case ">":
        return a > b;
      case "<":
        return a < b;
      case ">=":
        return a >= b;
      case "<=":
        return a <= b;
      default:
        return false;
    }
  }

  _matchOne(row, cond) {
    const v = row[cond.field];
    return this._cmpOp(v, cond.op, cond.value);
  }

  _evaluateWhere(row, where) {
    if (!where.length) return true;
    let acc = typeof where[0] === "object" ? this._matchOne(row, where[0]) : true;
    for (let i = 1; i < where.length; i += 2) {
      const op = where[i];
      const next = where[i + 1];
      if (op !== "AND" && op !== "OR") break;
      if (typeof next !== "object") break;
      if (op === "AND") acc = acc && this._matchOne(row, next);
      else acc = acc || this._matchOne(row, next);
    }
    return acc;
  }

  _plan(ast) {
    for (let i = 0; i < ast.where.length; i++) {
      const w = ast.where[i];
      if (typeof w === "object" && w.op === "=" && this._hasIndex(ast.table, w.field)) {
        return { type: "index", field: w.field, value: w.value };
      }
    }
    return { type: "scan" };
  }

  _baseRows(ast) {
    const plan = this._plan(ast);
    if (plan.type === "index") {
      try {
        return this.find(ast.table, { [plan.field]: plan.value });
      } catch {
        return this.findAll(ast.table);
      }
    }
    return this.findAll(ast.table);
  }

  _joinRows(leftRows, rightTable, leftRef, rightRef) {
    const lField = leftRef.includes(".") ? leftRef.split(".").pop() : leftRef;
    const rField = rightRef.includes(".") ? rightRef.split(".").pop() : rightRef;
    const rightRows = this.findAll(rightTable);
    const idx = new Map();
    for (const b of rightRows) {
      const k = String(b[rField]);
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(b);
    }
    const out = [];
    for (const a of leftRows) {
      const k = String(a[lField]);
      const matches = idx.get(k) || [];
      for (const b of matches) {
        out.push({ ...a, ...b });
      }
    }
    return out;
  }

  _applyJoins(rows, ast) {
    let r = rows;
    for (const j of ast.joins) {
      r = this._joinRows(r, j.table, j.left, j.right);
    }
    return r;
  }

  _groupBy(rows, field, aggregates) {
    const groups = new Map();
    for (const row of rows) {
      const k = String(row[field]);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(row);
    }
    const out = [];
    for (const [k, list] of groups) {
      /** @type {Record<string, unknown>} */
      const obj = { [field]: k };
      for (const agg of aggregates) {
        if (agg.fn === "COUNT") obj[agg.alias] = list.length;
        if (agg.fn === "SUM" && agg.field) {
          obj[agg.alias] = list.reduce((a, x) => a + (Number(x[agg.field]) || 0), 0);
        }
      }
      out.push(obj);
    }
    return out;
  }

  _project(rows, fields) {
    if (fields.length === 0 || (fields.length === 1 && fields[0] === "*")) return rows;
    return rows.map((r) => {
      /** @type {Record<string, unknown>} */
      const o = {};
      for (const f of fields) {
        if (/^COUNT\(\*\)$/i.test(f) || /^SUM\(/i.test(f)) continue;
        o[f] = r[f];
      }
      return o;
    });
  }

  _sort(rows, field, dir) {
    const mul = dir === "DESC" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      if (va < vb) return -1 * mul;
      if (va > vb) return 1 * mul;
      return 0;
    });
  }

  /**
   * @param {string} sql
   * @returns {unknown[]}
   */
  executeQuery(sql) {
    const norm = sql.trim().replace(/\s+/g, " ");
    if (this._queryCacheEnabled && this._queryCache.has(norm)) {
      return /** @type {unknown[]} */ (this._queryCache.get(norm));
    }
    const ast = this._parseSelect(sql);
    let rows = this._baseRows(ast);
    rows = this._applyJoins(rows, ast);
    rows = rows.filter((r) => this._evaluateWhere(r, ast.where));
    if (ast.groupBy) {
      rows = this._groupBy(rows, ast.groupBy, ast.aggregates);
    } else {
      rows = this._project(rows, ast.fields);
    }
    if (ast.orderBy) {
      rows = this._sort(rows, ast.orderBy.field, ast.orderBy.dir);
    }
    if (ast.offset != null) {
      rows = rows.slice(ast.offset);
    }
    if (ast.limit != null) {
      rows = rows.slice(0, ast.limit);
    }
    if (this._queryCacheEnabled) this._queryCache.set(norm, rows);
    return rows;
  }

  /**
   * Igual que executeQuery pero filtra en trozos para no bloquear un tick largo.
   * @param {string} sql
   * @param {import("@minecraft/server").System} system
   * @param {(err: Error | null, rows?: unknown[]) => void} onDone
   * @param {number} [chunkSize]
   */
  executeQueryAsync(sql, system, onDone, chunkSize = 50) {
    let ast;
    try {
      ast = this._parseSelect(sql);
    } catch (e) {
      onDone(/** @type {Error} */ (e));
      return;
    }
    const norm = sql.trim().replace(/\s+/g, " ");
    if (this._queryCacheEnabled && this._queryCache.has(norm)) {
      onDone(null, /** @type {unknown[]} */ (this._queryCache.get(norm)));
      return;
    }

    let base = this._baseRows(ast);
    base = this._applyJoins(base, ast);
    if (base.length <= ASYNC_ROW_THRESHOLD) {
      try {
        let rows = base.filter((r) => this._evaluateWhere(r, ast.where));
        if (ast.groupBy) rows = this._groupBy(rows, ast.groupBy, ast.aggregates);
        else rows = this._project(rows, ast.fields);
        if (ast.orderBy) rows = this._sort(rows, ast.orderBy.field, ast.orderBy.dir);
        if (ast.offset != null) rows = rows.slice(ast.offset);
        if (ast.limit != null) rows = rows.slice(0, ast.limit);
        if (this._queryCacheEnabled) this._queryCache.set(norm, rows);
        onDone(null, rows);
      } catch (e) {
        onDone(/** @type {Error} */ (e));
      }
      return;
    }

    let i = 0;
    /** @type {unknown[]} */
    const acc = [];
    const step = () => {
      const end = Math.min(i + chunkSize, base.length);
      for (; i < end; i++) {
        if (this._evaluateWhere(base[i], ast.where)) acc.push(base[i]);
      }
      if (i < base.length) {
        system.run(step);
        return;
      }
      let rows = acc;
      if (ast.groupBy) rows = this._groupBy(rows, ast.groupBy, ast.aggregates);
      else rows = this._project(rows, ast.fields);
      if (ast.orderBy) rows = this._sort(rows, ast.orderBy.field, ast.orderBy.dir);
      if (ast.offset != null) rows = rows.slice(ast.offset);
      if (ast.limit != null) rows = rows.slice(0, ast.limit);
      if (this._queryCacheEnabled) this._queryCache.set(norm, rows);
      onDone(null, rows);
    };
    system.run(step);
  }

  createMaterializedView(name, sql) {
    const data = this.executeQuery(sql);
    this.db.set(`${P}view:${name}`, { sql, data, ts: Date.now() });
  }

  getMaterializedView(name) {
    const v = this.db.get(`${P}view:${name}`);
    return v?.data ?? [];
  }

  refreshMaterializedView(name) {
    const v = this.db.get(`${P}view:${name}`);
    if (!v?.sql) return;
    const data = this.executeQuery(v.sql);
    this.db.set(`${P}view:${name}`, { ...v, data, ts: Date.now() });
  }
}

export { RelationalEngine };
