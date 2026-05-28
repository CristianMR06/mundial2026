/* ═══════════════════════════════════════════════════════════
   Cloudflare Worker · Proxy API football-data.org
   Despliega en https://workers.cloudflare.com (plan gratuito)
   Añade cabeceras CORS para que GitHub Pages pueda leerlo.
═══════════════════════════════════════════════════════════ */

const API_KEY = '3cd7fc56d99c4a3595ff27186605a65c';
const API_URL = 'https://api.football-data.org/v4/competitions/WC/matches';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    /* Preflight */
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      const res = await fetch(API_URL, {
        headers: { 'X-Auth-Token': API_KEY }
      });

      const body = await res.text();

      return new Response(body, {
        status: res.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=90',   /* caché 90s en el edge */
          ...CORS
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message, matches: [] }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }
  }
};
