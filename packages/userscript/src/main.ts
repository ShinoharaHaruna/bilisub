// ==UserScript==
// @name         BiliSub - 哔哩哔哩字幕下载工具
// @namespace    https://github.com/ShinoharaHaruna/bilisub
// @version      1.0.0
// @description  在哔哩哔哩页面直接下载字幕，支持AI字幕和普通字幕
// @author       Shinohara Haruna
// @match        *://*.bilibili.com/video/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      api.bilibili.com
// @connect      aisubtitle.hdslb.com
// ==/UserScript==

declare function GM_setValue(key: string, value: string): void;
declare function GM_getValue<T = unknown>(
  key: string,
  defaultValue?: T
): T | undefined;
declare const unsafeWindow: Window & typeof globalThis;
declare function GM_xmlhttpRequest(details: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  responseType?: "json" | "text";
  timeout?: number;
  onload?: (response: GMXMLHttpRequestResponse) => void;
  onerror?: (response: GMXMLHttpRequestResponse) => void;
  ontimeout?: (response: GMXMLHttpRequestResponse) => void;
}): void;

interface GMXMLHttpRequestResponse {
  status: number;
  responseText: string;
  statusText: string;
}

// 内联共享代码，避免外部依赖
interface VideoInfo {
  bvid: string;
  title: string;
  cid: number;
  duration: number;
  pages: Page[];
}

interface Page {
  cid: number;
  page: number;
  part: string;
  duration: number;
}

interface SubtitleItem {
  id: number;
  lan: string;
  lan_doc: string;
  is_lock: boolean;
  subtitle_url: string;
  type: number;
  id_str: string;
  ai_type: number;
  ai_status: number;
}

interface BilibiliSubtitle {
  font_size: number;
  font_color: string;
  background_alpha: number;
  background_color: string;
  stroke: string;
  type: string;
  lang: string;
  version: string;
  body: BilibiliSubtitleLine[];
}

interface BilibiliSubtitleLine {
  from: number;
  to: number;
  sid: number;
  location: number;
  content: string;
  music: number;
}

interface VideoInfoResp {
  code: number;
  message: string;
  ttl: number;
  data: {
    bvid: string;
    aid: number;
    cid: number;
    title: string;
    duration: number;
    pages: Page[];
  };
}

interface PlayerConfigResp {
  code: number;
  message: string;
  ttl: number;
  data: {
    subtitle: {
      allow_submit: boolean;
      lan: string;
      lan_doc: string;
      subtitles: SubtitleItem[];
    };
  };
}

// 工具函数
function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*]/g, "_").trim();
}

function extractBVID(input: string): string {
  const match = input.match(/BV[a-zA-Z0-9]+/);
  return match ? match[0] : "";
}

// B站 API 客户端
class BilibiliAPI {
  private static readonly BASE_URL = "https://api.bilibili.com";
  private static readonly USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

  static async getVideoInfo(bvid: string): Promise<VideoInfo> {
    const url = `${this.BASE_URL}/x/web-interface/view?bvid=${bvid}`;

    const data = await this.requestJson<VideoInfoResp>(url);

    if (data.code !== 0) {
      throw new Error(`API错误: ${data.message}`);
    }

    return {
      bvid: data.data.bvid,
      title: data.data.title,
      cid: data.data.cid,
      duration: data.data.duration,
      pages: data.data.pages,
    };
  }

  static async getSubtitleURL(
    cid: number,
    bvid: string,
    sessdata?: string
  ): Promise<SubtitleItem> {
    const url = `${this.BASE_URL}/x/player/v2?cid=${cid}&bvid=${bvid}`;

    const data = await this.requestJson<PlayerConfigResp>(url, sessdata);

    if (data.code !== 0) {
      throw new Error(`API错误: ${data.message}`);
    }

    let selectedSub: SubtitleItem | undefined;

    for (const sub of data.data.subtitle.subtitles) {
      if (sub.lan === "ai-zh" && !selectedSub) {
        selectedSub = sub;
        break;
      } else if (sub.lan_doc.includes("中文") && !selectedSub) {
        selectedSub = sub;
      }
    }

    if (!selectedSub) {
      throw new Error("未找到中文字幕");
    }

    console.log(
      `选择字幕: lan=${selectedSub.lan}, lan_doc=${selectedSub.lan_doc}`
    );
    return selectedSub;
  }

