// ---------- State ----------
let config = null;
let clips = [];
let currentIndex = 0;
let libSignature = ''; // tracks which folder/clip-set the grid was built for
let settingsInput = null; // input folder snapshot when Settings was opened
let previewMode = false; // launched via "Open with" to view a single clip
let savedNames = new Set(); // lowercased file names already present in the output folder

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);

const setupScreen = $('setup');
const playerScreen = $('player');
const libraryScreen = $('library');

const inputPathEl = $('inputPath');
const outputPathEl = $('outputPath');
const chooseInputBtn = $('chooseInput');
const chooseOutputBtn = $('chooseOutput');
const setupStartEnabled = $('setupStartEnabled');
const setupStartAt = $('setupStartAt');
const setupSkip = $('setupSkip');
const setupSpeed = $('setupSpeed');
const setupIntro = $('setupIntro');
const setupBootFs = $('setupBootFs');
const setupClipInfo = $('setupClipInfo');
const keybindList = $('keybindList');
const kbReset = $('kbReset');
const themeSwatches = $('themeSwatches');
const themeEditor = $('themeEditor');
const teBg1 = $('teBg1');
const teBg2 = $('teBg2');
const teAccent = $('teAccent');
const teAccent2 = $('teAccent2');
const teNew = $('teNew');
const teDelete = $('teDelete');
const teName = $('teName');
const gpBg = $('gpBg');
const gpAccent = $('gpAccent');
const pvBg = $('pvBg');
const pvAccent = $('pvAccent');
const setupYt = $('setupYt');
const ytBody = $('ytBody');
const ytFolderPathEl = $('ytFolderPath');
const chooseYtFolderBtn = $('chooseYtFolder');
const ytBtn = $('ytBtn');
const ytModal = $('ytModal');
const ytClose = $('ytClose');
const ytDest = $('ytDest');
const ytFmt = $('ytFmt');
const ytUrl = $('ytUrl');
const ytGoBtn = $('ytGoBtn');
const ytProgWrap = $('ytProgWrap');
const ytProgBar = $('ytProgBar');
const ytStatus = $('ytStatus');
const startBtn = $('startBtn');
const setupHint = $('setupHint');
const setClose = $('setClose');
const setNav = document.querySelectorAll('.setnavitem');

const settingsBtn = $('settingsBtn');
const browseBtn = $('browseBtn');
const previewTrimBtn = $('previewTrimBtn');
const infoBtn = $('infoBtn');
const previewExitBtn = $('previewExitBtn');
const clipNameEl = $('clipName');
const video = $('video');
const emptyState = $('emptyState');
const emptyMsg = $('emptyMsg');
const retryBtn = $('retryBtn');
const emptyChangeBtn = $('emptyChangeBtn');
const startAt20 = $('startAt20');
const startAtText = $('startAtText');
const startWarn = $('startWarn');
const openOutBtn = $('openOutBtn');
const toast = $('toast');
const splash = $('splash');
const splashLogo = $('splashLogo');
const splashWelcome = $('splashWelcome');
const brandMark = $('brandMark');

const libBack = $('libBack');
const libSearch = $('libSearch');
const libCount = $('libCount');
const libGrid = $('libGrid');
const libTop = $('libTop');
const libBottom = $('libBottom');
const ctxMenu = $('ctxMenu');
const ctxReveal = $('ctxReveal');
const ctxDelete = $('ctxDelete');

// Start-point settings (configurable in Settings). Each clip independently tries
// to start at `startAtValue`; clips too short for that just play from 0, while the
// setting itself stays in effect for every other clip.
let startEnabled = false;
let startAtValue = 20;
const THUMB_AT = 20; // where thumbnails are grabbed from (fixed)

// How far ← / → and the skip buttons jump (configurable in Settings).
let skipSeconds = 10;
function applySkipConfig() {
  skipSeconds = Math.max(1, Math.min(600, Math.round(Number(config.skipSeconds) || 10)));
  // transport buttons (  = hair space, matching the original glyph spacing)
  if (vBack10) {
    vBack10.innerHTML = '↺ ' + skipSeconds;
    vBack10.title = `Back ${skipSeconds} seconds`;
  }
  if (vFwd10) {
    vFwd10.innerHTML = skipSeconds + ' ↻';
    vFwd10.title = `Forward ${skipSeconds} seconds`;
  }
  if (setupSkip) setupSkip.value = String(skipSeconds);
  renderShortcutHint(); // the bottom-bar hint shows ±Ns + the current keys
}

// ---------- Keybinds (customizable in Settings ▸ Keybinds) ----------
const KEYBIND_ACTIONS = [
  { id: 'playPause', label: 'Play / pause', def: ' ' },
  { id: 'skipBack', label: 'Skip back', def: 'ArrowLeft' },
  { id: 'skipFwd', label: 'Skip forward', def: 'ArrowRight' },
  { id: 'nextClip', label: 'Next clip', def: 'ArrowUp' },
  { id: 'prevClip', label: 'Previous clip', def: 'ArrowDown' },
  { id: 'save', label: 'Save to output', def: 'e' },
  { id: 'browse', label: 'Browse clips', def: 'Tab' },
  { id: 'clipMode', label: 'Clip / trim mode', def: 'v' },
  { id: 'fullscreen', label: 'Fullscreen', def: 'f' },
  { id: 'volumeUp', label: 'Volume up', def: '' },
  { id: 'volumeDown', label: 'Volume down', def: '' },
];
const DEFAULT_KEYBINDS = Object.fromEntries(KEYBIND_ACTIONS.map((a) => [a.id, a.def]));
let keybinds = { ...DEFAULT_KEYBINDS };
let capturingFor = null; // action id currently waiting for a key press, or null

// Normalize a key so single characters compare case-insensitively.
function normKey(k) {
  if (!k) return '';
  return k.length === 1 ? k.toLowerCase() : k;
}
// Pretty label for a key value (arrows, Space, etc.).
function keyLabel(k) {
  if (!k) return 'Unbound';
  const m = { ' ': 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc' };
  return m[k] || (k.length === 1 ? k.toUpperCase() : k);
}
function loadKeybinds() {
  keybinds = { ...DEFAULT_KEYBINDS, ...(config.keybinds || {}) };
}
function commitKeybinds() {
  window.api.setConfig({ keybinds }).then((c) => {
    config = c;
  });
  renderKeybinds();
  renderShortcutHint();
}
// Bind `rawKey` to an action; clears the key from any other action so each key
// maps to one thing. Empty key = unbind.
function setBind(actionId, rawKey) {
  const key = normKey(rawKey);
  if (key) {
    for (const a of KEYBIND_ACTIONS) {
      if (a.id !== actionId && keybinds[a.id] === key) keybinds[a.id] = '';
    }
  }
  keybinds[actionId] = key;
  commitKeybinds();
}

// Build the rows of a keybind editor (Settings tab + first-run wizard).
function paintKeybindList(el) {
  if (!el) return;
  el.innerHTML = '';
  KEYBIND_ACTIONS.forEach((a) => {
    const k = keybinds[a.id];
    const listening = capturingFor === a.id;
    const row = document.createElement('div');
    row.className = 'kb-row';
    const keyCls = 'kb-key' + (listening ? ' listening' : '') + (!k && !listening ? ' unbound' : '');
    const keyTxt = listening ? 'Press a key…' : keyLabel(k);
    row.innerHTML =
      `<span class="kb-name">${a.label}</span>` +
      `<div class="kb-controls">` +
      `<button class="${keyCls}" data-act="${a.id}">${keyTxt}</button>` +
      (k && !listening ? `<button class="kb-clear" data-clear="${a.id}" title="Unbind">✕</button>` : '') +
      `</div>`;
    el.appendChild(row);
  });
}
function renderKeybinds() {
  paintKeybindList(keybindList);
  paintKeybindList($('obKeybindList'));
}

// Rebuild the bottom-bar shortcut hint from the current binds (+ skip seconds).
function renderShortcutHint() {
  const el = document.querySelector('.shortcuts');
  if (!el) return;
  const parts = [];
  const sb = keybinds.skipBack, sf = keybinds.skipFwd;
  if (sb && sf) parts.push(`<b>${keyLabel(sb)} / ${keyLabel(sf)}</b> ±${skipSeconds}s`);
  else if (sb) parts.push(`<b>${keyLabel(sb)}</b> -${skipSeconds}s`);
  else if (sf) parts.push(`<b>${keyLabel(sf)}</b> +${skipSeconds}s`);
  const addIf = (id, text) => {
    if (keybinds[id]) parts.push(`<b>${keyLabel(keybinds[id])}</b> ${text}`);
  };
  addIf('nextClip', 'next');
  addIf('prevClip', 'prev');
  addIf('save', 'save');
  addIf('browse', 'browse');
  addIf('clipMode', 'clip');
  addIf('fullscreen', 'fullscreen');
  addIf('playPause', 'play/pause');
  const vu = keybinds.volumeUp, vd = keybinds.volumeDown;
  if (vu && vd) parts.push(`<b>${keyLabel(vu)} / ${keyLabel(vd)}</b> volume`);
  else if (vu) parts.push(`<b>${keyLabel(vu)}</b> vol +`);
  else if (vd) parts.push(`<b>${keyLabel(vd)}</b> vol -`);
  el.innerHTML = parts.join(' &nbsp; ');
}

// Nudge the player volume (used by the volumeUp / volumeDown keybinds).
function changeVolume(delta) {
  let v = video.volume;
  if (!isFinite(v)) v = 1;
  v = Math.max(0, Math.min(1, v + delta));
  video.volume = v;
  video.muted = v === 0;
  if (vVol) vVol.value = String(v);
  updateMuteIcon();
  showToast('Volume ' + Math.round(v * 100) + '%');
}

// Run the action a keybind maps to (normal review mode).
function runKeyAction(id) {
  switch (id) {
    case 'playPause':
      if (video.paused) video.play().catch(() => {});
      else video.pause();
      break;
    case 'skipBack': nudge(-skipSeconds); break;
    case 'skipFwd': nudge(skipSeconds); break;
    case 'nextClip': next(); break;
    case 'prevClip': prev(); break;
    case 'save': if (!previewMode) addToOutput(); break;
    case 'browse': openLibrary(); break;
    case 'clipMode': enterClipMode(); break;
    case 'fullscreen': toggleFullscreen(); break;
    case 'volumeUp': changeVolume(0.1); break;
    case 'volumeDown': changeVolume(-0.1); break;
  }
}

function onKbListClick(e) {
  const clear = e.target.closest('.kb-clear');
  if (clear) {
    setBind(clear.dataset.clear, '');
    return;
  }
  const keyBtn = e.target.closest('.kb-key');
  if (keyBtn) {
    capturingFor = keyBtn.dataset.act; // wait for the next key press
    renderKeybinds();
  }
}
if (keybindList) keybindList.addEventListener('click', onKbListClick);
if ($('obKeybindList')) $('obKeybindList').addEventListener('click', onKbListClick);
if (kbReset) {
  kbReset.addEventListener('click', () => {
    keybinds = { ...DEFAULT_KEYBINDS };
    capturingFor = null;
    commitKeybinds();
  });
}

// Capture phase: while waiting for a rebind, grab the next key and stop it from
// triggering app shortcuts or closing Settings.
document.addEventListener(
  'keydown',
  (e) => {
    if (!capturingFor) return;
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return; // wait for a real key
    e.preventDefault();
    e.stopImmediatePropagation();
    const act = capturingFor;
    capturingFor = null;
    if (e.key === 'Escape') {
      renderKeybinds(); // cancel
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      setBind(act, ''); // clear
    } else {
      setBind(act, e.key);
    }
  },
  true
);

function honorsStart(d) {
  return startEnabled && isFinite(d) && d > startAtValue + 0.5;
}

function applyStartConfig() {
  startEnabled = !!config.startEnabled;
  startAtValue = Math.max(0, Number(config.startAt) || 0);
  startAt20.checked = startEnabled;
  startAtText.textContent = `Start at ${startAtValue}s`;
  if (setupStartEnabled) setupStartEnabled.checked = startEnabled;
  if (setupStartAt) setupStartAt.value = String(startAtValue);
}

function updateStartWarning() {
  const d = video.duration;
  if (startEnabled && isFinite(d) && d > 0 && !honorsStart(d)) {
    startWarn.textContent = `⚠ This clip is only ${fmtClock(d)} — playing from the start`;
    startWarn.classList.remove('hidden');
  } else {
    startWarn.classList.add('hidden');
  }
}

// ---------- Helpers ----------
function basename(p) {
  if (!p) return '';
  return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
}

let toastTimer = null;
function showToast(msg, kind = '') {
  toast.textContent = msg;
  toast.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast hidden';
  }, 2200);
}

