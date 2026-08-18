# LingTP 网络拓扑管理平台

> 纯前端单机版网络拓扑绘制与运维工具，零运行时依赖。可打包为 Electron 桌面程序，也可直接用浏览器打开核心单文件。

LingTP（原名 NetTopo）面向运维 / 网工，用于快速绘制、归档和导出网络拓扑。核心逻辑是自包含的单文件 `LingTP.html`，主进程 `index.js` 通过 Electron 提供窗口、磁盘读写与旧版数据迁移等 IPC 能力。

---

## 功能特性

- **设备图元**：14 类内置设备图标，覆盖常见网络/安全/计算设备。
- **自定义素材库**：导入 PNG / JPG / SVG（含 Visio 导出），全局 `shapes.json` 管理，导出时内嵌被引用素材（独立命名空间 `custom:xxx`）。
- **批量导入**：CSV / LLDP 连接表、通用 JSON、原生 JSON。
- **自动连线**：接口—对端下拉选择，自动生成链路。
- **布局算法**：分层 / 力导向 / 网格 / 环形 四种一键布局。
- **标注**：区域框（Zone）划分、文本标注。
- **编辑体验**：撤销 / 重做。
- **自动备份**：localStorage + 磁盘自动存档（含全量 backups）。
- **多格式导出**：JSON / CSV / 设备接口清单 / PNG / SVG / Excel 接线表（`.xls`）。
- **数据继承**：跨版本、重装自动继承；支持**旧版 NetTopo（LevelDB）数据迁移**。

---

## 快速开始

### 方式一：直接使用（推荐普通用户）

获取安装包 `LingTP-Setup-x.x.x.exe`（见 Releases 或向维护者索取），双击安装即可。
首次启动会自动扫描旧版数据目录并询问是否恢复。

### 方式二：从源码运行（开发者）

前置：Node.js 18+ 与 npm。

```bash
cd nettopo-app
npm install
npm run dist        # 打包 Windows 安装包（electron-builder + NSIS）
```

或直接用 Electron 启动：

```bash
npx electron .      # 需先 npm install
```

也可直接用浏览器打开 `LingTP.html` —— 核心 UI 与绘图逻辑是自包含单文件，但部分依赖 IPC 的功能（磁盘读写、旧版迁移）需要 Electron 环境。

#### 构建注意（Windows / 国内网络）

- 打包时设镜像以避免 GitHub 下载 NSIS 卡死：

  ```bash
  set ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/
  npm run dist
  ```

- 产物：`dist/LingTP-Setup-x.x.x.exe`（NSIS 安装包），单文件 HTML 即 `LingTP.html`。

---

## 从旧版 NetTopo 迁移

首次启动时，程序会自动扫描以下旧目录：

```
%APPDATA%\nettopo\Local Storage\leveldb
%APPDATA%\NetTopo\Local Storage\leveldb
%APPDATA%\LingTP 网络拓扑管理\Local Storage\leveldb
```

发现旧数据后会**弹窗询问是否恢复**（仅询问一次）。若需手动恢复，可在「导入」中选择导出的 JSON 文件。

---

## 数据模型（简要）

| 对象 | 关键字段 |
|------|----------|
| `device` | `id, name, type, x, y, ip, vendor, model, site, note, interfaces[]` |
| `iface`  | `id, name, speed, ip, vlan, desc, status, linkId` |
| `link`   | `id, a:{d,i}, b:{d,i}, media, bandwidth, status, note` |
| `zone`   | 区域框标注 |
| `text`   | 文本标注 |

---

## 目录结构

```
nettopo-app/
├── LingTP.html              # 核心单文件（UI + 逻辑，自包含）
├── index.js                 # Electron 主进程（窗口 / IPC / 旧版迁移）
├── preload.js               # 渲染进程桥（contextBridge）
├── package.json             # 打包与依赖配置
├── md2pdf_rl.py             # 使用手册 PDF 生成脚本（reportlab）
└── LingTP用户使用手册.md/.pdf  # 使用手册
```

---

## 已知短板 / 后续方向

当前为纯静态单机版，以下能力暂未实现，可作为后续需求方向：

- 无实时状态 / 监控轮询
- 单拓扑，无多拓扑管理
- 无变更对比 / 版本管理
- 无路径追踪 / 故障影响面分析
- 无 IPAM / 子网视图
- 无发现 / 采集（SNMP / Nmap）
- 无等保合规叠加层
- 无多用户 / 服务端

---

## 许可证

暂未指定。如需开源请自行添加 `LICENSE` 文件。