  static async getSubtitle(subtitleURL: string): Promise<BilibiliSubtitle> {
    const url = subtitleURL.startsWith("//")
      ? `https:${subtitleURL}`
      : subtitleURL;

    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise<BilibiliSubtitle>((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          headers: {
            "User-Agent": this.USER_AGENT,
            Referer: "https://www.bilibili.com",
            Accept: "application/json",
          },
          responseType: "text",
          onload: (response) => {
            if (response.status >= 200 && response.status < 300) {
              try {
                const parsed = JSON.parse(response.responseText);
                resolve(parsed);
              } catch (error) {
                reject(error);
              }
            } else {
              reject(
                new Error(
                  `请求失败，状态码：${response.status} ${response.statusText}`
                )
              );
            }
          },
          onerror: (response) => {
            reject(
              new Error(
                `请求失败，状态码：${response.status} ${
                  response.statusText || ""
                }`.trim()
              )
            );
          },
          ontimeout: () => {
            reject(new Error("请求超时"));
          },
        });
      });
    }

    const response = await this.fetchWithHeaders(url);
    const data: BilibiliSubtitle = await response.json();

    return data;
  }

  static async getAvailableSubtitles(
    cid: number,
    bvid: string,
    sessdata?: string
  ): Promise<SubtitleItem[]> {
    const url = `${this.BASE_URL}/x/player/v2?cid=${cid}&bvid=${bvid}`;

    console.log(
      "Fetching subtitles for cid:",
      cid,
      "bvid:",
      bvid,
      "sessdata present:",
      !!sessdata
    );

    const data = await this.requestJson<PlayerConfigResp>(url, sessdata);
    console.log("API response:", data);

    if (data.code !== 0) {
      console.log("API error, code:", data.code, "message:", data.message);
      throw new Error(`API错误: ${data.message}`);
    }

    console.log("Subtitles:", data.data.subtitle.subtitles);
    return data.data.subtitle.subtitles;
  }

  private static async fetchWithHeaders(url: string): Promise<Response> {
    return fetch(url, {
      headers: {
        "User-Agent": this.USER_AGENT,
        Referer: "https://www.bilibili.com",
      },
      credentials: "include",
    });
  }

  private static async requestJson<T>(
    url: string,
    sessdata?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      "User-Agent": this.USER_AGENT,
      Referer: "https://www.bilibili.com",
      Accept: "application/json",
    };

    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise<T>((resolve, reject) => {
        const gmHeaders = { ...headers };
        if (sessdata) {
          gmHeaders["Cookie"] = `SESSDATA=${sessdata}`;
        }

        GM_xmlhttpRequest({
          method: "GET",
          url,
          headers: gmHeaders,
          responseType: "text",
          onload: (response) => {
            if (response.status >= 200 && response.status < 300) {
              try {
                const parsed = JSON.parse(response.responseText) as T;
                resolve(parsed);
              } catch (error) {
                reject(error);
              }
            } else {
              reject(
                new Error(
                  `请求失败，状态码：${response.status} ${response.statusText}`
                )
              );
            }
          },
          onerror: (response) => {
            reject(
              new Error(
                `请求失败，状态码：${response.status} ${
                  response.statusText || ""
                }`.trim()
              )
            );
          },
          ontimeout: () => {
            reject(new Error("请求超时"));
          },
        });
      });
    }

    const response = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`请求失败，状态码：${response.status}`);
    }

    return (await response.json()) as T;
  }
}

