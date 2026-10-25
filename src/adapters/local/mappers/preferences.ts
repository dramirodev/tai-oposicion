import type { MappingResult, Preferences } from '../../../core/domain/entities.js';
import { cleanCfg } from '../config.js';

export const preferencesMapper = {
  toDomain(dto: unknown): MappingResult<Preferences> {
    // TODO(zod): validate Preferences with the config schemas.
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
