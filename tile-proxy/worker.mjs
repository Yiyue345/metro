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

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: corsHeaders(request) });
    const target = upstreamUrl(url.pathname);
    if (!target) return new Response('Unknown tile path', { status: 404, headers: corsHeaders(request) });
    try {
      const upstream = await fetch(target, { headers: { Accept: request.headers.get('Accept') || '*/*' } });
      const headers = new Headers(upstream.headers);
      headers.delete('set-cookie');
      headers.delete('content-encoding');
      headers.delete('content-length');
      headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
      for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
      return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers });
    } catch { return new Response('Tile upstream unavailable', { status: 502, headers: corsHeaders(request) }); }
  },
};

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
    Vary: 'Origin',
  };
}
