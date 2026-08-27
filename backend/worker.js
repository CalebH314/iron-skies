/* =============================================================================
   AVIATORS — accounts and room discovery.

   A Cloudflare Worker with one KV namespace. It does two jobs and deliberately
   no more: it owns the list of usernames so a name means the same person on
   every device, and it holds the list of open rooms so finding a game does not
   depend on one player staying online.

   It never touches gameplay. Aircraft, damage and the fight itself stay
   peer-to-peer between browsers, because relaying that costs real money —
   roughly 2.7 GB an hour for a single six-player room — and buys nothing.

   Deploy:  see README.md in this folder.
   ========================================================================== */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400'
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS }
  });
const fail = (msg, status = 400) => json({ error: msg }, status);

/* ------------------------------- passwords -------------------------------- */
/* PBKDF2-SHA256, 120k iterations, 16 random bytes of salt each. The password
   never leaves this function and is never written anywhere. */
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(v => v.toString(16).padStart(2, '0')).join('');

async function derive(password, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 120000 }, key, 256);
  return hex(bits);
}
function newSalt() {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}
function newToken() {
  return hex(crypto.getRandomValues(new Uint8Array(24)));
}
/** constant-time compare, so a wrong password cannot be timed character by character */
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* -------------------------------- names ----------------------------------- */
const nameKey = n => 'u:' + String(n || '').trim().toLowerCase();
function checkName(n) {
  const t = String(n || '').trim();
  if (t.length < 3) return 'Pick a name of at least three characters.';
  if (t.length > 16) return 'Sixteen characters at most.';
  if (!/^[A-Za-z0-9 _-]+$/.test(t)) return 'Letters, numbers, spaces, - and _ only.';
  return null;
}

/* -------------------------------- sessions -------------------------------- */
const TOKEN_TTL = 60 * 60 * 24 * 30;          // thirty days
async function issue(env, key) {
  const token = newToken();
  await env.KV.put('t:' + token, key, { expirationTtl: TOKEN_TTL });
  return token;
}
async function whoIs(env, token) {
  if (!token) return null;
  const key = await env.KV.get('t:' + String(token));
  if (!key) return null;
  const raw = await env.KV.get(key);
  return raw ? { key, rec: JSON.parse(raw) } : null;
}

/* --------------------------------- rooms ---------------------------------- */
/* Hosts re-register every twenty seconds; anything not heard from in seventy-five
   is treated as gone. Rooms are their own KV entries with a TTL so a host that
   simply closes the tab cleans itself up. */
const ROOM_TTL = 75;

/* ------------------------------ rate limiting ----------------------------- */
/* Best effort, per IP per minute. It exists to stop someone grinding through
   passwords, not to be airtight. */
