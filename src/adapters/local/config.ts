// Preferencias externas: límites de tamaño, claves seguras y formas que admiten las pantallas.
const safeKey = (key: string) => /^[A-Za-z0-9_.-]{1,40}$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key);
const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (lo: number, hi: number) => (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value >= lo && value <= hi;
const oneOf = (values: readonly unknown[]) => (value: unknown): boolean => values.includes(value);
const bool = (value: unknown) => typeof value === 'boolean';
const temas = (value: unknown) => Array.isArray(value) && value.every(value => typeof value === 'string' && /^T\d\.\d\d$/.test(value));
const origins = (value: unknown) => Array.isArray(value) && value.every(value => ['O', 'A', 'G'].includes(value));
const trainingMinutes = (value: unknown) => Array.isArray(value) && value.length === 7 && value.every(integer(0, 240));
const trainingActivities = (value: unknown) => Array.isArray(value) && value.length >= 1 && value.length <= 4 && new Set(value).size === value.length
  && value.every(oneOf(['activeRecall', 'topicTest', 'failures', 'spacedReviews']));
const trainingTopicId = (value: unknown) => typeof value === 'string' && /^T[1-4]\.\d{2}$/.test(value);
const trainingReviewModes = (value: unknown) => object(value) && Object.keys(value).length <= 36
  && Object.entries(value).every(([topicId, mode]) => /^T[1-4]\.\d{2}$/.test(topicId) && ['initial-study', 'active-retrieval', 'selective-reading', 'broad-reading'].includes(String(mode)));
const scope = oneOf(['vistos', 'todos']);
type Check = (value: unknown) => boolean;
const schemas: Record<string, { defaults: Record<string, unknown>; fields: Record<string, Check> }> = {
  ui: { defaults: {}, fields: { theme: oneOf(['auto', 'light', 'dark']), size: integer(0, 3), lectura: integer(0, 2) } },
  test: { defaults: { sel: [], n: 15, mode: 'nuevas', o: ['O', 'A', 'G'] }, fields: {
    all: bool, sel: temas, n: integer(1, 80), mode: oneOf(['nuevas', 'aleatorio', 'falladas', 'dudosas', 'trampas']), o: origins, pt: integer(0, 1), min: integer(1, 180),
  } },
  sim: { defaults: { n: 80, min: 90, o: ['O', 'G'], parte2: true, scope: 'vistos' }, fields: {
    n: oneOf([40, 80]), min: integer(1, 180), o: origins, parte2: bool, scope,
  } },
  cardsc: { defaults: { n: 20, scope: 'vistos' }, fields: { n: oneOf([10, 20, 30]), scope } },
  evo: { defaults: { m: 'acierto', f: 'g', w: 12, tabla: false }, fields: {
    m: oneOf(['acierto', 'tiempo']), f: (value: unknown) => typeof value === 'string' && /^(g|t:T\d\.\d\d|k:[DICK])$/.test(value), w: oneOf([8, 12, 26]), tabla: bool,
  } },
  simc: { defaults: {}, fields: { a: integer(0, 299), b: integer(0, 299) } },
  slow: { defaults: {}, fields: { ok: bool } },
  training: { defaults: {}, fields: { minutesByDay: trainingMinutes, introductionDay: integer(0, 6), introductionTopicId: trainingTopicId, activities: trainingActivities, reviewModesByTopic: trainingReviewModes } },
};
function cleanValue(itemValue: unknown, depth = 0): unknown {
  if (itemValue === null || typeof itemValue === 'boolean') return itemValue;
  if (typeof itemValue === 'string') return itemValue.slice(0, 200);
  if (typeof itemValue === 'number') return Number.isFinite(itemValue) ? itemValue : undefined;
  if (!object(itemValue) && !Array.isArray(itemValue) || depth >= 5) return undefined;
  if (Array.isArray(itemValue)) return itemValue.slice(0, 300).map(value => cleanValue(value, depth + 1)).filter(value => value !== undefined);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(itemValue).slice(0, 100)) {
    if (!safeKey(key)) continue;
    const value = cleanValue(itemValue[key], depth + 1);
    if (value !== undefined) out[key] = value;
  }
  return out;
}
export function cleanCfgSetting(key: string, value: unknown): unknown {
  if (!safeKey(key)) return undefined;
  const itemValue = cleanValue(value);
  const schema = own(schemas, key) ? schemas[key] : null;
  if (schema) {
    if (!object(itemValue)) return undefined;
    const out: Record<string, unknown> = JSON.parse(JSON.stringify(schema.defaults));
    for (const [field, check] of Object.entries(schema.fields)) if (own(itemValue, field) && check(itemValue[field])) out[field] = itemValue[field];
    return out;
  }
  if (key === 'tdet') {
    if (!object(itemValue)) return undefined;
    const out: Record<string, number[]> = {};
    for (const [objectKey, pair] of Object.entries(itemValue)) {
      if (/^(?:[1-9]|1[0-4])$/.test(objectKey) && Array.isArray(pair) && pair.length === 2 && pair.every(integer(0, 1e6))) out[objectKey] = [pair[0], Math.min(pair[0], pair[1])];
    }
    return out;
  }
  return itemValue;
}
export function cleanCfg(cfg: unknown): Record<string, unknown> {
  if (!object(cfg)) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(cfg).slice(0, 100)) {
    const value = cleanCfgSetting(key, cfg[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}
