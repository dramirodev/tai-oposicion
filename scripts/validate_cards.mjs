// Valida public/cards/*.json (Fase B del plan de flashcards). Uso: node scripts/validate_cards.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TIPOS = ['definicion', 'contraste', 'cifra', 'alcance', 'intrusa'];
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export function validateAll() {
  const errs = [], report = {};
  const idx = JSON.parse(fs.readFileSync(path.join(root, 'data/index.json'), 'utf8')).temas.map(t => t.id);
  const ci = path.join(root, 'cards/index.json');
  const listed = fs.existsSync(ci) ? JSON.parse(fs.readFileSync(ci, 'utf8')).temas || {} : {};
  const files = fs.existsSync(path.join(root, 'cards')) ? fs.readdirSync(path.join(root, 'cards')).filter(f => /^T\d\.\d\d\.json$/.test(f)) : [];
  for (const f of files) {
    const t = f.replace('.json', ''); let cards;
    try { cards = JSON.parse(fs.readFileSync(path.join(root, 'cards', f), 'utf8')); } catch (e) { errs.push(`${f}: JSON no válido`); continue; }
    if (!idx.includes(t)) errs.push(`${f}: tema inexistente en data/index.json`);
    if (!Array.isArray(cards)) { errs.push(`${f}: debe ser un array`); continue; }
    if (cards.length > 40) errs.push(`${f}: más de 40 tarjetas (${cards.length})`);
    if (listed[t] !== cards.length) errs.push(`${f}: cards/index.json dice ${listed[t] ?? 'nada'} y el fichero tiene ${cards.length}`);
    const ids = new Set(), qs = new Set(), tipos = {};
    cards.forEach((c, k) => {
      const w = `${f}[${k}]`;
      if (!c || typeof c !== 'object') return errs.push(`${w}: no es un objeto`);
      if (!/^FC-T\d\.\d\d-\d{3}$/.test(c.id || '') || !c.id.startsWith(`FC-${t}-`)) errs.push(`${w}: id inválido (${c.id})`);
      if (ids.has(c.id)) errs.push(`${w}: id duplicado ${c.id}`); ids.add(c.id);
      if (c.t !== t) errs.push(`${w}: t debe ser ${t}`);
      if (!TIPOS.includes(c.tipo)) errs.push(`${w}: tipo inválido (${c.tipo})`); else tipos[c.tipo] = (tipos[c.tipo] || 0) + 1;
      if (typeof c.q !== 'string' || c.q.length < 15 || c.q.length > 300) errs.push(`${w}: q debe tener 15–300 caracteres`);
      if (typeof c.a !== 'string' || !c.a.trim() || c.a.trim().split(/\s+/).length > 25) errs.push(`${w}: a debe tener 1–25 palabras`);
      if (typeof c.ref !== 'string' || !c.ref.trim()) errs.push(`${w}: falta ref`);
      if (c.src !== 'curada') errs.push(`${w}: src debe ser "curada"`);
      if (typeof c.q === 'string') { const n = norm(c.q); if (qs.has(n)) errs.push(`${w}: pregunta duplicada`); qs.add(n); }
    });
    report[t] = { n: cards.length, tipos };
  }
  return { errs, report };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { errs, report } = validateAll();
  for (const t in report) console.log(t, JSON.stringify(report[t]));
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log(`OK · ${Object.keys(report).length} temas con tarjetas`);
}