function updateStartButton() {
  const ready = !!config.inputFolder; // output is optional
  startBtn.disabled = !ready;
  setupHint.textContent = ready ? '' : 'Pick an input folder to begin (output is optional).';
}

// ---------- Setup screen ----------
function renderSetup() {
  inputPathEl.textContent = config.inputFolder || 'Not selected';
  inputPathEl.classList.toggle('muted', !config.inputFolder);
  outputPathEl.textContent = config.outputFolder || 'Not selected';
  outputPathEl.classList.toggle('muted', !config.outputFolder);
  setupStartEnabled.checked = !!config.startEnabled;
  setupStartAt.value = String(config.startAt ?? 20);
  setupSkip.value = String(config.skipSeconds ?? 10);
  if (setupSpeed) setupSpeed.checked = config.speedControl !== false;
  setupIntro.checked = config.introEnabled !== false;
  setupBootFs.checked = !!config.bootFullscreen;
  setupClipInfo.checked = config.showClipInfo !== false; // default on
  if (setupYt) {
    setupYt.checked = !!config.ytEnabled;
    ytBody.classList.toggle('hidden', !config.ytEnabled);
    ytFolderPathEl.textContent = config.ytFolder || 'Not selected';
    ytFolderPathEl.classList.toggle('muted', !config.ytFolder);
  }
  capturingFor = null; // never reopen mid-capture
  renderKeybinds();
  renderThemeSwatches();
  const isCustom = (config.theme || '').startsWith('custom:');
  if (isCustom) loadEditorInputs(findCustom(config.theme) || DEFAULT_CUSTOM);
  showEditor(isCustom);
  updateStartButton();
  // Only offer a close (✕) once the app is usable; first-run must pick an input folder.
  const configured = !!config.inputFolder;
  setClose.classList.toggle('hidden', !configured);
  // First run lands on Folders so the empty pickers are front-and-centre.
  setTab(configured ? 'theme' : 'folders');
}

// switch the active settings tab (left nav <-> content panes)
function setTab(name) {
  setNav.forEach((t) => t.classList.toggle('active', t.dataset.stab === name));
  document
    .querySelectorAll('.setpane')
    .forEach((p) => p.classList.toggle('active', p.id === 'spane-' + name));
}
setNav.forEach((t) => t.addEventListener('click', () => setTab(t.dataset.stab)));

const THEMES = ['indigo', 'ocean', 'emerald', 'sunset', 'crimson', 'mono'];
const THEME_LABELS = {
  indigo: 'Indigo',
  ocean: 'Ocean',
  emerald: 'Emerald',
  sunset: 'Sunset',
  crimson: 'Crimson',
  mono: 'Mono',
};
const THEME_DOT = {
  indigo: 'linear-gradient(135deg, #2f9bff, #8b5cf6)',
  ocean: 'linear-gradient(135deg, #38bdf8, #6366f1)',
  emerald: 'linear-gradient(135deg, #34d399, #10b981)',
  sunset: 'linear-gradient(135deg, #fb923c, #f43f8e)',
  crimson: 'linear-gradient(135deg, #ff6b6b, #f0556c)',
  mono: 'linear-gradient(135deg, #c7ccda, #9aa0b5)',
};
const DEFAULT_CUSTOM = { bg1: '#16213f', bg2: '#241a3d', accent: '#7c6cf0', accent2: '#8b5cf6' };

