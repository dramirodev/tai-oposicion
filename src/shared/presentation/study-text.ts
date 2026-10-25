import { escapeHtml as esc } from './format.ts';

type Span = [number, number];
// Resalta en negrita (HTML ya escapado) el fragmento de `u` que mejor responde con `ans`.
const STOP = new Set('para como pero este esta estos estas esos esas sobre entre desde hasta cada todo todos toda todas otro otra otros otras puede pueden será serán solo sólo tiene tienen según cuando donde mientras ellos ellas dicho dicha cual cuales'.split(' '));
const normW = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '');
export function hiliteHtml(u0: unknown, ans0: unknown): string {
  const escH = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const u = String(u0 || ''), ans = String(ans0 || '');
  const toks = u.split(/(\s+)/);           // palabras y separadores
  const idx: number[] = []; toks.forEach((t, i) => { if (t && !/^\s+$/.test(t)) idx.push(i); });
  const nw = idx.map(i => normW(toks[i]));
  const aw = new Set(ans.split(/\s+/).map(normW).filter(w => w.length > 3 && !STOP.has(w) || /^\d+$/.test(w)));
  if (!aw.size || !idx.length) return escH(u);
  const hit = nw.map(w => aw.has(w));
  let best: { i: number; j: number; sc: number; n: number } | null = null; const maxLen = Math.min(idx.length, aw.size * 2 + 6);
  for (let i = 0; i < idx.length; i++) {
    if (!hit[i]) continue;
    const seen = new Set();
    for (let j = i; j < Math.min(idx.length, i + maxLen); j++) {
      if (hit[j]) seen.add(nw[j]);
      if (!hit[j]) continue;
      const sc = seen.size - (j - i + 1 - seen.size) * 0.15;
      if (!best || sc > best.sc + 1e-9 || (Math.abs(sc - best.sc) < 1e-9 && j - i < best.j - best.i)) best = { i, j, sc, n: seen.size };
    }
  }
  if (!best || best.n < Math.min(2, aw.size)) return escH(u);
  const a = idx[best.i], b = idx[best.j];
  return escH(toks.slice(0, a).join('')) + '<b class="hl">' + escH(toks.slice(a, b + 1).join('')) + '</b>' + escH(toks.slice(b + 1).join(''));
}

// ───────── lectura atenta (contra los fallos por velocidad) ─────────
// Palabras que cambian el sentido: negaciones, excepciones, absolutos, restrictivos y cifras/plazos.
const KW = /(?<![\p{L}\d])(NO|NUNCA|NINGUN[OA]S?|NADA|SIEMPRE|TODOS|TODAS|SOLO|SÓLO|ÚNICAMENTE|EXCLUSIVAMENTE|EXCEPTO|SALVO|INCORRECT[OA]S?|FALS[OA]S?|VERDADER[OA]S?|CORRECT[OA]S?|MÁXIM[OA]S?|MÍNIM[OA]S?|SIN|MENOS|MÁS|ANTES|DESPUÉS|HÁBILES|NATURALES)(?![\p{L}\d])|(?<![\p{L}\d])\d[\d.,]*\s?(?:%|bits?|bytes?|GB|MB|KB|Mbps|Gbps|MHz|GHz|días?|meses|años?|horas?|segundos?|puertos?)?/giu;
export function claveSpans(text: unknown): Span[] {
  const t = String(text ?? ''), out: Span[] = []; let m: RegExpExecArray | null; KW.lastIndex = 0;
  while ((m = KW.exec(t))) {
    const w = m[0];
    // «NO», «MÁS», «SIN»… en minúscula son palabras corrientes: solo se marcan en mayúsculas o los términos fuertes
    const flojo = /^(no|más|sin|menos|antes|después|correct[oa]s?|verdader[oa]s?|todos|todas|solo|sólo|nada)$/i.test(w) && w !== w.toUpperCase();
    if (flojo) continue;
    if (m.index === KW.lastIndex) KW.lastIndex++;
    out.push([m.index, m.index + w.length]);
  }
  return out;
}
export function claveHtml(text: unknown): string {
  const t = String(text ?? ''); let h = '', p = 0;
  for (const [a, b] of claveSpans(t)) { h += esc(t.slice(p, a)) + '<mark class="kw">' + esc(t.slice(a, b)) + '</mark>'; p = b; }
  return h + esc(t.slice(p));
}

