import { escapeHtml as esc } from './format.ts';

type Span = [number, number];
// Resalta en negrita (HTML ya escapado) el fragmento de respuesta que mejor coincide con la explicación.
const STOP = new Set('para como pero este esta estos estas esos esas sobre entre desde hasta cada todo todos toda todas otro otra otros otras puede pueden será serán solo sólo tiene tienen según cuando donde mientras ellos ellas dicho dicha cual cuales'.split(' '));
const normalizeWord = (word: string) => word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '');
export function hiliteHtml(sourceTextInput: unknown, answerTextInput: unknown): string {
  const escapeHtml = (text: unknown) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sourceText = String(sourceTextInput || ''), answerText = String(answerTextInput || '');
  const tokens = sourceText.split(/(\s+)/);
  const wordTokenIndexes: number[] = [];
  tokens.forEach((token, tokenIndex) => { if (token && !/^\s+$/.test(token)) wordTokenIndexes.push(tokenIndex); });
  if (!answerText.trim() || !wordTokenIndexes.length) return richCitationMarkup(sourceText, null, escapeHtml);
  const normalizedWords = wordTokenIndexes.map(tokenIndex => normalizeWord(tokens[tokenIndex]));
  const answerKeywords = new Set(answerText.split(/\s+/).map(normalizeWord).filter(word => word.length > 3 && !STOP.has(word) || /^\d+$/.test(word)));
  if (!answerKeywords.size || !wordTokenIndexes.length) return richCitationMarkup(sourceText, null, escapeHtml);
  const isAnswerKeyword = normalizedWords.map(word => answerKeywords.has(word));
  let bestMatch: { startIndex: number; endIndex: number; score: number; matchedKeywordCount: number } | null = null;
  const maximumWindowLength = Math.min(wordTokenIndexes.length, answerKeywords.size * 2 + 6);
  for (let startWordIndex = 0; startWordIndex < wordTokenIndexes.length; startWordIndex++) {
    if (!isAnswerKeyword[startWordIndex]) continue;
    const matchedKeywords = new Set<string>();
    for (let endWordIndex = startWordIndex; endWordIndex < Math.min(wordTokenIndexes.length, startWordIndex + maximumWindowLength); endWordIndex++) {
      if (isAnswerKeyword[endWordIndex]) matchedKeywords.add(normalizedWords[endWordIndex]);
      if (!isAnswerKeyword[endWordIndex]) continue;
      const score = matchedKeywords.size - (endWordIndex - startWordIndex + 1 - matchedKeywords.size) * 0.15;
      if (!bestMatch || score > bestMatch.score + 1e-9 || (Math.abs(score - bestMatch.score) < 1e-9 && endWordIndex - startWordIndex < bestMatch.endIndex - bestMatch.startIndex)) {
        bestMatch = { startIndex: startWordIndex, endIndex: endWordIndex, score, matchedKeywordCount: matchedKeywords.size };
      }
    }
  }
  if (!bestMatch || bestMatch.matchedKeywordCount < Math.min(2, answerKeywords.size)) return richCitationMarkup(sourceText, null, escapeHtml);
  const firstTokenIndex = wordTokenIndexes[bestMatch.startIndex], lastTokenIndex = wordTokenIndexes[bestMatch.endIndex];
  const emphasis: Span = [tokens.slice(0, firstTokenIndex).join('').length, tokens.slice(0, lastTokenIndex + 1).join('').length];
  return richCitationMarkup(sourceText, emphasis, escapeHtml);
}

