const UPSTREAM_ORIGIN = 'https://tiles.versatiles.org';

function upstreamUrl(pathname) {
  if (pathname === '/tiles/osm/tiles.json') return `${UPSTREAM_ORIGIN}/tiles/osm/tiles.json`;
  const match = pathname.match(/^\/tiles\/osm\/(\d{1,2})\/(\d+)\/(\d+)$/);
  if (!match) return undefined;
  const [z, x, y] = match.slice(1).map(Number);
  const size = 2 ** z;
  if (z > 14 || x >= size || y >= size) return undefined;
  return `${UPSTREAM_ORIGIN}/tiles/osm/${z}/${x}/${y}`;
}

export default async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const pathname = new URL(request.url).pathname;
  const target = upstreamUrl(pathname);
  if (!target) return new Response('Unknown tile path', { status: 404 });
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(request.url, { method: 'GET' });
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return request.method === 'HEAD' ? new Response(null, { status: cached.status, headers: cached.headers }) : cached;
    } catch { /* A cache miss must not make the map unavailable. */ }
  }
  try {
    const upstream = await fetch(target, { headers: { Accept: request.headers.get('Accept') || '*/*' } });
    const headers = new Headers(upstream.headers);
    headers.delete('set-cookie');
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    const response = new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers });
    if (cache && upstream.ok && request.method === 'GET') {
      try { context.waitUntil(cache.put(cacheKey, response.clone())); }
      catch { /* Caching is an optimization; the live response is still valid. */ }
    }
    return response;
  } catch {
    return new Response('Tile upstream unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