function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return `rgba(124,108,240,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}
function applyCustomVars(ct) {
  const s = document.documentElement.style;
  s.setProperty('--app-grad', `linear-gradient(135deg, ${ct.bg1} 0%, ${ct.bg2} 100%)`);
  s.setProperty('--grad', `linear-gradient(90deg, ${ct.accent}, ${ct.accent2})`);
  s.setProperty('--accent', ct.accent);
  s.setProperty('--seek', ct.accent);
  s.setProperty('--seek-light', ct.accent2);
  s.setProperty('--seek-glow', hexToRgba(ct.accent, 0.9));
}
function clearCustomVars() {
  ['--app-grad', '--grad', '--accent', '--seek', '--seek-light', '--seek-glow'].forEach((p) =>
    document.documentElement.style.removeProperty(p)
  );
}
function readEditor() {
  return { bg1: teBg1.value, bg2: teBg2.value, accent: teAccent.value, accent2: teAccent2.value };
}
function loadEditorInputs(ct) {
  ct = ct || DEFAULT_CUSTOM;
  teBg1.value = ct.bg1;
  teBg2.value = ct.bg2;
  teAccent.value = ct.accent;
  teAccent2.value = ct.accent2;
  if (teName) teName.value = ct.name || '';
  updateGradPreviews();
}
// label shown for a custom theme in the swatch list (named, else "Custom N")
function customLabel(t, i) {
  const n = (t.name || '').trim();
  return n || 'Custom ' + (i + 1);
}
// live gradient swatches + preview tiles next to the custom color pickers
function updateGradPreviews() {
  const ct = readEditor();
  const bg = `linear-gradient(135deg, ${ct.bg1}, ${ct.bg2})`;
  const ac = `linear-gradient(90deg, ${ct.accent}, ${ct.accent2})`;
  if (gpBg) gpBg.style.background = bg;
  if (gpAccent) gpAccent.style.background = ac;
  if (pvBg) pvBg.style.background = bg;
  if (pvAccent) pvAccent.style.background = ac;
}
function showEditor(on) {
  themeEditor.classList.toggle('hidden', !on);
}
function findCustom(themeStr) {
  if (!themeStr || !themeStr.startsWith('custom:')) return null;
  const id = themeStr.slice(7);
  return (config.customThemes || []).find((t) => t.id === id) || null;
}

function applyTheme(name) {
  const ct = findCustom(name);
  if (ct) {
    document.documentElement.dataset.theme = 'custom';
    applyCustomVars(ct);
  } else {
    clearCustomVars();
    document.documentElement.dataset.theme = THEMES.includes(name) ? name : 'indigo';
  }
  renderThemeSwatches();
}

// Paint a theme-swatch grid (Settings tab + first-run wizard). The wizard
// gets presets only — the custom editor lives in Settings.
function paintThemeSwatches(el, presetsOnly) {
  if (!el) return;
  const cur = (config && config.theme) || 'indigo';
  el.innerHTML = '';
  const mkRow = (key, label, dot) => {
    const row = document.createElement('div');
    row.className = 'swatchrow' + (key === cur ? ' active' : '');
    row.dataset.theme = key;
    row.innerHTML = `<span class="swatchdot" style="background:${dot}"></span>${label}`;
    el.appendChild(row);
  };
  THEMES.forEach((t) => mkRow(t, THEME_LABELS[t], THEME_DOT[t]));
  if (presetsOnly) return;
  (config.customThemes || []).forEach((t, i) =>
    mkRow('custom:' + t.id, customLabel(t, i), `linear-gradient(135deg, ${t.accent}, ${t.accent2})`)
  );
  // "+ New theme" row
  const add = document.createElement('div');
  add.className = 'swatchrow';
  add.dataset.new = '1';
  add.innerHTML = '<span class="swatchdot swatchdot-new">+</span>New theme';
  el.appendChild(add);
}
function renderThemeSwatches() {
  paintThemeSwatches(themeSwatches, false);
  paintThemeSwatches($('obThemeSwatches'), false);
}

async function selectTheme(name) {
  config = await window.api.setConfig({ theme: name });
  applyTheme(name);
  const isCustom = name.startsWith('custom:');
  if (isCustom) loadEditorInputs(findCustom(name) || DEFAULT_CUSTOM);
  showEditor(isCustom);
}

async function createCustomTheme(fromEditor) {
  const id = 'c' + Date.now();
  const t = { id, name: '', ...(fromEditor ? readEditor() : DEFAULT_CUSTOM) };
  const list = [...(config.customThemes || []), t];
  config = await window.api.setConfig({ customThemes: list, theme: 'custom:' + id });
  applyTheme(config.theme);
  loadEditorInputs(t);
  showEditor(true);
  if (teName) teName.focus(); // let the user name it right away
}

themeSwatches.addEventListener('click', (e) => {
  const row = e.target.closest('.swatchrow');
  if (!row) return;
  if (row.dataset.new) {
    createCustomTheme(false);
    return;
  }
  if (row.dataset.theme) selectTheme(row.dataset.theme);
});

teNew.addEventListener('click', () => createCustomTheme(true));

teDelete.addEventListener('click', async () => {
  const cur = config.theme || '';
  if (!cur.startsWith('custom:')) return;
  const id = cur.slice(7);
  const list = (config.customThemes || []).filter((t) => t.id !== id);
  config = await window.api.setConfig({ customThemes: list, theme: 'indigo' });
  applyTheme('indigo');
  showEditor(false);
});

// edit the currently-selected custom theme: live preview on input, persist on change
[teBg1, teBg2, teAccent, teAccent2].forEach((inp) => {
  inp.addEventListener('input', () => {
    const ct = findCustom(config.theme);
    if (!ct) return;
    Object.assign(ct, readEditor());
    applyCustomVars(ct);
    updateGradPreviews();
    renderThemeSwatches();
  });
  inp.addEventListener('change', async () => {
    const ct = findCustom(config.theme);
    if (!ct) return;
    Object.assign(ct, readEditor());
    config = await window.api.setConfig({ customThemes: config.customThemes });
  });
});

// rename the currently-selected custom theme: live label on input, persist on change
if (teName) {
  teName.addEventListener('input', () => {
    const ct = findCustom(config.theme);
    if (!ct) return;
    ct.name = teName.value;
    renderThemeSwatches();
  });
  teName.addEventListener('change', async () => {
    const ct = findCustom(config.theme);
    if (!ct) return;
    ct.name = teName.value.trim();
    teName.value = ct.name;
    config = await window.api.setConfig({ customThemes: config.customThemes });
    renderThemeSwatches();
  });
  // Enter commits the name (blur fires the change handler)
  teName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') teName.blur();
  });
}

function goToSetup() {
  settingsInput = config.inputFolder; // remember to detect input changes on return
  video.pause(); // pause the clip behind the overlay
  // Settings is an overlay: leave the player mounted & visible (blurred) behind
  // it, like a real modal. Only collapse the library so the player shows through.
  libraryScreen.classList.add('hidden');
  setupScreen.classList.remove('hidden');
  renderSetup();
}

chooseInputBtn.addEventListener('click', async () => {
  const folder = await window.api.openFolder('Select your clips (input) folder');
  if (folder) {
    config = await window.api.setConfig({ inputFolder: folder });
    renderSetup();
  }
});

chooseOutputBtn.addEventListener('click', async () => {
  const folder = await window.api.openFolder('Select your output folder');
  if (folder) {
    config = await window.api.setConfig({ outputFolder: folder });
    renderSetup();
  }
});

setupStartEnabled.addEventListener('change', async () => {
  config = await window.api.setConfig({ startEnabled: setupStartEnabled.checked });
  applyStartConfig();
});

setupStartAt.addEventListener('change', async () => {
  let v = Math.max(0, Math.round(Number(setupStartAt.value) || 0));
  setupStartAt.value = String(v);
  config = await window.api.setConfig({ startAt: v });
  applyStartConfig();
});

setupSkip.addEventListener('change', async () => {
  let v = Math.max(1, Math.min(600, Math.round(Number(setupSkip.value) || 10)));
  setupSkip.value = String(v);
  config = await window.api.setConfig({ skipSeconds: v });
  applySkipConfig();
});

setupSpeed.addEventListener('change', async () => {
  config = await window.api.setConfig({ speedControl: setupSpeed.checked });
  applySpeedConfig();
});

setupIntro.addEventListener('change', async () => {
  config = await window.api.setConfig({ introEnabled: setupIntro.checked });
});

setupBootFs.addEventListener('change', async () => {
  config = await window.api.setConfig({ bootFullscreen: setupBootFs.checked });
});

setupClipInfo.addEventListener('change', async () => {
  config = await window.api.setConfig({ showClipInfo: setupClipInfo.checked });
  applyClipInfoConfig();
});

// ---- YouTube downloader ----
let ytFormat = 'video'; // 'video' | 'mp3'
// Reflect the OGG setting (show/hide its option) and the active format choice.
function updateYtFmt() {
  if (ytFmt) {
    ytFmt.querySelectorAll('.yt-fmt-opt').forEach((b) =>
      b.classList.toggle('active', b.dataset.fmt === ytFormat)
    );
  }
}
// Show/hide the red toolbar button based on the Settings toggle.
function applyYtConfig() {
  if (ytBtn) ytBtn.classList.toggle('hidden', !config.ytEnabled);
  updateYtFmt();
}
function closeYtModal() {
  if (ytModal) ytModal.classList.add('hidden');
}
async function openYtModal() {
  if (!ytModal) return;
  ytDest.textContent = config.ytFolder ? basename(config.ytFolder) : 'no folder set (Settings ▸ YouTube)';
  ytProgWrap.classList.add('hidden');
  ytProgBar.style.width = '0%';
  ytStatus.textContent = '';
  ytUrl.value = '';
  ytModal.classList.remove('hidden');
  ytUrl.focus();
  // Auto-fill from the clipboard if it holds a URL — usually no need to paste.
  try {
    const clip = (await window.api.readClipboard()) || '';
    if (/^https?:\/\/\S+$/i.test(clip.trim())) {
      ytUrl.value = clip.trim();
      ytUrl.select();
    }
  } catch {}
}

if (setupYt) {
  setupYt.addEventListener('change', async () => {
    config = await window.api.setConfig({ ytEnabled: setupYt.checked });
    ytBody.classList.toggle('hidden', !setupYt.checked);
    applyYtConfig();
  });
  if (ytFmt) {
    ytFmt.addEventListener('click', (e) => {
      const b = e.target.closest('.yt-fmt-opt');
      if (!b) return;
      ytFormat = b.dataset.fmt;
      updateYtFmt();
    });
  }
  chooseYtFolderBtn.addEventListener('click', async () => {
    const folder = await window.api.openFolder('Select where downloaded videos go');
    if (folder) {
      config = await window.api.setConfig({ ytFolder: folder });
      ytFolderPathEl.textContent = folder;
      ytFolderPathEl.classList.remove('muted');
    }
  });

  if (ytBtn) ytBtn.addEventListener('click', openYtModal);
  if (ytClose) ytClose.addEventListener('click', closeYtModal);
  if (ytModal) ytModal.addEventListener('mousedown', (e) => { if (e.target === ytModal) closeYtModal(); });

  let ytBusy = false;
  async function startYtDownload() {
    if (ytBusy) return;
    const url = ytUrl.value.trim();
    if (!url) { ytStatus.textContent = 'Paste a video URL first.'; return; }
    if (!config.ytFolder) { ytStatus.textContent = 'Pick a download folder in Settings ▸ YouTube first.'; return; }
    ytBusy = true;
    ytGoBtn.disabled = true;
    ytProgWrap.classList.remove('hidden');
    ytProgBar.style.width = '0%';
    ytStatus.textContent = 'Starting…';
    const res = await window.api.ytDownload(url, ytFormat);
    ytBusy = false;
    ytGoBtn.disabled = false;
    if (res && res.ok) {
      ytProgBar.style.width = '100%';
      ytStatus.textContent = '✓ Saved ' + ytFormat.toUpperCase() + ' to ' + basename(config.ytFolder);
      ytUrl.value = '';
    } else {
      ytStatus.textContent = 'Failed: ' + ((res && res.error) || 'unknown error');
    }
  }
  ytGoBtn.addEventListener('click', startYtDownload);
  ytUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); startYtDownload(); }
  });
  window.api.onYtProgress((p) => {
    if (!p) return;
    if (p.status) ytStatus.textContent = p.status;
    if (ytProgBar && p.pct != null) ytProgBar.style.width = p.pct + '%';
  });
}

// Leave Settings and return to reviewing. Blocked until both folders are set
// (first-run onboarding can't be dismissed early).
function closeSettings() {
  if (!config.inputFolder) return; // output is optional
  // If we just opened Settings from an active session and didn't change the
  // input folder, return to the same clip — paused, where we left off — instead
  // of reloading and auto-playing.
  if (clips.length > 0 && settingsInput !== null && config.inputFolder === settingsInput) {
    resumePlayer();
  } else {
    enterPlayer();
  }
  settingsInput = null;
}

startBtn.addEventListener('click', closeSettings);
setClose.addEventListener('click', closeSettings);
// click the dimmed backdrop (outside the card) to close
setupScreen.addEventListener('mousedown', (e) => {
  if (e.target === setupScreen) closeSettings();
});
// Esc closes Settings (the global player shortcut handler bails while setup is open)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !setupScreen.classList.contains('hidden')) {
    e.preventDefault();
    closeSettings();
  }
});

function paintPlayerChrome() {
  // no output folder set → hide Save (and "open output") entirely
  const hasOut = !!config.outputFolder;
  vSave.classList.toggle('hidden', !hasOut);
  if (openOutBtn) openOutBtn.classList.toggle('hidden', !hasOut);
  if (hasOut) vSave.title = 'Save to ' + basename(config.outputFolder) + ' (E)';
}

// Return from Settings without reloading: keep the current clip & position, paused.
function resumePlayer() {
  setupScreen.classList.add('hidden');
  libraryScreen.classList.add('hidden');
  playerScreen.classList.remove('hidden');
  paintPlayerChrome();
  applyStartConfig();
  applySkipConfig();
  applySpeedConfig();
  updateStartWarning();
  showControls(); // bar stays (video is paused)
}

// ---------- Player ----------
async function enterPlayer() {
  setupScreen.classList.add('hidden');
  libraryScreen.classList.add('hidden');
  playerScreen.classList.remove('hidden');

  paintPlayerChrome();
  applyStartConfig();
  applySkipConfig();
  applySpeedConfig();

  await loadClips();
}

// ---- Preview mode: view a single clip opened from "Open with" ----
function dirOf(p) {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return i >= 0 ? p.slice(0, i) : '';
}

function enterPreview(clip) {
  previewMode = true;
  if (clipMode) exitClipMode();
  setupScreen.classList.add('hidden');
  libraryScreen.classList.add('hidden');
  playerScreen.classList.remove('hidden');
  playerScreen.classList.add('preview-mode');
  previewTrimBtn.classList.remove('hidden');
  previewExitBtn.classList.remove('hidden');
  applyStartConfig();
  applySpeedConfig();
  // play the opened clip immediately…
  clips = [clip];
  currentIndex = 0;
  loadClip(0);
  // fullscreen if the setting is on (preview only)
  if (config.bootFullscreen) requestAppFullscreen();
  // …then load its folder so Prev/Next can step through neighbouring clips
  loadPreviewSiblings(clip);
}

async function loadPreviewSiblings(clip) {
  const folder = dirOf(clip.path);
  if (!folder) return;
  const res = await window.api.listClips(folder);
  if (!previewMode || !res || !res.ok || !res.clips.length) return;
  const idx = res.clips.findIndex((c) => c.path === clip.path || c.name === clip.name);
  if (idx < 0) return;
  clips = res.clips;
  currentIndex = idx;
  vPrev.disabled = idx === 0;
  vNext.disabled = idx >= clips.length - 1;
}

function exitPreview() {
  previewMode = false;
  if (clipMode) exitClipMode();
  playerScreen.classList.remove('preview-mode');
  previewTrimBtn.classList.add('hidden');
  previewExitBtn.classList.add('hidden');
  if (config.inputFolder) enterPlayer();
  else goToSetup();
}

previewTrimBtn.addEventListener('click', enterClipMode);
previewExitBtn.addEventListener('click', exitPreview);

async function loadClips() {
  const res = await window.api.listClips(config.inputFolder);

  if (!res.ok) {
    clips = [];
    showEmpty(res.reason);
    return;
  }

  clips = res.clips;
  if (clips.length === 0) {
    showEmpty('empty');
    return;
  }

  // Resume to the last clip we were on for this folder (by file name)
  let startIndex = 0;
  const remembered = config.resume && config.resume[config.inputFolder];
  if (remembered) {
    const idx = clips.findIndex((c) => c.name === remembered);
    if (idx >= 0) startIndex = idx;
  }

  loadClip(startIndex);
}

// Re-list the folder (e.g. a new clip was just recorded) without disturbing playback.
async function refreshClips() {
  const folder = previewMode
    ? dirOf((clips[currentIndex] && clips[currentIndex].path) || '')
    : config.inputFolder;
  if (!folder) return;
  const res = await window.api.listClips(folder);
  if (!res || !res.ok || !res.clips.length) return;
  const curName = clips[currentIndex] && clips[currentIndex].name;
  clips = res.clips;
  let idx = curName ? clips.findIndex((c) => c.name === curName) : -1;
  if (idx < 0) idx = Math.min(currentIndex, clips.length - 1);
  currentIndex = Math.max(0, idx);
  vPrev.disabled = currentIndex === 0;
  vNext.disabled = currentIndex >= clips.length - 1;
  if (!libraryScreen.classList.contains('hidden') && signatureOf() !== libSignature) {
    buildLibrary();
    highlightCurrentCard();
  }
}

function showEmpty(reason) {
  const folder = config.inputFolder || '(none)';
  let msg;
  if (reason === 'missing' || reason === 'unreadable') {
    msg =
      `Can't reach your input folder:\n${folder}\n\n` +
      `Is the drive connected? Your folders are still saved — hit Retry.`;
  } else {
    msg = `No video clips found in:\n${folder}`;
  }
  emptyMsg.textContent = msg;
  emptyState.classList.remove('hidden');
  video.classList.add('hidden');
  document.getElementById('vControls').classList.add('hidden');
  clipNameEl.textContent = '';
  vNext.disabled = true;
  vSave.disabled = true;
  vPrev.disabled = true;
}

