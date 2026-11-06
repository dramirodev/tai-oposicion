import { BookText, type LucideIcon } from 'lucide-react';
import type { MouseEvent } from 'react';
import { showMenu, type MenuGroup } from '../../shared/ui/dialog-actions.js';
import { hashPath, hashSegment } from '../router/paths.js';
import { navigationIcons } from '../navigation-icons.js';

interface Destination { route: string; label: string; icon: LucideIcon }
const destinations: Destination[] = [
  { route: 'home', label: 'Inicio', icon: navigationIcons.home },
  { route: 'test', label: 'Test por tema', icon: navigationIcons.test },
  { route: 'sim', label: 'Simulacros', icon: navigationIcons.sim },
  { route: 'falladas', label: 'Preguntas falladas', icon: navigationIcons.failures },
  { route: 'lectura', label: 'Lectura atenta', icon: navigationIcons.reading },
  { route: 'trampas', label: 'Detective de trampas', icon: navigationIcons.traps },
  { route: 'relampago', label: 'Relámpago', icon: navigationIcons.lightning },
  { route: 'temario', label: 'Temas estudiados', icon: navigationIcons.topics },
  { route: 'planificacion', label: 'Planificación', icon: navigationIcons.planning },
  { route: 'stats', label: 'Progreso', icon: navigationIcons.stats },
  { route: 'ayuda', label: 'Ayuda', icon: navigationIcons.help },
  { route: 'settings', label: 'Ajustes', icon: navigationIcons.settings },
  { route: 'acceso', label: 'Accesos', icon: navigationIcons.access },
];
const groups = [
  ['Planificar', ['planificacion', 'temario']],
  ['Practicar', ['test', 'sim']],
  ['Seguimiento', ['falladas', 'stats']],
  ['Entrenamientos', ['lectura', 'trampas', 'relampago']],
  ['Tu espacio', ['ayuda', 'settings', 'acceso']],
] as const;
export function WorkspaceNavigation({ full, owner, section, pathname, navigate }: {
  full: boolean; owner: boolean; section: string; pathname: string; navigate: (path: string) => void;
}) {
  const visible = (route: string) => route === 'acceso' ? owner : full || ['home', 'ayuda', 'settings'].includes(route);
  const current = pathname.split('/')[1] || 'home';
  const active = (route: string) => route === current || (['quiz', 'result', 'sim2', 'examenes'].includes(current) && section === route);
  const link = (destination: Destination) => { const Icon = destination.icon; return <a key={destination.route} href={hashSegment(destination.route)} className={`flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-muted no-underline motion-safe:transition-[background-color,color] motion-safe:duration-[var(--duration-fast)] ${active(destination.route) ? 'is-active bg-[var(--nav-active)] font-semibold !text-ink' : ''}`} aria-current={active(destination.route) ? 'page' : undefined}><Icon className="h-[1.125rem] w-[1.125rem] shrink-0 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]" size="1.125rem" strokeWidth={1.7} aria-hidden="true" /><span>{destination.label}</span></a>; };
  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.focus({ preventScroll:true });
    const menu: MenuGroup[] = [['Inicio', [[navigationIcons.home, 'Inicio', '', hashPath('home')]]]];
    for (const [title, routes] of groups) {
      const items: MenuGroup[1] = destinations.filter(d => (routes as readonly string[]).includes(d.route) && visible(d.route)).map(d => [d.icon, d.label, '', hashSegment(d.route)]);
      if (items.length) menu.push([title, items]);
    }
    void showMenu(menu, hashSegment(current), path => navigate(path.slice(1)));
  };
  return <>
    <aside className="workspace-sidebar fixed inset-y-0 left-0 z-[7] hidden w-[var(--sidebar-width)] flex-col overflow-y-auto overscroll-contain border-r border-line bg-canvas px-4 pb-6 pt-[calc(1.75rem+var(--sat))] text-sm leading-[1.4] navigation:flex" aria-label="Espacio de estudio">
      <a className="workspace-brand mb-[1.625rem] flex min-h-0 items-center gap-3 px-3 py-0 font-semibold text-ink no-underline" href={hashPath('home')} translate="no"><span className="workspace-mark border-r border-line pb-0 pr-3 text-2xl font-bold tracking-[-.0625rem]" aria-hidden="true">TAI</span><span>Oposición<small className="mt-1 block text-xs">Tu espacio de estudio</small></span></a>
      {link(destinations[0])}
      {groups.map(([title, routes]) => {
        const items = destinations.filter(d => (routes as readonly string[]).includes(d.route) && visible(d.route));
        return items.length > 0 && <section key={title} className={title === 'Tu espacio' ? 'workspace-utilities mt-auto' : undefined} aria-label={title}><h2 className="mx-3 mb-1 mt-[1.375rem] text-xs font-medium text-muted">{title}</h2>{items.map(link)}</section>;
      })}
    </aside>
    <header className="workspace-mobile-header flex items-center justify-between gap-4 border-b border-line bg-canvas px-5 py-3"><a href={hashPath('home')} className="workspace-mobile-brand text-lg font-semibold tracking-[-.03em] text-ink no-underline" translate="no">TAI <span className="ml-1.5 text-[.8125rem] font-normal tracking-normal text-muted">Oposición</span></a><button className="workspace-menu flex min-h-11 items-center gap-2 rounded-md border border-[var(--control-line)] bg-surface px-3 py-2.5 text-[length:var(--fs-m)] font-medium text-ink" type="button" aria-haspopup="dialog" onClick={openMenu}><BookText className="h-[1.125rem] w-[1.125rem] shrink-0 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]" size="1.125rem" strokeWidth={1.7} aria-hidden="true" />Menú</button></header>
  </>;
}
