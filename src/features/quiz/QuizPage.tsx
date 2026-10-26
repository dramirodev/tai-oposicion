import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useStudyServices } from '../../shared/ui/study-services.js';
import { ORIGEN, TRAMPAS } from '../../shared/presentation/labels.js';
import { FAILURE_REASONS } from '../../shared/presentation/study-labels.js';
import { asksForNegativeOption } from '../../core/domain/reading-strategy.js';
import { simulationPace } from '../../core/domain/simulation-analysis.js';
import { resolveHighlight } from '../../core/domain/attempts/highlights.js';
import { canonicalText, paintTextHighlight, selectedTextAnchor } from '../../shared/ui/text-highlights.js';
import { richHtml, hiliteHtml } from '../../shared/presentation/study-text.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { HelpIconLink } from '../../shared/ui/HelpIconLink.js';
import { studyKeyAction, swipeDirection } from '../../shared/ui/study-input.js';

function useQuizSnapshot() {
  const { quiz } = useStudyServices();
  const [snapshot, setSnapshot] = useState(() => quiz.getSnapshot());
  useEffect(() => quiz.subscribe(() => setSnapshot(quiz.getSnapshot())), [quiz]);
  return snapshot;
}

export function QuizPage() {
  const { quiz } = useStudyServices();
  const snapshot = useQuizSnapshot();
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [selection, setSelection] = useState(false);
  const [clock, setClock] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Respuesta correcta mal marcada');
  const [reportNote, setReportNote] = useState('');
  const [explanationResult, setExplanationResult] = useState<{ id: string; content: string }>({ id: '', content: '' });
  const [highlightMark, setHighlightMark] = useState<{ questionId: string; id: string | null }>({ questionId: '', id: null });
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const finishing = useRef(false);
  const timingOut = useRef(false);
  const wasPaused = useRef(false);
  const prompt = snapshot?.prompt;
  const locked = !!snapshot && (snapshot.feedback ? snapshot.studyState === 'answered' || snapshot.studyState === 'revealed' : typeof snapshot.answer === 'number' && snapshot.answer >= 0);
  const revealed = !!snapshot && snapshot.feedback && (snapshot.answer !== undefined || snapshot.studyState === 'revealed');
  const readingGate = !!snapshot && snapshot.readingMode === 2 && !revealed && snapshot.answer === undefined && !snapshot.paused;
  const gateRemaining = readingGate ? Math.max(0, Math.ceil((snapshot.readingGateUntil - clock) / 1000)) : 0;
  const explanation = prompt && explanationResult.id === prompt.id ? explanationResult.content : '';
  const promptId = prompt?.id, contentRevision = prompt?.contentRevision, studyState = snapshot?.studyState, highlights = snapshot?.highlights, questionIndex = snapshot?.index;
  const markBlank = useCallback(() => { quiz.markBlank(); window.getSelection()?.removeAllRanges(); window.scrollTo(0, 0); }, [quiz]);
  const moveNext = useCallback(async () => { const current = quiz.getSnapshot(); if (!current || finishing.current) return; if (current.index === current.count - 1) { finishing.current = true; try { await quiz.finish(); } finally { finishing.current = false; } return; } quiz.setIndex(current.index + 1); window.scrollTo(0, 0); }, [quiz]);
  const movePrevious = useCallback(() => { const current = quiz.getSnapshot(); if (!current || current.paused || current.index <= 0) return; quiz.setIndex(current.index - 1); window.scrollTo(0, 0); }, [quiz]);

  useEffect(() => { if (questionIndex !== undefined) quiz.startCurrentQuestion(); }, [quiz, questionIndex]);
  useEffect(() => { if (snapshot) quiz.persist(); }, [quiz, snapshot]);
  useEffect(() => () => quiz.cancelConfirmation(), [quiz]);
  useEffect(() => { if (questionIndex !== undefined) { heading.current?.setAttribute('tabindex', '-1'); heading.current?.focus({ preventScroll: true }); } }, [questionIndex]);
  useEffect(() => {
    const host = root.current; if (!host) return;
    host.querySelectorAll<HTMLElement>('.qhead,.study-run-title,.pace,.card.q,.bar2').forEach(element => { element.inert = !!snapshot?.paused; });
    if (snapshot?.paused) root.current?.querySelector<HTMLElement>('#resume')?.focus();
    else if (wasPaused.current) root.current?.querySelector<HTMLElement>('#pause')?.focus();
    wasPaused.current = !!snapshot?.paused;
  }, [snapshot?.paused, snapshot?.index]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = quiz.getSnapshot();
      if (current && !current.paused) {
        quiz.tick();
        setClock(Date.now());
        if (current.remainingSeconds !== null && current.remainingSeconds <= 0 && !timingOut.current) {
          timingOut.current = true;
          finishing.current = true;
          void quiz.finish('timeout').finally(() => { finishing.current = false; });
        }
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [quiz]);

  useEffect(() => {
    if (!promptId || !revealed) return;
    let active = true;
    void quiz.loadExplanation().then(value => { if (active && value.status === 'current') setExplanationResult({ id: promptId, content: value.content || '' }); if (active && value.status === 'outdated') setExplanationResult({ id: promptId, content: 'Hay una explicación de una revisión anterior; no se muestra para evitar información desactualizada.' }); }).catch(() => {});
    return () => { active = false; };
  }, [promptId, quiz, revealed, studyState, questionIndex]);

  useEffect(() => {
    const container = root.current;
    if (!container || !highlights || !contentRevision) return;
    let stale = false;
    highlights.forEach(mark => {
      const host = mark.field === 'statement' ? container.querySelector('.enun') : container.querySelector(`.opt[data-i="${Number(mark.field.slice(7))}"] .pre`);
      if (!host) return;
      const resolved = resolveHighlight(mark, canonicalText(host), contentRevision);
      if (resolved.stale) { stale = true; return; }
      paintTextHighlight(host, resolved.start, resolved.end, mark.category, mark.id);
    });
    const note = container.querySelector<HTMLElement>('#stale-highlight');
    if (note) note.hidden = !stale;
  }, [contentRevision, highlights, questionIndex]);

  useEffect(() => {
    if (!snapshot || !prompt) return;
    const host = root.current;
    if (!host) return;
    const syncSelection = () => { const anchor = selectedTextAnchor(host); setSelection(!!anchor); const mark = anchor && snapshot.highlights.find(item => item.field === anchor.field && item.start < anchor.end && item.end > anchor.start); setHighlightMark({ questionId: prompt.id, id: mark?.id || null }); };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target as HTMLElement : null;
      if (!target) return;
      const textRoot = target.closest('.enun, .opt .pre') || target.closest('.opt')?.querySelector('.pre');
      if (textRoot && !target.closest('.opt') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); return; }
      if (textRoot && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        const currentSelection = window.getSelection();
        if (currentSelection && (!currentSelection.anchorNode || !textRoot.contains(currentSelection.anchorNode))) {
          const walker = document.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT); const first = walker.nextNode();
          if (first) { const range = document.createRange(); range.setStart(first, 0); range.collapse(true); currentSelection.removeAllRanges(); currentSelection.addRange(range); }
        }
        const modify = (currentSelection as (Selection & { modify?: (action: string, direction: string, granularity: string) => void }) | null)?.modify;
        if (currentSelection && modify) { event.preventDefault(); modify.call(currentSelection, event.shiftKey ? 'extend' : 'move', ['ArrowLeft', 'ArrowUp'].includes(event.key) ? 'backward' : 'forward', ['ArrowUp', 'ArrowDown'].includes(event.key) ? 'line' : 'character'); syncSelection(); }
        return;
      }
      if (['Enter', ' '].includes(event.key) && target.closest('button,a,[role="button"]')) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const action = studyKeyAction(event, prompt.options.length); if (!action) return;
      event.preventDefault();
      if (action.type === 'option') quiz.answer(action.index);
      else if (action.type === 'next') void moveNext();
      else if (action.type === 'previous') movePrevious();
      else if (action.type === 'blank') { if (snapshot.feedback) markBlank(); else quiz.toggleBlank(); }
      else if (action.type === 'flag') quiz.toggleFlag();
      else if (action.type === 'pause') quiz.setPaused(!snapshot.paused);
    };
    document.addEventListener('selectionchange', syncSelection);
    document.addEventListener('keyup', syncSelection);
    host.addEventListener('mouseup', syncSelection);
    const onTouchStart = (event: TouchEvent) => { const touch = event.touches[0], target = event.target as HTMLElement; touchStart.current = event.touches.length === 1 && touch.clientX > 24 && touch.clientX < innerWidth - 24 && !target.closest('details,input,textarea,button,.opt') ? { x: touch.clientX, y: touch.clientY } : null; };
    const onTouchEnd = (event: TouchEvent) => { if (!touchStart.current) return; const touch = event.changedTouches[0], direction = swipeDirection(touch.clientX - touchStart.current.x, touch.clientY - touchStart.current.y); touchStart.current = null; if (direction === 'next') void moveNext(); else if (direction === 'prev') movePrevious(); };
    host.addEventListener('touchstart', onTouchStart, { passive: true }); host.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('selectionchange', syncSelection); document.removeEventListener('keyup', syncSelection); host.removeEventListener('mouseup', syncSelection); host.removeEventListener('touchstart', onTouchStart); host.removeEventListener('touchend', onTouchEnd); document.removeEventListener('keydown', onKey); };
  }, [markBlank, moveNext, movePrevious, prompt, quiz, snapshot]);

  if (!snapshot || !prompt) return <><h1>Sesión de estudio</h1><p className="note">No hay una sesión activa. <Link to="/home">Volver al inicio</Link></p></>;
  const addMark = (category: 'key' | 'doubt') => {
    const anchor = root.current && selectedTextAnchor(root.current);
    if (anchor && quiz.addHighlight(anchor, category)) { window.getSelection()?.removeAllRanges(); setSelection(false); }
  };
  const responseLocked = snapshot.feedback ? locked : typeof snapshot.answer === 'number' && snapshot.answer >= 0;
  const confidenceLabels = { sure: 'Seguro', betweenTwo: 'Entre dos', guess: 'Adivino' };
  const sourceLabel = prompt.origin === 'O' && prompt.year ? ` · ${prompt.year.replace('Ingreso libre ', '').replace('convocatoria ', '')}` : '';
  const pace = snapshot.timeLimitSeconds && snapshot.timeLimitSeconds > 0 ? simulationPace(snapshot.index, snapshot.count, snapshot.timeLimitSeconds, snapshot.seconds) : 0;
  const explanationComponent = explanation ? <div id="code-explanation-slot" aria-live="polite"><StudyMarkup html={explanation} /></div> : null;
  const report = snapshot.report;
  const openReport = () => { setReportReason(report?.reason || 'Respuesta correcta mal marcada'); setReportNote(report?.note || ''); setReportOpen(true); };

  return <div ref={root} className="quiz-page">
    <h1 ref={heading} className="sr">{snapshot.title} · pregunta {snapshot.index + 1}{snapshot.timed ? '' : ` de ${snapshot.count}`}</h1>
    <div className="qhead"><button className="ghost" id="exit" aria-label="Salir" onClick={() => void quiz.exit()}>✕</button><div className="prog"><div style={{ width: `${snapshot.timed && snapshot.timeLimitSeconds ? Math.min(100, 100 * snapshot.seconds / snapshot.timeLimitSeconds) : 100 * snapshot.index / snapshot.count}%` }} /></div><div className="cnt">{snapshot.timed ? `#${snapshot.index + 1}` : `${snapshot.index + 1}/${snapshot.count}`}</div>
      {snapshot.timeLimitSeconds !== null && <><div className="clock" id="clock">{Math.floor(Math.max(0, snapshot.remainingSeconds || 0) / 60)}:{String(Math.max(0, snapshot.remainingSeconds || 0) % 60).padStart(2, '0')}</div><button className="ghost" id="pause" aria-label="Pausar" onClick={() => quiz.setPaused(true)}>⏸</button></>}
    </div>
    <div className="sub study-run-title">{snapshot.title} <HelpIconLink topic="sesiones" label="Ayuda sobre controles y estados de pregunta" /></div>
    {snapshot.timeLimitSeconds !== null && snapshot.prompt && <div className={`pace ${pace >= 0 ? 'up' : pace > -3 ? 'mid' : 'low'}`} id="pace">Ritmo: {pace > 0 ? `${pace} por delante` : pace < 0 ? `${-pace} por detrás` : 'al día'} · {Math.round(snapshot.timeLimitSeconds / snapshot.count)} s por pregunta</div>}
    <details className="question-map"><summary>Mapa de preguntas · {snapshot.feedback ? `${snapshot.studyStates.filter(state => state === 'answered').length} respondidas · ${snapshot.studyStates.filter(state => state === 'pending').length} pendientes · ${snapshot.studyStates.filter(state => state === 'revealed').length} consultadas` : `${snapshot.answers.filter(answer => answer !== undefined && answer >= 0).length} respondidas · ${snapshot.review.length} para revisar`}</summary><div className="question-grid">{Array.from({ length: snapshot.count }, (_, index) => { const answer = snapshot.answers[index]; const status = snapshot.feedback ? snapshot.studyStates[index] || 'unseen' : answer === undefined ? 'unseen' : answer === -1 ? 'blank' : 'answered'; const label = ({ unseen: snapshot.feedback ? 'Sin visitar' : 'Sin responder', pending: 'Pendiente', revealed: 'Solución consultada', answered: 'Respondida', blank: 'En blanco' } as const)[status]; return <button key={index} data-jump={index} aria-current={index === snapshot.index ? 'step' : undefined} className={status} onClick={() => { quiz.setIndex(index); window.scrollTo(0, 0); }}>{index + 1}<small>{label}{snapshot.review.includes(index) ? ' · Revisar' : ''}</small></button>; })}</div></details>
    {!snapshot.feedback && <button className="ghost" id="review-question" aria-pressed={snapshot.review.includes(snapshot.index)} onClick={() => quiz.toggleReview()}>{snapshot.review.includes(snapshot.index) ? '✓ Marcada para revisar' : 'Marcar para revisar'}</button>}
    {snapshot.studyState === 'pending' && <p className="note">Si ves la solución, ya no podrás responder esta pregunta en este intento.</p>}
    <div className={`card q${prompt.hasAssumption ? ' with-sup' : ''}`}>
      <div className="meta"><span className="tag">{prompt.topicId} · {prompt.topicName}</span><span className={`tag o${prompt.origin}`}>{ORIGEN[prompt.origin]}{sourceLabel}</span>{prompt.provisional && <span className="tag warn">Respuesta provisional</span>}{prompt.mayExpire && <span className="tag warn">Puede caducar</span>}{prompt.variant && <span className="tag">Variante</span>}</div>
      {prompt.notice && <StudyMarkup html={prompt.notice} />}
      {prompt.hasAssumption && <details className="sup scenario-context"><summary>Enunciado del supuesto</summary><div className="pre">{prompt.assumptionText}</div></details>}
      {prompt.context && <div className="ctx pre"><StudyMarkup html={richHtml(prompt.context)} /></div>}
      {asksForNegativeOption(prompt.statement) && <div className="pide">Ojo: te piden la opción INCORRECTA o la excepción</div>}
      <div className="enun pre" tabIndex={0} aria-label="Enunciado. Usa Mayús y las flechas para seleccionar texto"><StudyMarkup html={richHtml(prompt.statement, snapshot.readingMode === 1)} /></div>
      <div className="study-signals" aria-label="Señales opcionales de estudio"><span className="study-signals-label">¿Cómo lo ves?</span>{(['sure', 'betweenTwo', 'guess'] as const).map(value => <button type="button" className={`signal${snapshot.confidence === value ? ' on' : ''}`} data-confidence={value} aria-pressed={snapshot.confidence === value} disabled={responseLocked || snapshot.paused} onClick={() => quiz.setConfidence(value)} key={value}>{confidenceLabels[value]}</button>)}</div>
      <div className="opts">{prompt.options.map((option, index) => { const selected = snapshot.answer === index, correct = revealed && index === prompt.correctIndex, wrong = revealed && selected && index !== prompt.correctIndex; return <div className="option-control" key={`${prompt.id}-${index}`}><button type="button" className={`opt${snapshot.discarded.includes(index) ? ' discarded' : ''}${correct ? ' ok' : wrong ? ' bad' : selected ? ' sel' : ''}${revealed ? ' dis' : ''}`} data-i={index} aria-pressed={selected} disabled={revealed || snapshot.paused || gateRemaining > 0} onClick={() => { const currentSelection = window.getSelection(); if (currentSelection && !currentSelection.isCollapsed && (root.current?.querySelector(`.opt[data-i="${index}"]`)?.contains(currentSelection.anchorNode) || root.current?.querySelector(`.opt[data-i="${index}"]`)?.contains(currentSelection.focusNode))) return; quiz.answer(index); }}><b>{'ABCD'[index]}</b><span className="pre" tabIndex={0} aria-label={`Opción ${'ABCD'[index]}. Usa Mayús y las flechas para seleccionar texto`}><StudyMarkup html={richHtml(option, snapshot.readingMode === 1)} /></span>{correct && <span className="sr">(respuesta correcta)</span>}{wrong && <span className="sr">(tu respuesta, incorrecta)</span>}</button><button type="button" className={`discard-option${snapshot.discarded.includes(index) ? ' on' : ''}`} data-discard-option={index} aria-pressed={snapshot.discarded.includes(index)} aria-label={`${snapshot.discarded.includes(index) ? 'Restaurar' : 'Descartar'} opción ${'ABCD'[index]}`} disabled={responseLocked || snapshot.paused || gateRemaining > 0} onClick={() => quiz.toggleDiscard(index)}>{snapshot.discarded.includes(index) ? 'Restaurar' : 'Descartar'}</button></div>; })}</div>
      <div className="highlight-tools" id="highlight-tools" role="group" aria-label="Subrayado opcional" hidden={!selection || snapshot.paused}><span>Texto seleccionado:</span><button type="button" className="signal" data-add-highlight="key" onMouseDown={event => event.preventDefault()} onClick={() => addMark('key')}>Clave</button><button type="button" className="signal" data-add-highlight="doubt" onMouseDown={event => event.preventDefault()} onClick={() => addMark('doubt')}>Duda</button>{highlightMark.questionId === prompt.id && highlightMark.id && <button type="button" className="signal" data-remove-highlight onClick={() => { quiz.removeHighlight(highlightMark.id!); setHighlightMark({ questionId: prompt.id, id: null }); }}>Quitar marca</button>}</div>
      <p className="sub stale-highlight" id="stale-highlight" hidden>Una marca no coincide con el texto actual y no se ha movido.</p>
      {gateRemaining > 0 && <div className="gate" id="gate" role="status">👀 Lee con calma: podrás responder en {gateRemaining} s. ¿Qué te piden? ¿Hay NO, SALVO, cifras?</div>}
      {revealed && <div className={`fb ${snapshot.studyState === 'revealed' ? 'note' : snapshot.answer === prompt.correctIndex ? 'good' : 'wrong'}`} role="status"><b>{snapshot.studyState === 'revealed' ? 'Solución consultada · cuenta como blanco' : snapshot.answer === -1 ? 'Sin responder' : snapshot.answer === prompt.correctIndex ? '¡Correcto!' : 'Incorrecto'}</b> · Respuesta: <b>{'ABCD'[prompt.correctIndex]}</b>
        {snapshot.studyState === 'revealed' && <span className="sr" id="live">Solución consultada · cuenta como blanco</span>}
        {snapshot.studyState !== 'revealed' && snapshot.answer !== -1 && snapshot.answer !== prompt.correctIndex && snapshot.recentAnswer && <div className="fbsub">Marcaste {'ABCD'[snapshot.answer!]} en {snapshot.recentAnswer[0]} s{snapshot.recentAnswer[0] < snapshot.recentAnswer[1] * 0.6 ? `; leerla con calma lleva unos ${snapshot.recentAnswer[1]} s` : ''}.</div>}
        {prompt.citation && <div className="cita"><span>Temario</span><StudyMarkup html={hiliteHtml(prompt.citation, prompt.options[prompt.correctIndex])} /></div>}{prompt.source && <StudyMarkup html={prompt.source} />}{prompt.traps.length > 0 && <div className="trap">Trampa: {prompt.traps.map(id => TRAMPAS[id] || id).join(' · ')}</div>}
        {snapshot.studyState !== 'revealed' && snapshot.answer !== prompt.correctIndex && snapshot.answer !== -1 && <div className="mot"><small>¿Por qué fallé? <HelpIconLink topic="motivos" label="Ayuda sobre los motivos del fallo" />{snapshot.recentAnswer && snapshot.recentAnswer[0] < snapshot.recentAnswer[1] * .6 && <b className="r">Respondiste en {snapshot.recentAnswer[0]} s; leerla bien lleva ≈{snapshot.recentAnswer[1]} s. ¿Fue velocidad?</b>}</small>{[5, 7, 1, 2, 3, 4].map(reason => <button className={snapshot.failureReason === reason ? 'on' : reason === 7 && snapshot.recentAnswer && snapshot.recentAnswer[0] < snapshot.recentAnswer[1] * .6 ? 'sug' : ''} data-m={reason} key={reason} onClick={() => quiz.setFailureReason(reason)}>{FAILURE_REASONS[reason]}</button>)}{!(snapshot.failureReason === 4 && !snapshot.cardExists) && <button className="mk" id="mkcard" onClick={() => quiz.toggleCard()}>{snapshot.cardExists ? '📇 Tarjeta creada ✓' : '📇 Hacer tarjeta'}</button>}</div>}
        {snapshot.studyState !== 'revealed' && snapshot.answer === prompt.correctIndex && <div className="mot"><small>¿Seguro? (entra en repaso a +2 días)</small>{snapshot.scoreByLuck === 6 && <b className="r">🍀 Marcada como suerte: acierto 1/2. Otra vez bien y se quita la etiqueta.</b>}{snapshot.scoreByLuck === 8 && <b className="r">🍀 ¡Acierto 2/2! Etiqueta de suerte quitada: ya la sabes.</b>}<button className={snapshot.scoreByLuck === 6 || snapshot.scoreByLuck === 8 ? 'on' : ''} data-a="doubt" onClick={() => quiz.markDoubt()}>🤔 Acerté dudando</button><button className={snapshot.scoreByLuck === 6 || snapshot.scoreByLuck === 8 ? 'on' : ''} data-a="suerte" onClick={() => quiz.markLuck()}>🍀 Fue suerte</button></div>}
        <button className="ghost fl" id="flag" onClick={() => quiz.toggleFlag()}>{snapshot.flagged ? '★ Dudosa' : '☆ Marcar como dudosa'}</button>
        <div className="repw" id="rep">{report?.state === 'abierto' && !reportOpen ? <span className="rep ok">✓ Error anotado <button className="ghost sm" onClick={openReport}>editar</button></span> : !reportOpen ? <button className="ghost fl" onClick={openReport}>⚠ Avisar de error</button> : <div className="repf"><label htmlFor="report-reason">Motivo del error</label><select id="report-reason" value={reportReason} onChange={event => setReportReason(event.target.value)}>{['Respuesta correcta mal marcada', 'Enunciado erróneo o confuso', 'Opciones repetidas o dos correctas', 'La cita del temario no coincide', 'Otro'].map(reason => <option key={reason}>{reason}</option>)}</select><label htmlFor="report-note">Qué falla (opcional)</label><input id="report-note" maxLength={300} placeholder="Qué falla (opcional)" value={reportNote} onChange={event => setReportNote(event.target.value)} /><div className="row"><button className="btn" onClick={() => { quiz.saveReport(reportReason, reportNote); setReportOpen(false); }}>Guardar</button><button className="btn sec" onClick={() => setReportOpen(false)}>Cancelar</button></div></div>}</div>
        {explanationComponent}
      </div>}
    </div>
    <div className="bar2">{snapshot.feedback ? <><button className="btn sec" id="prev" disabled={snapshot.index === 0 || snapshot.paused} onClick={movePrevious}>← Anterior</button>{snapshot.studyState === 'unseen' ? <button className="btn sec" id="blank" disabled={snapshot.paused} onClick={markBlank}>No lo sé</button> : snapshot.studyState === 'pending' ? <><span className="tag warn" role="status">Pendiente</span><button className="btn sec" id="reveal-solution" disabled={snapshot.paused} onClick={() => quiz.reveal() && window.scrollTo(0, 0)}>Ver solución</button></> : snapshot.studyState === 'revealed' ? <span className="tag warn" role="status">Solución consultada · blanco</span> : <span className="tag" role="status">Respondida</span>}<button className="btn" id="next" disabled={snapshot.paused} onClick={() => void moveNext()}>{snapshot.index + 1 === snapshot.count ? 'Terminar' : 'Siguiente'} →</button></> : <><button className="btn sec" id="blank" disabled={snapshot.paused} onClick={() => quiz.toggleBlank()}>{snapshot.answer === -1 ? '✓ En blanco' : 'Dejar en blanco'}</button><button className="btn" id="next" disabled={snapshot.paused} onClick={() => void moveNext()}>{snapshot.index + 1 === snapshot.count ? 'Terminar' : 'Siguiente'} →</button></>}</div>
    {snapshot.paused && <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pt"><div className="card"><h2 id="pt">En pausa</h2><p>El tiempo está detenido.</p><button className="btn" id="resume" onClick={() => quiz.setPaused(false)}>Continuar</button></div></div>}
  </div>;
}