function hideEmpty() {
  emptyState.classList.add('hidden');
  video.classList.remove('hidden');
  document.getElementById('vControls').classList.remove('hidden');
  vSave.disabled = false;
}

function loadClip(index) {
  if (clips.length === 0) return;
  if (clipMode) exitClipMode();
  index = Math.max(0, Math.min(index, clips.length - 1));
  currentIndex = index;
  const clip = clips[index];

  hideEmpty();
  startWarn.classList.add('hidden'); // re-evaluated on loadedmetadata
  video.src = clip.url;
  video.load();
  video.play().catch(() => {});

  clipNameEl.textContent = clip.name;
  updateClipInfo(clip);

  vPrev.disabled = index === 0;
  vNext.disabled = index >= clips.length - 1;

  highlightCurrentCard();

  // Persist position AND keep our in-memory copy in sync, so returning from
  // Settings (which re-reads config.resume) lands on the clip we're actually on.
  // (Skip in preview mode — the previewed file isn't part of the culling folder.)
  if (!previewMode) {
    if (!config.resume) config.resume = {};
    config.resume[config.inputFolder] = clip.name;
    window.api.setResume(config.inputFolder, clip.name);
  }

  showControls(); // reveal the bar on a new clip, then let it fade after idle
}

// ---------- clip details panel (fills the letterbox gutter) ----------
const clipInfoEl = $('clipInfo');
function fmtSize(n) {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (i >= 2 ? v.toFixed(1) : Math.round(v)) + ' ' + u[i];
}
function fmtClock(s) {
  if (!isFinite(s) || s <= 0) return '—';
  const m = Math.floor(s / 60);
  return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}
function fmtWhen(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
// The clip-details panel is toggled by the blue info (i) button in the toolbar.
let clipInfoOpen = false; // panel currently shown (session state)
function updateInfoBtn() {
  if (!infoBtn) return;
  const enabled = config.showClipInfo !== false;
  infoBtn.classList.toggle('hidden', !enabled); // Settings can hide the button entirely
  infoBtn.classList.toggle('active', enabled && clipInfoOpen);
  infoBtn.setAttribute('aria-pressed', enabled && clipInfoOpen ? 'true' : 'false');
}
function applyClipInfoConfig() {
  if (config.showClipInfo === false) clipInfoOpen = false; // feature off → force closed
  updateInfoBtn();
  positionClipInfo();
}
function toggleClipInfo() {
  if (config.showClipInfo === false) return;
  clipInfoOpen = !clipInfoOpen;
  updateInfoBtn();
  positionClipInfo();
}

function positionClipInfo() {
  if (!clipInfoEl) return;
  // Shown only when opened via the info button (windowed, a clip is loaded, not
  // trimming, feature enabled). Anchored top-left, right under the info button.
  const on =
    clipInfoOpen &&
    config.showClipInfo !== false &&
    !document.fullscreenElement &&
    clips.length > 0 &&
    !clipMode;
  clipInfoEl.classList.toggle('hidden', !on);
}
let clipInfoReq = 0;
async function updateClipInfo(clip) {
  if (!clipInfoEl) return;
  if (!clip) { clipInfoEl.classList.add('hidden'); return; }
  $('ciName').textContent = clip.name;
  $('ciName').title = clip.name;
  $('ciDur').textContent = '—'; // filled on loadedmetadata
  $('ciRes').textContent = '—';
  $('ciDate').textContent = '—';
  $('ciSize').textContent = '—';
  const req = ++clipInfoReq;
  try {
    const st = await window.api.statClip(clip.path);
    if (req !== clipInfoReq || !st || !st.ok) return; // a newer clip loaded, or stat failed
    $('ciDate').textContent = fmtWhen(st.mtimeMs);
    $('ciSize').textContent = fmtSize(st.size);
  } catch {}
}
video.addEventListener('loadedmetadata', () => {
  $('ciDur').textContent = fmtClock(video.duration);
  $('ciRes').textContent = video.videoWidth && video.videoHeight ? `${video.videoWidth}×${video.videoHeight}` : '—';
  positionClipInfo();
});
window.addEventListener('resize', positionClipInfo);

// Apply the configured start offset once metadata (duration) is known.
// Clips too short for the offset just play from the start, but the setting
// stays active for every other clip.
video.addEventListener('loadedmetadata', () => {
  if (clipMode) return;
  updateStartWarning();
  if (honorsStart(video.duration)) {
    try {
      video.currentTime = startAtValue;
    } catch {}
  }
});

// When a clip finishes, just stop on the last frame — don't loop it over and over.
video.addEventListener('ended', () => {
  if (clipMode) return; // clip mode handles its own in/out looping
  video.pause();
  updatePlayIcon();
});

function next() {
  if (currentIndex < clips.length - 1) loadClip(currentIndex + 1);
  else showToast('That was the last clip 🎉', 'ok');
}

function prev() {
  if (currentIndex > 0) loadClip(currentIndex - 1);
}

async function addToOutput() {
  if (!config.outputFolder) {
    showToast('No output folder set — pick one in Settings', 'warn');
    return;
  }
  if (clips.length === 0) return;
  const clip = clips[currentIndex];
  vSave.disabled = true;
  const res = await window.api.copyClip(clip.path, config.outputFolder);
  vSave.disabled = false;

  if (!res.ok) {
    showToast('Copy failed: ' + res.error, 'err');
    return;
  }
  showToast(res.already ? 'Already in output — skipping ahead' : 'Saved ✓ ' + res.name,
    res.already ? 'warn' : 'ok');
  savedNames.add(clip.name.toLowerCase()); // remember it's now in the output folder
  applySavedMarks(); // light up its green "saved" outline in the grid
  next();
}

// ---------- Control buttons ----------
retryBtn.addEventListener('click', loadClips);
emptyChangeBtn.addEventListener('click', goToSetup);
settingsBtn.addEventListener('click', goToSetup);

// GitHub link — opens the Funny Cut Pro repo in the default browser.
const githubBtn = $('githubBtn');
if (githubBtn) {
  githubBtn.addEventListener('click', () =>
    window.api.openExternal('https://github.com/Jacobwood2004/Funny-Cut-Pro')
  );
}

// Settings footer version label (major.minor from package.json, e.g. "v1.0")
const verLabel = $('verLabel');
if (verLabel && window.appVersion) {
  verLabel.textContent = 'v' + window.appVersion.split('.').slice(0, 2).join('.');
}

// "Update available" pill — appears when a newer GitHub release exists.
const updateBtn = $('updateBtn');
window.api.onUpdateAvailable((info) => {
  if (!updateBtn || !info) return;
  updateBtn.textContent = '⬆ Update available — v' + String(info.version).split('.').slice(0, 2).join('.');
  updateBtn.classList.remove('hidden');
  updateBtn.onclick = () => window.api.openExternal(info.url);
});
openOutBtn.addEventListener('click', () => window.api.reveal(config.outputFolder));
browseBtn.addEventListener('click', openLibrary);
if (infoBtn) infoBtn.addEventListener('click', toggleClipInfo);

startAt20.addEventListener('change', async () => {
  startEnabled = startAt20.checked;
  config = await window.api.setConfig({ startEnabled });
  if (setupStartEnabled) setupStartEnabled.checked = startEnabled;
  updateStartWarning();
  // apply immediately to the current clip
  if (honorsStart(video.duration) && video.currentTime < startAtValue) {
    try {
      video.currentTime = startAtValue;
    } catch {}
  }
});

// =================================================================
//  LIBRARY (file-explorer style thumbnail grid)
// =================================================================

// --- thumbnail generation queue (limit concurrent ffmpeg jobs) ---
const thumbQueue = [];
let activeThumbs = 0;
const MAX_CONCURRENT = 4;

function pumpThumbs() {
  while (activeThumbs < MAX_CONCURRENT && thumbQueue.length) {
    const task = thumbQueue.shift();
    activeThumbs++;
    Promise.resolve()
      .then(task)
      .finally(() => {
        activeThumbs--;
        pumpThumbs();
      });
  }
}

async function ensureThumb(card) {
  if (card.dataset.loaded === '1' || card.dataset.loading === '1') return;
  card.dataset.loading = '1';
  const clip = clips[parseInt(card.dataset.index, 10)];
  if (!clip) return;
  const img = card.querySelector('img');
  const spinner = card.querySelector('.spinner');

  const show = (url) => {
    card.dataset.loading = '0';
    if (!url) {
      if (spinner) spinner.textContent = '🎞';
      return;
    }
    img.onload = () => {
      img.hidden = false;
      void img.offsetWidth; // commit the un-hide so the fade-in transition runs
      img.classList.add('thumb-in');
      if (spinner) spinner.remove();
    };
    img.src = url;
    card.dataset.loaded = '1';
  };

  // fast path: already cached on disk -> no ffmpeg, no queue
  const cached = await window.api.getThumb(clip);
  if (cached) {
    show(cached);
    return;
  }
  // otherwise generate with ffmpeg (in the main process), gated by the queue
  thumbQueue.push(async () => {
    const url = await window.api.generateThumb(clip);
    show(url);
  });
  pumpThumbs();
}

const thumbObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) ensureThumb(entry.target);
    }
  },
  { root: libGrid, rootMargin: '300px' }
);

