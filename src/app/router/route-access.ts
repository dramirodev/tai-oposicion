const guestRoutes = new Set(['home', 'quiz', 'result', 'settings', 'acceso', 'ayuda']);

export function isGuestNavigationRoute(route: string): boolean {
  return guestRoutes.has(route);
}