// ───────── lectura atenta (contra los fallos por velocidad) ─────────
// Palabras que cambian el sentido: negaciones, excepciones, absolutos, restrictivos y cifras/plazos.
const KW = /(?<![\p{L}\d])(NO|NUNCA|NINGUN[OA]S?|NADA|SIEMPRE|TODOS|TODAS|SOLO|SÓLO|ÚNICAMENTE|EXCLUSIVAMENTE|EXCEPTO|SALVO|INCORRECT[OA]S?|FALS[OA]S?|VERDADER[OA]S?|CORRECT[OA]S?|MÁXIM[OA]S?|MÍNIM[OA]S?|SIN|MENOS|MÁS|ANTES|DESPUÉS|HÁBILES|NATURALES)(?![\p{L}\d])|(?<![\p{L}\d])\d[\d.,]*(?:\s?(?:%|bits?|bytes?|GB|MB|KB|Mbps|Gbps|MHz|GHz|días?|meses|años?|horas?|segundos?|puertos?))?/giu;
export function claveSpans(text: unknown): Span[] {
  const textValue = String(text ?? ''), spans: Span[] = []; let match: RegExpExecArray | null; KW.lastIndex = 0;
  while ((match = KW.exec(textValue))) {
    const matchedKeyword = match[0];
    // «NO», «MÁS», «SIN»… en minúscula son palabras corrientes: solo se marcan en mayúsculas o los términos fuertes
    const flojo = /^(no|más|sin|menos|antes|después|correct[oa]s?|verdader[oa]s?|todos|todas|solo|sólo|nada)$/i.test(matchedKeyword) && matchedKeyword !== matchedKeyword.toUpperCase();
    if (flojo) continue;
    if (match.index === KW.lastIndex) KW.lastIndex++;
    spans.push([match.index, match.index + matchedKeyword.length]);
  }
  return spans;
}
export function claveHtml(text: unknown): string {
  const textValue = String(text ?? ''); let html = '', previousEnd = 0;
  for (const [start, end] of claveSpans(textValue)) { html += esc(textValue.slice(previousEnd, start)) + '<mark class="kw">' + esc(textValue.slice(start, end)) + '</mark>'; previousEnd = end; }
  return html + esc(textValue.slice(previousEnd));
}

