// Vite config.
// En dev sirve los módulos del juego y además un middleware que emula la
// función serverless /api/evento de Vercel: así la narrativa de IA funciona
// también en local y no aparece un 404 en la pestaña Network.
import { defineConfig, loadEnv } from 'vite';
import { pedirGroq, groqConfigurada, GroqError } from './api/groq.js';

export default defineConfig(({ mode }) => {
  // loadEnv con '' como prefijo carga TODAS las variables del .env,
  // incluida GROQ_API_KEY y GROQ_MODEL (que no llevan prefijo VITE_).
  const env = loadEnv(mode, process.cwd(), '');

  // api/groq.js lee process.env en cada llamada: le propagamos las vars.
  if (env.GROQ_API_KEY !== undefined) process.env.GROQ_API_KEY = env.GROQ_API_KEY;
  if (env.GROQ_MODEL !== undefined) process.env.GROQ_MODEL = env.GROQ_MODEL;

  return {
    plugins: [
      {
        name: 'dream-team-api-evento-dev',
        configureServer(server) {
          server.middlewares.use('/api/evento', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Usá POST' }));
              return;
            }

            if (!groqConfigurada()) {
              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'GROQ_API_KEY no está configurada. El juego sigue andando con el texto del catálogo, pero la narrativa de IA está apagada.',
              }));
              return;
            }

            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
              let payload;
              try {
                payload = JSON.parse(body || '{}');
              } catch {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Body inválido: JSON mal formado.' }));
                return;
              }

              const { sistema, usuario } = payload;
              if (typeof sistema !== 'string' || typeof usuario !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Faltan "sistema" y/o "usuario" en el body.' }));
                return;
              }

              try {
                const { contenido, modelo } = await pedirGroq({ sistema, usuario });
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ contenido, modelo }));
              } catch (e) {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json');
                if (e instanceof GroqError) {
                  res.end(JSON.stringify({ error: e.message, detalle: e.detalle || undefined }));
                } else {
                  res.end(JSON.stringify({ error: 'No se pudo contactar a GROQ', detalle: String(e.message) }));
                }
              }
            });
          });
        },
      },
    ],
  };
});