// --- "already saved" tracking: which input clips also live in the output folder ---
async function refreshSavedNames() {
  savedNames = new Set();
  if (!config.outputFolder) return;
  const res = await window.api.listClips(config.outputFolder);
  if (res && res.ok) {
    for (const c of res.clips) savedNames.add(c.name.toLowerCase());
  }
}

function isSaved(clip) {
  return !!clip && savedNames.has(clip.name.toLowerCase());
}

// Paint the green "✓ Saved" outline + tag onto whichever built cards are saved.
function applySavedMarks() {
  for (const card of libGrid.children) {
    const clip = clips[parseInt(card.dataset.index, 10)];
    const saved = isSaved(clip);
    card.classList.toggle('saved', saved);
    const thumb = card.querySelector('.thumb');
    let tag = card.querySelector('.saved-tag');
    if (saved && !tag && thumb) {
      tag = document.createElement('span');
      tag.className = 'saved-tag';
      tag.textContent = '✓ Saved';
      thumb.appendChild(tag);
    } else if (!saved && tag) {
      tag.remove();
    }
  }
}

function buildLibrary() {
  thumbQueue.length = 0;
  thumbObserver.disconnect();
  libGrid.innerHTML = '';

  const frag = document.createDocumentFragment();
  const cards = [];
  clips.forEach((clip, i) => {
    const card = document.createElement('div');
    card.className = 'clip-card';
    card.dataset.index = String(i);
    card.dataset.name = clip.name.toLowerCase();
    card.innerHTML = `
      <div class="thumb">
        <span class="badge">${i + 1}</span>
        <div class="spinner"></div>
        <img alt="" hidden />
      </div>
      <div class="cname">${escapeHtml(clip.name)}</div>`;
    card.addEventListener('click', () => {
      loadClip(i);
      closeLibrary();
    });
    frag.appendChild(card);
    cards.push(card);
  });
  libGrid.appendChild(frag); // one reflow for the whole grid
  cards.forEach((c) => thumbObserver.observe(c));

  applySavedMarks(); // green outline on clips already in the output folder
  libSignature = signatureOf();
  applyLibFilter();
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function signatureOf() {
  if (!clips.length) return config.inputFolder + '|0';
  return `${config.inputFolder}|${clips.length}|${clips[0].name}|${clips[clips.length - 1].name}`;
}

function highlightCurrentCard() {
  const cards = libGrid.children;
  for (let i = 0; i < cards.length; i++) {
    cards[i].classList.toggle('current', parseInt(cards[i].dataset.index, 10) === currentIndex);
  }
}

function applyLibFilter() {
  const q = libSearch.value.trim().toLowerCase();
  let shown = 0;
  for (const card of libGrid.children) {
    const match = !q || card.dataset.name.includes(q);
    card.style.display = match ? '' : 'none';
    if (match) shown++;
  }
  libCount.textContent = q ? `${shown} of ${clips.length}` : `${clips.length} clips`;
}

async function openLibrary() {
  video.pause(); // always pause the current clip when browsing (preview or normal)
  await refreshClips({ silent: true }); // pick up any newly-added clips
  await refreshSavedNames(); // re-check which clips already live in the output folder
  if (signatureOf() !== libSignature) buildLibrary();
  else applySavedMarks();
  playerScreen.classList.add('hidden');
  libraryScreen.classList.remove('hidden');
  highlightCurrentCard();
  const cur = libGrid.querySelector('.clip-card.current');
  if (cur) cur.scrollIntoView({ block: 'center' });
}

function closeLibrary() {
  libraryScreen.classList.add('hidden');
  playerScreen.classList.remove('hidden');
}

libBack.addEventListener('click', closeLibrary);
libSearch.addEventListener('input', applyLibFilter);
libTop.addEventListener('click', () => libGrid.scrollTo({ top: 0, behavior: 'smooth' }));
libBottom.addEventListener('click', () =>
  libGrid.scrollTo({ top: libGrid.scrollHeight, behavior: 'smooth' })
);

// ---- right-click a clip: Show in folder / Delete (to Recycle Bin) ----
let ctxIndex = -1;
function hideCtxMenu() {
  ctxMenu.classList.add('hidden');
  ctxIndex = -1;
}
libGrid.addEventListener('contextmenu', (e) => {
  const card = e.target.closest('.clip-card');
  if (!card) return;
  e.preventDefault();
  ctxIndex = parseInt(card.dataset.index, 10);
  ctxMenu.classList.remove('hidden');
  const mw = ctxMenu.offsetWidth || 180;
  const mh = ctxMenu.offsetHeight || 90;
  ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - mw - 8) + 'px';
  ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - mh - 8) + 'px';
});
ctxReveal.addEventListener('click', () => {
  const clip = clips[ctxIndex];
  if (clip) window.api.showInFolder(clip.path);
  hideCtxMenu();
});
ctxDelete.addEventListener('click', () => {
  const idx = ctxIndex;
  hideCtxMenu();
  if (idx >= 0) deleteClipAt(idx);
});
document.addEventListener('click', (e) => {
  if (!ctxMenu.classList.contains('hidden') && !ctxMenu.contains(e.target)) hideCtxMenu();
});
document.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape' && !ctxMenu.classList.contains('hidden')) {
      e.stopPropagation();
      hideCtxMenu();
    }
  },
  true
);
libGrid.addEventListener('scroll', hideCtxMenu);

async function deleteClipAt(index) {
  const clip = clips[index];
  if (!clip) return;
  const res = await window.api.deleteClip(clip.path);
  if (!res || !res.ok) {
    showToast('Delete failed: ' + (res && res.error), 'err');
    return;
  }
  showToast('🗑 Moved to Recycle Bin: ' + clip.name, 'warn');
  clips.splice(index, 1);
  if (index < currentIndex) currentIndex--;
  if (currentIndex >= clips.length) currentIndex = Math.max(0, clips.length - 1);
  if (!libraryScreen.classList.contains('hidden')) {
    buildLibrary();
    highlightCurrentCard();
  }
  vPrev.disabled = currentIndex === 0;
  vNext.disabled = currentIndex >= clips.length - 1;
}

// =================================================================
//  CLIP MODE (Premiere-style trim + ffmpeg export)
// =================================================================
const clipModeBtn = $('clipModeBtn');
const clipPanel = $('clipPanel');
const clipBadge = $('clipBadge');
const tlIn = $('tlIn');
const tlOut = $('tlOut');
const tlSel = $('tlSel');
const tlRuler = $('tlRuler');
const tlTrack = $('tlTrack');
const tlDimL = $('tlDimL');
const tlDimR = $('tlDimR');
const tlSelection = $('tlSelection');
const tlHandleL = $('tlHandleL');
const tlHandleR = $('tlHandleR');
const tlPlayhead = $('tlPlayhead');
const saveCutBtn = $('saveCutBtn');
const exitClipBtn = $('exitClipBtn');

let clipMode = false;
let clipDuration = 0;
let inPoint = 0;
let outPoint = 0;
let scrubbing = false;
const MIN_SELECTION = 0.1; // seconds

function fmtTC(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const tenths = Math.floor((t * 10) % 10);
  return `${m}:${String(s).padStart(2, '0')}.${tenths}`;
}

function buildRuler() {
  tlRuler.innerHTML = '';
  if (!clipDuration) return;
  // pick a "nice" tick interval aiming for ~8 ticks
  const targets = [1, 2, 5, 10, 15, 30, 60, 120, 300];
  let step = targets[targets.length - 1];
  for (const t of targets) {
    if (clipDuration / t <= 9) {
      step = t;
      break;
    }
  }
  for (let t = 0; t <= clipDuration + 0.001; t += step) {
    const tick = document.createElement('div');
    tick.className = 'tl-tick';
    tick.style.left = (t / clipDuration) * 100 + '%';
    tick.textContent = fmtTC(t);
    tlRuler.appendChild(tick);
  }
}

function renderTimeline() {
  if (!clipDuration) return;
  const inPct = (inPoint / clipDuration) * 100;
  const outPct = (outPoint / clipDuration) * 100;
  tlSelection.style.left = inPct + '%';
  tlSelection.style.width = outPct - inPct + '%';
  tlDimL.style.left = '0%';
  tlDimL.style.width = inPct + '%';
  tlDimR.style.left = outPct + '%';
  tlDimR.style.width = 100 - outPct + '%';
  tlIn.textContent = fmtTC(inPoint);
  tlOut.textContent = fmtTC(outPoint);
  tlSel.textContent = fmtTC(outPoint - inPoint);
  updatePlayhead();
}

function updatePlayhead() {
  if (!clipDuration) return;
  tlPlayhead.style.left = (Math.min(video.currentTime, clipDuration) / clipDuration) * 100 + '%';
}

