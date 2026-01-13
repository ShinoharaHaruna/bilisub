# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

bilisub 是一个用于从 B站（Bilibili）视频下载字幕的 Go 命令行工具。它通过 BV 号或视频链接获取视频的中文字幕并保存为文本文件。

## 开发命令

### 构建

```bash
go build -o bilisub main.go
```

### 运行

```bash
# 使用 BV 号
./bilisub BV1xx411c7mD

# 使用视频链接（程序会自动提取 BV 号）
./bilisub https://www.bilibili.com/video/BV1xx411c7mD
```

### 环境变量

- `SESSDATA`: 可选的 Bilibili Cookie 值，用于访问需要登录的字幕资源

## 代码架构

项目采用标准的 Go 项目结构，分为三个主要包：

### 核心流程

1. **BV 号提取与验证** - 使用正则表达式从输入中提取 BV 号
2. **视频信息获取** - 调用 Bilibili API 获取 CID、分P信息和标题
3. **字幕候选策略** - 尝试多个 CID（主视频 + 各分P），优先使用成功的字幕
4. **字幕选择** - 优先选择 AI 中文字幕（`ai-zh`），其次选择其他中文字幕
5. **文件输出** - 将字幕内容纯文本化，输出到 `output/` 目录

### 包结构

- **pkg/api**: 与 Bilibili API 交互
  - `GetCID()`: 获取视频基础信息和分P列表
  - `GetSubtitleURL()`: 获取字幕下载链接，优先选择 AI 中文字幕
  - `GetSubtitleFromCID()`: 通过 CID 获取字幕内容
  - 所有请求都设置 User-Agent 和 Referer 头

- **pkg/model**: 数据结构定义
  - `VideoInfoResp`: 视频信息响应结构
  - `PlayerConfigResp`: 播放器配置响应结构
  - `Subtitle`: 字幕文件结构，包含时间轴和文本内容
  - `SubtitleLine`: 单行字幕，包含时间戳（From/To）和内容

- **pkg/utils**: 工具函数
  - `SanitizeFilename()`: 清理文件名，移除非法字符

### 字幕处理逻辑

- 程序会创建候选列表：主视频（P1）+ 所有分P
- 按顺序尝试每个候选的 CID，直到成功获取字幕
- 输出文件名格式：`{BV号}_{标题}_{分P标签}.txt`
- 只保存字幕文本内容，去除时间轴信息

## API 端点

- 视频信息：`https://api.bilibili.com/x/web-interface/view?bvid={bvid}`
- 播放器配置：`https://api.bilibili.com/x/player/v2?cid={cid}&bvid={bvid}`
