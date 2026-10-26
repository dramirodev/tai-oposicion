import { useMemo, useState, useSyncExternalStore } from 'react';
import { Navigate } from 'react-router';
import { useStudyServices } from '../../shared/ui/study-services.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { useActionLifetime } from '../../shared/ui/use-action-lifetime.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { AccessView } from './AccessView.js';
import { createAccessController } from './access-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
export function AccessPage() {
  const { access: services } = useStudyServices();
  const captureLifetime = useActionLifetime(services.accountId);
  const [controller] = useState(() => createAccessController(services, captureLifetime));
  const pending = useSyncExternalStore(controller.subscribe, controller.getPending, controller.getPending);
  const resource = useMemo(() => ({ accountId: services.accountId, subscribe: services.subscribe, load: services.load }), [services]);
  const { value: overview, error } = useAccountResource(resource);
  usePageReady(!!overview?.owner);
  const run = (id: string, action: () => Promise<boolean>, success: string, confirmation?: readonly [string, string]) => { void controller.run(id, action, success, confirmation); };
  if (error) return <p role="alert">No se pudo cargar la lista de accesos.</p>;
  if (!overview) return <PageLoading variant="access" />;
  if (!overview.owner) return <Navigate to="/home" replace />;
  return <AccessView
    overview={overview}
    pending={pending}
    onApprove={member => void run(member.uid, () => services.approve(member), `${member.name || member.email} ya tiene acceso completo`)}
    onReject={member => void run(member.uid, () => services.reject(member.uid), 'Solicitud rechazada', [`¿Rechazar la solicitud de ${member.name || member.email}?`, 'Rechazar'])}
    onRevoke={member => void run(member.uid, () => services.revoke(member.uid), 'Acceso revocado', [`¿Quitar el acceso completo a ${member.name || member.email}? Volverá a poder hacer solo la sesión rápida.`, 'Revocar'])}
  />;
}
