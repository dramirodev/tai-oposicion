import { z } from 'zod';

const nonBlankText = z.string().refine((value) => value.trim().length > 0);
const sourceUrl = z.string().refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'invalid-source-url');

export const explanationDtoSchema = z.object({
  i: nonBlankText,
  rev: nonBlankText,
  lang: nonBlankText,
  status: z.enum(['draft', 'reviewed']),
  snippet: nonBlankText,
  result: z.object({
    kind: z.enum(['output', 'compile-error', 'runtime-error', 'logic']),
    value: z.string().optional(),
  }),
  steps: z.array(z.object({ title: nonBlankText, detail: nonBlankText })),
  distractors: z.array(z.object({ option: z.number().int().nonnegative(), detail: nonBlankText })),
  limitation: nonBlankText,
  editorialNote: z.string().optional(),
  sources: z.array(z.object({ title: nonBlankText, url: sourceUrl, section: z.string().optional() })),
});
