import { useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { useStudyServices } from '../../shared/ui/study-services.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { useActionLifetime } from '../../shared/ui/use-action-lifetime.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
const date = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
export function AccessPage() {
  const { access: services } = useStudyServices();
  const captureLifetime = useActionLifetime(services.accountId);
  const resource = useMemo(() => ({ accountId: services.accountId, subscribe: services.subscribe, load: services.load }), [services]);
  const { value: overview, error } = useAccountResource(resource);
  const busy = useRef(new Set<string>()), [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  usePageReady(!!overview?.owner);
  const run = async (id: string, action: () => Promise<boolean>, success: string, confirmation?: [string, string]) => {
    if (busy.current.has(id)) return;
    const alive = captureLifetime();
    busy.current.add(id); setPending(new Set(busy.current));
    try {
      if (confirmation && !await services.confirm(confirmation[0], confirmation[1], true)) return;
      if (!alive()) return;
      const result = await action();
      if (alive()) services.notify(result ? success : 'No se pudo completar. Revisa la conexión y las reglas de Firestore.');
    } catch { if (alive()) services.notify('No se pudo completar. Revisa la conexión y las reglas de Firestore.'); }
    finally { busy.current.delete(id); if (alive()) setPending(new Set(busy.current)); }
  };
  if (error) return <p role="alert">No se pudo cargar la lista de accesos.</p>;
  if (!overview) return <p className="sub loading" role="status">Cargando…</p>;
  if (!overview.owner) return <Navigate to="/home" replace />;
  return <><h1>Accesos</h1><p className="sub">Quien no esté aprobado solo puede hacer la sesión rápida de 5 minutos. Al aprobar, la persona obtiene todas las funciones y su propio historial sincronizado.</p>
    {overview.error && <div className="note">No se pudo leer la lista de accesos ({overview.error}). Comprueba que las reglas de Firestore están publicadas.</div>}
    <div className="card"><h2 className="h3">Solicitudes ({overview.requests.length})</h2>{overview.requests.length ? overview.requests.map((member, index) => <div className="arow" key={member.uid}><span><b>{member.name || member.email}</b><small>{member.email} · {date(member.ts)}</small></span><span className="abtn"><button className="btn" data-ok={index} disabled={pending.has(member.uid)} onClick={() => void run(member.uid, () => services.approve(member), `${member.name || member.email} ya tiene acceso completo`)}>Aprobar</button><button className="btn sec" data-no={index} disabled={pending.has(member.uid)} onClick={() => void run(member.uid, () => services.reject(member.uid), 'Solicitud rechazada', [`¿Rechazar la solicitud de ${member.name || member.email}?`, 'Rechazar'])}>Rechazar</button></span></div>) : <p className="sub">No hay solicitudes pendientes.</p>}</div>
    <div className="card"><h2 className="h3">Con acceso completo ({overview.grants.length})</h2>{overview.grants.length ? overview.grants.map((member, index) => <div className="arow" key={member.uid}><span><b>{member.name || member.email}</b><small>{member.email} · desde {date(member.ts)}</small></span><span className="abtn"><button className="btn sec" data-rv={index} disabled={pending.has(member.uid)} onClick={() => void run(member.uid, () => services.revoke(member.uid), 'Acceso revocado', [`¿Quitar el acceso completo a ${member.name || member.email}? Volverá a poder hacer solo la sesión rápida.`, 'Revocar'])}>Revocar</button></span></div>) : <p className="sub">Todavía nadie, aparte de ti.</p>}</div>
  </>;
}
