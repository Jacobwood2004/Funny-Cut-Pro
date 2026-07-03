const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const https = require('https');
const { pathToFileURL } = require('url');
const ffmpegPath = require('ffmpeg-static');

const CONFIG_PATH = path.join(app.getPath('userData'), 'funnycut-config.json');
const THUMB_DIR = path.join(app.getPath('userData'), 'thumbs');
const YTDLP_PATH = path.join(app.getPath('userData'), 'yt-dlp.exe'); // fetched on first use

const DEFAULT_CONFIG = {
  onboarded: false, // finished the first-run setup wizard?
  inputFolder: '',
  outputFolder: '',
  ytEnabled: false, // YouTube downloader feature (off by default)
  ytFolder: '', // where downloaded videos are saved
  startEnabled: false, // skip into each clip?
  startAt: 20, // how many seconds in
  skipSeconds: 10, // how far ←/→ and the skip buttons jump
  speedControl: true, // show the playback-speed dropdown in the play bar
  resume: {}, // { [inputFolder]: lastClipFileName }
  lastCutDir: '', // remembered folder for the Save Cut dialog
  introEnabled: true, // play the intro animation on startup
  bootFullscreen: false, // fullscreen automatically when opening a clip (preview)
  showClipInfo: true, // show the clip-details panel in fullscreen
  theme: 'indigo', // 'indigo'|'ocean'|... preset, or 'custom:<id>'
  customThemes: [], // [{ id, name, bg1, bg2, accent, accent2 }]
  keybinds: {}, // { actionId: key } overrides; merged over defaults in the renderer
  windowBounds: null, // last window size/position/maximized (restored on launch)
};

function loadConfig() {
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const cfg = { ...DEFAULT_CONFIG, ...data, resume: data.resume || {} };
    // migrate the old boolean "startAt20" setting
    if (data.startEnabled === undefined && data.startAt20 !== undefined) {
      cfg.startEnabled = !!data.startAt20;
      cfg.startAt = 20;
    }
    delete cfg.startAt20;
    // migrate single customTheme -> customThemes list
    if (!Array.isArray(cfg.customThemes)) cfg.customThemes = [];
    if (data.customTheme && cfg.customThemes.length === 0) {
      const id = 'c' + Date.now();
      cfg.customThemes = [{ id, ...data.customTheme }];
      if (cfg.theme === 'custom') cfg.theme = 'custom:' + id;
    }
    delete cfg.customTheme;
    // configs from before the wizard existed: already set up — skip the wizard
    if (data.onboarded === undefined && cfg.inputFolder) cfg.onboarded = true;
    return cfg;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

let config = loadConfig();
let mainWindow;

// ---- "Open with" / file-association handling (preview mode) ----
const PREVIEW_EXT = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi']);
function clipFromArgv(argv) {
  for (const a of argv || []) {
    try {
      if (
        typeof a === 'string' &&
        PREVIEW_EXT.has(path.extname(a).toLowerCase()) &&
        fs.existsSync(a) &&
        fs.statSync(a).isFile()
      ) {
        return a;
      }
    } catch {}
  }
  return null;
}
function toClipObj(f) {
  return { path: f, name: path.basename(f), url: pathToFileURL(f).href };
}
let pendingPreview = clipFromArgv(process.argv);

// single instance: a second "open with" reuses the running window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}
app.on('second-instance', (event, argv) => {
  const f = clipFromArgv(argv);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    if (f) mainWindow.webContents.send('preview:open', toClipObj(f));
  }
});

