(() => {
  let theme = 'auto';
  let visualTheme = 'soft-brutalism';
  try {
    const account = localStorage.getItem('tai.account');
    const storageKey = `tai.v1:${account || 'guest'}`;
    const snapshot = JSON.parse(localStorage.getItem(storageKey) || 'null');
    const savedTheme = snapshot?.cfg?.ui?.theme;
    const savedVisualTheme = snapshot?.cfg?.ui?.visualTheme;
    if (['soft-brutalism', 'living-notebook', 'momentum', 'tai-lab', 'classic'].includes(savedVisualTheme)) visualTheme = savedVisualTheme;
    else if (savedVisualTheme === 'precision') visualTheme = 'classic';
    if (savedTheme === 'light' || savedTheme === 'dark') theme = savedTheme;
  } catch {}
  const root = document.documentElement;
  root.dataset.visualTheme = visualTheme;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.colorScheme = dark ? 'dark' : 'light';
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = dark ? '#111113' : '#f5f6f7';
})();
