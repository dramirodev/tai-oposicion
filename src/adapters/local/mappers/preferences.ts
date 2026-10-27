import type { MappingResult, Preferences } from '../../../core/domain/entities.js';
import { cleanCfg } from '../config.js';

export const preferencesMapper = {
  toDomain(dto: unknown): MappingResult<Preferences> {
    // cleanCfg is the canonical schema-aware normalizer; duplicating its per-setting rules in Zod
    // would create two authorities and could change legacy defaults or sanitization behavior.
    if (!dto || typeof dto !== 'object' || Array.isArray(dto)) {
      return { ok: false, reason: 'Preferencias inválidas' };
    }
    const cleaned = cleanCfg(dto);
    if (JSON.stringify(cleaned) !== JSON.stringify(dto)) {
      return { ok: false, reason: 'Preferencias con valores fuera de esquema' };
    }
    return { ok: true, value: cleaned };
  },

  toDto(preferences: Preferences): Record<string, unknown> {
    return preferences;
  },
};
