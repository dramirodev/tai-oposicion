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

const rowClasses: Record<PageLoadingVariant, string> = {
  home: 'min-h-[4.75rem]',
  topics: 'min-h-[3.625rem]',
  access: 'min-h-[6.875rem]',
  legacy: 'min-h-[4.75rem]',
  study: 'min-h-[4.75rem]',
  content: 'min-h-[5.5rem]',
  chart: 'min-h-[11rem]',
};

const rowsClasses: Record<PageLoadingVariant, string> = {
  home: 'grid-cols-2 gap-3 mt-5 max-[640px]:grid-cols-1',
  topics: 'grid-cols-1 gap-2 mt-5',
  access: 'grid-cols-2 gap-3 mt-5 max-[640px]:grid-cols-1',
  legacy: 'grid-cols-1 gap-3 mt-5',
  study: 'grid-cols-1 gap-3 mt-5',
  content: 'grid-cols-1 gap-3 mt-0',
  chart: 'grid-cols-1 gap-3 mt-0',
};

const shapeClasses = 'block rounded-md bg-[linear-gradient(100deg,var(--card)_25%,var(--sel)_45%,var(--card)_65%)] [background-size:300%_100%] motion-safe:animate-[page-loading-shimmer_1.5s_ease-in-out_infinite] motion-reduce:bg-none motion-reduce:bg-[var(--sel)]';

export function PageLoading({ variant }: { variant: PageLoadingVariant }) {
  const compact = variant === 'content' || variant === 'chart';
  return <section className={`page-loading ${compact ? 'min-h-0 p-0' : 'min-h-[min(58vh,35rem)] py-[clamp(1.25rem,4vw,2.5rem)]'}`} aria-busy="true">
    <span className="sr" role="status">Cargando {labels[variant]}…</span>
    <div className="mx-auto grid max-w-[61.25rem] gap-4" aria-hidden="true">
      {variant !== 'content' && variant !== 'chart' && <>
        <span className={`${shapeClasses} w-[min(58%,21.25rem)] h-[2.125rem]`} />
        <span className={`${shapeClasses} w-[min(82%,38.75rem)] h-[1.125rem]`} />
      </>}
      <div className={`grid ${rowsClasses[variant]}`}>
        {(variant === 'chart' ? [0] : variant === 'content' ? [0, 1, 2] : [0, 1, 2, 3]).map(index => <span className={`${shapeClasses} ${rowClasses[variant]}`} key={index} />)}
      </div>
    </div>
  </section>;
}
