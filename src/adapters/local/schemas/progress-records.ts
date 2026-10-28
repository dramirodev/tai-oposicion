import { z } from 'zod';

const finiteNumber = z.number().finite();

export const statRecordSchema = z.array(finiteNumber).min(3);
export const cardRecordSchema = z.array(finiteNumber).min(5).max(17);
export const reportRecordSchema = z.strictObject({
  ts: finiteNumber,
  tema: z.string(),
  motivo: z.string(),
  nota: z.string(),
  st: z.enum(['abierto', 'resuelto', 'quitado']),
});
