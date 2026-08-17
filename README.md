# IRON SKIES — 3D Plane Battle

A self-contained 3D combat flight game in a single HTML file. No build step, no
dependencies: the renderer is hand-written WebGL, the flight model, AI, shop and
netcode are all plain JavaScript.

**Play:** https://calebh314.github.io/iron-skies/

## Playing together

One player clicks **HOST GAME** and shares the 5-character room code; everyone
else enters it under **JOIN GAME**. No accounts and no installs — players connect
peer-to-peer over WebRTC, so game traffic goes directly between computers.

## Controls

| | |
|---|---|
| `W` · `S` | climb · dive (straight up and down, no turning) |
| `Q` · `E` | slide left and right without turning |
| Mouse · `A` / `D` | aim the nose · roll |
| Mouse wheel · `Shift` | throttle · afterburner |
| `LMB` / `Space` · `RMB` / `F` | fire selected weapon · quick missile |
| `1`–`5` · `X` · `R` | weapon (`4` = homing missiles) · flares · rearm at base |
| `B` · `C` · `Tab` | hangar · camera · scoreboard |
| `Esc` / `P` · `M` | pause &amp; exit · mute sound |

New players should start with **FLIGHT TRAINING**, a ten-step course covering
flying, gunnery, missiles, flares and building base defenses.

You fly from an F-22 style cockpit: a bubble canopy, a wide-angle HUD combiner
and three colour displays — a live radar scope, an attitude indicator with speed
and altitude tapes, and hull/throttle/flare/ammo gauges.

The landscape is rebuilt every campaign level, and the ground between the bases
gets harder to cross. Open levels grow ridgelines you have to find gaps in. One level in four is a **canyon run**: the midfield is walled off above the flight
ceiling and a single trench — three kilometres long with a bend every few hundred
metres — is the only way through.

Tokens also buy the **Inferno Beam** — a sustained plasma torrent in weapon
slot 6 that keeps gaining ranks with no ceiling — and your own aircraft under
**Your Aircraft**: four airframes that genuinely fly differently, and eight paint
schemes, previewed in 3D as you pick them.

**Settings** covers difficulty (Recruit through Ace), mouse sensitivity, sound,
and resetting your campaign level or erasing progress entirely.

The campaign gets harder as you win. Each victory raises your **campaign level**,
and the enemy answers with a tougher HQ, more hangars launching aircraft faster,
and more defences. Level, tokens, perks and career record are saved in your
browser.

**Missions** are short solo contracts — precision strikes, fighter sweeps, a
low-level gate course, and base defence. Completing one pays **tokens**, which
buy permanent upgrades on the menu that carry into every mode.

## The game

You fly from the cockpit. Earn credits from kills, structure damage and passive
income, then spend them in the hangar on weapons (cannon, rocket pods, homing
missiles, plasma lance), airframe upgrades (armour, engine, control surfaces,
flares) and base defenses — **Sniper Towers**, **Surface-to-Air Missile sites**,
flak cannons, radar dishes and repair pads. Destroy the enemy Command HQ to win.

## Editing

`index.html` is the whole game. Open it directly in a browser to play offline;
commit a change and GitHub Pages redeploys it.