function createWindow() {
  // Restore the last window size/position — but ignore stale bounds that would
  // land the window off-screen (e.g. a monitor that's no longer plugged in).
  const saved = config.windowBounds;
  let pos = {};
  if (saved && saved.width >= 820 && saved.height >= 640) {
    const onScreen = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return (
        saved.x + saved.width > a.x + 40 &&
        saved.x < a.x + a.width - 40 &&
        saved.y > a.y - 10 &&
        saved.y < a.y + a.height - 40
      );
    });
    if (onScreen) pos = { x: saved.x, y: saved.y, width: saved.width, height: saved.height };
    else pos = { width: saved.width, height: saved.height };
  }

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    ...pos,
    minWidth: 820,
    minHeight: 640,
    show: false, // don't show until the first themed paint is ready (no default-theme flash)
    backgroundColor: '#101015',
    title: 'Funny Cut Pro',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required', // let clips play on launch without a click
    },
  });

  if (saved && saved.maximized) mainWindow.maximize();

  mainWindow.setMenuBarVisibility(false);

  // Remember size/position, debounced on every move/resize — so it survives
  // however the app exits (including Ctrl+Q, which skips close events).
  let boundsTimer = null;
  const rememberBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFullScreen()) return;
      config.windowBounds = {
        ...mainWindow.getNormalBounds(),
        maximized: mainWindow.isMaximized(),
      };
      saveConfig(config);
    }, 500);
  };
  mainWindow.on('resize', rememberBounds);
  mainWindow.on('move', rememberBounds);
  mainWindow.on('maximize', rememberBounds);
  mainWindow.on('unmaximize', rememberBounds);
  const showWin = () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
  };
  mainWindow.once('ready-to-show', showWin);
  setTimeout(showWin, 2000); // safety net in case ready-to-show is delayed

  // Ctrl+Q force-quits. Handled at the browser level (main process) so it still
  // fires when the window is focused even if the page's own JS is glitching.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.type === 'keyDown' &&
      (input.control || input.meta) &&
      (input.key === 'q' || input.key === 'Q')
    ) {
      event.preventDefault();
      forceQuit();
    }
  });

  mainWindow.loadFile('index.html');
}

// Hard force-quit — kills the app even if the renderer is hung
// (in-app Quit button, Ctrl+Q).
function forceQuit() {
  app.exit(0);
}

// ---- Update check (GitHub releases; quiet, best-effort) ----
// Compares the latest release tag against the running version. Fails silently
// (offline, no releases yet, repo still private) — the app never nags.
function cmpVer(a, b) {
  const pa = String(a).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}
function checkForUpdates() {
  const req = https.get(
    'https://api.github.com/repos/Jacobwood2004/Funny-Cut-Pro/releases/latest',
    { headers: { 'User-Agent': 'FunnyCutPro', Accept: 'application/vnd.github+json' } },
    (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return;
      }
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          const rel = JSON.parse(body);
          const latest = String(rel.tag_name || '').replace(/^v/i, '');
          if (latest && cmpVer(latest, app.getVersion()) > 0 && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:available', {
              version: latest,
              url: rel.html_url || 'https://github.com/Jacobwood2004/Funny-Cut-Pro/releases',
            });
          }
        } catch {}
      });
    }
  );
  req.on('error', () => {});
  req.setTimeout(10000, () => req.destroy());
}

// Watch the input folder so newly-recorded clips show up without a restart.
let folderWatcher = null;
let watchDebounce = null;
function watchInputFolder() {
  try {
    if (folderWatcher) folderWatcher.close();
  } catch {}
  folderWatcher = null;
  const folder = config.inputFolder;
  if (!folder || !fs.existsSync(folder)) return;
  try {
    folderWatcher = fs.watch(folder, { persistent: false }, () => {
      clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('clips:changed');
      }, 600);
    });
  } catch {
    /* fs.watch can fail on some network drives — the library also re-lists on open */
  }
}

