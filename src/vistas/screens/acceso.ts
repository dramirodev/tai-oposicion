import * as sync from '../../infra/syncfacade.js';
import { esc } from '../../domain/logic.js';
import { $, app, legacyScope, toast, ask, type El } from '../ui.js';
import { isOwner } from '../../infra/access.js';
// Pantalla del propietario: aprobar o rechazar solicitudes y revocar accesos.
export function registerAcceso({ routes, go }: any, screen: any) {
routes.acceso = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen);
  if (!isOwner()) { go('#/home'); return; }
  const fecha = (ts: any) => ts ? new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
  const draw = () => {
    const s = sync.status, rq = s.reqs, gr = s.grants;
    app.innerHTML = `
    <h1>Accesos</h1>
    <p class="sub">Quien no esté aprobado solo puede hacer la sesión rápida de 5 minutos. Al aprobar, la persona obtiene todas las funciones y su propio historial sincronizado.</p>
    ${s.accessErr ? `<div class="note">No se pudo leer la lista de accesos (${esc(s.accessErr)}). Comprueba que las reglas de Firestore están publicadas.</div>` : ''}
    <div class="card"><h2 class="h3">Solicitudes (${rq.length})</h2>
      ${rq.length ? rq.map((r, i) => `<div class="arow"><span><b>${esc(r.name || r.email)}</b><small>${esc(r.email)} · ${fecha(r.ts)}</small></span>
        <span class="abtn"><button class="btn" data-ok="${i}">Aprobar</button><button class="btn sec" data-no="${i}">Rechazar</button></span></div>`).join('') : '<p class="sub">No hay solicitudes pendientes.</p>'}
    </div>
    <div class="card"><h2 class="h3">Con acceso completo (${gr.length})</h2>
      ${gr.length ? gr.map((g, i) => `<div class="arow"><span><b>${esc(g.name || g.email)}</b><small>${esc(g.email)} · desde ${fecha(g.ts)}</small></span>
        <span class="abtn"><button class="btn sec" data-rv="${i}">Revocar</button></span></div>`).join('') : '<p class="sub">Todavía nadie, aparte de ti.</p>'}
    </div>`;
    const run = async (btn: any, fn: any, ok: any) => { btn.disabled = true; if (await fn()) toast(ok); else { btn.disabled = false; toast('No se pudo completar. Revisa la conexión y las reglas de Firestore.'); } };
    app.querySelectorAll<El>('[data-ok]').forEach(b => b.onclick = () => { const r = rq[+b.dataset.ok!]; run(b, () => sync.approve(r), `${r.name || r.email} ya tiene acceso completo`); });
    app.querySelectorAll<El>('[data-no]').forEach(b => b.onclick = async () => { const r = rq[+b.dataset.no!]; if (await ask(`¿Rechazar la solicitud de ${r.name || r.email}?`, 'Rechazar', true)) run(b, () => sync.reject(r.uid), 'Solicitud rechazada'); });
    app.querySelectorAll<El>('[data-rv]').forEach(b => b.onclick = async () => { const g = gr[+b.dataset.rv!]; if (await ask(`¿Quitar el acceso completo a ${g.name || g.email}? Volverá a poder hacer solo la sesión rápida.`, 'Revocar', true)) run(b, () => sync.revoke(g.uid), 'Acceso revocado'); });
  };
  routeScreen.cleanup = sync.onStatus(draw);
  draw();
};
}
