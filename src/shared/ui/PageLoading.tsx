type PageLoadingVariant = 'home' | 'topics' | 'access' | 'legacy' | 'study' | 'content' | 'chart';

const labels: Record<PageLoadingVariant, string> = {
  home: 'el inicio',
  topics: 'los temas',
  access: 'los accesos',
  legacy: 'la pantalla',
  study: 'el ejercicio',
  content: 'el contenido',
  chart: 'el gráfico',
};

export function PageLoading({ variant }: { variant: PageLoadingVariant }) {
  return <section className={`page-loading page-loading--${variant}`} aria-busy="true">
    <span className="sr" role="status">Cargando {labels[variant]}…</span>
    <div className="page-loading__content" aria-hidden="true">
      {variant !== 'content' && variant !== 'chart' && <>
        <span className="page-loading__shape page-loading__title" />
        <span className="page-loading__shape page-loading__intro" />
      </>}
      <div className={`page-loading__rows${variant === 'chart' ? ' page-loading__rows--chart' : ''}`}>
        {(variant === 'chart' ? [0] : variant === 'content' ? [0, 1, 2] : [0, 1, 2, 3]).map(index => <span className="page-loading__shape page-loading__row" key={index} />)}
      </div>
    </div>
  </section>;
}
