# AVIATORS — accounts and room list

A single Cloudflare Worker. It owns two things and nothing else:

- **usernames**, so a name means the same person on every device
- **the list of open rooms**, so finding a game does not depend on one player
  staying online to hold the list

It never sees a shot fired. The fight itself stays peer-to-peer between
browsers — relaying it would cost about **2.7 GB an hour for one six-player
room** and would not make the game any better.

## The game works without this

`index.html` ships with the backend switched **off**. With no URL set it uses
the local accounts it has always used, and the room browser falls back to the
peer-held directory. Deploying this is opt-in; not deploying it changes nothing.

## Deploying

You need a free Cloudflare account.

```bash
cd backend
npx wrangler login
npx wrangler kv namespace create AVIATORS      # prints an id
#   paste that id into wrangler.toml
npx wrangler deploy                            # prints https://aviators-api.<you>.workers.dev
```

Then set the URL in the game. **Edit `Planes.html`, not `index.html`.**
`Planes.html` is the master; `index.html` is a copy made from it on every
deploy, so a URL put only in `index.html` gets silently overwritten by the next
change and you are quietly back on local accounts with no obvious reason why.

In `Planes.html` find this line (near the top of the script):

```js
const BACKEND='';
```

and put your URL in it:

```js
const BACKEND='https://aviators-api.<you>.workers.dev';
```

Then copy it over and push:

```bash
cd ..
cp ../Planes.html index.html
git add -A && git commit -m "point the game at the backend" && git push
```

The game URL does not change.

## What it costs

| | Per player per session | Free tier |
|---|---|---|
| Sign in, load progress | ~3 requests | |
| Saving progress | ~1 per round | |
| Room list while browsing | ~1 every 10 s | |
| Host heartbeat | 3 per minute | |

Cloudflare's free tier is 100,000 requests a day and 1 GB of KV storage, which
works out to roughly **3,000–10,000 sessions a day** at no cost. A profile is
about 400 bytes, so 1 GB is more accounts than this game will ever have.

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/v1/signup` | `{name,pass,profile?}` | `{token,name,profile}` |
| POST | `/v1/login` | `{name,pass}` | `{token,name,profile}` |
| POST | `/v1/me` | `{token}` | `{name,profile}` |
| POST | `/v1/rename` | `{token,name}` | `{token,name}` |
| POST | `/v1/password` | `{token,old,next}` | `{ok}` |
| POST | `/v1/profile` | `{token,data}` | `{ok}` |
| GET | `/v1/rooms` | — | `{rooms:[…]}` |
| POST | `/v1/rooms` | `{room,name,pilots}` | `{ok}` |
| DELETE | `/v1/rooms/CODE` | — | `{ok}` |
| GET | `/v1/ping` | — | `{ok,at}` |

## Security, honestly

- Passwords are **PBKDF2-SHA256, 120,000 iterations, 16 random bytes of salt**
  each. The password is never stored and never logged.
- Wrong passwords are compared in constant time.
- Sign-up and sign-in are rate limited per IP per minute. It is enough to stop
  someone grinding through passwords; it is not a serious anti-abuse system.
- Tokens last thirty days and are revoked by changing your password or name.
- There is no email and no password reset. Forget the password and the account
  is gone — that is the trade for not collecting anybody's email address.
- `access-control-allow-origin` is `*` so the file works from anywhere,
  including opened straight off disk. Lock it to your Pages origin if you would
  rather it did not.