async function overLimit(env, ip, bucket, max) {
  const k = 'r:' + bucket + ':' + ip + ':' + Math.floor(Date.now() / 60000);
  const n = parseInt((await env.KV.get(k)) || '0', 10) + 1;
  await env.KV.put(k, String(n), { expirationTtl: 120 });
  return n > max;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!env.KV) return fail('The KV namespace is not bound. See README.md.', 500);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    let body = {};
    if (request.method === 'POST') { try { body = await request.json(); } catch (e) { body = {}; } }

    try {
      /* ---- who am I ---- */
      if (path === '/v1/me' && request.method === 'POST') {
        const who = await whoIs(env, body.token);
        if (!who) return fail('Not signed in.', 401);
        return json({ name: who.rec.name, profile: who.rec.profile || null });
      }

      /* ---- create an account ---- */
      if (path === '/v1/signup' && request.method === 'POST') {
        if (await overLimit(env, ip, 'signup', 10)) return fail('Too many attempts. Wait a minute.', 429);
        const bad = checkName(body.name);
        if (bad) return fail(bad);
        if (String(body.pass || '').length < 4) return fail('Pick a password of at least four characters.');
        const key = nameKey(body.name);
        if (await env.KV.get(key)) return fail('That name is already taken.');
        const salt = newSalt();
        const rec = {
          name: String(body.name).trim(),
          salt,
          hash: await derive(body.pass, salt),
          made: Date.now(),
          profile: body.profile || null      // lets a local account carry its progress up
        };
        await env.KV.put(key, JSON.stringify(rec));
        return json({ token: await issue(env, key), name: rec.name, profile: rec.profile });
      }

      /* ---- sign in ---- */
      if (path === '/v1/login' && request.method === 'POST') {
        if (await overLimit(env, ip, 'login', 20)) return fail('Too many attempts. Wait a minute.', 429);
        const key = nameKey(body.name);
        const raw = await env.KV.get(key);
        if (!raw) return fail('No account with that name.');
        const rec = JSON.parse(raw);
        if (!same(await derive(body.pass, rec.salt), rec.hash)) return fail('That password does not match.');
        return json({ token: await issue(env, key), name: rec.name, profile: rec.profile || null });
      }

      /* ---- change the name ---- */
      if (path === '/v1/rename' && request.method === 'POST') {
        const who = await whoIs(env, body.token);
        if (!who) return fail('Not signed in.', 401);
        const bad = checkName(body.name);
        if (bad) return fail(bad);
        const next = nameKey(body.name);
        if (next !== who.key && await env.KV.get(next)) return fail('That name is already taken.');
        who.rec.name = String(body.name).trim();
        await env.KV.put(next, JSON.stringify(who.rec));
        if (next !== who.key) await env.KV.delete(who.key);
        return json({ token: await issue(env, next), name: who.rec.name });
      }

      /* ---- change the password ---- */
      if (path === '/v1/password' && request.method === 'POST') {
        const who = await whoIs(env, body.token);
        if (!who) return fail('Not signed in.', 401);
        if (!same(await derive(body.old, who.rec.salt), who.rec.hash))
          return fail('That is not your current password.');
        if (String(body.next || '').length < 4) return fail('Pick a password of at least four characters.');
        who.rec.salt = newSalt();
        who.rec.hash = await derive(body.next, who.rec.salt);
        await env.KV.put(who.key, JSON.stringify(who.rec));
        return json({ ok: true });
      }

      /* ---- progress ---- */
      if (path === '/v1/profile' && request.method === 'POST') {
        const who = await whoIs(env, body.token);
        if (!who) return fail('Not signed in.', 401);
        const data = String(body.data || '');
        if (data.length > 20000) return fail('That profile is too large.');
        who.rec.profile = data;
        await env.KV.put(who.key, JSON.stringify(who.rec));
        return json({ ok: true });
      }

      /* ---- the room list ---- */
      if (path === '/v1/rooms' && request.method === 'GET') {
        const list = await env.KV.list({ prefix: 'room:' });
        const rooms = [];
        for (const k of list.keys) {
          const raw = await env.KV.get(k.name);
          if (raw) rooms.push(JSON.parse(raw));
        }
        rooms.sort((a, b) => (b.at || 0) - (a.at || 0));
        return json({ rooms: rooms.slice(0, 40) });
      }
      if (path === '/v1/rooms' && request.method === 'POST') {
        const room = String(body.room || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{4,6}$/.test(room)) return fail('Bad room code.');
        if (await overLimit(env, ip, 'room', 60)) return fail('Too many updates.', 429);
        await env.KV.put('room:' + room, JSON.stringify({
          room,
          name: String(body.name || 'PILOT').slice(0, 16),
          pilots: Math.max(1, Math.min(12, body.pilots | 0)),
          at: Date.now()
        }), { expirationTtl: ROOM_TTL });
        return json({ ok: true });
      }
      if (path.startsWith('/v1/rooms/') && request.method === 'DELETE') {
        await env.KV.delete('room:' + path.slice('/v1/rooms/'.length).toUpperCase());
        return json({ ok: true });
      }

      /* ---- health ---- */
      if (path === '/v1/ping') return json({ ok: true, at: Date.now() });

      return fail('No such endpoint.', 404);
    } catch (e) {
      return fail('Server error: ' + (e && e.message ? e.message : String(e)), 500);
    }
  }
};