// loop playback within [in, out] while PLAYING; leave the playhead free when paused
function clipTick() {
  if (!clipMode) return;
  if (!scrubbing && !video.paused && video.currentTime >= outPoint - 0.02) {
    try {
      video.currentTime = inPoint;
    } catch {}
  }
  updatePlayhead();
  requestAnimationFrame(clipTick);
}

// C / V: snap the in / out point to the current playhead position
function setInToPlayhead() {
  if (!clipMode) return;
  inPoint = Math.max(0, Math.min(video.currentTime, outPoint - MIN_SELECTION));
  renderTimeline();
}
function setOutToPlayhead() {
  if (!clipMode) return;
  outPoint = Math.min(clipDuration, Math.max(video.currentTime, inPoint + MIN_SELECTION));
  renderTimeline();
}

function timeFromClientX(clientX) {
  const rect = tlTrack.getBoundingClientRect();
  let frac = (clientX - rect.left) / rect.width;
  frac = Math.max(0, Math.min(1, frac));
  return frac * clipDuration;
}

function startDrag(which) {
  return (downEvt) => {
    downEvt.preventDefault();
    const onMove = (e) => {
      const t = timeFromClientX(e.clientX);
      if (which === 'left') {
        inPoint = Math.max(0, Math.min(t, outPoint - MIN_SELECTION));
        try {
          video.currentTime = inPoint;
        } catch {}
      } else {
        outPoint = Math.min(clipDuration, Math.max(t, inPoint + MIN_SELECTION));
        try {
          video.currentTime = outPoint;
        } catch {}
      }
      renderTimeline();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      try {
        video.currentTime = inPoint;
      } catch {}
      video.play().catch(() => {});
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
}

tlHandleL.addEventListener('mousedown', startDrag('left'));
tlHandleR.addEventListener('mousedown', startDrag('right'));

// drag anywhere on the track or ruler to scrub the playhead through the video
function scrubToClientX(clientX) {
  try {
    video.currentTime = timeFromClientX(clientX);
  } catch {}
  updatePlayhead();
}

function beginScrub(e) {
  if (e.target === tlHandleL || e.target === tlHandleR) return; // edges = trim, not scrub
  e.preventDefault();
  scrubbing = true;
  scrubToClientX(e.clientX);
  video.play().catch(() => {}); // play so you HEAR the audio while scrubbing

  const onMove = (ev) => scrubToClientX(ev.clientX);
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    scrubbing = false;
    video.pause(); // leave the playhead where you dropped it (so C / V can grab it)
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

tlTrack.addEventListener('mousedown', beginScrub);
tlRuler.addEventListener('mousedown', beginScrub);

function enterClipMode() {
  if (clips.length === 0) return;
  const begin = () => {
    clipDuration = video.duration;
    inPoint = 0;
    outPoint = clipDuration;
    clipMode = true;
    playerScreen.classList.add('clip-mode');
    clipBadge.classList.remove('hidden');
    clipPanel.classList.remove('hidden');
    document.querySelector('.bottombar').classList.add('hidden');
    videoWrap.classList.remove('hide-controls'); // never hide cursor while trimming
    clearTimeout(controlsTimer);
    buildRuler();
    renderTimeline();
    try {
      video.currentTime = 0;
    } catch {}
    video.play().catch(() => {});
    requestAnimationFrame(clipTick);
  };
  if (isFinite(video.duration) && video.duration > 0) begin();
  else video.addEventListener('loadedmetadata', begin, { once: true });
}

function exitClipMode() {
  clipMode = false;
  playerScreen.classList.remove('clip-mode');
  clipBadge.classList.add('hidden');
  clipPanel.classList.add('hidden');
  document.querySelector('.bottombar').classList.remove('hidden');
  showControls();
}

clipModeBtn.addEventListener('click', () => (clipMode ? exitClipMode() : enterClipMode()));
exitClipBtn.addEventListener('click', exitClipMode);
window.addEventListener('resize', () => {
  if (clipMode) renderTimeline();
});

saveCutBtn.addEventListener('click', async () => {
  if (!clipMode || clips.length === 0) return;
  const clip = clips[currentIndex];
  const defaultName = clip.name.replace(/\.[^.]+$/, '') + '_cut.mp4';
  const dest = await window.api.saveCutDialog(defaultName);
  if (!dest) return;

  const wasPaused = video.paused;
  video.pause();
  saveCutBtn.disabled = true;
  saveCutBtn.textContent = 'Cutting…';
  const res = await window.api.exportCut({
    src: clip.path,
    start: inPoint,
    duration: Math.max(MIN_SELECTION, outPoint - inPoint),
    dest,
  });
  saveCutBtn.disabled = false;
  saveCutBtn.textContent = '💾 Save cut…';
  if (res.ok) showToast('Cut saved ✓ ' + basename(dest), 'ok');
  else showToast('Cut failed: ' + res.error, 'err');
  if (!wasPaused) video.play().catch(() => {});
});

// =================================================================
//  CUSTOM VIDEO CONTROLS (blue glowing seek bar)
// =================================================================
const videoWrap = document.querySelector('.video-wrap');
const vControls = $('vControls');
const vPlay = $('vPlay');
const vTime = $('vTime');
const vRemain = $('vRemain');
const vSeek = $('vSeek');
const vSeekFill = $('vSeekFill');
const vSeekThumb = $('vSeekThumb');
const vMute = $('vMute');
const vVol = $('vVol');
const vFull = $('vFull');
const vBack10 = $('vBack10');
const vFwd10 = $('vFwd10');
const vPrev = $('vPrev');
const vNext = $('vNext');
const vSave = $('vSave');
const vSpeedWrap = $('vSpeedWrap');
const vSpeedBtn = $('vSpeedBtn');
const vSpeedMenu = $('vSpeedMenu');
const vSpeedOpts = vSpeedMenu ? Array.from(vSpeedMenu.querySelectorAll('.v-speed-opt')) : [];

// ---------- playback speed (dropdown in the play bar) ----------
let playRate = 1; // persists across clips within the session
let speedEnabled = true;
function applyRate() {
  try { video.playbackRate = speedEnabled ? playRate : 1; } catch {}
}
function updateSpeedUI() {
  const shown = speedEnabled ? playRate : 1;
  if (vSpeedBtn) vSpeedBtn.textContent = shown + 'x';
  vSpeedOpts.forEach((o) => o.classList.toggle('active', parseFloat(o.dataset.rate) === playRate));
}
function closeSpeedMenu() {
  if (vSpeedMenu) vSpeedMenu.classList.add('hidden');
  if (vSpeedBtn) vSpeedBtn.setAttribute('aria-expanded', 'false');
}
function setRate(rate) {
  playRate = rate;
  applyRate();
  updateSpeedUI();
  closeSpeedMenu();
}
// Reflect the Settings toggle: show/hide the control (and force 1x when off).
function applySpeedConfig() {
  speedEnabled = config.speedControl !== false; // default on
  if (!speedEnabled) {
    playRate = 1;
    closeSpeedMenu();
  }
  if (vSpeedWrap) vSpeedWrap.classList.toggle('hidden', !speedEnabled);
  if (setupSpeed) setupSpeed.checked = speedEnabled;
  applyRate();
  updateSpeedUI();
}

function fmtClock(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updatePlayIcon() {
  vPlay.textContent = video.paused ? '▶' : '⏸';
}

// clean themed SVG glyphs (matches the glassy browse/clip tool icons, not the colour emoji)
const VOL_ON_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
const VOL_OFF_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
function updateMuteIcon() {
  const off = video.muted || video.volume === 0;
  vMute.innerHTML = off ? VOL_OFF_SVG : VOL_ON_SVG;
  vMute.title = off ? 'Unmute' : 'Mute';
  vMute.classList.toggle('is-muted', off);
}

function updateSeekUI() {
  const d = video.duration;
  const hasD = isFinite(d) && d > 0;
  const frac = hasD ? video.currentTime / d : 0;
  const pct = frac * 100 + '%';
  vSeekFill.style.width = pct;
  vSeekThumb.style.left = pct;
  vTime.textContent = fmtClock(video.currentTime);
  vRemain.textContent = hasD ? '-' + fmtClock(d - video.currentTime) : '0:00';
}

// smooth fill while playing (timeupdate alone is only ~4Hz)
function vTick() {
  if (clipMode || video.paused) return;
  updateSeekUI();
  requestAnimationFrame(vTick);
}

vPlay.addEventListener('click', () => {
  if (video.paused) video.play().catch(() => {});
  else video.pause();
});
video.addEventListener('click', () => {
  if (clipMode) return;
  if (video.paused) video.play().catch(() => {});
  else video.pause();
});
video.addEventListener('play', () => {
  updatePlayIcon();
  requestAnimationFrame(vTick);
});
video.addEventListener('pause', updatePlayIcon);
video.addEventListener('timeupdate', updateSeekUI);
video.addEventListener('loadedmetadata', updateSeekUI);
// playbackRate resets to 1 whenever the source changes — re-apply our speed.
video.addEventListener('loadedmetadata', applyRate);
video.addEventListener('ratechange', updateSpeedUI);

// speed dropdown: toggle the menu, pick a rate, click-away to close
if (vSpeedBtn) {
  vSpeedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = vSpeedMenu.classList.toggle('hidden');
    vSpeedBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
  });
  vSpeedOpts.forEach((o) =>
    o.addEventListener('click', (e) => {
      e.stopPropagation();
      setRate(parseFloat(o.dataset.rate));
    })
  );
  document.addEventListener('click', (e) => {
    if (vSpeedWrap && !vSpeedWrap.contains(e.target)) closeSpeedMenu();
  });
}

function seekToClientX(clientX) {
  const rect = vSeek.getBoundingClientRect();
  let frac = (clientX - rect.left) / rect.width;
  frac = Math.max(0, Math.min(1, frac));
  if (isFinite(video.duration)) {
    try {
      video.currentTime = frac * video.duration;
    } catch {}
  }
  updateSeekUI();
}

vSeek.addEventListener('mousedown', (e) => {
  e.preventDefault();
  const wasPlaying = !video.paused;
  seekToClientX(e.clientX);
  video.play().catch(() => {}); // hear the audio while dragging the playhead
  const onMove = (ev) => seekToClientX(ev.clientX);
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (!wasPlaying) video.pause(); // restore the paused state if it wasn't playing
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});

vVol.addEventListener('input', () => {
  video.volume = parseFloat(vVol.value);
  video.muted = video.volume === 0;
  updateMuteIcon();
});
vMute.addEventListener('click', () => {
  video.muted = !video.muted;
  if (!video.muted && video.volume === 0) {
    video.volume = 1;
    vVol.value = '1';
  }
  updateMuteIcon();
});
vFull.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  vFull.textContent = document.fullscreenElement ? '🗗' : '⛶';
  positionClipInfo(); // the details panel is fullscreen-only
});

