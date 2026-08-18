/* LingTP 桌面端入口：用 Electron 加载单文件 HTML，作为独立原生窗口运行 */
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: '#f4f6fa',
    title: 'LingTP 网络拓扑管理',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile(path.join(__dirname, 'LingTP.html'));
}

app.whenReady().then(createWindow);

/* 帮助手册：点击「帮助」按钮时用系统默认 PDF 阅读器打开使用手册 */
ipcMain.on('open-manual', () => {
  shell.openPath(path.join(__dirname, 'LingTP用户使用手册.pdf'));
});

/* ---------- 配置与存档目录 ---------- */
// 配置（含用户自选的存档位置）存于 appData/LingTP，与安装目录、应用改名解耦
const CONFIG_DIR = path.join(app.getPath('userData'), 'LingTP');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir() { try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); } catch (e) {} }
function readConfig() {
  try { ensureConfigDir(); return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}'); }
  catch (e) { return {}; }
}
function writeConfig(cfg) { ensureConfigDir(); fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); }

// 存档目录解析优先级：用户配置 > 系统“文档”文件夹（已改盘则自动去其他盘）
function getSaveDir() {
  const cfg = readConfig();
  if (cfg.saveDir && fs.existsSync(cfg.saveDir)) return cfg.saveDir;
  try {
    const docs = app.getPath('documents');
    if (docs) return path.join(docs, 'LingTP');
  } catch (e) {}
  try { return path.join(app.getPath('userData'), 'LingTP'); }
  catch (e) { return ''; }
}

/* ---------- 目录 / 文件选择 ---------- */
ipcMain.handle('dialog:openDir', async () => {
  const r = await dialog.showOpenDialog({ title: '选择 LingTP 存档位置', properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:openFile', async (e, opts) => {
  opts = opts || {};
  const r = await dialog.showOpenDialog({
    title: opts.title || '选择文件',
    properties: ['openFile', 'multiSelections'],
    filters: opts.filters || []
  });
  return r.canceled ? [] : r.filePaths;
});

/* ---------- 配置读写 ---------- */
ipcMain.handle('cfg:get', (e, k) => readConfig()[k]);
ipcMain.handle('cfg:set', (e, k, v) => { const c = readConfig(); c[k] = v; writeConfig(c); return true; });

/* ---------- 存档目录解析 + 文件读写 ---------- */
ipcMain.handle('fs:saveDir', () => getSaveDir());
ipcMain.handle('fs:read', (e, p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } });
ipcMain.handle('fs:write', (e, p, c) => {
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); return true; }
  catch (e) { return false; }
});
ipcMain.handle('fs:mkdir', (e, p) => { try { fs.mkdirSync(p, { recursive: true }); return true; } catch (e) { return false; } });
ipcMain.handle('fs:exists', (e, p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
ipcMain.handle('fs:list', (e, p) => { try { return fs.readdirSync(p); } catch (e) { return []; } });

/* ---------- 旧版 NetTopo 数据迁移扫描 ----------
 * 扫描候选旧 AppData 目录下的 Chromium localStorage（LevelDB），
 * 纯文本提取 lingtp.v1 / nettopo.v1 键对应的拓扑 JSON（不依赖第三方 LevelDB 库）。
 */
const LEGACY_CANDIDATES = (function () {
  try {
    const roaming = app.getPath('appData');
    return [
      path.join(roaming, 'nettopo', 'Local Storage', 'leveldb'),
      path.join(roaming, 'NetTopo', 'Local Storage', 'leveldb'),
      path.join(roaming, 'LingTP 网络拓扑管理', 'Local Storage', 'leveldb')
    ];
  } catch (e) { return []; }
})();

ipcMain.handle('legacy:scan', (e, customDir) => {
  const dirs = customDir ? [customDir] : LEGACY_CANDIDATES;
  for (const dir of dirs) {
    const data = extractLeveldb('lingtp.v1', dir) || extractLeveldb('nettopo.v1', dir);
    if (data) return { found: true, path: dir, data: data };
  }
  return { found: false };
});

// 从 LevelDB 的 .log/.ldb 文件中启发式提取某个 key 对应、且含 devices 数组的 JSON 对象
// 关键：Chromium 把 localStorage 的字符串值以 UTF-16LE 存储，整文件按 utf8 读后 JSON 会散满 \0 导致解析失败；
// 因此改为在原始 Buffer 上定位 key，再从其后的 UTF-16LE '{'（字节 00 7B）起按 utf16le 解码得到干净 JSON。
function extractLeveldb(key, dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /\.(log|ldb)$/.test(f)); } catch (e) { return null; }
  const keyBuf = Buffer.from(key, 'utf8');
  for (const f of files) {
    let buf;
    try { buf = fs.readFileSync(path.join(dir, f)); } catch (e) { continue; }
    let pos = buf.indexOf(keyBuf);
    while (pos !== -1) {
      // UTF-16LE 的 '{' 表现为字节 00 7B
      let s = pos + keyBuf.length;
      while (s + 1 < buf.length && !(buf[s] === 0x7B && buf[s - 1] === 0x00)) s++;
      let obj = null;
      if (s + 1 < buf.length) obj = tryParseJson(buf, s, 'utf16le');
      if (!obj) {
        // 兜底：纯 UTF-8 场景，直接找首个 '{'
        let s8 = pos + keyBuf.length;
        while (s8 < buf.length && buf[s8] !== 0x7B) s8++;
        if (s8 < buf.length) obj = tryParseJson(buf, s8, 'utf8');
      }
      if (obj) return obj;
      pos = buf.indexOf(keyBuf, pos + keyBuf.length);
    }
  }
  return null;
}

// 从 buffer 的 off 字节起按指定编码解码，做括号平衡匹配并尝试 JSON.parse；成功且含 devices 数组则返回对象
function tryParseJson(buf, off, enc) {
  let json = '';
  try { json = buf.slice(off).toString(enc); } catch (e) { return null; }
  const end = findBalanced(json, 0);
  if (end <= 0) return null;
  try {
    const o = JSON.parse(json.slice(0, end + 1));
    if (o && Array.isArray(o.devices)) return o;
  } catch (e) {}
  return null;
}

// 从 start（指向 '{'）做括号平衡扫描，返回匹配的右花括号下标；字符串内的括号不计数
function findBalanced(txt, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < txt.length; i++) {
    const ch = txt[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
