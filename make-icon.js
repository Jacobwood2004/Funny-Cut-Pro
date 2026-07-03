// One-off: draws the Funny Cut Pro icon (FCP) + wordmark, matching the app's
// Indigo theme. Writes build/icon.png, build/icon.ico, build/wordmark.png.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// "FCP" app icon — F & C white, P in the indigo blue→violet gradient, on a dark
// indigo tile (matches the app's Indigo theme background).
function drawIconFCP(SIZE) {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const x = c.getContext('2d');
  const r = SIZE * 0.22;

  // dark indigo rounded background (the Indigo theme's --app-grad)
  const bg = x.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, '#16213f');
  bg.addColorStop(1, '#241a3d');
  x.fillStyle = bg;
  x.beginPath();
  x.roundRect(0, 0, SIZE, SIZE, r);
  x.fill();

  // subtle cool edge sheen
  x.strokeStyle = 'rgba(150, 170, 255, 0.22)';
  x.lineWidth = SIZE * 0.018;
  x.beginPath();
  x.roundRect(SIZE * 0.035, SIZE * 0.035, SIZE * 0.93, SIZE * 0.93, r * 0.88);
  x.stroke();

  // FCP
  const fontSize = SIZE * 0.46;
  x.font = `bold ${fontSize}px "Segoe UI", "Arial Black", Arial, sans-serif`;
  x.textBaseline = 'middle';
  x.textAlign = 'left';

  const letters = ['F', 'C', 'P'];
  const spacing = SIZE * 0.005;
  const widths = letters.map((l) => x.measureText(l).width);
  const total = widths[0] + widths[1] + widths[2] + spacing * 2;
  let sx = (SIZE - total) / 2;
  const y = SIZE * 0.55;

  x.fillStyle = '#ffffff';
  x.fillText('F', sx, y);
  sx += widths[0] + spacing;
  x.fillText('C', sx, y);
  sx += widths[1] + spacing;

  // "P" in the indigo blue→violet gradient (the theme --grad), with a soft
  // indigo glow so it lifts off the dark tile.
  const mg = x.createLinearGradient(sx, y - fontSize / 2, sx + widths[2], y + fontSize / 2);
  mg.addColorStop(0, '#2f9bff');
  mg.addColorStop(1, '#8b5cf6');
  x.save();
  x.shadowColor = 'rgba(124, 108, 240, 0.55)';
  x.shadowBlur = SIZE * 0.04;
  x.shadowOffsetY = SIZE * 0.006;
  x.fillStyle = mg;
  x.fillText('P', sx, y);
  x.restore();

  return c.toDataURL('image/png');
}

// "Funny Cut Pro" wordmark — "Funny Cut" white, "Pro" in the indigo gradient.
function drawWordmark(W, H, withBg) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');

  // optional dark-indigo rounded backdrop (for the standalone shareable logo)
  if (withBg) {
    const bg = x.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#16213f');
    bg.addColorStop(1, '#241a3d');
    x.fillStyle = bg;
    x.beginPath();
    x.roundRect(0, 0, W, H, H * 0.16);
    x.fill();
  }

  const fs2 = H * 0.5;
  x.font = `bold ${fs2}px "Segoe UI", Arial, sans-serif`;
  x.textBaseline = 'middle';
  x.textAlign = 'left';

  const t1 = 'Funny Cut ';
  const t2 = 'Pro';
  const w1 = x.measureText(t1).width;
  const w2 = x.measureText(t2).width;
  const total = w1 + w2;
  let sx = (W - total) / 2;
  const y = H * 0.54;

  // "Funny Cut" white (reads on both the dark backdrop and the dark app UI)
  x.fillStyle = '#ffffff';
  x.fillText(t1, sx, y);
  // "Pro" in the indigo blue→violet gradient
  const mg = x.createLinearGradient(sx + w1, 0, sx + w1 + w2, 0);
  mg.addColorStop(0, '#2f9bff');
  mg.addColorStop(1, '#8b5cf6');
  x.fillStyle = mg;
  x.fillText(t2, sx + w1, y);

  return c.toDataURL('image/png');
}

