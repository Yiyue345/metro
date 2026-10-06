import { defineConfig } from 'astro/config';
import { createReadStream } from 'node:fs';
import { cp, readdir, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Each city keeps its own public assets; the app serves both from one origin.
const cityPublicDirectories = ['nanning', 'dongguan'].map(id => ({ id, publicDirectory: fileURLToPath(new URL(`../${id}/public/`, import.meta.url)) }));
const contentTypes = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };
const cityAssets = {
  name: 'metro-city-assets',
  hooks: {
    'astro:server:setup': ({ server }) => {
      for (const { id, publicDirectory } of cityPublicDirectories) server.middlewares.use(`/${id}/`, async (request, response, next) => {
        let pathname;
        try { pathname = decodeURIComponent((request.url ?? '').split('?')[0]); }
        catch { response.statusCode = 400; response.end(); return; }
        const asset = resolve(publicDirectory, `.${pathname.startsWith('/') ? pathname : `/${pathname}`}`);
        const inside = relative(publicDirectory, asset);
        const type = contentTypes[extname(asset).toLowerCase()];
        if (inside.startsWith('..') || isAbsolute(inside) || !type) { next(); return; }
        try {
          if (!(await stat(asset)).isFile()) { next(); return; }
          response.setHeader('Content-Type', type);
          const stream = createReadStream(asset);
          stream.on('error', () => response.destroy());
          stream.pipe(response);
        } catch (error) {
          if (error.code === 'ENOENT') next();
          else { response.statusCode = 500; response.end(); }
        }
      });
    },
    'astro:build:done': async ({ dir }) => {
      for (const { id, publicDirectory } of cityPublicDirectories) {
        const destination = fileURLToPath(new URL(`${id}/`, dir));
        // Only asset directories are copied, preserving the generated page index.
        for (const entry of await readdir(publicDirectory, { withFileTypes: true })) {
          if (entry.isDirectory()) await cp(join(publicDirectory, entry.name), join(destination, entry.name), { recursive: true });
        }
      }
    },
  },
};

export default defineConfig({ devToolbar: { enabled: false }, integrations: [cityAssets] });
