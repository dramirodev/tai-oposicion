import { X } from 'lucide-react';

interface StudyExitButtonProps {
  onExit: () => void;
  className?: string;
  id?: string;
}

/** Accessible exit control used by study session headers. */
export function StudyExitButton({ onExit, className = 'ghost', id }: StudyExitButtonProps) {
  return <button className={className} id={id} aria-label="Salir" onClick={onExit}><X size="1.25rem" aria-hidden="true" /></button>;
}
