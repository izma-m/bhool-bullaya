# Bhool Bulayya

Fly **Jugnoo** the firefly through a neon 3D maze in first person. Eat every glowing orb, dodge the imposters,
grab a **Power Coin** and flip them into coins.

Built with **Three.js (WebGL)**, **React**, plain **ES modules**, and **Node.js** for the dev server and physics tests.
There is **no build step**, so the repo is already a deployable website.

## Play locally

```bash
npm start          # http://localhost:8080  (Node 18+, zero dependencies)
npm test           # runs the physics unit tests
```

Any static server works (`npx serve`, `python3 -m http.server`). Opening `index.html` straight from disk will not,
because browsers block ES modules on `file://`.

## Put it online with GitHub Pages

1. Create a new GitHub repo and upload the **contents** of this folder (unzipped) to the `main` branch.
2. **Settings → Pages → Build and deployment → Source: _GitHub Actions_.**
3. Push (or run the *Deploy to GitHub Pages* workflow). It runs the tests, then publishes.
   Your game appears at `https://<you>.github.io/<repo>/`.

Prefer no Actions? Choose **Source: Deploy from a branch → main → / (root)** instead. `.nojekyll` is already included.

## Controls

| | Desktop | Phone / tablet |
|---|---|---|
| Move | `W A S D` or `↑ ↓` | left thumb |
| Look | mouse (click the game to capture it) or `← →` / `Q E` | right thumb |
| Camera | `V` first / third person | 🎥 button |
| Pause | `P` or `Esc` | ⏸ button |
| Minimap / guide arrow | `M` / `G` | |

## Levels

| | Beginner | Advance |
|---|---|---|
| Imposters | 2 | 3 |
| Speed | relaxed | full |
| Power Coin | 10 s | 8 s |
| Imposter aggression | lower | high |
| Guide arrow to nearest orb | on | off (press `G`) |

## Physics

All simulation lives in `src/physics.js` (pure JS, unit-tested in Node):

* **Fixed 120 Hz timestep** with an accumulator, so behaviour is identical at 30 or 240 fps.
* **Circle-vs-grid collision** with penetration correction, normal impulse with **restitution**, and slight wall friction.
* **Swept sub-steps**: a body never moves more than half its radius per sub-step, so it cannot tunnel through walls at any speed.
* **Inertia**: acceleration toward a wished velocity with drag, so Jugnoo ramps up, glides and bumps instead of teleporting.
* **Body-body impulses** (imposters bump each other and bounce you during your grace period).
* **Springs** drive Jugnoo's banking, pitch and hover, and wall hits kick the hover spring.
* **Ballistics**: spark particles use gravity, drag and a bouncy floor; captured imposters become coins that are tossed, bounce and spin to rest. Orbs are magnetised toward Jugnoo's mouth.

## Performance

* Whole maze = 2 draw calls (instanced walls + one merged neon edge geometry); all orbs = 1 draw call; all particles = 1 draw call.
* Pixel ratio capped at 2, MSAA render target, and an **auto-quality** governor that drops bloom if the frame rate stays low
  (also selectable in the pause menu).
* Respects `prefers-reduced-motion` (no FOV kick, softer flashes, fewer particles).

## Project layout

```
index.html           import map (Three.js, React, htm from CDNs) + page shell
css/style.css        all styling
src/main.js          bootstrap
src/game.js          scene, physics step, AI, pickups, effects, input, render
src/physics.js       pure physics (tested)
src/maze.js          the level map + helpers
src/models.js        Jugnoo, logo coin, imposters, sky, environment map
src/menu.js          opening scene (Jugnoo on his leaf)
src/ui.js            React UI (menus, HUD, pause, results)
src/audio.js         procedural music + SFX (no audio files)
src/store.js         tiny state store linking game and UI
server.js            zero-dependency dev server
tests/               node:test physics tests
.github/workflows/   GitHub Pages deploy
```

## Tweaking

* New maze: edit `MAP` in `src/maze.js` (`#` wall, `.` orb, `2` power coin; keep it 15×13 or update `W`, `H`, `OX`, `OZ`, `START`, `SPAWNS`).
* Difficulty: edit `LEVELS` at the top of `src/game.js`.
* Colours: wall hue ramp and sky in `src/game.js` / `src/models.js` (`makeSky`).

Three.js is pinned to `0.160.0`, React to `18.3.1`. To work fully offline, download those files, put them in a `vendor/` folder and point the import map at them.

## License

MIT. See `LICENSE`.
