import http from 'node:http';

const upstreamOrigin = new URL(process.env.TILE_UPSTREAM_ORIGIN || 'https://tiles.versatiles.org');
if (upstreamOrigin.protocol !== 'https:') throw new Error('TILE_UPSTREAM_ORIGIN must use https');
const listenHost = process.env.TILE_PROXY_HOST || '127.0.0.1';
const listenPort = Number(process.env.PORT || 8787);
const allowedOrigin = process.env.TILE_ALLOWED_ORIGIN || '*';

function upstreamUrl(pathname) {
  if (pathname === '/tiles/osm/tiles.json') return new URL('/tiles/osm/tiles.json', upstreamOrigin);
  const match = pathname.match(/^\/tiles\/osm\/(\d{1,2})\/(\d+)\/(\d+)$/);
  if (!match) return undefined;
  const [z, x, y] = match.slice(1).map(Number);
  const size = 2 ** z;
  if (z > 14 || x >= size || y >= size) return undefined;
  return new URL(`/tiles/osm/${z}/${x}/${y}`, upstreamOrigin);
}

function sendError(response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(message);
}

const server = http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Vary', 'Origin');
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers': 'Accept' });
    response.end();
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return sendError(response, 405, 'Method not allowed');
  let pathname;
  try { pathname = new URL(request.url || '/', 'http://localhost').pathname; }
  catch { return sendError(response, 400, 'Invalid URL'); }
  const target = upstreamUrl(pathname);
  if (!target) return sendError(response, 404, 'Unknown tile path');
  try {
    const upstream = await fetch(target, { headers: { Accept: request.headers.accept || '*/*' } });
    const headers = new Headers(upstream.headers);
    headers.delete('set-cookie');
    // Node's fetch transparently decodes compressed responses; do not forward
    // stale encoding and length headers for the decoded body.
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.writeHead(upstream.status, Object.fromEntries(headers));
    if (request.method === 'HEAD') response.end();
    else response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error('Tile upstream request failed', error);
    sendError(response, 502, 'Tile upstream unavailable');
  }
});

server.listen(listenPort, listenHost, () => console.log(`Tile proxy listening on http://${listenHost}:${listenPort}`));
