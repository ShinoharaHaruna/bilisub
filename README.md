# BiliSub - 哔哩哔哩字幕下载工具

## 📋 项目简介

BiliSub 是一个用于下载哔哩哔哩视频字幕的工具，支持 CLI 和浏览器插件两种使用方式。项目采用 Monorepo 架构，使用 Yarn Berry 作为包管理器。

## 🏗️ 项目结构

```bash
bilisub/
├── packages/
│   ├── cli/              # Go CLI 工具
│   └── userscript/       # 油猴脚本
├── .yarnrc.yml           # Yarn Berry 配置
├── package.json          # 工作区配置
└── README.md            # 项目文档
```

## 🚀 快速开始

### 安装依赖

```bash
yarn install
```

### 构建所有包

```bash
yarn build
```

### CLI 工具

```bash
cd packages/cli
yarn dev BV1AAqGBhEAW  # 运行CLI
```

### 浏览器插件

1. 构建脚本：`cd packages/userscript && yarn build`（内部使用 `tsc` 输出 `dist/bilisub.user.js`）
2. 在 Tampermonkey / Violentmonkey 中安装 `dist/bilisub.user.js`
3. 首次点击“下载字幕”时，如提示缺少 SESSDATA，按照弹出的指南复制命令，在控制台执行 `window.__BILISUB_SET_SESSDATA('粘贴值')` 保存登录态
4. 成功授权后，插件会自动定位当前分 P 并列出可用字幕，点击即可下载

## 📦 包说明

### @bilisub/cli

- **语言**: Go
- **功能**: 命令行下载字幕工具
- **构建**: `go build`

### @bilisub/userscript

- **语言**: TypeScript
- **功能**: 油猴脚本，在浏览器中直接下载字幕（内置 UI、SESSDATA 向导、BewlyBewly 兼容）
- **构建**: `yarn workspace @bilisub/userscript build`（等价于 `tsc && mv dist/main.js dist/bilisub.user.js`）

## 🛠️ 开发

### 工作区管理

- 使用 Yarn Berry PnP 模式
- 所有包共享依赖管理
- 统一构建和测试脚本

### 构建脚本

```bash
# 构建所有包
yarn build

# 开发模式
yarn dev

# 清理构建产物
yarn clean

# 运行测试
yarn test
```

## 🎯 功能特性

- ✅ 支持 AI 字幕和普通字幕
- ✅ 智能字幕选择（优先 AI 字幕）
- ✅ 浏览器一键下载
- ✅ CLI 批量处理
- ✅ TypeScript 类型安全
- ✅ Monorepo 架构

## 📋 API 说明

### 视频信息获取

```typescript
const videoInfo = await BilibiliAPI.getVideoInfo(bvid);
```

### 字幕列表获取

```typescript
const subtitles = await BilibiliAPI.getAvailableSubtitles(cid, bvid, sessdata);
```

### 字幕内容下载

```typescript
const subtitleContent = await BilibiliAPI.getSubtitle(subtitleURL);
```

## 🔐 登录凭证（SESSDATA）

- CLI：通过环境变量提供 Cookie，例如 `SESSDATA=xxx ./bilisub BVxxxx`
- Userscript：脚本无法读取 HttpOnly Cookie，需在浏览器 DevTools 中复制 `SESSDATA`，然后执行 `window.__BILISUB_SET_SESSDATA('粘贴值')`
- Tampermonkey 弹框来自跨域访问，脚本声明了 `@connect api.bilibili.com` 与 `@connect aisubtitle.hdslb.com`，请允许以完成字幕下载

## 🔧 技术栈

- **Go**: CLI 工具开发
- **TypeScript**: 类型安全的脚本开发
- **Vite**: 用户脚本打包
- **Yarn Berry**: 包管理和工作区
- **Tampermonkey**: 用户脚本运行时

## 📄 许可证

本项目采用 MIT 许可证。