app.whenReady().then(() => {
  if (!gotTheLock) return; // duplicate instance — it forwarded its file and will quit
  if (process.platform === 'win32') app.setAppUserModelId('com.funnycut.pro');
  fsp.mkdir(THUMB_DIR, { recursive: true }).catch(() => {});
  createWindow();
  watchInputFolder();
  setTimeout(checkForUpdates, 5000); // after boot, off the critical path
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Renderer asks for the clip it was launched with (null in normal mode)
ipcMain.handle('preview:getFile', () => {
  const f = pendingPreview;
  pendingPreview = null;
  return f ? toClipObj(f) : null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- Config IPC ----

ipcMain.handle('config:get', () => config);

// synchronous read so the renderer can apply the theme before first paint
ipcMain.on('config:getSync', (e) => {
  e.returnValue = config;
});

// app version (from package.json) for the Settings footer label
ipcMain.on('app:getVersion', (e) => {
  e.returnValue = app.getVersion();
});

ipcMain.handle('config:set', (e, partial) => {
  const inputChanged = 'inputFolder' in partial && partial.inputFolder !== config.inputFolder;
  config = { ...config, ...partial };
  saveConfig(config);
  if (inputChanged) watchInputFolder();
  return config;
});

// In-app force-quit (Ctrl+Q).
ipcMain.handle('app:quit', () => forceQuit());

// Register Funny Cut Pro as an "Open with" handler for video files, then open
// Windows Settings so the user can pick it as their default player. (Windows
// doesn't let apps set themselves as default programmatically — the final
// choice always happens in Settings.)
ipcMain.handle('assoc:register', async () => {
  if (process.platform !== 'win32') return { ok: false };
  const exe = process.execPath;
  const openCmd = app.isPackaged
    ? `"${exe}" "%1"`
    : `"${exe}" "${app.getAppPath()}" "%1"`;
  const icon = app.isPackaged
    ? `"${exe}",0`
    : `"${path.join(app.getAppPath(), 'build', 'icon.ico')}",0`;
  const add = (args) =>
    new Promise((resolve) =>
      execFile('reg', ['add', ...args, '/f'], { windowsHide: true }, (err) => resolve(!err))
    );
  let ok = await add(['HKCU\\Software\\Classes\\FunnyCutPro.clip', '/ve', '/d', 'Funny Cut Pro Clip']);
  ok = (await add(['HKCU\\Software\\Classes\\FunnyCutPro.clip\\DefaultIcon', '/ve', '/d', icon])) && ok;
  ok = (await add(['HKCU\\Software\\Classes\\FunnyCutPro.clip\\shell\\open\\command', '/ve', '/d', openCmd])) && ok;
  for (const ext of ['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi']) {
    ok = (await add([`HKCU\\Software\\Classes\\${ext}\\OpenWithProgids`, '/v', 'FunnyCutPro.clip', '/t', 'REG_NONE'])) && ok;
  }
  shell.openExternal('ms-settings:defaultapps');
  return { ok };
});

// Factory reset (Settings ▸ Preferences ▸ Reset app): delete the saved config
// and relaunch — the fresh boot runs the first-time setup wizard.
ipcMain.handle('app:factoryReset', () => {
  try {
    fs.unlinkSync(CONFIG_PATH);
  } catch {}
  config = { ...DEFAULT_CONFIG };
  app.relaunch();
  app.exit(0);
});

// Read the clipboard (used to auto-fill the YouTube URL field).
ipcMain.handle('clipboard:readText', () => {
  try { return clipboard.readText() || ''; } catch { return ''; }
});

// Open an external URL (e.g. the GitHub repo) in the user's default browser.
ipcMain.handle('shell:openExternal', (e, url) => {
  if (typeof url === 'string' && /^https:\/\//i.test(url)) shell.openExternal(url);
});

ipcMain.handle('config:setResume', (e, { folder, fileName }) => {
  config.resume = config.resume || {};
  if (folder) config.resume[folder] = fileName;
  saveConfig(config);
  return config;
});

ipcMain.handle('dialog:openFolder', async (e, title) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: title || 'Select a folder',
    properties: ['openDirectory'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

// ---- Clip listing ----

const VIDEO_EXT = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi']);

// Returns { ok, reason, clips }.
//  ok=false + reason='missing'    -> folder doesn't exist / drive not ready
//  ok=true  + clips=[]            -> folder readable but has no videos
ipcMain.handle('fs:listClips', async (e, folder) => {
  if (!folder) return { ok: false, reason: 'unset', clips: [] };
  if (!fs.existsSync(folder)) return { ok: false, reason: 'missing', clips: [] };

  let entries;
  try {
    entries = await fsp.readdir(folder, { withFileTypes: true });
  } catch {
    return { ok: false, reason: 'unreadable', clips: [] };
  }

  // No per-file statSync here — on big/network folders that's the main source of
  // lag. Thumbnails are cached by path alone (clips have unique names anyway).
  const clips = entries
    .filter((d) => d.isFile() && VIDEO_EXT.has(path.extname(d.name).toLowerCase()))
    .map((d) => {
      const full = path.join(folder, d.name);
      return { name: d.name, path: full, url: pathToFileURL(full).href, mtimeMs: 0 };
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

  return { ok: true, reason: '', clips };
});

// single-file stat for the clip-details panel (one file at a time → cheap)
ipcMain.handle('fs:statClip', async (e, filePath) => {
  try {
    const st = await fsp.stat(filePath);
    return { ok: true, size: st.size, mtimeMs: st.mtimeMs };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle('fs:copyClip', async (e, { src, destFolder }) => {
  try {
    const base = path.basename(src);
    const dest = path.join(destFolder, base);
    if (fs.existsSync(dest)) {
      return { ok: true, already: true, dest, name: base };
    }
    await fsp.copyFile(src, dest);
    return { ok: true, already: false, dest, name: base };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('fs:reveal', async (e, folder) => {
  if (folder) shell.openPath(folder);
});

ipcMain.handle('fs:showInFolder', async (e, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
});

// Move a clip to the Recycle Bin (recoverable, not a permanent delete)
ipcMain.handle('fs:deleteClip', async (e, filePath) => {
  try {
    await shell.trashItem(filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ---- Thumbnail disk cache ----

function thumbPathFor(clipPath, mtimeMs) {
  const hash = crypto.createHash('md5').update(clipPath + '|' + mtimeMs).digest('hex');
  return path.join(THUMB_DIR, hash + '.jpg');
}

ipcMain.handle('thumb:get', (e, { path: clipPath, mtimeMs }) => {
  const tp = thumbPathFor(clipPath, mtimeMs);
  if (fs.existsSync(tp)) return pathToFileURL(tp).href;
  return null;
});

// Generate a thumbnail with ffmpeg (fast, off the renderer). Cached on disk.
ipcMain.handle('thumb:generate', async (e, { path: clipPath, mtimeMs }) => {
  const tp = thumbPathFor(clipPath, mtimeMs);
  if (fs.existsSync(tp)) return pathToFileURL(tp).href;
  try {
    await fsp.mkdir(THUMB_DIR, { recursive: true });
  } catch {}
  const grab = (seek) =>
    new Promise((resolve) => {
      execFile(
        ffmpegPath,
        ['-ss', String(seek), '-i', clipPath, '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '5', '-y', tp],
        { windowsHide: true, timeout: 20000, maxBuffer: 1 << 24 },
        (err) => resolve(!err && fs.existsSync(tp))
      );
    });
  let ok = await grab(20); // ~20s in (matches the player's start point)
  if (!ok) ok = await grab(1); // clip shorter than 20s
  if (!ok) ok = await grab(0); // last resort: first frame
  return ok ? pathToFileURL(tp).href : null;
});

// ---- Clip trimming (ffmpeg) ----

// Ask the user where to save the trimmed clip (every time).
ipcMain.handle('dialog:saveCut', async (e, defaultName) => {
  const defaultPath = config.lastCutDir
    ? path.join(config.lastCutDir, defaultName)
    : defaultName;
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Save trimmed clip as…',
    defaultPath,
    filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
  });
  if (res.canceled || !res.filePath) return null;
  config.lastCutDir = path.dirname(res.filePath);
  saveConfig(config);
  return res.filePath;
});

// Cut [start, start+duration] out of src and re-encode to dest (frame-accurate).
ipcMain.handle('clip:export', async (e, { src, start, duration, dest }) => {
  return new Promise((resolve) => {
    const args = [
      '-ss', String(start),
      '-i', src,
      '-t', String(duration),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '18',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-y',
      dest,
    ];
    execFile(ffmpegPath, args, { windowsHide: true, maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) => {
      if (err) {
        const tail = (stderr || '').trim().split('\n').slice(-3).join(' ');
        resolve({ ok: false, error: tail || String(err) });
      } else {
        resolve({ ok: true, dest });
      }
    });
  });
});

// ---- YouTube downloader (yt-dlp, fetched on first use) ----

// Download a URL to a file, following GitHub's redirects.
function httpsDownload(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const go = (u, n) => {
      if (n > 6) return reject(new Error('too many redirects'));
      https
        .get(u, { headers: { 'User-Agent': 'FunnyCutPro' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return go(res.headers.location, n + 1);
          }
          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error('HTTP ' + res.statusCode));
          }
          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
        })
        .on('error', reject);
    };
    go(url, 0);
  }).catch((err) => {
    try { fs.unlinkSync(dest); } catch {}
    throw err;
  });
}

// Make sure yt-dlp.exe is available (download the official build on first use).
async function ensureYtDlp(send) {
  if (fs.existsSync(YTDLP_PATH)) return YTDLP_PATH;
  if (send) send({ status: 'Setting up the downloader (first run)…', pct: null });
  const tmp = YTDLP_PATH + '.part';
  await httpsDownload('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', tmp);
  fs.renameSync(tmp, YTDLP_PATH);
  return YTDLP_PATH;
}

ipcMain.handle('yt:download', async (e, opts) => {
  const url = ((opts && opts.url) || '').trim();
  const format = (opts && opts.format) || 'video';
  if (!url) return { ok: false, error: 'Paste a video URL first.' };
  if (!config.ytFolder || !fs.existsSync(config.ytFolder)) {
    return { ok: false, error: 'Pick a valid download folder first.' };
  }
  const send = (p) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('yt:progress', p);
  };
  let bin;
  try {
    bin = await ensureYtDlp(send);
  } catch (err) {
    return { ok: false, error: 'Could not fetch yt-dlp (need internet on first use): ' + err.message };
  }
  return new Promise((resolve) => {
    const out = path.join(config.ytFolder, '%(title).180B [%(id)s].%(ext)s');
    const common = [
      '--ffmpeg-location', path.dirname(ffmpegPath),
      '--no-playlist',
      '--newline',
      '-o', out,
    ];
    let args;
    if (format === 'mp3') {
      args = ['-x', '--audio-format', 'mp3', '--audio-quality', '0', ...common, url];
    } else {
      args = ['-f', 'bv*+ba/b', '--merge-output-format', 'mp4', ...common, url];
    }
    let proc;
    try {
      proc = spawn(bin, args, { windowsHide: true });
    } catch (err) {
      return resolve({ ok: false, error: String(err) });
    }
    let lastErr = '';
    proc.stdout.on('data', (d) => {
      const s = d.toString();
      const m = s.match(/\[download\]\s+([\d.]+)%/);
      if (m) send({ status: 'Downloading… ' + m[1] + '%', pct: parseFloat(m[1]) });
      else if (/\[Merger\]|Merging formats/i.test(s)) send({ status: 'Merging…', pct: 100 });
      else if (/\[ExtractAudio\]|\[VideoConvertor\]/i.test(s)) send({ status: 'Converting…', pct: null });
    });
    proc.stderr.on('data', (d) => {
      const line = d.toString().trim().split('\n').pop();
      if (line) lastErr = line;
    });
    proc.on('error', (err) => resolve({ ok: false, error: String(err) }));
    proc.on('close', (code) => {
      if (code === 0) {
        send({ status: 'Done ✓', pct: 100 });
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: lastErr || 'yt-dlp exited with code ' + code });
      }
    });
  });
});