class BiliSub {
  private videoInfo: VideoInfo | null = null;
  private bvid: string = "";
  private cid: number = 0;
  private sessdata: string | undefined;
  private downloadBtn: HTMLElement | null = null;
  private readonly sessdataStorageKey = "bilisub_sessdata";
  private readonly pageWindow: Window & typeof globalThis;
  private subtitlePanel: HTMLElement | null = null;
  private subtitleTracksContainer: HTMLElement | null = null;
  private subtitleTimelineContainer: HTMLElement | null = null;
  private actionDownloadBtn: HTMLButtonElement | null = null;
  private actionSummaryBtn: HTMLButtonElement | null = null;
  private subtitleCache: Map<string, BilibiliSubtitle> = new Map();
  private availableSubtitles: SubtitleItem[] = [];
  private currentSubtitleItem: SubtitleItem | null = null;
  private currentSubtitleData: BilibiliSubtitle | null = null;

  constructor() {
    this.pageWindow =
      typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    this.registerSessdataBridge();
    this.init();
  }

  private async init() {
    console.log("BiliSub 初始化中...");

    this.bvid = extractBVID(window.location.href);
    if (!this.bvid) {
      console.error("无法获取BV号");
      return;
    }

    this.sessdata = this.getSessdata();
    console.log("Sessdata found:", !!this.sessdata);

    const p = this.getCurrentP();
    try {
      this.videoInfo = await BilibiliAPI.getVideoInfo(this.bvid);
      this.cid = p
        ? this.videoInfo.pages[p - 1]?.cid || this.videoInfo.cid
        : this.videoInfo.cid;
      console.log("Current p:", p, "cid set to:", this.cid);
    } catch (error) {
      console.error("获取视频信息失败:", error);
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setupUI());
    } else {
      this.setupUI();
    }

