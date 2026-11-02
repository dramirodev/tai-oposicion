import { mergeRemoteWeeklyStudyAgenda, readWeeklyStudyAgenda, saveWeeklyStudyAgenda } from '../../../adapters/local/weekly-study-agenda.js';
import { applyWeeklyAgendaPlan, applyWeeklyAgendaRecovery, isWeeklyAgendaItem, replaceWeeklyAgendaWeek, updateWeeklyAgendaItemStatus, type WeeklyAgendaItem, type WeeklyAgendaPlanProposal, type WeeklyAgendaRecoveryProposal, type WeeklyAgendaStatus, type WeeklyStudyAgenda } from '../../../core/domain/study-weekly-agenda.js';

/** Account-scoped local checkpoint for confirmed weekly proposals with optional private cloud sync. */
export function createWeeklyStudyAgendaComposition(dependencies: {
  accountId(): string | null;
  now(): number;
  push?(agenda: WeeklyStudyAgenda): void;
}) {
  const get = () => readWeeklyStudyAgenda(dependencies.accountId());
  const persist = (agenda: WeeklyStudyAgenda): boolean => {
    const accountId = dependencies.accountId();
    if (!saveWeeklyStudyAgenda(accountId, agenda)) return false;
    dependencies.push?.(readWeeklyStudyAgenda(accountId));
    return true;
  };
  return {
    get,
    mergeRemote(value: unknown): boolean { return mergeRemoteWeeklyStudyAgenda(dependencies.accountId(), value); },
    replaceWeek(weekStart: string, items: readonly WeeklyAgendaItem[]): WeeklyStudyAgenda | null {
      const next = replaceWeeklyAgendaWeek(get(), weekStart, items, dependencies.now());
      if (!next || !persist(next)) return null;
      return get();
    },
    recover(proposal: WeeklyAgendaRecoveryProposal): WeeklyStudyAgenda | null {
      const next = applyWeeklyAgendaRecovery(get(), proposal, dependencies.now());
      if (!next || !persist(next)) return null;
      return get();
    },
    addPlan(proposal: WeeklyAgendaPlanProposal): WeeklyStudyAgenda | null {
      const next = applyWeeklyAgendaPlan(get(), proposal, dependencies.now());
      if (!next || !persist(next)) return null;
      return get();
    },
    setStatus(id: string, status: WeeklyAgendaStatus): WeeklyStudyAgenda | null {
      if (!isWeeklyAgendaItem(get().items.find(item => item.id === id))) return null;
      const next = updateWeeklyAgendaItemStatus(get(), id, status, dependencies.now());
      if (!next || !persist(next)) return null;
      return get();
    },
  };
}
