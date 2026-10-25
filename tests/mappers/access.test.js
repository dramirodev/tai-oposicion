import { it, expect } from 'vitest';
import { accessMapper } from '../../src/adapters/firebase/mappers/access.js';
import { firestoreIdMapper } from '../../src/adapters/firebase/mappers/firestore-id.js';

it('mapea el uid del documento junto a la solicitud y emite el DTO sin uid', () => {
  const dto = { email: 'user@example.test', name: 'Persona', ts: 1700000000000 };
  const mapped = accessMapper.toDomain('uid-1', dto);
  expect(mapped.ok).toBe(true);
  expect(mapped.value).toEqual({ uid: 'uid-1', email: dto.email, name: dto.name, requestedAt: dto.ts });
  expect(JSON.stringify(accessMapper.toDto(mapped.value))).toBe(JSON.stringify(dto));
  expect(accessMapper.toDomain('uid-1', {...dto, extra:true})).toMatchObject({ok:false,reason:expect.any(String)});
});

it('codifica y decodifica IDs de Firestore con el formato histórico punto por tilde', () => {
  const id = 'AS12B-P1.04';
  expect(firestoreIdMapper.toDto(id)).toBe('AS12B-P1~04');
  expect(firestoreIdMapper.toDomain(firestoreIdMapper.toDto(id))).toBe(id);
});