// ±10s transport (Movies & TV style)
function nudge(sec) {
  if (!isFinite(video.duration)) return;
  video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + sec));
  updateSeekUI();
}
vBack10.addEventListener('click', () => nudge(-skipSeconds));
vFwd10.addEventListener('click', () => nudge(skipSeconds));

// Prev / Next / Save — in the control bar so they work in fullscreen too
vPrev.addEventListener('click', prev);
vNext.addEventListener('click', next);
vSave.addEventListener('click', addToOutput);

// ---- auto-hide the control bar when the mouse is idle over the video ----
let controlsTimer = null;
let overControls = false;
const CONTROLS_IDLE = 2800;
function scheduleHideControls() {
  clearTimeout(controlsTimer);
  controlsTimer = setTimeout(() => {
    if (!clipMode && !overControls) videoWrap.classList.add('hide-controls');
  }, CONTROLS_IDLE);
}
function showControls() {
  videoWrap.classList.remove('hide-controls');
  if (!overControls) scheduleHideControls();
}
videoWrap.addEventListener('mousemove', showControls);
videoWrap.addEventListener('mouseleave', scheduleHideControls);
vControls.addEventListener('mouseenter', () => {
  overControls = true;
  clearTimeout(controlsTimer);
  videoWrap.classList.remove('hide-controls');
});
vControls.addEventListener('mouseleave', () => {
  overControls = false;
  scheduleHideControls();
});

// The floating Browse/Clip icons fade in/out together with the playback controls
// (see the .video-wrap.hide-controls rule) — including in fullscreen.

// Fullscreen the whole app (so Browse / Settings work while fullscreen).
// The player chrome is hidden via CSS in :fullscreen for an immersive video.
function requestAppFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
}
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else requestAppFullscreen();
}

updatePlayIcon();
updateMuteIcon();
updateSeekUI();

// ---------- Keyboard shortcuts ----------
document.addEventListener('keydown', (e) => {
  // Any key skips the intro splash
  if (!introDone && !splash.classList.contains('hidden')) {
    e.preventDefault();
    skipIntro();
    return;
  }
  // Settings overlay open: it floats above the player, so swallow player
  // shortcuts here. (Esc-to-close is handled by a dedicated listener below.)
  if (!setupScreen.classList.contains('hidden')) return;
  // YouTube download popup open: Esc closes it, swallow everything else.
  if (ytModal && !ytModal.classList.contains('hidden')) {
    if (e.key === 'Escape') { e.preventDefault(); closeYtModal(); }
    return;
  }
  // Library open: Escape (or the Browse key) closes it
  if (!libraryScreen.classList.contains('hidden')) {
    const browseKey = keybinds.browse;
    if (e.key === 'Escape' || (browseKey && normKey(e.key) === browseKey)) {
      e.preventDefault();
      closeLibrary();
    }
    return;
  }
  if (playerScreen.classList.contains('hidden')) return;

  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'select' || tag === 'input') return;

  // Clip mode: Esc exit, Space play/pause, C/V set in/out at the playhead.
  if (clipMode) {
    if (e.key === 'Escape') {
      e.preventDefault();
      exitClipMode();
    } else if (e.key === ' ') {
      e.preventDefault();
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      setInToPlayhead();
    } else if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      setOutToPlayhead();
    }
    return;
  }

  // Customizable shortcuts (Settings ▸ Keybinds)
  const k = normKey(e.key);
  for (const a of KEYBIND_ACTIONS) {
    if (keybinds[a.id] && keybinds[a.id] === k) {
      e.preventDefault();
      runKeyAction(a.id);
      return;
    }
  }
});


// =================================================================
//  Window drag-and-drop guard — without this, dropping a file onto the
//  window makes Electron navigate to it. The app does not accept drops.
// =================================================================
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());


// =================================================================
//  INTRO SPLASH — the "FCP" monogram unfolds into "Funny Cut Pro",
//  then the whole wordmark zooms out onto the header logo.
// =================================================================

// Startup stinger — a warm major "Rhodes" chord (Fmaj7, matched to a recording
// of the original intro). Best-effort; never lets audio break the intro.
// `rare` (the prismatic opening) brightens the filter sweep, quickens the
// shimmer and adds a glassy octave on top. `long` (the first-run welcome
// intro) adds a second sparkle phrase and a longer release.
function playStinger(rare, long) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ctx.currentTime + 0.04;
    const comp = ctx.createDynamicsCompressor();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(0.5, t0 + 0.18);
    master.connect(comp).connect(ctx.destination);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1000, t0);
    lp.frequency.exponentialRampToValueAtTime(rare ? 5200 : 3200, t0 + 0.8);
    lp.Q.value = 0.6;
    lp.connect(master);

    const trem = ctx.createGain();
    trem.gain.value = 1;
    trem.connect(lp);
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = rare ? 7.5 : 6.0;
    lfoG.gain.value = 0.1;
    lfo.connect(lfoG).connect(trem.gain);
    lfo.start(t0);
    lfo.stop(t0 + (long ? 3.4 : 2.4));

    const rhodes = (freq, start, dur, gain) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      og.gain.setValueAtTime(0.0001, start);
      og.gain.exponentialRampToValueAtTime(gain, start + 0.02);
      og.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(og).connect(trem);
      o.start(start);
      o.stop(start + dur + 0.05);
      const tine = ctx.createOscillator();
      const tg = ctx.createGain();
      tine.type = 'sine';
      tine.frequency.value = freq * 2;
      tg.gain.setValueAtTime(0.0001, start);
      tg.gain.exponentialRampToValueAtTime(gain * 0.35, start + 0.006);
      tg.gain.exponentialRampToValueAtTime(0.0001, start + Math.min(0.4, dur * 0.5));
      tine.connect(tg).connect(trem);
      tine.start(start);
      tine.stop(start + dur + 0.05);
    };
    const bass = (freq, start, dur, gain) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g).connect(master);
      o.start(start);
      o.stop(start + dur + 0.05);
    };

    // Fmaj7 (F-A-C-E) rolled up — warm and mellow. Matched to the original
    // intro recording: F2 bass, F3/A3/C4/E4 chord, C5+F5 sparkle on top.
    const F2 = 87.31, F3 = 174.61, A3 = 220.0, C4 = 261.63, E4 = 329.63, C5 = 523.25, F5 = 698.46;
    bass(F2, t0, 1.9, 0.5);
    const roll = 0.07;
    rhodes(F3, t0 + roll * 0, 1.7, 0.2);
    rhodes(A3, t0 + roll * 1, 1.7, 0.17);
    rhodes(C4, t0 + roll * 2, 1.7, 0.17);
    rhodes(E4, t0 + roll * 3, 1.7, 0.18); // the maj7 color tone
    // bright sparkle as the letters unfold
    rhodes(C5, t0 + 0.72, 0.9, 0.12);
    rhodes(F5, t0 + 0.8, 1.0, 0.1);
    if (rare) {
      // prismatic: an extra glassy octave of shimmer on top
      const A5 = 880.0, C6 = 1046.5;
      rhodes(A5, t0 + 0.88, 1.0, 0.09);
      rhodes(C6, t0 + 0.96, 1.1, 0.08);
    }
    if (long) {
      // welcome intro: a second rising sparkle phrase carries the longer hold
      const A5 = 880.0;
      rhodes(C5, t0 + 1.55, 1.1, 0.1);
      rhodes(F5, t0 + 1.68, 1.3, 0.09);
      rhodes(A5, t0 + 1.82, 1.5, 0.07);
    }

    master.gain.setValueAtTime(0.5, t0 + (long ? 2.4 : 1.5));
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + (long ? 3.2 : 2.2));
    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, long ? 3800 : 2700);
  } catch {
    /* audio is best-effort */
  }
}

// "Shiny" chime for the prismatic opening — a quick ascending glass gliss with
// a lingering ting, layered over the unfold so the wordmark "goes iridescent".
function playShiny() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ctx.currentTime + 0.02;
    const master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);

    // rising sparkle run (glassy sines)
    const run = [1567.98, 1975.53, 2349.32, 2793.83, 3135.96, 3951.07];
    run.forEach((freq, i) => {
      const st = t0 + i * 0.05;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.4, st + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.22);
      o.connect(g).connect(master);
      o.start(st);
      o.stop(st + 0.25);
    });

    // the lingering "ting" on top
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 2637.02; // E7
    const st = t0 + run.length * 0.05 + 0.02;
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.3, st + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.7);
    o.connect(g).connect(master);
    o.start(st);
    o.stop(st + 0.75);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 1300);
  } catch {
    /* best-effort */
  }
}

let introTimers = [];
let introDone = false;
let prismatic = false; // rolled at boot: the rare 1/100 "prismatic" opening

function finishIntro() {
  if (introDone) return;
  introDone = true;
  introTimers.forEach(clearTimeout);
  introTimers = [];
  document.body.classList.remove('hide-brand');
  splash.classList.add('hidden');
  splash.classList.remove('welcome');
  if (splashWelcome) splashWelcome.classList.remove('in', 'out');
  video.muted = false;
  updateMuteIcon();
  // don't autoplay the clip while Settings is open (e.g. after the ✨ preview)
  if (video.src && video.paused && !clipMode && setupScreen.classList.contains('hidden'))
    video.play().catch(() => {});
  showControls();
}

function skipIntro() {
  if (introDone) return;
  introTimers.forEach(clearTimeout);
  introTimers = [];
  splash.classList.add('fade');
  introTimers.push(setTimeout(finishIntro, 300));
}

