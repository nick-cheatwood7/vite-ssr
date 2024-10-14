import express from 'express';
import fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ViteDevServer } from 'vite';
import routes from './routes/index.js';

const isProduction = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 5173;
const base = process.env.BASE || '/';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const client = path.join(__dirname, 'client');
const server = path.join(__dirname, 'server');

const templateHtml = isProduction ? await fs.readFile(path.join(client, 'index.html'), 'utf-8') : '';
const ssrManifest = isProduction ? await fs.readFile(path.join(client, '.vite/ssr-manifest.json'), 'utf-8') : '';

const app = express();

let vite: ViteDevServer;
if (!isProduction) {
  const { createServer } = await import('vite');
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    base,
  });
  app.use(vite.middlewares);
} else {
  const compression = (await import('compression')).default;
  const sirv = (await import('sirv')).default;
  app.use(compression());
  app.use(base, sirv(client, { extensions: [] }));
}

app.use('/api', routes);

app.use('*', async (req, res) => {
  try {
    const url = req.originalUrl.replace(base, '');

    let template;
    let render;
    if (!isProduction) {
      template = await fs.readFile('./index.html', 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render;
    } else {
      template = templateHtml;
      render = (await import(path.join(server, 'entry-server.js'))).render;
    }

    const rendered = await render(url, ssrManifest);

    const html = template
      .replace(`<!--app-head-->`, rendered.head ?? '')
      .replace(`<!--ssr-outlet-->`, rendered.html ?? '');

    res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
  } catch (e) {
    vite.ssrFixStacktrace(e as unknown as Error);
    if (e instanceof Error) {
      console.error(e.stack);
      res.status(500).end(e.stack);
    }
  }
});

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
