/* LingTP 预加载脚本：在渲染进程暴露 window.api 桥接 IPC（桌面版能力探测） */
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  openManual: () => ipcRenderer.send('open-manual'),

  // 选择目录（手动设置存档位置）
  openDirDialog: () => ipcRenderer.invoke('dialog:openDir'),

  // 选择文件（导入图片/SVG/旧版数据/素材），opts: {title, filters}
  openFileDialog: (opts) => ipcRenderer.invoke('dialog:openFile', opts || {}),

  // 配置读写（存于 appData/LingTP/config.json）
  getConfig: (k) => ipcRenderer.invoke('cfg:get', k),
  setConfig: (k, v) => ipcRenderer.invoke('cfg:set', k, v),

  // 解析最终存档目录（配置优先，否则跟随系统文档目录）
  getSaveDir: () => ipcRenderer.invoke('fs:saveDir'),

  // 文件系统能力组（桌面版专属；浏览器版无此对象 → 自动降级）
  fs: {
    read: (p) => ipcRenderer.invoke('fs:read', p),
    write: (p, c) => ipcRenderer.invoke('fs:write', p, c),
    mkdir: (p) => ipcRenderer.invoke('fs:mkdir', p),
    exists: (p) => ipcRenderer.invoke('fs:exists', p),
    list: (p) => ipcRenderer.invoke('fs:list', p)
  },

  // 旧版 NetTopo 数据迁移扫描（customDir 可选，传入则只扫该目录）
  scanLegacy: (customDir) => ipcRenderer.invoke('legacy:scan', customDir || null)
};

contextBridge.exposeInMainWorld('api', api);
