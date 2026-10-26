type PageLoadingVariant = 'home' | 'topics' | 'access' | 'legacy';

const labels: Record<PageLoadingVariant, string> = {
  home: 'el inicio',
  topics: 'los temas',
  access: 'los accesos',
  legacy: 'la pantalla',
};

export function PageLoading({ variant }: { variant: PageLoadingVariant }) {
  return <section className={`page-loading page-loading--${variant}`} aria-busy="true">
    <span className="sr" role="status">Cargando {labels[variant]}…</span>
    <div className="page-loading__content" aria-hidden="true">
      <span className="page-loading__shape page-loading__title" />
      <span className="page-loading__shape page-loading__intro" />
      <div className="page-loading__rows">
        {[0, 1, 2, 3].map(index => <span className="page-loading__shape page-loading__row" key={index} />)}
      </div>
    </div>
  </section>;
}
