// Fachada de la sincronización: el SDK de Firebase se carga bajo demanda (import dinámico) tras el primer pintado.
import { status, onStatus, emit } from './sync-status-store.js';
import type { AccessRequest } from '../../core/domain/entities.js';
import type { ProgressSyncStore } from '../contracts/progress-sync.js';
import type { AttemptRepository } from '../../core/ports/AttemptRepository.js';
import type { AcademyMaterialOpenEvent, AcademyMaterialSelection, AcademySectionStudyEvent } from '../../core/domain/academy-study-progress.js';
import type { AcademyStudyProgressSyncStore } from './academy-study-progress-sync.js';
export { status, onStatus };
type Mod = typeof import('./legacy-sync.js');
let mod: Mod | null = null, loading: Promise<Mod> | null = null;
let attemptRepository: AttemptRepository | null = null;
const load = (): Promise<Mod> => (loading ||= import('./legacy-sync.js').then(metadata => {
  mod = metadata;
  if (attemptRepository) metadata.setAttemptRepository(attemptRepository);
  return metadata;
}, event => {
  loading = null;
  status.state = 'sin conexión';
  status.error = 'No se pudo cargar el servicio de autenticación.';
  status.authResolved = true;
  emit();
  throw event;
}));
export function setAttemptRepository(repository: AttemptRepository): void {
  attemptRepository = repository;
  if (mod) mod.setAttemptRepository(repository);
}
// Si el módulo ya está cargado se llama de forma síncrona: signInWithPopup necesita ejecutarse dentro del gesto del usuario.
const call = <R>(callback: (metadata: Mod) => R): R | Promise<R> => (mod ? callback(mod) : load().then(callback));
export const init = (metadata: Parameters<Mod['init']>[0], progressStore: ProgressSyncStore, trainingSessionStore?: Parameters<Mod['init']>[2], paperRecallStore?: Parameters<Mod['init']>[3], trainingCalendarStore?: Parameters<Mod['init']>[4], weeklyStudyAgendaStore?: Parameters<Mod['init']>[5], academyStudyProgressStore?: AcademyStudyProgressSyncStore, paperTestAttemptsStore?: Parameters<Mod['init']>[7]) => load().then(value => value.init(metadata, progressStore, trainingSessionStore, paperRecallStore, trainingCalendarStore, weeklyStudyAgendaStore, academyStudyProgressStore, paperTestAttemptsStore));
export const login = () => call(metadata => metadata.login());
export const logout = () => call(metadata => metadata.logout());
export const retry = () => call(metadata => metadata.retry());
export const requestAccess = () => call(metadata => metadata.requestAccess());
export const approve = (accessRequest: AccessRequest) => call(metadata => metadata.approve(accessRequest));
export const reject = (id: string) => call(metadata => metadata.reject(id));
export const revoke = (id: string) => call(metadata => metadata.revoke(id));
export const pushTrainingSession = (session: import('../../core/domain/study-training-session.js').DailyTrainingSession) => call(metadata => metadata.pushTrainingSession(session));
export const pushPaperRecallAssessments = () => call(metadata => metadata.pushPaperRecallAssessments());
export const pushPaperTestAttempts = () => call(metadata => metadata.pushPaperTestAttempts());
export const pushTrainingCalendar = (activities?: readonly import('../../core/domain/study-training-calendar.js').ScheduledStudyActivity[]) => call(metadata => metadata.pushTrainingCalendar(activities));
export const pushWeeklyStudyAgenda = () => call(metadata => metadata.pushWeeklyStudyAgenda());
export const pushAcademyMaterialSelection = (selection: AcademyMaterialSelection) => call(metadata => metadata.pushAcademyMaterialSelection(selection));
export const pushAcademySectionStudyEvent = (event: AcademySectionStudyEvent) => call(metadata => metadata.pushAcademySectionStudyEvent(event));
export const pushAcademyMaterialOpenEvent = (event: AcademyMaterialOpenEvent) => call(metadata => metadata.pushAcademyMaterialOpenEvent(event));
