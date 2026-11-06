import type { SettingsSnapshot } from '../../shared/ui/study-services.js';
import { normalizeTrainingPreferences } from '../../core/domain/study-training-plan.js';
import { normalizeUiPreferences } from '../../shared/presentation/ui-preferences.js';

export interface SettingsSnapshotInput {
  sync: SettingsSnapshot['sync'];
  full: boolean;
  level: string;
  devMode: string | null;
  devRevealed: boolean;
  uiPreferences: unknown;
  trainingPreferences: unknown;
  progress: SettingsSnapshot['progress'];
  exam: unknown;
  version: string;
  build: string;
  update: string | null;
  offline: SettingsSnapshot['offline'];
  index: SettingsSnapshot['index'];
}

/** Normalizes composed account, preference and progress data for settings UI. */
export function toSettingsSnapshot(input: SettingsSnapshotInput): SettingsSnapshot {
  const ui = normalizeUiPreferences(input.uiPreferences);
  return {
    sync: input.sync,
    full: input.full,
    level: input.level,
    devMode: input.devMode,
    devRevealed: input.devRevealed,
    ui: { visualTheme: ui.visualTheme, theme: ui.theme, size: ui.size, lectura: ui.lectura },
    training: normalizeTrainingPreferences(input.trainingPreferences),
    progress: input.progress,
    exam: String(input.exam || ''),
    version: input.version,
    build: input.build,
    update: input.update,
    offline: input.offline,
    index: input.index,
  };
}
