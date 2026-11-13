# Nitro Road

Arcade racing in the browser. Four tracks, three ways to play, three difficulties — and a garage full of paint jobs to unlock.

**Play it:** https://mordmaman.github.io/nitro-road/

## Modes

- **🏁 Race** — start at the back of the grid and beat 5 computer cars over 3 laps. 1st = ★★★, 2nd = ★★, 3rd = ★.
- **⏱️ Time Trial** — 3 laps against the clock. Your best run is saved as a see-through **ghost car** you race next time. Gold, silver and bronze times to chase.
- **🚧 Dodge Run** — endless road full of traffic, cones, barrels, roadworks, oil slicks and ramps. Grab coins, scrape past things for **near-miss** combos, jump the ramps. It gets faster every 1,000 m. How far can you get?

Every track × mode × difficulty has 3 stars to win (108 in total). Stars unlock new paints and cars in the **Garage**.

## Tracks

| | |
|---|---|
| Green Valley | gentle hills — the place to start |
| Desert Canyon | big hills and blind crests at sunset |
| Snowy Peaks | slippery bends (your car slides more on snow) |
| Neon City | tight turns at night |

## Controls

| | Keyboard | Touch |
|---|---|---|
| Steer | ← → or A D | ◀ bottom left, ▶ bottom right |
| Gas | ↑ or W | GAS, above ▶ (or switch on **Auto-accelerate**) |
| Brake | ↓ or S | BRAKE, above ▶ |
| Nitro | Space, Shift or N | NITRO, above ◀ |
| Pause | P or Esc | ⏸ |
| Sound | M | 🔊 |

Tips: press gas (or nitro) exactly on **GO!** for a turbo start. Drive in another car's slipstream to fill your nitro. Blue strips on the road are boosts. Save nitro for straights — use it in a bend and you'll slide off.

On a phone or tablet, turn it sideways. You can install it from the browser menu (**Add to Home screen** / **Install app**) — it opens full screen and works offline.

## Changing the game

No build step — just edit the files and commit; GitHub Pages updates in a minute or so.

- `js/config.js` — the easy settings: number of laps, top speed shown, the computer drivers' names and colours, billboard words, everything about each difficulty, and the garage unlocks.
- `js/tracks.js` — the tracks. Each one is a list of straights, curves and hills, e.g. `.curve(LEN.MEDIUM, CURVE.HARD, HILL.LOW)`. Negative curve = left, negative hill = down.
- `js/art.js` — every picture (cars, trees, signs, backgrounds) is drawn here with code.
- `js/game.js` — driving physics, the three modes, the computer drivers and the HUD.
- `js/render.js` — the pseudo-3D road drawing.
- `js/ui.js` — menus, garage, results and touch controls.

If you add a new file, also add it to the list at the top of `sw.js` and bump the `CACHE` name so installed copies pick it up.

Progress is saved in the browser (localStorage), per device.

Fonts: Russo One and Fredoka, both under the SIL Open Font License (see `fonts/`).
