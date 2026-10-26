import { Link } from 'react-router';

/** Recover from a route failure without exposing internal error details. */
export function RouteError() {
  return <section className="card" role="alert" aria-labelledby="route-error-title">
    <h1 id="route-error-title">No se pudo mostrar esta pantalla</h1>
    <p>Vuelve al inicio o recarga la aplicación para intentarlo de nuevo.</p>
    <div className="row">
      <Link className="btn sec" to="/home">Volver al inicio</Link>
      <button className="btn" onClick={() => window.location.reload()}>Recargar</button>
    </div>
  </section>;
}
