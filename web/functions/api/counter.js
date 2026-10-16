export async function onRequest(context) {
  const { env, request } = context;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'hit';
    const key = 'kksf_ukd_total_visits';

    if (!env.UKD_COUNTER_KV) {
      return new Response(JSON.stringify({ count: 1, source: 'fallback' }), { headers });
    }

    const raw = await env.UKD_COUNTER_KV.get(key);
    let count = raw ? parseInt(raw, 10) : 0;
    if (Number.isNaN(count) || count < 0) count = 0;

    if (mode !== 'get') {
      count += 1;
      await env.UKD_COUNTER_KV.put(key, String(count));
    }

    return new Response(JSON.stringify({ count, source: 'kv' }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ count: 1, error: String(err) }), {
      status: 200,
      headers,
    });
  }
}
