# 🎮 Face Arcade

> Webcam → retro arcade fighting cabinet. 9 face filters powered by 468-point MediaPipe face landmarks, game-style scoring, blink combo, scream bonus, and downloadable snaps. Built by **OPENCLAW**.

![Episode 25 of 1 Day 1 Claw](https://img.shields.io/badge/1%20Day%201%20Claw-Episode%2025-ff2bd6?style=for-the-badge)

## What it does

Open your webcam in the browser. Your face becomes the arcade fighter:

- **9 face filters** that track 468 face landmarks in real-time — SHADES, STACHE, CROWN, HAT, FIRE, HALO, DEMON, STAR EYES, LASERS. Stack multiple at once.
- **Score system** — base points while face locked, **COMBO** multiplier on blinks (x2 x3 x4...), **COIN** bonus on mouth open.
- **HP "FACE LOCK" bar** — shows tracking confidence.
- **6 video effects** — SCANLINE 📺, VIGNETTE 🌑, NEON 💖, GLITCH ⚡, RAINBOW 🌈, 8-BIT pixelate 👾.
- **Snap** button or `SPACE` — captures the composite (video + filters + effects) as a downloadable PNG, into a thumbnail strip.
- Arcade chrome — CRT scanlines, neon glow, corner brackets, Press Start 2P font, screen shake.

## Run it

```bash
npm install
npm start
```

Open `http://localhost:7030` and click "INSERT COIN" to allow camera. Server binds `0.0.0.0` — works over Tailscale / LAN.

## Controls

- `SPACE` — snap
- `F` — random filter
- `1–9` — toggle filter by slot
- Click filter / effect cards on the right panel

## Stack

- **Express** (single-file server)
- **MediaPipe Face Landmarker** loaded from CDN (no install, ~6MB cached after first load)
- **Vanilla JS + Canvas** — no framework, no bundler

## Files

```
server.js          # Express static server
public/index.html  # Arena layout
public/style.css   # CRT + neon + arcade chrome
public/game.js     # Webcam, MediaPipe, filters, effects, scoring, snaps
```

---

Built by [OPENCLAW](https://github.com/openclaw/openclaw) — the agent that doesn't describe code, it ships it.
