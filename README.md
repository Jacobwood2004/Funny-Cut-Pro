# 🎬 Funny Cut Pro

A fast clip-sorting and trimming tool for reviewing recorded clips — play through a
folder of clips in order, keep the good ones, and trim cuts on a Premiere-style timeline.

## Download

1. Grab the latest **[Funny Cut Pro Setup.exe](https://github.com/Jacobwood2004/Funny-Cut-Pro/releases/latest)** from the Releases page.
2. Run it — the installer sets Funny Cut Pro up like any normal Windows program (Start Menu
   entry + desktop shortcut) and walks you through first-time setup.
3. Launch it from your Start Menu or desktop shortcut whenever you want. No `.bat` files, no terminal.

> **Heads-up:** the app isn't code-signed yet, so Windows SmartScreen may show
> *"Windows protected your PC."* Click **More info → Run anyway** — that's normal for a
> new indie app, and the warning fades as more people install it.

Updates install right over the top — no need to uninstall first, and your settings are kept.

## What it does

- Pick an **input folder** (where your clips are) and an optional **output folder** (where keepers get copied).
- Plays clips **in folder order** (same natural order as File Explorer).
- **Skip** → move to the next clip.
- **Save** → copies the current clip into your output folder, then moves on.
- **Browse clips** → a file-explorer-style grid of thumbnails + names; click any clip to
  jump there. Thumbnails are generated once and cached, and there's a search box.
- **Clip mode** (✂ button or `C`) → trim the current clip on a Premiere-style timeline.
  Drag the **red left/right edges** inward to set the cut, click the track to scrub, then
  **Save cut…** — it asks where to save (a fresh MP4) every time. Cutting is frame-accurate
  via a bundled `ffmpeg`. `Esc` exits clip mode.
- **Themes** → 6 color themes (Indigo, Ocean, Emerald, Sunset, Crimson, Mono), plus a
  **custom theme editor** with color pickers for the background gradient and accent. Saved across restarts.
- **Default video player** → a one-click option in the setup wizard (and Settings) registers
  Funny Cut Pro so you can set it as your default for video. Opening a clip then launches a
  stripped-down **preview mode** — just playback + a **Trim & save** button.
- **YouTube downloader** (optional, off by default) → enable it in **Settings ▸ YouTube** and
  pick a download folder; a red button then appears in the toolbar to grab a video (**Video**
  or **MP3**) by URL. Uses `yt-dlp`, fetched automatically on first use.
- **Settings** (⚙ button) → change folders, theme, keybinds, playback speed, and the
  **start point** (how many seconds into each clip playback begins; default 20, adjustable).
- **Auto-resume** → remembers the exact clip you were on (per input folder) and reopens right there.

## Keyboard shortcuts

| Key        | Action            |
| ---------- | ----------------- |
| `←` / `→`  | Back / forward 10s |
| `↑`        | Next clip         |
| `↓`        | Previous clip     |
| `E`        | Save to output    |
| `Tab`      | Browse clips      |
| `V`        | Clip / trim mode  |
| `F`        | Fullscreen        |
| `Space`    | Play / pause      |
| `Esc`      | Close browser / exit clip mode / exit fullscreen |

Shortcuts are customizable in **Settings ▸ Keybinds**.

## Notes

- Clips are **copied**, not moved — your originals stay safe in the input folder.
- If a clip with the same name is already in the output folder, it won't be copied again.
- Supported formats: `.mp4`, `.mov`, `.mkv`, `.webm`, `.m4v`, `.avi`.

## Building from source (developers)

Funny Cut Pro is an [Electron](https://www.electronjs.org/) app — plain HTML/CSS/JS, no framework. You'll need [Node.js](https://nodejs.org/).

```bash
npm install       # install dependencies
npm start         # run the app from source
npm run dist      # build the Windows installer into dist/
```

`npm run dist` produces `dist/Funny Cut Pro Setup.exe` — the same installer end users download.
