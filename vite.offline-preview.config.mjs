import config from './vite.config.mjs';

// A local-only UI preview must never reuse the production Firebase configuration.
const offlineFirebaseConfig = {
  name: 'tai-offline-preview-firebase-config',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/firebase-config.json') return next();
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end('{}');
    });
  },
};

export default { ...config, plugins: [offlineFirebaseConfig, ...config.plugins] };
