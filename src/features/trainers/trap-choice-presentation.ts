export type TrapChoiceIcon = 'check' | 'circle' | 'circle-x' | null;

export interface TrapChoicePresentation {
  className: string;
  label: string;
  icon: TrapChoiceIcon;
}

export function getTrapChoicePresentation(input: {
  trapLabel: string;
  selected: boolean;
  correct: boolean;
  revealed: boolean;
  wasSelected: boolean;
}): TrapChoicePresentation {
  const { trapLabel, selected, correct, revealed, wasSelected } = input;
  if (!revealed) return { className: selected ? 'on' : '', label: trapLabel, icon: null };
  if (correct) {
    return {
      className: wasSelected ? 'ok' : 'sug',
      label: `${wasSelected ? 'Detectada: ' : 'No la viste: '}${trapLabel}`,
      icon: wasSelected ? 'check' : 'circle',
    };
  }
  if (wasSelected) return { className: 'bad', label: `Falsa alarma: ${trapLabel}`, icon: 'circle-x' };
  return { className: '', label: trapLabel, icon: null };
}
