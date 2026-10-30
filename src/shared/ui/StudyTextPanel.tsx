import { StudyMarkup } from './StudyMarkup.js';

interface StudyTextPanelProps {
  title: string;
  html: string;
  languageContext?: string;
}

/** Renders a labelled study citation or note using the shared rich-text renderer. */
export function StudyTextPanel({ title, html, languageContext }: StudyTextPanelProps) {
  return <div className="mt-2.5 rounded-[var(--r-l)] border border-[var(--line)] bg-[var(--card)] p-4 text-[length:var(--fs-b)] leading-[1.65] text-[var(--ink)] [overflow-wrap:anywhere]">
    <span className="mb-1.5 block text-[length:var(--fs-xs)] font-bold text-[var(--mute)]">{title}</span>
    <StudyMarkup html={html} languageContext={languageContext} />
  </div>;
}