// NSIS installer sidebar (164×314) — dark indigo banner with the FCP tile and
// wordmark, replacing electron-builder's default blue laptop graphic.
function drawSidebar(W, H) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');

  // indigo backdrop
  const bg = x.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, '#16213f');
  bg.addColorStop(1, '#241a3d');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);

  // soft accent glow behind the tile
  const glow = x.createRadialGradient(W / 2, 92, 8, W / 2, 92, 110);
  glow.addColorStop(0, 'rgba(124, 108, 240, 0.30)');
  glow.addColorStop(1, 'rgba(124, 108, 240, 0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, W, 220);

  // mini FCP tile (matches the app icon)
  const S = 92;
  const tx = (W - S) / 2;
  const ty = 46;
  const r = S * 0.22;
  const tile = x.createLinearGradient(tx, ty, tx + S, ty + S);
  tile.addColorStop(0, '#1b2850');
  tile.addColorStop(1, '#2c2050');
  x.fillStyle = tile;
  x.beginPath();
  x.roundRect(tx, ty, S, S, r);
  x.fill();
  x.strokeStyle = 'rgba(150, 170, 255, 0.25)';
  x.lineWidth = 2;
  x.beginPath();
  x.roundRect(tx + 2, ty + 2, S - 4, S - 4, r * 0.9);
  x.stroke();

  const fs2 = S * 0.42;
  x.font = `bold ${fs2}px "Segoe UI", Arial, sans-serif`;
  x.textBaseline = 'middle';
  x.textAlign = 'left';
  const letters = ['F', 'C', 'P'];
  const widths = letters.map((l) => x.measureText(l).width);
  let sx = tx + (S - (widths[0] + widths[1] + widths[2])) / 2;
  const ly = ty + S * 0.54;
  x.fillStyle = '#ffffff';
  x.fillText('F', sx, ly);
  sx += widths[0];
  x.fillText('C', sx, ly);
  sx += widths[1];
  const pg = x.createLinearGradient(sx, ly - fs2 / 2, sx + widths[2], ly + fs2 / 2);
  pg.addColorStop(0, '#2f9bff');
  pg.addColorStop(1, '#8b5cf6');
  x.fillStyle = pg;
  x.fillText('P', sx, ly);

  // wordmark under the tile
  const wy = ty + S + 40;
  x.font = 'bold 19px "Segoe UI", Arial, sans-serif';
  const t1 = 'Funny Cut ';
  const t2 = 'Pro';
  const w1 = x.measureText(t1).width;
  const w2 = x.measureText(t2).width;
  let wx = (W - (w1 + w2)) / 2;
  x.fillStyle = '#ffffff';
  x.fillText(t1, wx, wy);
  const wg = x.createLinearGradient(wx + w1, 0, wx + w1 + w2, 0);
  wg.addColorStop(0, '#2f9bff');
  wg.addColorStop(1, '#8b5cf6');
  x.fillStyle = wg;
  x.fillText(t2, wx + w1, wy);

  // tagline
  x.textAlign = 'center';
  x.font = '11px "Segoe UI", Arial, sans-serif';
  x.fillStyle = 'rgba(226, 230, 245, 0.55)';
  x.fillText('Sort · Trim · Keep', W / 2, wy + 26);

  return c.toDataURL('image/png');
}

function pngToIco(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0);
  entry.writeUInt8(0, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, pngBuf]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 600, height: 400 });
  await win.loadURL('data:text/html,<body></body>');

  const iconUrl = await win.webContents.executeJavaScript(`(${drawIconFCP.toString()})(256)`);
  const iconPng = Buffer.from(iconUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

  const wmUrl = await win.webContents.executeJavaScript(`(${drawWordmark.toString()})(1200, 300, true)`);
  const wmPng = Buffer.from(wmUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

  // transparent version for in-app use (blends into the settings card)
  const wmClearUrl = await win.webContents.executeJavaScript(
    `(${drawWordmark.toString()})(1200, 300, false)`
  );
  const wmClearPng = Buffer.from(wmClearUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

  // NSIS sidebar (exact 164×314; converted to .bmp separately for NSIS)
  const sbUrl = await win.webContents.executeJavaScript(`(${drawSidebar.toString()})(164, 314)`);
  const sbPng = Buffer.from(sbUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

  const buildDir = path.join(__dirname, 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, 'icon.png'), iconPng);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), pngToIco(iconPng));
  fs.writeFileSync(path.join(buildDir, 'wordmark.png'), wmPng);
  fs.writeFileSync(path.join(buildDir, 'wordmark-clear.png'), wmClearPng);
  fs.writeFileSync(path.join(buildDir, 'installerSidebar.png'), sbPng);
  console.log('ICONS OK icon=' + iconPng.length + ' wordmark=' + wmPng.length + ' clear=' + wmClearPng.length + ' sidebar=' + sbPng.length);
  app.quit();
});