// ───────── código: detección y marcado (SQL, comandos, etiquetas, funciones, rutas…) ─────────
const SQL_KW = 'ALTER|MODIFY|ADD|COLUMN|TABLE|CREATE|DROP|SAVEPOINT|INTO|SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LEFT OUTER JOIN|RIGHT OUTER JOIN|FULL OUTER JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|CROSS JOIN|NATURAL JOIN|JOIN|ON|AS|AND|OR|NOT NULL|NOT|NULL|IS|IN|BETWEEN|LIKE|DISTINCT|UNION ALL|UNION|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|CREATE TABLE|CREATE VIEW|CREATE INDEX|ALTER TABLE|DROP TABLE|DROP VIEW|DROP INDEX|PRIMARY KEY|FOREIGN KEY|REFERENCES|GRANT|REVOKE|COMMIT|ROLLBACK|TRUNCATE|ASC|DESC|LIMIT|EXISTS|ALL|ANY|COUNT|SUM|AVG|MAX|MIN';
const SQL_KW_RE = new RegExp('(?<![\\p{L}\\d_])(' + SQL_KW + ')(?![\\p{L}\\d_])', 'gu');
const SQL_START = /(?<![\p{L}\d_])(SELECT\s|INSERT INTO\s|UPDATE\s+[\p{L}_]+\s+SET|DELETE FROM\s|CREATE\s+(?:TABLE|VIEW|INDEX|DATABASE)\s|ALTER\s+TABLE\s|DROP\s+(?:TABLE|VIEW|INDEX|DATABASE)\s|GRANT\s|REVOKE\s)/giu;
// una sentencia SELECT necesita FROM, y GRANT/REVOKE necesitan ON/TO/FROM: «una sentencia SELECT grupos de…» es prosa
const sqlCompleta = (s: string): boolean => /^select/i.test(s) ? /\bfrom\b/i.test(s) : /^(grant|revoke)/i.test(s) ? /\b(on|to|from)\b/i.test(s) : true;
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
];
const noEsLlamada = /^(?:\d|[A-Z]{1,2}$)/;
function rangosCodigo(t: string): Span[] {
  const r: Span[] = [];
  // sentencias SQL completas: desde la palabra inicial hasta «;», o hasta el final de la frase, o el final del texto
  SQL_START.lastIndex = 0; let m: RegExpExecArray | null;
  while ((m = SQL_START.exec(t))) {
    const a = m.index; let b = t.length;
    const semi = t.indexOf(';', a); if (semi >= 0) b = semi + 1;
    const fin = /\.\s+(?=[¿¡A-ZÁÉÍÓÚÑ])|[?!]\s|\?$/g; fin.lastIndex = a; const f = fin.exec(t);
    if (f && f.index < b) b = f.index;
    let e = b; while (e > a && /[\s.]/.test(t[e - 1])) e--;
    if (e > a + 6 && sqlCompleta(t.slice(a, e))) { r.push([a, e]); SQL_START.lastIndex = Math.max(e, a + 1); }
  }
  for (const re of CODE_RES) {
    re.lastIndex = 0;
    while ((m = re.exec(t))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      const a = m.index;
      let b = a + m[0].length;
      if (re === CODE_RES[6] && noEsLlamada.test(m[0])) continue;
      if (re === CODE_RES[7] && /^C\+\+/.test(m[0])) continue;
      // no marcar paréntesis finales de frase: «cuando (a)» no es una llamada, pero sí «f(a)»
      while (b > a && /[.,;:]$/.test(t.slice(a, b)) && !/[)}\]]$/.test(t.slice(a, b - 1))) b--;
      if (b > a) r.push([a, b]);
    }
  }
  // bloques con llaves { … }: desde la sentencia que los abre hasta la última llave
  const o = t.indexOf('{'), c = t.lastIndexOf('}');
  if (o >= 0 && c > o) {
    let ini = 0; const pre = t.slice(0, o); const sb = /[.?!:]\s+(?=\S)/g; let q; while ((q = sb.exec(pre))) ini = q.index + q[0].length;
    const k = /\b(?:function|public|private|protected|static|class|interface|void|int|for|while|if|switch|try|def|echo|print)\b|[A-Za-z_$][\w$]*\(/.exec(t.slice(ini, o));
    r.push([k ? ini + k.index : o, c + 1]);
  }
  while ((m = SQL_WORDS.exec(t))) r.push([m.index, m.index + m[0].length]);
  r.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
  const u: Span[] = [];
  for (const [a, b] of r) { const l = u[u.length - 1]; if (l && a <= l[1]) l[1] = Math.max(l[1], b); else u.push([a, b]); }
  // «;» pegado al final de una sentencia forma parte del código
  for (const x of u) if (t[x[1]] === ';') x[1]++;
  // fragmentos de código separados solo por «,», «;» o por un identificador suelto entre ellos («a=10,b; b=a++;») son un único bloque
  const GAP = /^\s+$|^\s*[,;]\s*(?:[A-Za-z_]\w{0,15}\s*[,;]\s*)?$/;
  const v: Span[] = [];
  for (const x of u) { const l = v[v.length - 1]; if (l && x[0] >= l[1] && GAP.test(t.slice(l[1], x[0]))) l[1] = x[1]; else v.push([...x]); }
  return v;
}
export function codeSpans(text: unknown): Span[] { return rangosCodigo(String(text ?? '')); }
const codeInner = (h: string) => h.replace(SQL_KW_RE, '<b class="sk">$1</b>');
// Un texto corto que es todo código (p. ej. una opción «((a>b) and (a<d))», «GRANT.», «MODIFY TABLE t ADD (x INT)»)
// se pinta como un único bloque, en vez de trocearlo según qué fragmentos reconozca cada regla.
const PROSA = /[áéíóúñ¿¡]|(?<![\p{L}\d_])(?:de|la|el|los|las|un|una|y|o|que|en|se|por|para|con|del|al|es|son|no|su|sus|lo|como|más|sin|si|entre|cuando)(?![\p{L}\d_])/iu;
const SQLISH = /(?<![\p{L}\d_])(?:SELECT|FROM|WHERE|TABLE|COLUMN|ADD|MODIFY|ALTER|CREATE|DROP|INSERT|INTO|VALUES|UPDATE|SET|DELETE|GRANT|REVOKE|ROLLBACK|COMMIT|SAVEPOINT|TRUNCATE|INDEX|VIEW|CONSTRAINT|PRIMARY|KEY|ORDER|GROUP|BY|JOIN|HAVING|DISTINCT|UNION)(?![\p{L}\d_])/gu;
const ETIQUETA = /<\/?[A-Za-z][^<>]*>/g;
export function todoCodigo(text: unknown): boolean {
  const s = String(text ?? '').trim().replace(/\.$/, '');
  if (!s || s.length > 160 || !/[A-Za-z]/.test(s) || PROSA.test(s)) return false;
  if (/^[A-Z]+$/.test(s)) return (s.match(SQLISH) || []).length === 1; // «GRANT», «ROLLBACK»
  const sinEtiquetas = s.replace(ETIQUETA, ' ');
  if (/[={}\[\]<>]|&&|\|\|/.test(sinEtiquetas)) return true;
  // «;» solo cuenta si no separa frases con palabras en mayúscula inicial («I Plan 2012-2014; II Plan 2014-2016»)
  if (/;/.test(s) && (s.match(/(?<![\p{L}\d_])[A-Z][a-z]{2,}(?![\p{L}\d_])/gu) || []).length < 2) return true;
  // varias palabras SQL, empezando por una de ellas o en mayúsculas («Permite ejecutar SELECT … FROM DUAL» es prosa)
  if ((s.match(SQLISH) || []).length >= 2 && /^[^A-Za-z]*[A-Z]{2,}(?![a-z])/.test(s)) return true;
  // solo etiquetas: «<footer>», «<CRLF>#<CRLF>»; con texto alrededor («Solo obligatorio <html>») se marca solo la etiqueta
  return sinEtiquetas !== s && !/[A-Za-z]{3,}/.test(sinEtiquetas);
}
// Texto → HTML seguro: escapa todo, pone en tipografía de código lo que lo parece y (opcional) resalta las palabras clave de lectura.
export function richHtml(text: unknown, clave = false): string {
  const t = String(text ?? '');
  if (todoCodigo(t)) { const m = /^(\s*)([\s\S]*?)(\.?\s*)$/.exec(t)!; const blk = /\s/.test(m[2]) && m[2].length > 18 ? ' blk' : ''; return esc(m[1]) + '<code class="cd' + blk + '">' + codeInner(esc(m[2])) + '</code>' + (blk ? '' : esc(m[3])); } // en bloque, el punto final quedaría en una línea suelta
  const code = rangosCodigo(t), key = clave ? claveSpans(t).filter(([a, b]) => !code.some(([c, d]) => a < d && c < b)) : [];
  const cuts = new Set([0, t.length]);
  for (const [a, b] of code) { cuts.add(a); cuts.add(b); }
  for (const [a, b] of key) { cuts.add(a); cuts.add(b); }
  const pts = [...cuts].sort((x, y) => x - y); let h = '';
  const dentro = (L: Span[], i: number) => L.some(([a, b]) => i >= a && i < b);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; if (a === b) continue;
    const seg = esc(t.slice(a, b));
    if (dentro(code, a)) h += '<code class="cd">' + codeInner(seg) + '</code>';
    else if (dentro(key, a)) h += '<mark class="kw">' + seg + '</mark>';
    else h += seg;
  }
  return h.replace(/<\/code><code class="cd">/g, '');
}

