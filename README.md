<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Jacobwood2004/Funny-Cut-Pro/main/build/wordmark-clear.png" />
  <img src="https://raw.githubusercontent.com/Jacobwood2004/Funny-Cut-Pro/main/build/wordmark.png" alt="Funny Cut Pro" width="520" />
</picture>

### A fast clip-sorting and trimming workflow for reviewing recorded clips

Point it at a folder of recordings, play through them one by one, keep the funny ones, bin the misses, and trim a keeper down to the exact moment — without ever leaving the app.

[![Download](https://img.shields.io/badge/Download-Windows%20Installer-6c5ce7?style=for-the-badge)](https://github.com/Jacobwood2004/Funny-Cut-Pro/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows-2d6cdf?style=for-the-badge)](https://github.com/Jacobwood2004/Funny-Cut-Pro/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-2ecc71?style=for-the-badge)](LICENSE)

</div>

---

## What is it?

If you record a lot of gameplay or clips, you end up with a folder full of files and no quick way to find the good ones. Funny Cut Pro is built for exactly that: it plays through a folder **one clip at a time** so you can make a snap decision — **keep it** (copies it to your output folder) or **skip to the next one** — using just the arrow keys. When you find a keeper worth cutting down, jump into **clip mode** and trim it to a fresh MP4 on a Premiere-style timeline.

Everything is keyboard-driven, so you can blow through a review session fast.

## Features

- **Folder-based review** — pick an input folder and play through every video in it, in natural order (the same order File Explorer shows). Newly recorded clips appear automatically while the app is open.
- **Keep / skip workflow** — one key copies a clip to your output folder, another jumps to the next. Your place in each folder is remembered, so you can pick up right where you left off.
- **Clip & trim mode** — a Premiere-style timeline with draggable in/out handles. Scrub to set your start and end, then export a frame-accurate MP4 (re-encoded with ffmpeg, `+faststart` for instant playback).
- **Library grid** — press <kbd>Tab</kbd> for a thumbnail wall of every clip, with instant search by name. Thumbnails are generated once and cached.
- **Right-click actions** — show a clip in its folder, or send it to the Recycle Bin (recoverable — never a hard delete).
- **Playback controls** — scrub bar, skip buttons, mute/volume, and an optional playback-speed dropdown (0.25×–3×).
- **Start partway in** — optionally begin each long clip a few seconds in, to skip the dead air at the start.
- **Default video player** — register Funny Cut Pro in the Windows "Open with" menu and use it as a lightweight double-click video player, complete with a quick **Trim & save** button.
- **YouTube downloader** *(optional)* — paste a URL to grab a video (MP4) or audio (MP3). Powered by `yt-dlp`, fetched automatically on first use.
- **Themes** — five built-in looks (Indigo, Ocean, Emerald, Crimson, Mono) plus a custom theme editor for your own gradients.
- **Custom keybinds** — rebind any player shortcut to whatever keys you like.
- **Auto-updates** — the installed app checks for new releases and updates on your say-so (fully opt-in — nothing downloads or installs without a click).

## Download & install

1. Head to the [**latest release**](https://github.com/Jacobwood2004/Funny-Cut-Pro/releases/latest).
2. Download **`Funny-Cut-Pro-Setup.exe`**.
3. Run it and follow the installer — you can choose the install location, and it adds Start Menu and desktop shortcuts. No `.bat` files, no terminal.

> **Heads-up:** the app isn't code-signed yet, so Windows SmartScreen may show *"Windows protected your PC."* Click **More info → Run anyway** — that's normal for a new app.

Once installed, the app keeps itself up to date — when a new release is out you'll see an **Update available** prompt in Settings, and updates install right over the top with your settings kept.

## Getting started

The first time you open Funny Cut Pro, a short setup wizard walks you through it:

1. **Choose your folders** — an **input folder** (where your recorded clips live) and, optionally, an **output folder** (where keepers get copied).
2. **Optional features** — turn on the YouTube downloader, the clip-details button, the speed control, or "start partway in."
3. **Keybinds** — keep the defaults or rebind anything.
4. **Pick a look** — choose a theme or build your own.

Then you're dropped straight into the player, ready to review.

## Keyboard shortcuts

| Key | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Play / pause |
| <kbd>←</kbd> / <kbd>→</kbd> | Skip back / forward (default ±10s) |
| <kbd>↑</kbd> | Next clip |
| <kbd>↓</kbd> | Previous clip |
| <kbd>E</kbd> | Save clip to output folder |
| <kbd>Tab</kbd> | Open the library grid |
| <kbd>V</kbd> | Toggle clip / trim mode |
| <kbd>F</kbd> | Fullscreen |
| <kbd>Esc</kbd> | Close browser / exit clip mode / exit fullscreen |
| <kbd>Ctrl</kbd> + <kbd>Q</kbd> | Quit |

**In clip mode:** scrub to move the playhead, <kbd>C</kbd> sets the start (in) point and <kbd>V</kbd> sets the end (out) point. Every shortcut can be remapped in **Settings → Keybinds**.

## Settings

Everything from the wizard lives under **⚙ Settings**, organized into tabs:

- **Theme** — presets and the custom theme editor.
- **Preferences** — skip amount, start-partway-in, playback speed, intro animation, fullscreen-on-open, and a factory reset.
- **Keybinds** — remap any player shortcut.
- **Folders** — change your input and output folders.
- **YouTube** — enable the downloader and set its save folder.

## Good to know

- Clips are **copied**, not moved — your originals stay safe in the input folder.
- If a clip with the same name is already in the output folder, it won't be copied again.
- Supported formats: `.mp4`, `.mov`, `.mkv`, `.webm`, `.m4v`, `.avi`.

## Built with

- [Electron](https://www.electronjs.org/) — the desktop app shell (plain HTML/CSS/JS, no framework)
- [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) — thumbnails and clip trimming/export
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — the optional YouTube downloader
- [electron-updater](https://www.electron.build/auto-update) — in-app auto-updates

## Run from source

Have [Node.js](https://nodejs.org/) installed, then:

```bash
git clone https://github.com/Jacobwood2004/Funny-Cut-Pro.git
cd Funny-Cut-Pro
npm install
npm start
```

## License

Released under the [MIT License](LICENSE).

<div align="center">
<sub>Made by Funny Studio</sub>
</div>
