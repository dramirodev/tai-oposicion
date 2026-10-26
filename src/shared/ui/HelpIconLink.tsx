import { Link } from 'react-router';
import { CircleHelp } from 'lucide-react';

export type HelpTopic = 'sesiones' | 'motivos' | 'puntuacion' | 'simulacros' | 'repaso' | 'progreso';

export function HelpIconLink({ topic, label }: { topic: HelpTopic; label: string }) {
  return <Link className="help-icon-link" to={`/ayuda?tema=${encodeURIComponent(topic)}`} aria-label={label}>
    <CircleHelp size="1em" strokeWidth={1.8} aria-hidden="true" focusable="false" />
  </Link>;
}
