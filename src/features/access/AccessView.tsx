import type { AccessMember } from '../../shared/ui/study-services.js';

interface AccessOverviewView {
  error?: string;
  requests: readonly AccessMember[];
  grants: readonly AccessMember[];
}

export interface AccessViewProps {
  overview: AccessOverviewView;
  pending: ReadonlySet<string>;
  onApprove(member: AccessMember): void;
  onReject(member: AccessMember): void;
  onRevoke(member: AccessMember): void;
}

const date = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';

export function AccessView({ overview, pending, onApprove, onReject, onRevoke }: AccessViewProps) {
  return <><h1>Accesos</h1><p className="sub">Quien no esté aprobado solo puede hacer la sesión rápida de 5 minutos. Al aprobar, la persona obtiene todas las funciones y su propio historial sincronizado.</p>
    {overview.error && <div className="note">No se pudo leer la lista de accesos ({overview.error}). Comprueba que las reglas de Firestore están publicadas.</div>}
    <div className="card"><h2 className="h3">Solicitudes ({overview.requests.length})</h2>{overview.requests.length ? overview.requests.map((member, index) => <div className="arow" key={member.uid}><span><b>{member.name || member.email}</b><small>{member.email} · {date(member.ts)}</small></span><span className="abtn"><button className="btn" data-ok={index} disabled={pending.has(member.uid)} onClick={() => onApprove(member)}>Aprobar</button><button className="btn sec" data-no={index} disabled={pending.has(member.uid)} onClick={() => onReject(member)}>Rechazar</button></span></div>) : <p className="sub">No hay solicitudes pendientes.</p>}</div>
    <div className="card"><h2 className="h3">Con acceso completo ({overview.grants.length})</h2>{overview.grants.length ? overview.grants.map((member, index) => <div className="arow" key={member.uid}><span><b>{member.name || member.email}</b><small>{member.email} · desde {date(member.ts)}</small></span><span className="abtn"><button className="btn sec" data-rv={index} disabled={pending.has(member.uid)} onClick={() => onRevoke(member)}>Revocar</button></span></div>) : <p className="sub">Todavía nadie, aparte de ti.</p>}</div>
  </>;
}
