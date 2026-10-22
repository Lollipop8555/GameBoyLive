# GameBoyLive

> 一个部署在 GitHub Pages 上的纯静态 GB / GBC / GBA 在线模拟器。
> 默认不带任何游戏 ROM —— 你拖进来什么，它就模拟什么，并切换到对应的掌机外壳；本地开发可把 ROM 放进 `games/`，游戏面板里直接点开（见 §5）。
> 两种显示模式：**完整**（整壳 + 每个按键旁标出当前键位）与**特写**（只剩屏幕，沉浸游玩）。

![status](https://img.shields.io/badge/status-design--locked-blue) ![license](https://img.shields.io/badge/license-MIT-green)

---

## 1. 目标与非目标

### 目标

| # | 目标 | 验收口径 |
|---|------|---------|
| G1 | **零安装、零后端**，双击拖入 ROM 即可玩 | 首屏 → 拖入 `.gba` → 3 秒内出画面 |
| G2 | **桌面 + 移动端全兼容** | 1280×800 桌面、390×844 竖屏手机、844×390 横屏手机均无溢出/遮挡 |
| G3 | **键盘按键可自定义** | 每个按键独立重映射、持久化、冲突检测、一键恢复默认 |
| G4 | **屏幕按钮可直接点击** | 外壳上的 A/B/十字键/Start/Select/L/R 本身就是触控按钮，支持多点同时按 |
| G5 | **外壳精良还原** | GBA 横版 / GBC 竖版 / DMG 竖版，按 ROM 类型自动切换外壳与显示效果 |
| G6 | **多机型支持** | `.gb` `.gbc` `.gba`（另含 `.zip` 包裹的单 ROM），按文件头自动判别机型 |
| G7 | **本地存档** | SRAM 自动落盘、4 个即时存档槽、`.sav` 导出/导入 |
| G8 | **GitHub Pages 可直接部署** | `push main` → Actions 构建 → 线上可玩，无 COOP/COEP 头依赖 |
| G9 | **两种显示模式** | `完整`：整壳 + 每个按键旁显示当前键位映射；`特写`：只剩上盖屏幕，切换不断流 |
| G10 | **可安装、可离线开外壳** | 产物带 manifest + Service Worker：Android/桌面 Chrome 可「安装」，断网刷新仍能打开外壳 |

### 非目标（v1 明确不做）

- 不内置、不下载、不分发任何商业 ROM；`games/` 只是本地调试目录（已 `.gitignore`），构建默认不打包（`GAMES=1` 才包含）；不做 ROM 站点索引。
- 不做联机对战 / 联机交换（核心支持本地 link，但需要多人协调，v2 再评估）。
- 不做云存档 / 账号体系（纯本地存储）。
- 不做金手指（Cheat）编辑器。
- PWA **只缓存外壳**（HTML/JS/CSS/图标 + 首次加载用到的 wasm），不做 ROM 离线投递：卡带文件不进缓存，那是用户的文件，不该由我们留副本。

---

## 2. 技术选型与调研结论

### 2.1 模拟器内核（关键决策）

| 候选 | 结论 |
|------|------|
| **`@wasm-gaming/mgba-wasm@0.1.1`** ✅ **选用** | mGBA 官方内核编译到 wasm（~790 KB），**单个包同时覆盖 GBA + GB + GBC + SGB**，按镜像自动选核；**运行时不需 SharedArrayBuffer / COOP / COEP**，因此 **GitHub Pages 可直接跑**；音频走 AudioWorklet 环形缓冲；暴露 `setInput`（按 `KeyboardEvent.code` 重绑定）、`saveState/loadState`、`screenshot`、SRAM 自动持久化到 OPFS；原生把 `--mgba-aspect` 写到画布上，便于外壳自适应 |
| `@thenick775/mgba-wasm@2.6.0` | 成熟（powers gbajs3），但**强制线程 → 必须 COOP/COEP**；GitHub Pages 无法设置响应头，需 `coi-serviceworker` 兜底，iOS Safari 风险高。**作为 Plan B 保留** |
| EmulatorJS（CDN） | 开箱即用，但自带一整套 UI/虚拟手柄且**没有公开开关可禁用**，与「精良自制外壳」目标冲突，体积也更大 |
| 自研 JS 内核 | GB/GBC 可行，GBA 不可行（ARM7 + PPU，工程量与准确性风险不可接受） |

> **Plan B 触发条件**：若 M0 冒烟阶段发现内核对某类 ROM 兼容性/音频异常，切换到 `@thenick775/mgba-wasm` + `coi-serviceworker`。为此内核访问**全部收敛在一个适配层**（见 §4.1），UI 层不直接接触内核 API。

### 2.2 前端技术栈

- **框架：Vue 3.5 + `<script setup>` + TypeScript**（选型论证见 §2.2.1）。
- **构建：Vite 7**，产物纯静态；框架只负责 UI 状态（存档列表、设置面板、键位编辑器），**渲染循环完全由内核驱动，不参与逐帧渲染**。
- **零 UI 组件库**：外壳与外设全部用 **SVG + CSS**（渐变、内阴影、塑料质感），保证任意分辨率下清晰且体积极小（无位图素材）。
- **零额外运行时依赖**：状态用 `reactive()` 单例（不引 Pinia），IndexedDB 用原生封装（~80 行，不引 `idb`），无路由库（单页面）。

#### 2.2.1 React / Vue 选型论证

担忧「React 面向过程、维护不友好」是成立的，但它本质是 **hooks 心智负担**，不是 React 独有：闭包快照、依赖数组、`memo` 边界、受控组件样板，在本项目这种「**长期存活的单例服务 + 表单密集 UI**」的组合上会额外放大。

| 维度 | React 19 | Vue 3.5 | 本项目权重 |
|------|----------|---------|-----------|
| 单例服务状态（引擎/输入/存储） | 需 `useSyncExternalStore` 桥接层 | `reactive()` 单例即用，无需桥接 | **高** |
| 设置面板（~20 个开关 + 10 个键位） | 受控组件 + 手写 `onChange` | `v-model` 一行一个 | **高** |
| 键位捕获（命令式 `keydown`） | `useEffect` 依赖/闭包过期，易出错 | `onMounted` + 显式清理，读值无快照语义陷阱 | 中 |
| 画布与渲染循环隔离 | `ref` 持有节点即可 | 同 | 中 |
| 高频更新（FPS 计数） | 独立订阅防整树重渲 | 用 `shallowRef` 同理 | 中 |
| TS 体验 | 原生，hooks 推断好 | SFC + `vue-tsc`，模板内类型稍弱（本项目模板简单） | 低 |
| 产物体积 | ~45 KB gzip | ~34 KB gzip | 可忽略（wasm 790 KB） |

**结论：Vue 3 + SFC**。本应用是「服务驱动 + 表单密集」，正落在 Vue 的优势区；React 要达到同等整洁度需要额外写订阅与记忆化。

**风险隔离**：`src/core/**` 为**框架无关的纯 TS**（不 import 任何框架 API），UI 层只做三件事——读 store 渲染、派发命令、订阅事件。因此这个决策可逆：换框架只需重写 `src/ui/**`，`core` 不动。

> 若团队 React 更熟，改用 React 也只是换 UI 层，本设计的其余部分（内核适配、输入、存档、外壳）完全不变。

### 2.3 内核 API 实测备忘（已在源码层核对）

```ts
const engine = await load({
  canvasEl: canvas,
  assets: { rom: bytes },              // .gba/.gb/.gbc/.sgb，或 zip 的 ArrayBuffer
  options: { system: 'auto', gbModel: 'auto', aspect: 'native',
             renderFilter: 'pixelated', interframeBlending: true, volume: 0.7,
             escMenu: false, gamepads: true },
  persist: 'opfs',                     // SRAM 落盘 OPFS: mgba/<namespace>/sram.bin
  storageNamespace: romId,             // 每个 ROM 独立存档命名空间
  onEvent: (e) => { /* ready | frame{fps} | exit */ },
});
engine.start();                        // 启动渲染循环
engine.system;                         // 'gba' | 'gb'（实际启动的内核）
engine.pause(); engine.resume(); engine.reset(); engine.destroy();
engine.setInput({ 'p1.a': 'KeyJ' });   // 合并式，见 §4.4
await engine.saveState();              // Uint8Array（GBA 388 KiB / GB 70 KiB）
await engine.loadState(bytes);         // 长度必须与当前核心一致，否则抛错
await engine.screenshot();             // PNG Blob（当前帧）
engine.config.write('volume', 0.5);    // 运行期可改：volume/renderFilter/interframeBlending/...
```

**键位清空语义（已确认）**：`setInput(map)` 内部为 `{...DEFAULT_KEYMAP, ...map}` 且跳过 falsy 值 —— 因此传 `'p1.up': ''` 可**真正解绑**默认键；同一个 `code` 只能映射一个按键（Map 后写覆盖），所以 UI 必须做**唯一性校验**。

**合成事件可用（已确认）**：键盘监听只读 `e.code`，不校验 `isTrusted` —— 触屏按钮可以派发合成 `KeyboardEvent`，与键盘共用同一条输入通路。

### 2.4 内核产物完全本地化（无远程依赖）

项目**不引用任何 CDN 上的内核**，运行时不向第三方发请求：

- 内核本体来自 `node_modules/@wasm-gaming/mgba-wasm`，由 `scripts/copy-wasm.mjs` 在 `postinstall` / `predev` / `prebuild` 三个钩子里把 `mgba.js` + `mgba.wasm` 复制到 `public/mgba/`；该目录已从 `.gitignore` 移出、**作为项目内静态资源入库**（`mgba.js` 67 KB + `mgba.wasm` 791 KB）。因此上游撤版、改版或 CI 解析到别的内容，仓库里这份产物照样可跑。
- 脚本同时写 `public/mgba/manifest.json`（包名 + 版本 + 两个文件的 sha256）：内核字节一旦变化，构建日志会告警，`git diff` 里也看得见 —— 不会「悄悄换了内核还以为是同一个」。
- `EmulatorAdapter` 启动时显式传 `jsUrl` / `wasmUrl`，只指向本站相对路径（`${BASE_URL}mgba/mgba.js`、`${BASE_URL}mgba/mgba.wasm`），**没有 unpkg / jsdelivr 之类的远程回退**；`dist/` 里除 Vue 自带的提示链接外搜不到任何外部 URL。
- 上游版本在 `package.json` 里锁到 `^0.1.1`、`package-lock.json` 入库存精确解析；升级内核是一次显式的代码改动，而不是线上悄悄换版本。

> 也就是说：内核是**项目内的静态资源依赖**，不是远程项目依赖。唯一的外部性是「换机器重新构建时要能从 npm 拉到同一个版本」——这一步失败会直接构建失败，不会退化成线上加载别人的文件。

---

## 3. 总体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    Vue UI Layer (SFC，只读 store)                 │
│  ShellSwitcher · TouchControls · SettingsPanel · SaveMenu · Toast │
└───────────────┬──────────────────────────────┬───────────────────┘
                │ 读状态 / 派发命令             │ 订阅事件
┌───────────────▼──────────────────────────────▼───────────────────┐
│                 App Store (reactive 单例，无 Pinia)               │
│  settings(键位/音量/滤镜/触控开关) · session(rom/system/state)     │
└───────────────┬──────────────────────────────┬───────────────────┘
                │                              │
┌───────────────▼──────────────┐  ┌────────────▼───────────────────┐
│      InputManager            │  │        EmulatorAdapter         │
│ keyboard ─┐                  │  │  boot/pause/resume/reset       │
│ touch ────┼─► KeyboardEvent  │  │  saveState/loadState           │
│ gamepad ──┘   (synthetic)    │  │  screenshot/setInput/configure │
└───────────────┬──────────────┘  └────────────┬───────────────────┘
                │                              │
                │                    ┌─────────▼─────────┐
                │                    │  mgba.wasm (mGBA) │
                │                    │   canvas 2D blit  │
                │                    └─────────┬─────────┘
                │                              │ sram.bin
┌───────────────▼──────────────┐  ┌────────────▼───────────────────┐
│  RomLoader                   │  │  StorageService                │
│  拖拽/选择 → RomInfo 嗅探     │  │  IndexedDB(roms/states)        │
│  system: gba|gbc|dmg|sgb     │  │  OPFS(SRAM) · localStorage(设置)│
└──────────────────────────────┘  └────────────────────────────────┘
```

### 3.1 目录结构

```
GameBoyLive/
├─ .github/workflows/deploy.yml     # 构建 + 发布到 GitHub Pages
├─ public/
│  ├─ .nojekyll                     # 防止 Jekyll 吞掉 _ 开头资源
│  ├─ favicon.svg
│  ├─ manifest.webmanifest          # PWA 清单（可安装）
│  ├─ sw.js                         # 外壳缓存（不做 ROM 缓存）
│  └─ icons/                        # icon-192/512.png、maskable-512.png、apple-touch-icon.png（+ 源 SVG）
├─ src/
│  ├─ main.ts                       # createApp + SW 注册（仅产物；启动失败由 App.vue 兜成 error 态）
│  ├─ app/
│  │  ├─ App.vue                    # 布局 + 状态机（idle/loading/playing/paused）
│  │  └─ store.ts                   # reactive() 单例：settings + session（不引 Pinia）
│  ├─ i18n/
│  │  ├─ index.ts                   # locale ref + setLocale + t(key, params)，持久化 localStorage
│  │  └─ messages.ts                # zh 定义键、en 必须逐键覆盖（漏键编译期报错）
│  ├─ core/                         # ★ 框架无关纯 TS，禁止 import 框架 API
│  │  ├─ types.ts                   # System/KeyAction/RomInfo/SaveSlot 等
│  │  ├─ EmulatorAdapter.ts         # 内核唯一出入口（含 Plan B 适配点）
│  │  ├─ romInfo.ts                 # 文件头嗅探：机型/标题/容量/校验
│  │  ├─ InputManager.ts            # 键位映射 + 触控合成事件 + 冲突处理
│  │  ├─ StorageService.ts          # IndexedDB / OPFS / localStorage 统一封装
│  │  ├─ WakeLock.ts                # 屏幕常亮（运行时持有，暂停/后台即释放）
│  │  ├─ keyLabel.ts                # KeyboardEvent.code → 可读键位标签（U+2191 / A / R⇧）
│  │  └─ exports.ts                 # .sav 导出、截图下载、存档导入
│  ├─ ui/
│  │  ├─ shells/
│  │  │  ├─ ShellGBA.vue            # 横版外壳（含 L/R、扬声器孔、丝印）
│  │  │  ├─ ShellGBC.vue            # 竖版外壳（彩虹字标）
│  │  │  ├─ ShellDMG.vue            # 竖版外壳（点阵屏、品红按钮）
│  │  │  └─ ShellFrame.vue          # 共享底壳：屏幕开孔 + 玻璃反光 + 按钮原语（:mode="full|focus"）
│  │  ├─ Screen.vue                 # canvas 容器 + LCD 滤镜叠加层（尺寸随 mode 变化）
│  │  ├─ TouchControls.vue          # 完整模式：外壳按钮 → pointer 事件 → 合成按键
│  │  ├─ FloatingPad.vue            # 特写模式：半透明浮动触控层
│  │  ├─ KeyBadge.vue               # 按键旁的键位徽章（读 keymap，实时更新）
│  │  ├─ Dropzone.vue               # 首屏拖拽/选择 ROM
│  │  ├─ Toolbar.vue                # 暂停/存档/音量/全屏/退出
│  │  ├─ SettingsPanel.vue          # Tabs: 显示 | 按键 | 声音 | 关于
│  │  ├─ KeymapEditor.vue           # 点击捕获按键、冲突提示
│  │  ├─ SaveMenu.vue               # 4 槽即时存档 + SRAM 导出导入
│  │  └─ Library.vue                # 最近游戏
│  └─ styles/                       # tokens.css / shell.css / layout.css
├─ index.html
└─ vite.config.ts
```

---

## 4. 关键模块设计

### 4.1 EmulatorAdapter（内核隔离层）

```ts
interface EmulatorAdapter {
  boot(rom: Uint8Array, info: RomInfo): Promise<void>;
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;                       // 换 system/gbModel 时走 reboot
  destroy(): Promise<void>;            // 会先 flush SRAM，再释放 wasm
  setKeymap(map: Record<KeyAction, string>): void;
  configure(patch: Partial<EngineOptions>): void;
  saveState(): Promise<Uint8Array>;
  loadState(bytes: Uint8Array): Promise<void>;
  screenshot(): Promise<Blob>;
  readonly system: System;             // 'gba' | 'gb'
  on(evt: 'ready'|'frame'|'exit', cb: (detail: any) => void): () => void;
  // 内核只 emit ready/frame/exit；错误通过 rejected Promise 抛出，由本层统一转成 EmulatorError
}
```

- 所有 `wasm` 相关 `try/catch` 都收敛在此层，向上抛 `EmulatorError`（`LOAD_FAILED` / `UNSUPPORTED_ROM` / `AUDIO_BLOCKED`）。
- `destroy()` 顺序固定：`pause()` → 等 SRAM flush（`persistSram` 是异步的，`destroy` 后会写盘） → `mod._mgbawasm_unload()`。
- **Plan B 切换点**：仅替换本文件实现，`setKeymap` 在 Plan B 下改为 `bindKey/buttonPress` 适配。

### 4.2 ROM 识别（零依赖嗅探）

```ts
// 判定顺序：GBA → GB 家族
// GBA: rom[0xB2] === 0x96（固定值），标题在 0xA0..0xAB，容量 8..32 MB
// GB : 0x100..0x103 为入口跳转，标题 0x134..0x143(NUL 结尾)
//      0x143: 0x80/0xC0 → CGB；0x146 === 0x03 → SGB；否则 DMG
// 机型优先级：gba > gbc > sgb > dmg
```
产物：`{ id: sha1, name, system: 'gba'|'gb', model: 'dmg'|'cgb'|'sgb'|'agb', title, size }`。
`model` 决定外壳与默认滤镜（DMG 强制 `dmglcd` 滤镜），`system` 传给内核做兜底。

### 4.3 显示系统（外壳 + 屏幕）

| 机型 | 画布原生分辨率 | 屏幕比例 | 外壳比例 | 关键视觉 |
|------|---------------|---------|---------|---------|
| GBA | 240×160 | 3:2 | 1.55 : 1 横版 | 靛紫机身、顶部 L/R 肩键、右上 "GAME BOY ADVANCE" 丝印、右下扬声器孔阵 |
| GBC | 160×144 | 10:9 | 0.62 : 1 竖版 | 葡萄紫机身、屏下彩色 "GAME BOY COLOR"、斜置 A/B 与 Start/Select、左上电源灯 |
| DMG | 160×144 | 10:9 | 0.62 : 1 竖版 | 灰绿机身、深灰屏幕边框、品红 A/B、红字 "DOT MATRIX WITH STEREO SOUND"、点阵绿屏 |

- **屏幕层**：`<canvas>` 由内核写入，CSS `image-rendering: pixelated` + `aspect-ratio: var(--mgba-aspect)`；外层加 `screen-glass` 叠加层（斜向玻璃反光 + 内阴影 + 边缘晕影）。
- **滤镜**（`Screen.vue` 叠加层，纯 CSS，可关闭）：
  - `original` 原色；`dmglcd` DMG 四阶绿（`filter: sepia/ hue-rotate` + `mix-blend-mode: multiply`）；`grid` 像素栅格；`scanline` 扫描线；`blend` 交给内核 `interframeBlending` 做 LCD 拖影。
- **响应式策略**：`clamp()` 控制外壳宽度；`@media (orientation: landscape) and (max-height: 500px)` 时外壳横向撑满；**工具栏在所有尺寸下都折叠成一枚菜单键**（桌面也不再铺一排按钮，玩的时候不抢画面），展开为下拉浮层；`prefers-reduced-motion` 关闭开机动画。
- **触控按钮 = 外壳本体**：不叠加半透明悬浮手柄，而是让 SVG 上的按钮分组直接接收 `pointer` 事件（并显示按下位移与高光）。桌面端默认隐藏触控高亮，但**保留可点击**。

#### 4.3.1 两种显示模式（`settings.displayMode`）

| | **完整 `full`** | **特写 `focus`** |
|---|---|---|
| 渲染范围 | 整套外壳（上盖屏幕区 + 下盖按键区） | 仅上盖（屏幕区）：屏幕外框、丝印、玻璃反光、机身顶部圆角与配色**与完整模式同源** |
| 键位提示 | 每个按键旁渲染键位徽章 `<kbd>`，实时反映当前映射 | 不显示徽章（沉浸）；可选「显示键位提示条」开关（默认关） |
| 屏幕尺寸 | 外壳宽度的 ~62%（GBA ~72%） | `min(92vw, 86vh × 屏幕比例)`，最大占比 |
| 触控 | 直接点外壳按键 | 下盖不可见 → 自动启用**半透明浮动触控层**（§4.4 第 4 条） |
| 适用 | 上手期：看得见键位，边玩边记 | 熟练后：只剩屏幕，最大化沉浸 |

**切换入口**：工具栏模式按钮 + 快捷键 `` ` ``（Backquote，仅当该键未被映射）+ 双击屏幕；过渡 200ms（`prefers-reduced-motion` 下瞬时）。模式持久化到 localStorage。

**实现要点（关键：不允许出现两套视觉）**

```vue
<ShellFrame :mode="mode">        <!-- 同一份 SVG defs：渐变/内阴影/高光只定义一次 -->
```
- 下盖是同一组件的条件分支，CSS 用 `.shell[data-mode="focus"] .shell__lower { display: none }` 隐藏，**不做截图裁切、不复制组件**。
- 屏幕容器宽度由 CSS 变量 `--screen-w` 驱动，两模式各取一段 `clamp()`，`aspect-ratio: var(--mgba-aspect)` 保证不变形。
- 切换只改一个 `data-mode` 属性 + 两个 CSS 变量，DOM 结构不变 → 不触发 wasm/画布重排，**切换耗时 < 1 帧，游戏不中断**。
- 键位徽章必须 `pointer-events: none`，否则会挡住外壳按键的点击。
- **徽章排版**：渲染在按键正下方 6px，胶囊底色 + 等宽字体 + 12px 字号；DMG/GBC 竖版外壳底部预留 28px 内边距承载徽章，GBA 横版因 L/R 在肩部、A/B 在右侧，徽章跟随各自按键的局部坐标系（SVG `<g transform>` 内偏移），不参与机身整体缩放重算。

**设备矩阵**

| | 桌面（≥1024px） | 移动（≤767px） |
|---|---|---|
| 完整 | 外壳居中 + 右侧工具栏，徽章常显 | 外壳横向撑满视口，徽章默认隐藏（`设置 → 显示 → 键位徽章` 可强制开） |
| 特写 | 屏幕放大至 86vh，工具栏浮于右下 | 屏幕铺满，浮动触控层默认开启，透明度可调 |

### 4.4 输入系统

动作集合：`Up Down Left Right A B L R Start Select`（GBA 全量，GB 隐藏 L/R）。

1. **键盘映射**：`settings.keymap: Record<KeyAction, KeyboardEvent.code | null>` → localStorage。默认布局：

   | 动作 | 默认键 | 动作 | 默认键 |
   |---|---|---|---|
   | 上 / 下 / 左 / 右 | `W` / `S` / `A` / `D` | A / B | `L` / `K` |
   | Start / Select | `B` / `V` | L / R（GBA） | `Q` / `O` |

   旧版本默认（方向键 + `Z`/`X` + `A`/`S` + `↵`/`⇧`，以及上一版 `WASD`/`K`/`L`/`V`/`B` + 肩键 `I`/`O`）会在载入时整体迁移成当前默认——只在存档里的键位**一个都没改过**时才换，动过一个键就原样保留。

   - 编辑：点击动作行 → 「请按键」→ 捕获 `e.code` → 唯一性校验（冲突则提示并询问是否交换）→ 立即生效（`engine.setInput`）。
   - 生成完整映射：`{ 'p1.up': code ?? '', ... }`（空串即解绑，见 §2.3）。
   - 应用层热键与映射隔离：`Esc` 打开暂停菜单、`F11`/按钮全屏；仅当该 `code` 未被映射时生效。
2. **触屏**：`pointerdown/up/cancel/leave` + `setPointerCapture`，按 `pointerId` 维护按下集合，保证十字键 + A 同按；容器 `touch-action: none`、禁用长按菜单与双击缩放。
3. **手柄**：内核自动轮询标准映射手柄（`options.gamepads`），UI 只做「已连接」提示。
4. **浮动触控层（特写模式专用）**：`FloatingPad.vue`，与完整模式共用同一套 pointer→合成 `KeyboardEvent` 逻辑，仅换皮肤与布局。左半区 D-pad、右半区 A/B、中下 Start/Select、顶部两角 L/R（仅 GBA），`backdrop-filter: blur(6px)` + 低不透明度描边，按下高亮；`settings.touchLayer: 'auto' | 'on' | 'off'`，`auto` 时按 `(pointer: coarse)` 或首次 touch 事件判定，透明度可调（0.3–1.0）。
5. **键位标签**：`core/keyLabel.ts` 提供框架无关的 `formatKeyLabel(code)`，外壳徽章与设置面板共用一套映射：`KeyJ → J`、`ArrowUp → ↑`、`ShiftRight → R⇧`、`Space → Space`、`Numpad1 → 小键盘1`、`null → —`。

### 4.5 存档系统

| 类型 | 位置 | 触发 |
|------|------|------|
| SRAM（电池存档） | OPFS `mgba/<romId>/sram.bin` | 内核每 15s + 暂停/销毁时自动写 |
| 即时存档 ×4 | IndexedDB `states`（含 128×… PNG 缩略图 + 时间） | 用户手动 |
| 设置 | localStorage | 变更即写 |
| ROM 缓存 | IndexedDB `roms` | 载入时存（可在设置里关闭，用于「最近游戏」） |

- **`.sav` 导出**：读 OPFS `sram.bin` → 触发下载 `<title>.sav`。
- **`.sav` 导入**：`pause()` → `destroy()`（会写旧 SRAM）→ 覆盖 OPFS `sram.bin` → 重新 `boot()`（`reset()` 不会重读磁盘，必须重建）。
- **即时存档**：`saveState()` 字节 + `screenshot()` 缩略图入 IDB；读档前校验字节长度（跨机型/跨版本会抛错），失败给出可读提示。
- **存档保护**：启动时调 `navigator.storage.persist()` 换取浏览器的「不清理」承诺（`store.device.durable`）。被拒不影响玩，但存储吃紧时 IndexedDB / OPFS 可能被静默清掉，因此「关于」里如实显示状态并提供重试按钮。

### 4.6 状态机

```
idle ──拖入/选择 ROM──► loading ──ready──► playing ⇄ paused ──退出──► idle
  ▲                        └─error──► error(可重试)                    │
  └──────────────────────────── 选择其他 ROM ◄──────────────────────────┘
```

- `loading` 覆盖层显示内核下载/初始化进度（wasm 首次 ~790 KB）。
- 首次 `AudioContext` 必须在用户手势内 `resume()`，否则 `AudioContext` 会挂起 → 提供「点击开始」遮罩。
- **切到后台**：`visibilitychange` 隐藏时暂停并放掉常亮——看不见的画面继续跑只是白烧 CPU 和电；回到前台只恢复「因隐藏而暂停」的那一次，用户手动按下的暂停不替他恢复（存档面板开着时也不恢复）。
- **进程被回收前的兜底**：`pagehide` 也走同一条暂停路径（移动端切走 App 不一定先发 `visibilitychange`）。`pause()` 会把卡带存档写盘，尽量少丢最后那几十秒进度。
- **屏幕常亮**：`playing` 时持有 Screen Wake Lock，`paused` / `idle` / `error` / 卸载即释放；并发申请会合并成一次。不支持（Safari < 16.4、非安全上下文）或被系统拒绝时静默跳过，不影响游戏。

---

## 5. UI / UX

- **首屏**：一颗**完整模式**的外壳（默认 GBA）居中，屏幕内是自绘的 `GameBoyLive` 开机画面（扫描线 + 未插卡提示），下方一行「拖入 ROM 或点击选择」。右侧/底部工具栏：游戏、设置、关于。
- **游戏面板**：分「随项目提供」与「最近打开」（IndexedDB 缓存）两段，超过 4 个时出现搜索框；游戏再多也不影响首屏——面板打开前不发任何请求。`games/` 已加入 `.gitignore`，只存在于本地调试环境（`GAMES=1` 构建才会进产物），所以这一段的标题上直接标了「本地 `games/` · 不随部署发布」。
- **游戏中**：外壳 + 一枚折叠的菜单键（暂停、存档、模式切换、音量、全屏、更换 ROM 都在展开的菜单里，点外面或 `Esc` 收起）。机身下沿的丝印行刻着机型参数、当前卡带的内部标题与实时帧率（如 `32-BIT · 2001 ｜ ZELDA 60 FPS GLASS EDITION`），面板模式把同一组信息印在屏幕上方（`32-BIT · 2001 / AGB-001`、`ZELDA / 240 × 160 · 60 FPS`），横屏空间不够时转 90° 竖排、紧贴屏幕两侧。**FPS 是丝印的一部分，不是可开关的 HUD**。暂停时画面只罩一层薄玻璃，整块屏幕就是「继续」的点击热区——`HOLD` / `RUN` 的字样和指示灯都不进画面：整机模式下长在机身面板右上角那颗灯上，面板模式没有机身，同一颗灯印在屏幕上方那块铭牌右端（横屏改印在屏幕正下方右侧）；灯色与丝印都是**状态读数**（`OFF` 待机暗蓝 / `LOAD` 载入闪蓝 / `RUN` 运行常亮 / `HOLD` 暂停呼吸琥珀 / `ERR` 出错红），按下去就是暂停与继续（动作只写在 `title` / `aria-label` 里）。暂停前后屏幕尺寸不变，机身面板也一行都没多。
- **两种显示模式**：`完整`（整壳 + 按键旁键位徽章，上手期）/ `特写`（只剩上盖屏幕，沉浸期），详见 §4.3.1。工具栏按钮一键切换，状态持久化。
- **暂停遮罩**：4 个存档槽（缩略图 + 相对时间 + 覆盖确认）、导出/导入存档、截图、退出到首屏。
- **画面圆角遮罩（可选，默认关）**：开启时衬圈厚度 + 画面圆角 = 窗口外圆角（`--bay-pad + --screen-radius`），三者只有一个来源，内外两条弧线共圆心、平行；画布用 `position: absolute; inset: 0` 钉死在格子里，弧线同时画在格子和画布两处（`border-radius` + `clip-path`）。**已知限制**：画布（尤其 WebGL 合成层）上的圆角裁切在部分浏览器里会被忽略，开了也可能仍是直角，所以不设成默认外观，设置页里也直说了。
- **设置面板**：`显示`（显示模式、语言、键位徽章开关、滤镜、像素锐化、圆角遮罩、触控层透明度）| `按键`（键位表 + 恢复默认）| `声音`（音量/静音）| `关于`（内核版本、许可、无 ROM 声明、存档保护状态）。
- **界面语言（中 / EN）**：两处入口 —— 菜单面板**顶部**的 `中 | EN` 切换（横屏矮视口里菜单要滚动，所以不放末尾），以及 `设置 → 显示 → 语言`。切换即时生效、写入 `localStorage['gbl.locale.v1']`、刷新保持，同时同步 `<html lang>`。实现见 §5.1。
- **空/异常态**：无 ROM、坏 ROM、超过 32 MB、wasm 加载失败、浏览器不支持 —— 屏幕内直接说明原因并给出下一步动作（点整块屏幕即可重选）。
- **可访问性**：所有外壳按钮带 `role="button"` + `aria-label` + 键盘可达（`Tab` + `Space/Enter`）；对比度 ≥ 4.5:1。

### 5.1 国际化（自研 60 行，不引 vue-i18n）

- `src/i18n/messages.ts`：`zh` 对象是**唯一键定义处**，`MessageKey = keyof typeof zh`；`en` 声明为 `Record<MessageKey, string>`，所以**漏翻一个键就编译不过**（`vue-tsc` 直接拦下），不会出现运行时回退到中文或显示 key 的情况。
- `src/i18n/index.ts`：`locale` 是 `ref<Locale>`，`setLocale()` 写 `localStorage['gbl.locale.v1']` 并同步 `document.documentElement.lang`；`t(key, params?)` 支持 `{n}` / `{name}` 占位符插值。默认 `zh-CN`。
- 不引入框架的理由：文案量 ~200 键、无复数/日期库需求，`vue-i18n` 的 bundle 与配置成本大于收益；日期格式化直接用 `toLocaleDateString(locale)`，跟随同一个开关。
- **刻意不翻译**：ROM 文件名/卡带内部标题（用户数据）、机身丝印与按键刻字（`GAME BOY`、`OFF/LOAD/RUN/HOLD/ERR`，那是硬件外观，不是界面文案）。
- 错误信息走「稳定 code + 词典查表」：`RomError` 携带 `RomErrorCode`（`tiny`/`too-big`/`zip-broken`/…），UI 侧 `t(\`error.rom.${code}\`)`；切换语言时**已经显示在屏幕上的错误也会跟着变**，不会残留上一个语言。

---

## 6. 兼容性与降级

| 能力 | 要求 | 降级策略 |
|------|------|---------|
| WebAssembly | 全主流 | 不支持则显示「浏览器过旧」提示页 |
| AudioWorklet | Chrome 66+/Safari 14.1+ | 不可用时静音运行，UI 禁用音量 |
| OPFS | Chrome 111+/Safari 16.4+/FF 111+ | 不可用时 SRAM 仅内存保留 + 强提示手动导出 |
| `DecompressionStream`（zip ROM） | Chrome 80+/Safari 16.4+ | 不可用时提示先解压 |
| 触控 | Pointer Events | 使用 `pointer` 事件统一鼠标/触摸/笔 |
| Screen Wake Lock | Chrome 84+/Safari 16.4+ | 不可用或申请被拒：不常亮，游戏照常 |
| Service Worker | 全主流（需 https / localhost） | 注册失败只是没有离线能力；`file://` 打开则完全没有 |
| `navigator.storage.persist()` | Chrome 55+/Safari 15.2+ | 被拒时存档仍可用，只是可能被浏览器在存储紧张时清理（「关于」里如实标注） |

目标基线：**iOS Safari 16.4+ / Android Chrome 111+ / 桌面 Chrome、Edge、Firefox、Safari 最新两个大版本**。

---

## 7. 部署（GitHub Pages）

```yaml
# .github/workflows/deploy.yml（要点）
on: { push: { branches: [main] }, workflow_dispatch: {} }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    environment: github-pages
    steps: [{ uses: actions/deploy-pages@v4 }]
```

- `vite.config.ts`：`base: './'`（用户页与项目页通用）、`build.assetsInlineLimit: 0`、`assetsInclude: ['**/*.wasm']`。
- `public/.nojekyll` 必须存在。
- **不需要** COOP/COEP 响应头（这正是选 `@wasm-gaming/mgba-wasm` 的核心原因）；`.wasm` 由 GitHub Pages 以 `application/wasm` 正确返回。
- **PWA**：`public/manifest.webmanifest` + `public/sw.js`。SW 只在产物里注册（`import.meta.env.PROD`），dev 下不注册以免缓存搅乱热更新；注册用相对路径 `new URL('sw.js', document.baseURI)`，`base: './'` 部署到项目页子路径时 scope 仍落在 `/<repo>/`。缓存策略：导航请求网络优先（重新部署立刻生效）、静态资源缓存优先；`*.gb|gbc|gba|zip` 明确不进缓存。每次导航拿到新页面后按其中的 `src`/`href` 清掉 `/assets/` 下不再被引用的旧指纹资源，避免一次发版留一份旧 JS/CSS。图标为 PNG（192/512 + maskable + 180 的 `apple-touch-icon`），`icon.svg` 只作设计源文件保留——iOS 不接受 SVG 当主屏图标。
- 本地调试：`npm run dev`（HTTPS 不需要，localhost 属安全上下文）。
- 流水线已入库：`.github/workflows/deploy.yml`（push 到 `main` 即构建并发布），仓库需在 Settings → Pages 里把 Source 设为 GitHub Actions。

### 体积预算

| 项 | 预算 |
|----|------|
| `mgba.wasm` | 790 KB |
| 内核 JS + 应用 JS（gzip） | ≤ 250 KB |
| 外壳/图标（SVG/CSS，无位图） | < 20 KB |
| **首屏可交互** | **< 1.2 s**（宽带）/ 移动 4G < 3 s |

---

## 8. 开发任务拆分

> 里程碑按依赖顺序排列；每项都带可验收的完成标准。**M0 是唯一有技术不确定性的阶段** —— 已跑通（详见下节实测记录），三条通路、输入、存档、OPFS、子路径部署全部验证，Plan B 暂不触发。

### M0 · 可行性冒烟（半天）✅ 已完成

| ID | 任务 | 完成标准 | 状态 |
|----|------|---------|------|
| T0.1 | 初始化 Vite+TS+Vue 工程，接入 `@wasm-gaming/mgba-wasm` | `npm run dev` 能加载 wasm，控制台输出版本号 | ✅ |
| T0.2 | 最小可用播放器：拖入 ROM → canvas 出画面 + 出声 | GB / GBC / GBA 各一个自制或公有领域 ROM 均能运行 | ✅ |
| T0.3 | 验证关键 API 行为 | 合成 `KeyboardEvent` 生效、`'p1.x': ''` 能解绑、`saveState/loadState` 往返成功、OPFS `sram.bin` 刷新页面后仍在 | ✅ |
| T0.4 | 生产构建 + 子路径托管复验 | `dist/` 在 `/GameBoyLive/` 子路径下无 404、四项自检全绿 | ✅ |

**实测结果**（`dmg-acid2.gb` / `cgb-acid2.gbc` / `beast-beast.gba`，dev 与 production 各跑一遍）

| 项 | 结果 |
|----|------|
| 渲染 | GB/GBC 160×144、GBA 240×160，像素正确；`--mgba-aspect` 分别为 1.111 / 1.5 |
| 帧率 | GB 60 FPS、GBA 59 FPS（32 MB ROM 也是 59） |
| 合成键盘 | `dispatchEvent(new KeyboardEvent('keydown',{code:'KeyX'}))` → `defaultPrevented === true`，内核确实收到 |
| 空串解绑 | `setInput({'p1.a': ''})` → 同一事件 `defaultPrevented === false`，恢复后重新生效 |
| 即时存档 | GBA 388 KiB、GB 70 KiB，`saveState → 按键推进 → loadState` 往返成功 |
| SRAM 持久化 | `mgba/<sha1>/sram.bin` 32 KiB，**整页刷新后仍在** |
| zip | `acid2.zip` 解包后被识别为 DMG，正常启动 |
| 体积 | 应用 JS 36.9 kB gzip + 内核胶水 67 kB + `mgba.wasm` 791 kB |

**M0 踩到的坑（已固化进代码，后续不要再踩）**

1. **wasm 产物必须独立托管**：SDK 内部用 `new URL('./mgba.js', import.meta.url)` 定位资源，经 Vite 预打包后该路径失效。现由 `scripts/copy-wasm.mjs` 把 `mgba.js` + `mgba.wasm` 拷到 `public/mgba/`（已入库），再通过 `jsUrl` / `wasmUrl` 显式传入（`predev` / `prebuild` / `postinstall` 三个钩子都挂了）。
2. **上游类型声明已漂移**：`@wasm-gaming/mgba-wasm@0.1.1` 的 `.d.ts` 从 `@wasm-gaming/engine-specs` 导入 `EngineInstance`，而该包 0.3.2 并不导出它。`skipLibCheck` 会把它降级成 `any`，所以我们在 `core/types.ts` 自定义 `MgbaEngine` 接口收口，业务层不接触 `any`。
3. **`--mgba-aspect` 在首帧才写入**：启动瞬间 `getComputedStyle` 读到空值，需在 `frame` 回调里按节流补读。
4. **无电池存档的 ROM 不会产生 `sram.bin`**：`cloneSram()` 在 SRAM 为 0 字节时直接跳过，属预期行为。自检文案已区分，避免把 acid2 这类测试 ROM 误判为失败。
5. **`buildKeymap` 每次全量重建**（`codeToBit = new Map()`），所以改键不会残留旧映射，空串解绑语义可靠。

### M1 · 骨架与外观

| ID | 任务 | 完成标准 |
|----|------|---------|
| T1.1 | 部署流水线 + 空页面上线 | GH Pages 可访问，刷新子路径资源不 404 |
| T1.2 | 外壳组件：`ShellGBA` / `ShellGBC` / `ShellDMG` + `ShellFrame` | 三款外壳按 ROM 自动切换，SVG 在 2× DPR 下无锯齿 |
| T1.3 | `Screen` + 滤镜（原色/DMG 绿/栅格/扫描线）+ 玻璃反光 | 滤镜切换实时生效且不掉帧 |
| T1.4 | 响应式布局 + 横屏适配 | 三个基准视口无溢出，桌面/移动均居中完整 |
| T1.5 | **双显示模式**：`ShellFrame` 支持 `:mode="full\|focus"` + `Screen` 尺寸切换 + 切换过渡与持久化 | 切换 < 1 帧、游戏不中断、画布不变形；focus 下只渲染上盖且与 full 视觉同源 |

### M2 · 输入与存档

| ID | 任务 | 完成标准 |
|----|------|---------|
| T2.1 | `InputManager` + 键盘映射持久化 | 重映射后立即生效，刷新后仍保留 |
| T2.2 | `KeymapEditor` UI（捕获/冲突/恢复默认） | 冲突给出提示，未映射项显示「未绑定」 |
| T2.3 | 外壳触控按钮（多点、按下反馈、防误触滚动） | 手机真机：十字+A 同按有效，长按不弹菜单 |
| T2.4 | 存档系统：OPFS SRAM、4 存档槽、`.sav` 导入导出 | 导出文件可被第三方模拟器读取；导入后重启内核存档生效 |
| T2.5 | **键位徽章 + 浮动触控层**：`KeyBadge` 实时反映映射、`FloatingPad` 在 focus 模式接管操作 | 改键后徽章立即更新；focus + 手机可正常通关，触控层不遮挡画面中心 |

### M3 · 完整体验与打磨

| ID | 任务 | 完成标准 |
|----|------|---------|
| T3.1 | 游戏库（IndexedDB 缓存 ROM）+ 最近游戏 + 删除 | 二次进入无需重新选文件 |
| T3.2 | 设置面板（显示/按键/声音/关于）+ 暂停遮罩 | 所有开关即时生效、状态持久化 |
| T3.3 | 首屏开机动画 + 空态/异常态/错误提示 | 无 ROM、坏 ROM、wasm 失败均有明确引导 |
| T3.4 | 性能与移动端真机回归 | 移动端稳定 60 FPS，无内存泄漏（连续换 5 个 ROM） |
| T3.6 | 预置游戏：`games/` 目录 + 按需清单 | 首屏零请求；游戏加到几十个不拖慢首屏；ROM 点击才下载；`GAMES=1` 才进产物 |
| T3.5 | README 使用说明 + 上线验收 | 线上链接可玩，README 含截图与操作说明 |

---

## 9. 已知限制

1. **不支持快进/慢放**：当前内核未暴露倍速接口（仅 `idleOptimization` 提速）。方案：v2 向上游提 API 或 fork。
2. **即时存档不可跨机型/跨内核版本**：`loadState` 严格校验字节长度。
3. **SGB 边框**：内核支持 SGB，但 v1 复用 DMG 外壳，不还原 SGB 外框。
4. 依赖 0.1.x 的新包，接口若发生破坏性变更需同步适配层（已隔离）。
5. **不做拖影（ghosting）**：需要每帧扣一份历史帧再叠加，移动端代价和收益不匹配；`像素锐化` 是与它互补的那一档。
6. **iPhone Safari 不支持元素级全屏**：全屏按钮在这种情况下不出现，用横屏 + 面板模式代替。

---

## 10. 决策记录

| # | 决策点 | 结论 | 状态 |
|---|--------|------|------|
| D1 | 内核 | `@wasm-gaming/mgba-wasm`，无需 COI，GitHub Pages 直跑；M0 冒烟不过再切 `@thenick775/mgba-wasm` + `coi-serviceworker` | ✅ 已定 |
| D2 | 前端栈 | **Vue 3.5 + `<script setup>` + Vite + TS**（理由见 §2.2.1）；`core/` 框架无关，决策可逆 | ✅ 已定 |
| D3 | ROM 缓存 | 默认开启 IndexedDB 缓存（「最近游戏」），设置里可关闭 + 一键清空 | ✅ 已定 |
| D4 | 强制换壳 / 皮肤换色 | v1 不做，v2 候选 | 默认按此执行 |
| D5 | 界面语言 | 中 / EN 双语，菜单顶部与 `设置 → 显示` 可切；自研 `t()` + 编译期键校验，不引 vue-i18n | ✅ 已实现 |
| D7 | 内核依赖形态 | 产物落地到 `public/mgba/` 并入库，运行时只走本站相对路径，**无 CDN / 无远程回退** | ✅ 已定 |
| D6 | **双显示模式** | `完整`（整壳 + 按键旁键位徽章）/ `特写`（仅上盖屏幕，沉浸）；同一组件按 `data-mode` 切换，焦点模式在移动端自动启用浮动触控层 | ✅ 已定 |

---

## 11. 许可与合规

- 模拟器内核 mGBA 及其 wasm 封装为 **MPL-2.0**；分发时保留声明（关于页展示内核版本与许可）。
- 本项目**不下载、不分发任何 ROM**；用户拖入的文件只在浏览器本地内存/IndexedDB 中处理，不上传。`games/` 是开发者本地目录，已 `.gitignore`，构建默认不包含。
- 项目代码 MIT（见 `LICENSE`）。
