import { strToU8, zip, type Zippable } from 'fflate';

export interface AiStudyExportZipInput {
  manifestText: string;
  markdown: string;
  partFiles: readonly { fileName: string; content: string }[];
}

/** Bundle every file from the assisted-study export into one browser-friendly ZIP. */
export function createAiStudyExportZip(input: AiStudyExportZipInput): Promise<Uint8Array> {
  const files: Zippable = {
    'tai-estudio-manifiesto.json': strToU8(input.manifestText),
    'tai-estudio-informe.md': strToU8(input.markdown),
  };
  for (const part of input.partFiles) files[part.fileName] = strToU8(part.content);

  return new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}
