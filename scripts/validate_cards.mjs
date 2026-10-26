// Valida public/cards/*.json (Fase B del plan de flashcards). Uso: node scripts/validate_cards.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TIPOS = ['definicion', 'contraste', 'cifra', 'alcance', 'intrusa'];
const normalizeQuestionText = questionText => questionText.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export function validateAll() {
  const errors = [], topicReports = {};
  const topicIds = JSON.parse(fs.readFileSync(path.join(root, 'data/index.json'), 'utf8')).temas.map(topic => topic.id);
  const cardIndexPath = path.join(root, 'cards/index.json');
  const listedCardCounts = fs.existsSync(cardIndexPath) ? JSON.parse(fs.readFileSync(cardIndexPath, 'utf8')).temas || {} : {};
  const cardFiles = fs.existsSync(path.join(root, 'cards')) ? fs.readdirSync(path.join(root, 'cards')).filter(fileName => /^T\d\.\d\d\.json$/.test(fileName)) : [];
  for (const fileName of cardFiles) {
    const topicId = fileName.replace('.json', ''); let cards;
    try { cards = JSON.parse(fs.readFileSync(path.join(root, 'cards', fileName), 'utf8')); } catch (error) { errors.push(`${fileName}: JSON no válido`); continue; }
    if (!topicIds.includes(topicId)) errors.push(`${fileName}: tema inexistente en data/index.json`);
    if (!Array.isArray(cards)) { errors.push(`${fileName}: debe ser un array`); continue; }
    if (cards.length > 40) errors.push(`${fileName}: más de 40 tarjetas (${cards.length})`);
    if (listedCardCounts[topicId] !== cards.length) errors.push(`${fileName}: cards/index.json dice ${listedCardCounts[topicId] ?? 'nada'} y el fichero tiene ${cards.length}`);
    const ids = new Set(), qs = new Set(), tipos = {};
    cards.forEach((card, index) => {
      const cardLocation = `${fileName}[${index}]`;
      if (!card || typeof card !== 'object') return errors.push(`${cardLocation}: no es un objeto`);
      if (!/^FC-T\d\.\d\d-\d{3}$/.test(card.id || '') || !card.id.startsWith(`FC-${topicId}-`)) errors.push(`${cardLocation}: id inválido (${card.id})`);
      if (ids.has(card.id)) errors.push(`${cardLocation}: id duplicado ${card.id}`); ids.add(card.id);
      if (card.t !== topicId) errors.push(`${cardLocation}: t debe ser ${topicId}`);
      if (!TIPOS.includes(card.tipo)) errors.push(`${cardLocation}: tipo inválido (${card.tipo})`); else tipos[card.tipo] = (tipos[card.tipo] || 0) + 1;
      if (typeof card.q !== 'string' || card.q.length < 15 || card.q.length > 300) errors.push(`${cardLocation}: q debe tener 15–300 caracteres`);
      if (typeof card.a !== 'string' || !card.a.trim() || card.a.trim().split(/\s+/).length > 25) errors.push(`${cardLocation}: a debe tener 1–25 palabras`);
      if (typeof card.ref !== 'string' || !card.ref.trim()) errors.push(`${cardLocation}: falta ref`);
      if (card.src !== 'curada') errors.push(`${cardLocation}: src debe ser "curada"`);
      if (typeof card.q === 'string') { const normalizedQuestion = normalizeQuestionText(card.q); if (qs.has(normalizedQuestion)) errors.push(`${cardLocation}: pregunta duplicada`); qs.add(normalizedQuestion); }
    });
    topicReports[topicId] = { n: cards.length, tipos };
  }
  return { errs: errors, report: topicReports };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { errs, report } = validateAll();
  for (const topicId in report) console.log(topicId, JSON.stringify(report[topicId]));
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log(`OK · ${Object.keys(report).length} temas con tarjetas`);
}
