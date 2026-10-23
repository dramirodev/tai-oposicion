// Preferencias externas: límites de tamaño, claves seguras y formas que admiten las pantallas.
const safeKey = k => /^[A-Za-z0-9_.-]{1,40}$/.test(k) && !['__proto__', 'constructor', 'prototype'].includes(k);
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const integer = (lo, hi) => v => Number.isInteger(v) && v >= lo && v <= hi;
const oneOf = values => v => values.includes(v);
const bool = v => typeof v === 'boolean';
const temas = v => Array.isArray(v) && v.every(x => typeof x === 'string' && /^T\d\.\d\d$/.test(x));
const origins = v => Array.isArray(v) && v.every(x => ['O', 'A', 'G'].includes(x));
const scope = oneOf(['vistos', 'todos']);
const schemas = {
  ui: { defaults: {}, fields: { theme: oneOf(['auto', 'light', 'dark']), size: integer(0, 3), lectura: integer(0, 2) } },
  test: { defaults: { sel: [], n: 15, mode: 'nuevas', o: ['O', 'A', 'G'] }, fields: {
    sel: temas, n: integer(1, 80), mode: oneOf(['nuevas', 'aleatorio', 'falladas', 'dudosas', 'trampas']), o: origins, pt: integer(0, 1), min: integer(1, 180),
  } },
  sim: { defaults: { n: 80, min: 90, o: ['O', 'G'], parte2: true, scope: 'vistos' }, fields: {
    n: oneOf([40, 80]), min: integer(1, 180), o: origins, parte2: bool, scope,
  } },
  cardsc: { defaults: { n: 20, scope: 'vistos' }, fields: { n: oneOf([10, 20, 30]), scope } },
  evo: { defaults: { m: 'acierto', f: 'g', w: 12, tabla: false }, fields: {
    m: oneOf(['acierto', 'tiempo']), f: v => typeof v === 'string' && /^(g|t:T\d\.\d\d|k:[DICK])$/.test(v), w: oneOf([8, 12, 26]), tabla: bool,
  } },
  simc: { defaults: {}, fields: { a: integer(0, 299), b: integer(0, 299) } },
  slow: { defaults: {}, fields: { ok: bool } },
};
function cleanValue(v, depth = 0) {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.slice(0, 200);
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (!object(v) && !Array.isArray(v) || depth >= 5) return undefined;
  if (Array.isArray(v)) return v.slice(0, 300).map(x => cleanValue(x, depth + 1)).filter(x => x !== undefined);
  const out = {};
  for (const k of Object.keys(v).slice(0, 100)) {
    if (!safeKey(k)) continue;
    const value = cleanValue(v[k], depth + 1);
    if (value !== undefined) out[k] = value;
  }
  return out;
}
export function cleanCfgSetting(key, value) {
  if (!safeKey(key)) return undefined;
  const v = cleanValue(value);
  const schema = own(schemas, key) ? schemas[key] : null;
  if (schema) {
    if (!object(v)) return undefined;
    const out = JSON.parse(JSON.stringify(schema.defaults));
    for (const [field, check] of Object.entries(schema.fields)) if (own(v, field) && check(v[field])) out[field] = v[field];
    return out;
  }
  if (key === 'tdet') {
    if (!object(v)) return undefined;
    const out = {};
    for (const [k, pair] of Object.entries(v)) {
      if (/^(?:[1-9]|1[0-4])$/.test(k) && Array.isArray(pair) && pair.length === 2 && pair.every(integer(0, 1e6))) out[k] = [pair[0], Math.min(pair[0], pair[1])];
    }
    return out;
  }
  return v;
}
export function cleanCfg(cfg) {
  if (!object(cfg)) return {};
  const out = {};
  for (const key of Object.keys(cfg).slice(0, 100)) {
    const value = cleanCfgSetting(key, cfg[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}
