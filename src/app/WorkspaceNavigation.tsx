import type { ReactNode } from 'react';
import { showMenu, type MenuGroup } from '../shared/ui/dialogs.js';

interface Destination { route: string; label: string; icon: ReactNode }
const destinations: Destination[] = [
  { route: 'home', label: 'Inicio', icon: <><path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10" /></> },
  { route: 'test', label: 'Test por tema', icon: <><path d="m4 20 4-1L20 7l-3-3L5 16zM14 7l3 3M12 21h9" /></> },
  { route: 'sim', label: 'Simulacros', icon: <><circle cx="12" cy="14" r="8" /><path d="M12 10v4l3 2M9 2h6" /></> },
  { route: 'cards', label: 'Tarjetas', icon: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M7 3h10M7 12h10M7 16h6" /></> },
  { route: 'falladas', label: 'Preguntas falladas', icon: <><path d="M4 10a8 8 0 1 1 0 6M4 4v6h6M12 8v5l3 2" /></> },
  { route: 'lectura', label: 'Lectura atenta', icon: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12" /><circle cx="12" cy="12" r="3" /></> },
  { route: 'trampas', label: 'Detective de trampas', icon: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6M7 10h6" /></> },
  { route: 'relampago', label: 'Relámpago', icon: <path d="m13 2-9 12h7l-1 8 10-12h-7z" /> },
  { route: 'temario', label: 'Temas estudiados', icon: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /> },
  { route: 'stats', label: 'Progreso', icon: <path d="M5 21V11M12 21V4M19 21v-7" /> },
  { route: 'ayuda', label: 'Ayuda', icon: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3 2.5V14M12 17h.01" /></> },
  { route: 'settings', label: 'Ajustes', icon: <><path d="M3 6h7M16 6h5M3 18h11M20 18h1M3 12h2M11 12h10" /><circle cx="13" cy="6" r="3" /><circle cx="8" cy="12" r="3" /><circle cx="17" cy="18" r="3" /></> },
  { route: 'acceso', label: 'Accesos', icon: <><circle cx="9" cy="7" r="4" /><path d="M2 21v-3a7 7 0 0 1 14 0v3M19 8v6M16 11h6" /></> },
];
const groups = [
  ['Practicar', ['test', 'sim', 'cards']],
  ['Afianzar', ['falladas', 'temario', 'stats']],
  ['Entrenamientos', ['lectura', 'trampas', 'relampago']],
  ['Tu espacio', ['ayuda', 'settings', 'acceso']],
] as const;
function NavigationIcon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}
export function WorkspaceNavigation({ full, owner, section, pathname, navigate }: {
  full: boolean; owner: boolean; section: string; pathname: string; navigate: (path: string) => void;
}) {
  const visible = (route: string) => route === 'acceso' ? owner : full || ['home', 'ayuda', 'settings'].includes(route);
  const current = pathname.split('/')[1] || 'home';
  const active = (route: string) => route === current || (['quiz', 'result', 'sim2', 'examenes'].includes(current) && section === route);
  const link = (destination: Destination) => <a key={destination.route} href={`#/${destination.route}`} className={active(destination.route) ? 'is-active' : ''} aria-current={active(destination.route) ? 'page' : undefined}><NavigationIcon>{destination.icon}</NavigationIcon><span>{destination.label}</span></a>;
  const openMenu = () => {
    const menu: MenuGroup[] = [['Inicio', [['', 'Inicio', '', '#/home']]]];
    for (const [title, routes] of groups) {
      const items: MenuGroup[1] = destinations.filter(d => (routes as readonly string[]).includes(d.route) && visible(d.route)).map(d => ['', d.label, '', `#/${d.route}`]);
      if (items.length) menu.push([title, items]);
    }
    void showMenu(menu, `#/${current}`, path => navigate(path.slice(1)));
  };
  return <>
    <aside className="workspace-sidebar" aria-label="Espacio de estudio">
      <a className="workspace-brand" href="#/home" translate="no"><span className="workspace-mark" aria-hidden="true">TAI</span><span>Oposición<small>Tu espacio de estudio</small></span></a>
      {link(destinations[0])}
      {groups.map(([title, routes]) => {
        const items = destinations.filter(d => (routes as readonly string[]).includes(d.route) && visible(d.route));
        return items.length > 0 && <section key={title} className={title === 'Tu espacio' ? 'workspace-utilities' : undefined} aria-label={title}><h2>{title}</h2>{items.map(link)}</section>;
      })}
    </aside>
    <header className="workspace-mobile-header"><a href="#/home" className="workspace-mobile-brand" translate="no">TAI <span>Oposición</span></a><button className="workspace-menu" type="button" aria-haspopup="dialog" onClick={openMenu}><NavigationIcon><path d="M4 6h16M4 12h16M4 18h16" /></NavigationIcon>Menú</button></header>
  </>;
}
