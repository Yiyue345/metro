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
  try {
    const upstream = await fetch(target, { headers: { Accept: request.headers.get('Accept') || '*/*' } });
    const headers = new Headers(upstream.headers);
    headers.delete('set-cookie');
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response('Tile upstream unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