// Zoom the whole "Funny Cut Pro" wordmark out so it lands exactly on the app's
// header logo (measured live). Falls back to the CSS transform if the header
// isn't laid out yet (e.g. the first-run setup screen).
function flyLogoToHeader() {
  const s = splashLogo.getBoundingClientRect();
  const t = brandMark.getBoundingClientRect();
  let target = 'translateY(calc(-50vh + 28px)) scale(0.3)';
  if (t.width > 0 && s.width > 0) {
    const scale = t.width / s.width;
    const dx = t.left + t.width / 2 - (s.left + s.width / 2);
    const dy = t.top + t.height / 2 - (s.top + s.height / 2);
    target = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${scale.toFixed(4)})`;
  }
  splashLogo.style.opacity = '1';
  splashLogo.classList.remove('in');
  splashLogo.style.transition = 'none';
  splashLogo.style.transform = 'scale(1)';
  void splashLogo.offsetWidth; // commit the start state before transitioning
  splashLogo.style.transition = 'transform 0.8s cubic-bezier(0.6, 0, 0.25, 1)';
  splashLogo.style.transform = target;
}

function playIntro(welcome) {
  video.muted = true; // keep clip audio quiet under the splash
  document.body.classList.add('hide-brand'); // hide the header wordmark until hand-off

  // Welcome variant (first run only): "Welcome to" leads in, everything
  // shifts later and holds longer, and the stinger gets a longer tail.
  const t = welcome ? 600 : 0;
  if (welcome) {
    splash.classList.add('welcome');
    requestAnimationFrame(() => splashWelcome.classList.add('in'));
    introTimers.push(setTimeout(() => playStinger(prismatic, true), t));
    introTimers.push(setTimeout(() => splashLogo.classList.add('in'), t));
  } else {
    playStinger(prismatic);
    // the "FCP" monogram fades in…
    requestAnimationFrame(() => splashLogo.classList.add('in'));
  }

  // …then the letters unfold into "Funny Cut Pro" (with the shiny chime on a
  // prismatic opening)
  introTimers.push(
    setTimeout(() => {
      splashLogo.classList.add('expand');
      if (prismatic) playShiny();
    }, t + 900)
  );

  // the welcome line bows out before the hand-off
  if (welcome) introTimers.push(setTimeout(() => splashWelcome.classList.add('out'), 2600));

  // then the whole wordmark zooms out exactly onto the header logo
  introTimers.push(setTimeout(flyLogoToHeader, welcome ? 2900 : 1800));
  introTimers.push(
    setTimeout(() => {
      document.body.classList.remove('hide-brand');
      splash.classList.add('dissolve');
    }, welcome ? 3600 : 2500)
  );
  introTimers.push(setTimeout(finishIntro, welcome ? 4250 : 3150));
}

// click skips the intro
splash.addEventListener('click', skipIntro);


// =================================================================
//  FIRST-RUN SETUP WIZARD — folders → optional features → keybinds,
//  then the one-time "Welcome to Funny Cut Pro" intro plays.
// =================================================================
const onboardScreen = $('onboard');
const obSteps = Array.from(document.querySelectorAll('.ob-step'));
const obDots = Array.from(document.querySelectorAll('.ob-dot'));
const obBack = $('obBack');
const obNext = $('obNext');
const obHint = $('obHint');
const obInPath = $('obInPath');
const obOutPath = $('obOutPath');
const obYt = $('obYt');
const obYtFolderRow = $('obYtFolderRow');
const obYtPath = $('obYtPath');
const obClipInfo = $('obClipInfo');
const obSpeed = $('obSpeed');
const obStartEnabled = $('obStartEnabled');
const obStartAt = $('obStartAt');
const obThemeSwatches = $('obThemeSwatches');
let obStep = 0;

function obRender() {
  obSteps.forEach((s, i) => s.classList.toggle('active', i === obStep));
  obDots.forEach((d, i) => d.classList.toggle('active', i === obStep));
  obBack.classList.toggle('hidden', obStep === 0);
  obNext.textContent = obStep === obSteps.length - 1 ? '✔ Finish' : 'Next →';
  const needInput = obStep === 0 && !config.inputFolder;
  obNext.disabled = needInput;
  obHint.textContent = needInput ? 'Pick an input folder to continue (output is optional)' : '';
}

function openOnboarding() {
  setupScreen.classList.add('hidden'); // the Settings overlay must not peek out behind the wizard
  // borrow the Settings theme editor for the wizard's theme step
  $('obThemeEditorSlot').appendChild(themeEditor);
  showEditor((config.theme || '').startsWith('custom:'));
  obStep = 0;
  obInPath.textContent = config.inputFolder || 'Not selected — where your recorded clips are';
  obInPath.classList.toggle('muted', !config.inputFolder);
  obOutPath.textContent = config.outputFolder || 'Optional — where saved keepers get copied';
  obOutPath.classList.toggle('muted', !config.outputFolder);
  obYt.checked = !!config.ytEnabled;
  obYtFolderRow.classList.toggle('hidden', !config.ytEnabled);
  obYtPath.textContent = config.ytFolder || 'Not selected';
  obClipInfo.checked = config.showClipInfo !== false;
  obSpeed.checked = config.speedControl !== false;
  obStartEnabled.checked = !!config.startEnabled;
  obStartAt.value = String(config.startAt ?? 20);
  renderKeybinds();
  renderThemeSwatches();
  obRender();
  onboardScreen.classList.remove('hidden');
}

async function finishOnboarding() {
  config = await window.api.setConfig({ onboarded: true });
  onboardScreen.classList.add('hidden');
  // hand the theme editor back to Settings (it was last in its pane)
  document.getElementById('spane-theme').appendChild(themeEditor);
  applyYtConfig();
  applyClipInfoConfig();
  // the one-time WELCOME intro (the 1/100 prismatic roll still applies)
  prismatic = Math.random() < 0.01;
  if (prismatic) document.body.classList.add('prismatic');
  introDone = false;
  splash.classList.remove('hidden', 'fade', 'dissolve');
  playIntro(true);
  if (config.inputFolder) enterPlayer();
}

if (onboardScreen) {
  $('obInBtn').addEventListener('click', async () => {
    const folder = await window.api.openFolder('Select your clips (input) folder');
    if (folder) {
      config = await window.api.setConfig({ inputFolder: folder });
      obInPath.textContent = folder;
      obInPath.classList.remove('muted');
      obRender();
    }
  });
  $('obOutBtn').addEventListener('click', async () => {
    const folder = await window.api.openFolder('Select your output folder (optional)');
    if (folder) {
      config = await window.api.setConfig({ outputFolder: folder });
      obOutPath.textContent = folder;
      obOutPath.classList.remove('muted');
    }
  });
  obYt.addEventListener('change', async () => {
    config = await window.api.setConfig({ ytEnabled: obYt.checked });
    obYtFolderRow.classList.toggle('hidden', !obYt.checked);
  });
  $('obYtBtn').addEventListener('click', async () => {
    const folder = await window.api.openFolder('Select where downloaded videos go');
    if (folder) {
      config = await window.api.setConfig({ ytFolder: folder });
      obYtPath.textContent = folder;
      obYtPath.classList.remove('muted');
    }
  });
  obClipInfo.addEventListener('change', async () => {
    config = await window.api.setConfig({ showClipInfo: obClipInfo.checked });
  });
  $('obAssocBtn').addEventListener('click', async () => {
    const note = $('obAssocNote');
    note.textContent = 'Registering…';
    const res = await window.api.registerFileTypes();
    note.textContent =
      res && res.ok
        ? 'Registered ✓ — in the Windows Settings page that just opened, choose Funny Cut Pro as your default for video'
        : 'Could not register the file types — you can try again anytime from this setup (Settings ▸ Reset app)';
  });
  obSpeed.addEventListener('change', async () => {
    config = await window.api.setConfig({ speedControl: obSpeed.checked });
    applySpeedConfig();
  });
  obStartEnabled.addEventListener('change', async () => {
    config = await window.api.setConfig({ startEnabled: obStartEnabled.checked });
    applyStartConfig();
  });
  obStartAt.addEventListener('change', async () => {
    const v = Math.max(0, Math.min(3600, Math.round(Number(obStartAt.value) || 0)));
    obStartAt.value = String(v);
    config = await window.api.setConfig({ startAt: v });
    applyStartConfig();
  });
  obThemeSwatches.addEventListener('click', (e) => {
    const row = e.target.closest('.swatchrow');
    if (!row) return;
    if (row.dataset.new) {
      createCustomTheme(false);
      return;
    }
    if (row.dataset.theme) selectTheme(row.dataset.theme);
  });
  obBack.addEventListener('click', () => {
    if (obStep > 0) {
      obStep--;
      obRender();
    }
  });
  obNext.addEventListener('click', () => {
    if (obStep < obSteps.length - 1) {
      obStep++;
      obRender();
    } else {
      finishOnboarding();
    }
  });

  // Settings ▸ Preferences ▸ Reset app: factory reset — deletes the config
  // and restarts the app straight into the first-time setup.
  const resetSetupBtn = $('resetSetupBtn');
  if (resetSetupBtn) {
    resetSetupBtn.addEventListener('click', () => {
      if (
        !confirm(
          'Reset Funny Cut Pro?\n\nThis deletes ALL settings — folders, themes, keybinds and preferences — and restarts the app into the first-time setup.'
        )
      )
        return;
      window.api.factoryReset();
    });
  }
}


// ---------- Boot ----------
(async function init() {
  config = await window.api.getConfig();
  loadKeybinds();
  applyTheme(config.theme);
  applySkipConfig();
  applySpeedConfig();
  applyClipInfoConfig();
  applyYtConfig();
  renderSetup();

  // If launched by opening a clip ("Open with"), go straight to preview mode.
  const previewFile = await window.api.getPreviewFile();
  if (previewFile) {
    splash.classList.add('hidden'); // skip the intro when opening a single clip
    enterPreview(previewFile);
  } else {
    if (!config.onboarded && !config.inputFolder) {
      // First run: the setup wizard replaces the intro — the one-time
      // "Welcome to Funny Cut Pro" intro plays when the wizard finishes.
      splash.classList.add('hidden');
      openOnboarding();
    } else {
      if (config.introEnabled !== false) {
        // 1-in-100 roll: the PRISMATIC opening — the whole wordmark shimmers
        // (splash AND the header logo, for the whole session) and the stinger
        // gets a shiny twist.
        prismatic = Math.random() < 0.01;
        if (prismatic) document.body.classList.add('prismatic');
        playIntro();
      } else {
        splash.classList.add('hidden');
      }
      // If an input folder is set, always go straight back to reviewing.
      // (Even if the drive isn't ready, the player shows a Retry rather than setup.)
      if (config.inputFolder) {
        enterPlayer();
      }
    }
  }

  // Opening another clip while already running reuses this window.
  window.api.onPreviewOpen((clip) => {
    skipIntro();
    enterPreview(clip);
  });

  // Newly-recorded clips show up without a restart.
  window.api.onClipsChanged(() => refreshClips());
})();
