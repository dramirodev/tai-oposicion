import { RouterProvider } from 'react-router';
import { router } from './route-runtime.js';

/** Application route outlet. Route definitions and canonical paths live in route-runtime and paths. */
export function Routes() {
  return <RouterProvider router={router} />;
}
