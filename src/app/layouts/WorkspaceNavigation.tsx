import { BookText, type LucideIcon } from 'lucide-react';
import { showMenu, type MenuGroup } from '../../shared/ui/dialog-actions.js';
import { hashPath, hashSegment } from '../router/paths.js';
import { navigationIcons } from '../navigation-icons.js';

interface Destination { route: string; label: string; icon: LucideIcon }
const destinations: Destination[] = [
  { route: 'home', label: 'Inicio', icon: navigationIcons.home },
  { route: 'test', label: 'Test por tema', icon: navigationIcons.test },
  { route: 'sim', label: 'Simulacros', icon: navigationIcons.sim },
  { route: 'cards', label: 'Tarjetas', icon: navigationIcons.cards },
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
  ['Practicar', ['test', 'sim', 'cards']],
  ['Afianzar', ['falladas', 'temario', 'planificacion', 'stats']],
  ['Entrenamientos', ['lectura', 'trampas', 'relampago']],
  ['Tu espacio', ['ayuda', 'settings', 'acceso']],
] as const;
export function WorkspaceNavigation({ full, owner, section, pathname, navigate }: {
  full: boolean; owner: boolean; section: string; pathname: string; navigate: (path: string) => void;
}) {
  const visible = (route: string) => route === 'acceso' ? owner : full || ['home', 'ayuda', 'settings'].includes(route);
  const current = pathname.split('/')[1] || 'home';
  const active = (route: string) => route === current || (['quiz', 'result', 'sim2', 'examenes'].includes(current) && section === route);
  const link = (destination: Destination) => { const Icon = destination.icon; return <a key={destination.route} href={hashSegment(destination.route)} className={active(destination.route) ? 'is-active' : ''} aria-current={active(destination.route) ? 'page' : undefined}><Icon size="1.125rem" strokeWidth={1.7} aria-hidden="true" /><span>{destination.label}</span></a>; };
  const openMenu = () => {
    const menu: MenuGroup[] = [['Inicio', [[navigationIcons.home, 'Inicio', '', hashPath('home')]]]];
    if (full) menu.push(['Planificación', [[navigationIcons.planning, 'Planificación de estudio', 'Sesión de hoy y calendario semanal', hashPath('planning')]]]);
    for (const [title, routes] of groups) {
      const menuRoutes = full && title === 'Afianzar' ? routes.filter(route => route !== 'planificacion') : routes;
      const items: MenuGroup[1] = destinations.filter(d => (menuRoutes as readonly string[]).includes(d.route) && visible(d.route)).map(d => [d.icon, d.label, '', hashSegment(d.route)]);
      if (items.length) menu.push([title, items]);
    }
    void showMenu(menu, hashSegment(current), path => navigate(path.slice(1)));
  };
  return <>
    <aside className="workspace-sidebar" aria-label="Espacio de estudio">
      <a className="workspace-brand" href={hashPath('home')} translate="no"><span className="workspace-mark" aria-hidden="true">TAI</span><span>Oposición<small>Tu espacio de estudio</small></span></a>
      {link(destinations[0])}
      {groups.map(([title, routes]) => {
        const items = destinations.filter(d => (routes as readonly string[]).includes(d.route) && visible(d.route));
        return items.length > 0 && <section key={title} className={title === 'Tu espacio' ? 'workspace-utilities' : undefined} aria-label={title}><h2>{title}</h2>{items.map(link)}</section>;
      })}
    </aside>
    <header className="workspace-mobile-header"><a href={hashPath('home')} className="workspace-mobile-brand" translate="no">TAI <span>Oposición</span></a><button className="workspace-menu" type="button" aria-haspopup="dialog" onClick={openMenu}><BookText size="1.125rem" strokeWidth={1.7} aria-hidden="true" />Menú</button></header>
  </>;
}
