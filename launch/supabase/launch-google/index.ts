// Supabase Edge Function "launch-google" for ranranli.net/launch.
//
// Keeps the launch pad connected to Google Calendar for good: Google's long-lasting
// refresh token is stored here (encrypted) and short-lived access passes are handed to
// the launch pad on request. Only someone who unlocked the launch pad with its password
// can ask: every call carries the launch pad's vault token, checked against launch_vault.
//
// Needs (Supabase → Edge Functions → Secrets): GOOGLE_CLIENT_SECRET
// Deploy with "Verify JWT" turned OFF (the vault token is the check).

const CLIENT_ID = '270543400403-qfeirftcu5ev9tfbfa6jbilq804rf3db.apps.googleusercontent.com';
const VAULT = 'ranran-launch';
const ORIGINS = ['https://ranranli.net', 'https://www.ranranli.net'];
const SUPA = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const TOKEN_URL = Deno.env.get('GOOGLE_TOKEN_URL') ?? 'https://oauth2.googleapis.com/token';

const te = new TextEncoder(), td = new TextDecoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', te.encode(s)));

// The refresh token is stored encrypted with a key derived from the client secret.
async function key() {
  const raw = await crypto.subtle.digest('SHA-256', te.encode('launch-google|' + SECRET));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), te.encode(text)));
  return 'v1.' + b64(iv) + '.' + b64(ct);
}
async function open(blob: string) {
  const [, iv, ct] = blob.split('.');
  return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await key(), unb64(ct)));
}

function db(path: string, init: RequestInit = {}) {
  return fetch(SUPA + '/rest/v1/' + path, {
    ...init,
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}
async function google(params: Record<string, string>) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: SECRET, ...params }),
  });
  return await r.json();
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  try {
    if (!SECRET) return json({ error: 'not_configured', detail: 'GOOGLE_CLIENT_SECRET is not set' }, 500);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    // Only the launch pad's password holder: the vault token must match launch_vault.
    const hash = await sha256(String(body.vaultToken || ''));
    const ok = await db(`launch_vault?id=eq.${VAULT}&token_hash=eq.${hash}&select=id`).then((r) => r.json());
    if (!Array.isArray(ok) || !ok.length) return json({ error: 'locked' }, 401);

    if (action === 'exchange') {
      const t = await google({ code: String(body.code || ''), redirect_uri: 'postmessage', grant_type: 'authorization_code' });
      if (!t.access_token) return json({ error: 'google', detail: t.error_description || t.error }, 400);
      if (t.refresh_token) {
        await db('launch_google', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ id: VAULT, refresh_token: await seal(t.refresh_token), updated_at: new Date().toISOString() }),
        });
      }
      return json({ access_token: t.access_token, expires_in: t.expires_in, stored: !!t.refresh_token });
    }

    if (action === 'token') {
      const rows = await db(`launch_google?id=eq.${VAULT}&select=refresh_token`).then((r) => r.json());
      if (!Array.isArray(rows) || !rows.length) return json({ error: 'not_connected' }, 404);
      const t = await google({ refresh_token: await open(rows[0].refresh_token), grant_type: 'refresh_token' });
      if (!t.access_token) {
        if (t.error === 'invalid_grant') await db(`launch_google?id=eq.${VAULT}`, { method: 'DELETE' });
        return json({ error: 'not_connected', detail: t.error_description || t.error }, 404);
      }
      return json({ access_token: t.access_token, expires_in: t.expires_in });
    }

    if (action === 'disconnect') {
      const rows = await db(`launch_google?id=eq.${VAULT}&select=refresh_token`).then((r) => r.json());
      if (Array.isArray(rows) && rows.length) {
        const rt = await open(rows[0].refresh_token).catch(() => '');
        if (rt) await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(rt), { method: 'POST' }).catch(() => {});
        await db(`launch_google?id=eq.${VAULT}`, { method: 'DELETE' });
      }
      return json({ ok: true });
    }

    return json({ error: 'bad_action' }, 400);
  } catch (e) {
    return json({ error: 'server', detail: String(e) }, 500);
  }
});
