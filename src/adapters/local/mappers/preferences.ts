import type { MappingResult, Preferences } from '../../../core/domain/entities.js';
import { cleanCfg } from '../config.js';

function samePersistedValue(source: unknown, normalized: unknown): boolean {
  if (Object.is(source, normalized)) return true;
  if (Array.isArray(source) || Array.isArray(normalized)) {
    return Array.isArray(source) && Array.isArray(normalized) && source.length === normalized.length
      && source.every((value, index) => samePersistedValue(value, normalized[index]));
  }
  if (!source || !normalized || typeof source !== 'object' || typeof normalized !== 'object') return false;
  const sourceKeys = Object.keys(source).sort();
  const normalizedKeys = Object.keys(normalized).sort();
  return sourceKeys.length === normalizedKeys.length && sourceKeys.every((key, index) =>
    key === normalizedKeys[index] && samePersistedValue((source as Record<string, unknown>)[key], (normalized as Record<string, unknown>)[key]));
}

export const preferencesMapper = {
  toDomain(dto: unknown): MappingResult<Preferences> {
    // cleanCfg is the canonical schema-aware normalizer; duplicating its per-setting rules in Zod
    // would create two authorities and could change legacy defaults or sanitization behavior.
    if (!dto || typeof dto !== 'object' || Array.isArray(dto)) {
      return { ok: false, reason: 'Preferencias inválidas' };
    }
    const cleaned = cleanCfg(dto);
    if (!samePersistedValue(dto, cleaned)) {
      return { ok: false, reason: 'Preferencias con valores fuera de esquema' };
    }
    return { ok: true, value: cleaned };
  },

  toDto(preferences: Preferences): Record<string, unknown> {
    return preferences;
  },
};