    // 每 2 秒检查一次按钮是否存在，如果不存在则重新添加
    setInterval(() => {
      this.setupUI();
    }, 2000);
  }

  private getSessdata(): string | undefined {
    const stored = this.getStoredSessdata();
    if (stored) {
      console.log("Using stored SESSDATA");
      return stored;
    }

    console.log("All cookies:", document.cookie);
    const cookies = document.cookie.split(";").map((c) => c.trim().split("="));
    const sessdata = cookies.find(([name]) => name === "SESSDATA")?.[1];
    console.log("SESSDATA:", sessdata);
    return sessdata;
  }

  private getStoredSessdata(): string | undefined {
    try {
      if (typeof GM_getValue === "function") {
        const value = GM_getValue<string | undefined>(
          this.sessdataStorageKey,
          undefined
        );
        if (value) {
          return value;
        }
      }
    } catch (error) {
      console.warn("读取 GM 存储失败:", error);
    }

    const fallback = localStorage.getItem(this.sessdataStorageKey);
    return fallback ?? undefined;
  }

  private saveSessdata(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error("SESSDATA 不能为空");
    }

    try {
      if (typeof GM_setValue === "function") {
        GM_setValue(this.sessdataStorageKey, normalized);
      } else {
        localStorage.setItem(this.sessdataStorageKey, normalized);
      }
    } catch (error) {
      console.error("保存 SESSDATA 失败:", error);
      throw error;
    }
  }

  private registerSessdataBridge() {
    (this.pageWindow as any).__BILISUB_SET_SESSDATA = (value: string) => {
      if (!value) {
        this.showToast("未输入 SESSDATA，已取消保存。");
        return;
      }

      try {
        this.saveSessdata(value);
        this.sessdata = value.trim();
        this.showToast("SESSDATA 已保存，请重新点击下载按钮。");
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.showToast("保存 SESSDATA 失败: " + errMsg);
      }
    };
  }

  private promptSessdataGuide() {
    const existing = document.getElementById("bilisub-sessdata-guide");
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement("div");
    overlay.id = "bilisub-sessdata-guide";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
      width: min(480px, 90vw);
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      padding: 24px;
      color: #222;
    `;

    const title = document.createElement("h3");
    title.textContent = "设置 SESSDATA 以下载字幕";
    title.style.cssText = "margin: 0 0 12px;font-size:18px;";

    const desc = document.createElement("ol");
    desc.style.cssText = "margin:0 0 16px 16px;padding:0;line-height:1.6;";
    desc.innerHTML = `
      <li>打开 DevTools → Application → Cookies → https://www.bilibili.com</li>
      <li>找到名为 <strong>SESSDATA</strong> 的条目，复制 Value</li>
      <li>在控制台执行下面这条命令，并把复制的值粘贴到引号里</li>
    `;

    const command = "window.__BILISUB_SET_SESSDATA('在此粘贴 SESSDATA');";

    const textarea = document.createElement("textarea");
    textarea.value = command;
    textarea.readOnly = true;
    textarea.style.cssText = `
      width: 100%;
      min-height: 80px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 10px;
      resize: none;
      background: #f7f7f7;
      color: #333;
      box-sizing: border-box;
      margin-bottom: 12px;
    `;

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:12px;justify-content:flex-end;";

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "复制命令";
    copyBtn.style.cssText =
      "padding:8px 16px;border:none;border-radius:6px;background:#00aeec;color:#fff;cursor:pointer;";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(command);
        copyBtn.textContent = "已复制";
        setTimeout(() => (copyBtn.textContent = "复制命令"), 1500);
      } catch {
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        copyBtn.textContent = "已复制";
        setTimeout(() => (copyBtn.textContent = "复制命令"), 1500);
      }
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "知道了";
    closeBtn.style.cssText =
      "padding:8px 16px;border:none;border-radius:6px;background:#666;color:#fff;cursor:pointer;";
    closeBtn.addEventListener("click", () => overlay.remove());

    btnRow.appendChild(copyBtn);
    btnRow.appendChild(closeBtn);
    panel.appendChild(title);
    panel.appendChild(desc);
    panel.appendChild(textarea);
    panel.appendChild(btnRow);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    console.log(
      "[BiliSub] 控制台命令：window.__BILISUB_SET_SESSDATA('在此粘贴 SESSDATA');"
    );
  }

  private ensureSessdataAvailable(): boolean {
    if (this.sessdata) {
      return true;
    }

    const stored = this.getStoredSessdata();
    if (stored) {
      this.sessdata = stored;
      return true;
    }

    return false;
  }

  private showToast(message: string) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 18px;
      background: rgba(0,0,0,0.8);
      color: #fff;
      border-radius: 999px;
      font-size: 14px;
      z-index: 1000000;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  }

  private getCurrentP(): number | null {
    const url = new URL(window.location.href);
    const p = url.searchParams.get("p");
    return p ? parseInt(p) : null;
  }

  private setupUI() {
    // 检查按钮是否已存在
    if (this.downloadBtn && document.contains(this.downloadBtn)) {
      return;
    }

    this.downloadBtn = this.createDownloadButtonWrap();

    // 插入到工具栏左侧主区域
    const targetElement = document.querySelector(".video-toolbar-left-main");
    if (targetElement) {
      targetElement.appendChild(this.downloadBtn);
    } else {
      // 备用：固定定位到右上角
      document.body.appendChild(this.downloadBtn);
    }
  }

  private createDownloadButtonWrap(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "toolbar-left-item-wrap";

    const button = document.createElement("div");
    button.title = "字幕面板";
    button.className = "video-download video-toolbar-left-item";
    button.addEventListener("click", () => this.toggleSubtitlePanel());

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("width", "28");
    icon.setAttribute("height", "28");
    icon.setAttribute("viewBox", "0 0 28 28");
    icon.setAttribute("class", "video-download-icon video-toolbar-item-icon");
    icon.innerHTML =
      '<path d="M14 2C7.37 2 2 7.37 2 14s5.37 12 12 12 12-5.37 12-12S20.63 2 14 2zm-1 16l-4-4h3V9h2v5h3l-4 4z" fill="currentColor"/>';

    const text = document.createElement("span");
    text.className = "video-download-info video-toolbar-item-text";
    text.textContent = "字幕";

    button.appendChild(icon);
    button.appendChild(text);
    wrap.appendChild(button);

    return wrap;
  }

  private async toggleSubtitlePanel() {
    if (!this.ensureSessdataAvailable()) {
      this.promptSessdataGuide();
      return;
    }

    if (!this.subtitlePanel) {
      this.createSubtitlePanel();
    }

    if (!this.subtitlePanel) {
      return;
    }

    const isVisible = this.subtitlePanel.classList.contains(
      "bilisub-panel-visible"
    );

    if (isVisible) {
      this.subtitlePanel.classList.remove("bilisub-panel-visible");
      return;
    }

    this.subtitlePanel.classList.add("bilisub-panel-visible");
    await this.loadSubtitlePanelData();
  }

  private createSubtitlePanel() {
    this.ensurePanelStyles();

    const panel = document.createElement("div");
    panel.id = "bilisub-panel";
    panel.className = "bilisub-panel";

    const header = document.createElement("div");
    header.className = "bilisub-panel-header";

    const title = document.createElement("span");
    title.textContent = "字幕";

    const actions = document.createElement("div");
    actions.className = "bilisub-panel-actions";

    this.actionSummaryBtn = document.createElement("button");
    this.actionSummaryBtn.textContent = "AI 总结";
    this.actionSummaryBtn.addEventListener("click", () =>
      this.showSummaryPlaceholder()
    );

    this.actionDownloadBtn = document.createElement("button");
    this.actionDownloadBtn.textContent = "下载";
    this.actionDownloadBtn.addEventListener("click", () =>
      this.downloadCurrentSubtitle()
    );

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "bilisub-close-btn";
    closeBtn.addEventListener("click", () => {
      panel.classList.remove("bilisub-panel-visible");
    });

    actions.appendChild(this.actionSummaryBtn);
    actions.appendChild(this.actionDownloadBtn);
    actions.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(actions);

    const content = document.createElement("div");
    content.className = "bilisub-panel-content";

    this.subtitleTracksContainer = document.createElement("div");
    this.subtitleTracksContainer.className = "bilisub-tracks";

    this.subtitleTimelineContainer = document.createElement("div");
    this.subtitleTimelineContainer.className = "bilisub-timeline";

    content.appendChild(this.subtitleTracksContainer);
    content.appendChild(this.subtitleTimelineContainer);

    panel.appendChild(header);
    panel.appendChild(content);

    document.body.appendChild(panel);
    this.subtitlePanel = panel;
  }

  private ensurePanelStyles() {
    if (document.getElementById("bilisub-panel-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "bilisub-panel-styles";
    style.textContent = `
      .bilisub-panel {
        position: fixed;
        top: 90px;
        right: 24px;
        width: 360px;
        height: min(70vh, 520px);
        background: rgba(19, 21, 25, 0.96);
        color: #f5f5f5;
        border-radius: 16px;
        box-shadow: 0 24px 50px rgba(0, 0, 0, 0.35);
        transform: translateX(110%);
        opacity: 0;
        transition: transform 0.25s ease, opacity 0.25s ease;
        display: flex;
        flex-direction: column;
        z-index: 1000000;
        backdrop-filter: blur(10px);
      }
      .bilisub-panel-visible {
        transform: translateX(0);
        opacity: 1;
      }
      .bilisub-panel-header {
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 16px;
        font-weight: 600;
      }
      .bilisub-panel-actions button {
        margin-left: 8px;
        background: rgba(255, 255, 255, 0.08);
        border: none;
        color: #fff;
        border-radius: 999px;
        padding: 6px 14px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.2s ease;
      }
      .bilisub-panel-actions button:hover {
        background: rgba(255, 255, 255, 0.18);
      }
      .bilisub-close-btn {
        font-size: 18px;
        line-height: 1;
      }
      .bilisub-panel-content {
        flex: 1;
        display: grid;
        grid-template-columns: 140px 1fr;
        overflow: hidden;
      }
      .bilisub-tracks {
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        padding: 12px;
        overflow-y: auto;
      }
      .bilisub-track-item {
        display: block;
        width: 100%;
        padding: 10px 12px;
        margin-bottom: 8px;
        border-radius: 10px;
        border: 1px solid transparent;
        background: rgba(255, 255, 255, 0.05);
        color: inherit;
        text-align: left;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s ease;
      }
      .bilisub-track-item:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .bilisub-track-item.active {
        border-color: #00aeec;
        background: rgba(0, 174, 236, 0.15);
      }
      .bilisub-timeline {
        padding: 12px 18px 18px;
        overflow-y: auto;
      }
      .bilisub-line {
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .bilisub-line-time {
        font-size: 12px;
        color: #8aa0b8;
        margin-bottom: 4px;
        letter-spacing: 0.5px;
      }
      .bilisub-line-text {
        font-size: 14px;
        line-height: 1.5;
        color: #f2f2f2;
      }
      .bilisub-empty {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
        text-align: center;
        margin-top: 20px;
      }
    `;

    document.head.appendChild(style);
  }

  private async loadSubtitlePanelData() {
    if (!this.subtitleTracksContainer || !this.subtitleTimelineContainer) {
      return;
    }

    this.subtitleTracksContainer.innerHTML =
      '<div class="bilisub-empty">加载字幕列表...</div>';

    const subtitles = await this.getSubtitleList();

    if (subtitles.length === 0) {
      this.subtitleTracksContainer.innerHTML =
        '<div class="bilisub-empty">未找到可用字幕</div>';
      this.subtitleTimelineContainer.innerHTML =
        '<div class="bilisub-empty">无法展示字幕内容</div>';
      return;
    }

    this.renderSubtitleTracks(subtitles);

    const defaultSubtitle =
      this.currentSubtitleItem ??
      subtitles.find((s) => s.lan === "ai-zh") ??
      subtitles[0];

    await this.selectSubtitleTrack(defaultSubtitle);
  }

  private renderSubtitleTracks(subtitles: SubtitleItem[]) {
    if (!this.subtitleTracksContainer) {
      return;
    }

    this.subtitleTracksContainer.innerHTML = "";

    subtitles.forEach((subtitle) => {
      const button = document.createElement("button");
      button.className = "bilisub-track-item";

      const isAI = subtitle.lan === "ai-zh";
      button.textContent = `${subtitle.lan_doc || subtitle.lan}${
        isAI ? " · AI" : ""
      }`;

      if (this.currentSubtitleItem?.id === subtitle.id) {
        button.classList.add("active");
      }

      button.addEventListener("click", () =>
        this.selectSubtitleTrack(subtitle)
      );
      this.subtitleTracksContainer?.appendChild(button);
    });
  }

  private async selectSubtitleTrack(subtitle: SubtitleItem) {
    this.currentSubtitleItem = subtitle;

    if (this.subtitleTracksContainer) {
      this.subtitleTracksContainer
        .querySelectorAll(".bilisub-track-item")
        .forEach((el) => {
          const button = el as HTMLButtonElement;
          const isTarget =
            button.textContent ===
            `${subtitle.lan_doc || subtitle.lan}${
              subtitle.lan === "ai-zh" ? " · AI" : ""
            }`;
          button.classList.toggle("active", isTarget);
        });
    }

    if (this.subtitleTimelineContainer) {
      this.subtitleTimelineContainer.innerHTML =
        '<div class="bilisub-empty">加载字幕内容...</div>';
    }

    const cacheKey = subtitle.subtitle_url;
    if (this.subtitleCache.has(cacheKey)) {
      this.currentSubtitleData = this.subtitleCache.get(cacheKey)!;
      this.renderSubtitleTimeline();
      return;
    }

    try {
      const data = await BilibiliAPI.getSubtitle(subtitle.subtitle_url);
      this.subtitleCache.set(cacheKey, data);
      this.currentSubtitleData = data;
      this.renderSubtitleTimeline();
    } catch (error) {
      console.error("加载字幕失败:", error);
      if (this.subtitleTimelineContainer) {
        this.subtitleTimelineContainer.innerHTML =
          '<div class="bilisub-empty">加载失败，请重试</div>';
      }
    }
  }

  private renderSubtitleTimeline() {
    if (!this.subtitleTimelineContainer) {
      return;
    }

    if (!this.currentSubtitleData || !this.currentSubtitleData.body.length) {
      this.subtitleTimelineContainer.innerHTML =
        '<div class="bilisub-empty">暂无字幕内容</div>';
      return;
    }

    this.subtitleTimelineContainer.innerHTML = "";
    const fragment = document.createDocumentFragment();

    this.currentSubtitleData.body.forEach((line) => {
      const row = document.createElement("div");
      row.className = "bilisub-line";

      const time = document.createElement("div");
      time.className = "bilisub-line-time";
      time.textContent = `${this.formatTime(line.from)} → ${this.formatTime(
        line.to
      )}`;

      const text = document.createElement("div");
      text.className = "bilisub-line-text";
      text.textContent = line.content.trim() || "（空）";

      row.appendChild(time);
      row.appendChild(text);
      fragment.appendChild(row);
    });

    this.subtitleTimelineContainer.appendChild(fragment);
  }

  private formatTime(seconds: number): string {
    const totalSeconds = Math.floor(seconds);
    const mins = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  }

  private async downloadCurrentSubtitle() {
    if (!this.videoInfo) {
      alert("获取视频信息失败");
      return;
    }

    if (!this.currentSubtitleItem || !this.currentSubtitleData) {
      this.showToast("请先选择一个字幕轨道");
      return;
    }

    try {
      const content = this.formatSubtitleContent(this.currentSubtitleData);
      if (!content) {
        alert("该字幕轨道暂无内容");
        return;
      }

      const filename = `${sanitizeFilename(this.videoInfo.title)}_${
        this.currentSubtitleItem.lan_doc || this.currentSubtitleItem.lan
      }.txt`;
      this.downloadFile(filename, content);
      this.showToast("字幕下载完成");
    } catch (error) {
      console.error("下载字幕失败:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert("下载字幕失败: " + errorMessage);
    }
  }

  private showSummaryPlaceholder() {
    this.showToast("AI 总结开发中，敬请期待");
  }

  private async getVideoInfo(): Promise<VideoInfo | null> {
    try {
      return await BilibiliAPI.getVideoInfo(this.bvid);
    } catch (error) {
      console.error("获取视频信息失败:", error);
      return null;
    }
  }

  private async getSubtitleList(): Promise<SubtitleItem[]> {
    try {
      const list = await BilibiliAPI.getAvailableSubtitles(
        this.cid,
        this.bvid,
        this.sessdata
      );
      this.availableSubtitles = list;
      return list;
    } catch (error) {
      console.error("获取字幕列表失败:", error);
      return [];
    }
  }

  private formatSubtitleContent(subtitle: BilibiliSubtitle): string {
    if (!subtitle.body || subtitle.body.length === 0) {
      return "";
    }

    return subtitle.body
      .map((line) => line.content.trim())
      .filter((content) => content !== "")
      .join("\n");
  }

  private downloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }
}

new BiliSub();