// ───────── código: detección y marcado (SQL, comandos, etiquetas, funciones, rutas…) ─────────
const SQL_KW = 'ALTER|MODIFY|ADD|COLUMN|TABLE|CREATE|DROP|SAVEPOINT|INTO|SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LEFT OUTER JOIN|RIGHT OUTER JOIN|FULL OUTER JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|CROSS JOIN|NATURAL JOIN|JOIN|ON|AS|AND|OR|NOT NULL|NOT|NULL|IS|IN|BETWEEN|LIKE|DISTINCT|UNION ALL|UNION|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|CREATE TABLE|CREATE VIEW|CREATE INDEX|ALTER TABLE|DROP TABLE|DROP VIEW|DROP INDEX|PRIMARY KEY|FOREIGN KEY|REFERENCES|GRANT|REVOKE|COMMIT|ROLLBACK|TRUNCATE|ASC|DESC|LIMIT|EXISTS|ALL|ANY|COUNT|SUM|AVG|MAX|MIN';
const SQL_KW_RE = new RegExp('(?<![\\p{L}\\d_])(' + SQL_KW + ')(?![\\p{L}\\d_])', 'gu');
const SQL_START = /(?<![\p{L}\d_])(SELECT\s|INSERT INTO\s|UPDATE\s+[\p{L}_]+\s+SET|DELETE FROM\s|CREATE\s+(?:TABLE|VIEW|INDEX|DATABASE)\s|ALTER\s+TABLE\s|DROP\s+(?:TABLE|VIEW|INDEX|DATABASE)\s|GRANT\s|REVOKE\s)/giu;
// una sentencia SELECT necesita FROM, y GRANT/REVOKE necesitan ON/TO/FROM: «una sentencia SELECT grupos de…» es prosa
const sqlCompleta = (statement: string): boolean => /^select/i.test(statement) ? /\bfrom\b/i.test(statement) : /^(grant|revoke)/i.test(statement) ? /\b(on|to|from)\b/i.test(statement) : true;
const SQL_WORDS = /(?<![\p{L}\d_])(ORDER BY|GROUP BY|(?:LEFT|RIGHT|FULL)(?: OUTER)? JOIN|INNER JOIN|CROSS JOIN|NATURAL JOIN|PRIMARY KEY|FOREIGN KEY|NOT NULL|UNION(?: ALL)?|SELECT|INSERT|UPDATE|DELETE|WHERE|HAVING|DISTINCT|COMMIT|ROLLBACK|TRUNCATE|NULL|COUNT\(\*\))(?![\p{L}\d_])/gu;
const CMDS = '(?:chmod|chown|chgrp|grep|sudo|ping|ssh|scp|ifconfig|ipconfig|nslookup|traceroute|netstat|systemctl|mkdir|rsync|tar(?=\\s+-)|apt-get|umask|git\\s+(?:add|commit|push|pull|clone|status|log|branch|checkout|merge|rebase|init|fetch|diff|stash|reset|remote|tag)|docker\\s+(?:run|build|ps|pull|push|exec|images|compose|stop|rm|start)|kubectl\\s+(?:get|apply|describe|delete|logs|exec)|curl|wget)';
const CODE_RES = [
  /<\?php[\s\S]*?(?:\?>|$)/g,                                                              // PHP
  /<\/?[A-Za-z][\w:-]*(?:\s[^<>]*)?\/?>/g,                                                  // etiquetas HTML/XML y genéricos <tipo>
  /(?<![\w.])\/(?:etc|var|usr|home|s?bin|dev|proc|tmp|opt|root|lib|boot|mnt|media|srv|sys|run)(?:\/[\w.*-]+)*/g,             // rutas Linux
  /(?<![\w.-])[a-z0-9_][\w-]*\.(?:php|java|js|ts|py|xml|html|css|conf|sh|sql|json|ini|txt|log|yml|yaml|cfg|bat|tar|gz|zip)\b/g, // ficheros
  new RegExp('(?<![\\w-])' + CMDS + '\\b(?:\\s+-{1,2}[\\w-]+|\\s+\\d{3,4}\\b)*', 'g'),     // comandos con sus opciones
  /(?<=^|[\s(])--?[A-Za-z][\w-]*(?=[\s.,;:)]|$)/g,                                         // opciones -R, --force
  /(?<![\p{L}\d_$.])[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\((?:[^()]|\([^()]*\))*\)/gu,   // llamadas f(...), a.b(...)
  /[^\s]*(?:===?|!==?|\+\+|->|=>|&&|\|\|)[^\s]*/g,                                         // operadores
  /(?<![\p{L}\d_$])[A-Za-z_$][\w$.]*=[&*]?[\w$.'"]+/gu,                                          // a=b, A.a=B.b
  /(?<![\p{L}\d_$])(?:int|float|char|double|long|short|void|boolean|String)(?:\[\])*\s*\*{0,2}\s*[A-Za-z_]\w*(?:\s*,\s*\*{0,2}[A-Za-z_]\w*)*\s*(?:=\s*new\s+\w+\[[^\]]*\])?;/gu, // int *a,b;  float[] x = new float[12];
  /(?<![\p{L}\d_$])[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?![\p{L}\d_$])/gu,                        // snake_case
  /(?<![\p{L}\d_$])(?!(?:macOS|iOS|iPadOS|iPhone|iPad|iCloud|iMac|tvOS|watchOS|visionOS|openSUSE|eDNI|eIDAS|iTunes|eBay|iOS)\b)[a-z]{2,}(?:[A-Z][a-z0-9]*)+(?![\p{L}\d_$])/gu, // camelCase
  /(?<![\p{L}\d_$])[a-z]\s+(?:XNOR|NAND|XOR|NOR|AND|OR)\s+[a-z]\s*=\s*\d(?![\p{L}\d_$])/gu,        // a XOR b = 1
  /@[A-Za-z_$][\w$]*(?:\s*\([^()]*\))?/g,                                                   // anotaciones Java
  /[A-Za-z_$\d][\w$]*\s*\^\s*[A-Za-z_$\d][\w$]*/g,                                     // expresiones con XOR/caret
];
const noEsLlamada = /^(?:\d|[A-Z]{1,2}$)/;
function rangosCodigo(text: string): Span[] {
  const ranges: Span[] = [];
  // sentencias SQL completas: desde la palabra inicial hasta «;», o hasta el final de la frase, o el final del texto
  SQL_START.lastIndex = 0; let match: RegExpExecArray | null;
  while ((match = SQL_START.exec(text))) {
    const statementStart = match.index; let statementEnd = text.length;
    const semicolonIndex = text.indexOf(';', statementStart); if (semicolonIndex >= 0) statementEnd = semicolonIndex + 1;
    const sentenceBoundary = /\.\s+(?=[¿¡A-ZÁÉÍÓÚÑ])|[?!]\s|\?$/g; sentenceBoundary.lastIndex = statementStart; const boundaryMatch = sentenceBoundary.exec(text);
    if (boundaryMatch && boundaryMatch.index < statementEnd) statementEnd = boundaryMatch.index;
    let trimmedStatementEnd = statementEnd; while (trimmedStatementEnd > statementStart && /[\s.]/.test(text[trimmedStatementEnd - 1])) trimmedStatementEnd--;
    if (trimmedStatementEnd > statementStart + 6 && sqlCompleta(text.slice(statementStart, trimmedStatementEnd))) { ranges.push([statementStart, trimmedStatementEnd]); SQL_START.lastIndex = Math.max(trimmedStatementEnd, statementStart + 1); }
  }
  for (const re of CODE_RES) {
    re.lastIndex = 0;
    while ((match = re.exec(text))) {
      if (match[0] === '') { re.lastIndex++; continue; }
      const matchStart = match.index;
      let matchEnd = matchStart + match[0].length;
      if (re === CODE_RES[6] && noEsLlamada.test(match[0])) continue;
      if (re === CODE_RES[7] && /^C\+\+/.test(match[0])) continue;
      // no marcar paréntesis finales de frase: «cuando (a)» no es una llamada, pero sí «f(a)»
      while (matchEnd > matchStart && /[.,;:]$/.test(text.slice(matchStart, matchEnd)) && !/[)}\]]$/.test(text.slice(matchStart, matchEnd - 1))) matchEnd--;
      if (matchEnd > matchStart) ranges.push([matchStart, matchEnd]);
    }
  }
  // bloques de código con llaves: no convertir llaves de conjuntos matemáticos en una sentencia
  const openBraceIndex = text.indexOf('{'), closeBraceIndex = text.lastIndexOf('}');
  if (openBraceIndex >= 0 && closeBraceIndex > openBraceIndex) {
    let statementStart = 0;
    const prefix = text.slice(0, openBraceIndex), sentenceSeparator = /[.?!:]\s+(?=\S)/g;
    let separatorMatch: RegExpExecArray | null;
    while ((separatorMatch = sentenceSeparator.exec(prefix))) statementStart = separatorMatch.index + separatorMatch[0].length;
    const codeStart = /\b(?:function|public|private|protected|static|class|interface|void|int|for|while|if|switch|try|def|echo|print)\b|[A-Za-z_$][\w$]*\(/.exec(text.slice(statementStart, openBraceIndex));
    if (codeStart) ranges.push([statementStart + codeStart.index, closeBraceIndex + 1]);
  }
  while ((match = SQL_WORDS.exec(text))) ranges.push([match.index, match.index + match[0].length]);
  ranges.sort((leftRange, rightRange) => leftRange[0] - rightRange[0] || rightRange[1] - leftRange[1]);
  const mergedRanges: Span[] = [];
  for (const [rangeStart, rangeEnd] of ranges) { const previousRange = mergedRanges[mergedRanges.length - 1]; if (previousRange && rangeStart <= previousRange[1]) previousRange[1] = Math.max(previousRange[1], rangeEnd); else mergedRanges.push([rangeStart, rangeEnd]); }
  // «;» pegado al final de una sentencia forma parte del código
  for (const range of mergedRanges) if (text[range[1]] === ';') range[1]++;
  // fragmentos de código separados solo por «,», «;» o por un identificador suelto entre ellos («a=10,b; b=a++;») son un único bloque
  const GAP = /^\s+$|^\s*(?:(?:[,;.]|::|->|=>|\^|&&|\|\|)\s*)+(?:[A-Za-z_]\w{0,15}\s*(?:(?:[,;.]|::|->|=>|\^|&&|\|\|)\s*)+)?$/;
  const combinedRanges: Span[] = [];
  for (const currentRange of mergedRanges) { const previousRange = combinedRanges[combinedRanges.length - 1]; if (previousRange && currentRange[0] >= previousRange[1] && GAP.test(text.slice(previousRange[1], currentRange[0]))) previousRange[1] = currentRange[1]; else combinedRanges.push([...currentRange]); }
  return combinedRanges;
}
export function codeSpans(text: unknown): Span[] { return rangosCodigo(String(text ?? '')); }
const codeInner = (h: string) => h.replace(SQL_KW_RE, '<b class="sk">$1</b>');
function richCitationMarkup(text: string, emphasis: Span | null, escapeHtml: (value: unknown) => string): string {
  const codeRanges = rangosCodigo(text);
  const boundaries = new Set([0, text.length]);
  for (const [start, end] of codeRanges) { boundaries.add(start); boundaries.add(end); }
  if (emphasis) { boundaries.add(emphasis[0]); boundaries.add(emphasis[1]); }
  const points = [...boundaries].sort((left, right) => left - right);
  const isInside = (ranges: Span[], index: number) => ranges.some(([start, end]) => index >= start && index < end);
  let html = '';
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index], end = points[index + 1];
    if (start === end) continue;
    const isCode = isInside(codeRanges, start);
    let content = escapeHtml(text.slice(start, end));
    if (isCode) content = codeInner(content);
    if (emphasis && start >= emphasis[0] && start < emphasis[1]) content = `<b class="hl">${content}</b>`;
    html += isCode ? `<code class="cd">${content}</code>` : content;
  }
  return html.replace(/<\/code><code class="cd">/g, '');
}
// Un texto corto que es todo código (p. ej. una opción «((a>b) and (a<d))», «GRANT.», «MODIFY TABLE t ADD (x INT)»)
// se pinta como un único bloque, en vez de trocearlo según qué fragmentos reconozca cada regla.
const PROSA = /[áéíóúñ¿¡]|(?<![\p{L}\d_])(?:de|la|el|los|las|un|una|y|o|que|en|se|por|para|con|del|al|es|son|no|su|sus|lo|como|más|sin|si|entre|cuando)(?![\p{L}\d_])/iu;
const SQLISH = /(?<![\p{L}\d_])(?:SELECT|FROM|WHERE|TABLE|COLUMN|ADD|MODIFY|ALTER|CREATE|DROP|INSERT|INTO|VALUES|UPDATE|SET|DELETE|GRANT|REVOKE|ROLLBACK|COMMIT|SAVEPOINT|TRUNCATE|INDEX|VIEW|CONSTRAINT|PRIMARY|KEY|ORDER|GROUP|BY|JOIN|HAVING|DISTINCT|UNION)(?![\p{L}\d_])/gu;
const ETIQUETA = /<\/?[A-Za-z][^<>]*>/g;
export function todoCodigo(text: unknown): boolean {
  const textValue = String(text ?? '').trim().replace(/\.$/, '');
  if (!textValue || textValue.length > 160 || !/[A-Za-z]/.test(textValue) || PROSA.test(textValue)) return false;
  if (/^[A-Z]+$/.test(textValue)) return (textValue.match(SQLISH) || []).length === 1; // «GRANT», «ROLLBACK»
  const sinEtiquetas = textValue.replace(ETIQUETA, ' ');
  if (/[={}\[\]<>]|&&|\|\|/.test(sinEtiquetas)) return true;
  // «;» solo cuenta si no separa frases con palabras en mayúscula inicial («I Plan 2012-2014; II Plan 2014-2016»)
  if (/;/.test(textValue) && (textValue.match(/(?<![\p{L}\d_])[A-Z][a-z]{2,}(?![\p{L}\d_])/gu) || []).length < 2) return true;
  // varias palabras SQL, empezando por una de ellas o en mayúsculas («Permite ejecutar SELECT … FROM DUAL» es prosa)
  if ((textValue.match(SQLISH) || []).length >= 2 && /^[^A-Za-z]*[A-Z]{2,}(?![a-z])/.test(textValue)) return true;
  // solo etiquetas: «<footer>», «<CRLF>#<CRLF>»; con texto alrededor («Solo obligatorio <html>») se marca solo la etiqueta
  return sinEtiquetas !== textValue && !/[A-Za-z]{3,}/.test(sinEtiquetas);
}
// Texto → HTML seguro: escapa todo, pone en tipografía de código lo que lo parece y (opcional) resalta las palabras clave de lectura.
export function richHtml(text: unknown, highlightKeywords = false): string {
  const textValue = String(text ?? '');
  if (todoCodigo(textValue)) { const match = /^(\s*)([\s\S]*?)(\.?\s*)$/.exec(textValue)!; const blockClass = /\s/.test(match[2]) && match[2].length > 18 ? ' blk' : ''; return esc(match[1]) + '<code class="cd' + blockClass + '">' + codeInner(esc(match[2] + (blockClass ? match[3] : ''))) + '</code>' + (blockClass ? '' : esc(match[3])); }
  const codeRanges = rangosCodigo(textValue), keywordRanges = highlightKeywords ? claveSpans(textValue).filter(([keywordStart, keywordEnd]) => !codeRanges.some(([codeStart, codeEnd]) => keywordStart < codeEnd && codeStart < keywordEnd)) : [];
  const boundaries = new Set([0, textValue.length]);
  for (const [rangeStart, rangeEnd] of codeRanges) { boundaries.add(rangeStart); boundaries.add(rangeEnd); }
  for (const [rangeStart, rangeEnd] of keywordRanges) { boundaries.add(rangeStart); boundaries.add(rangeEnd); }
  const boundaryPoints = [...boundaries].sort((leftIndex, rightIndex) => leftIndex - rightIndex); let html = '';
  const isWithinRange = (ranges: Span[], offset: number) => ranges.some(([rangeStart, rangeEnd]) => offset >= rangeStart && offset < rangeEnd);
  for (let boundaryIndex = 0; boundaryIndex < boundaryPoints.length - 1; boundaryIndex++) {
    const segmentStart = boundaryPoints[boundaryIndex], segmentEnd = boundaryPoints[boundaryIndex + 1]; if (segmentStart === segmentEnd) continue;
    const segmentHtml = esc(textValue.slice(segmentStart, segmentEnd));
    if (isWithinRange(codeRanges, segmentStart)) html += '<code class="cd">' + codeInner(segmentHtml) + '</code>';
    else if (isWithinRange(keywordRanges, segmentStart)) html += '<mark class="kw">' + segmentHtml + '</mark>';
    else html += segmentHtml;
  }
  return html.replace(/<\/code><code class="cd">/g, '');
}

