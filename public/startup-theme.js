(() => {
  let theme = 'auto';
  try {
    const account = localStorage.getItem('tai.account');
    const storageKey = `tai.v1:${account || 'guest'}`;
    const snapshot = JSON.parse(localStorage.getItem(storageKey) || 'null');
    const savedTheme = snapshot?.cfg?.ui?.theme;
    if (savedTheme === 'light' || savedTheme === 'dark') theme = savedTheme;
  } catch {}
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.colorScheme = dark ? 'dark' : 'light';
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = dark ? '#111113' : '#f5f6f7';
})();
