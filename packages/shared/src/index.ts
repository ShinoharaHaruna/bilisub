// B站视频信息接口
export interface VideoInfo {
  bvid: string;
  title: string;
  cid: number;
  duration: number;
  pages: Page[];
}

// 分P信息
export interface Page {
  cid: number;
  page: number;
  part: string;
  duration: number;
}

// 字幕数据结构
export interface Subtitle {
  body: SubtitleLine[];
}

export interface SubtitleLine {
  content: string;
  from: number;
  to: number;
}

// API 响应类型
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// B站 API 响应类型
export interface VideoInfoResp {
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

export interface PlayerConfigResp {
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

export interface SubtitleItem {
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

export interface BilibiliSubtitle {
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

export interface BilibiliSubtitleLine {
  from: number;
  to: number;
  sid: number;
  location: number;
  content: string;
  music: number;
}

// 工具函数
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export function extractBVID(input: string): string {
  const match = input.match(/BV[a-zA-Z0-9]+/);
  return match ? match[0] : "";
}

// B站 API 客户端
export class BilibiliAPI {
  private static readonly BASE_URL = "https://api.bilibili.com";
  private static readonly USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

  // 获取视频信息
  static async getVideoInfo(bvid: string): Promise<VideoInfo> {
    const url = `${this.BASE_URL}/x/web-interface/view?bvid=${bvid}`;

    const response = await this.fetchWithHeaders(url);
    const data: VideoInfoResp = await response.json();

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

  // 获取字幕URL
  static async getSubtitleURL(
    cid: number,
    bvid: string,
    sessdata?: string
  ): Promise<SubtitleItem> {
    const url = `${this.BASE_URL}/x/player/v2?cid=${cid}&bvid=${bvid}`;

    const headers: Record<string, string> = {
      "User-Agent": this.USER_AGENT,
      Referer: "https://www.bilibili.com",
    };

    if (sessdata) {
      headers["Cookie"] = `SESSDATA=${sessdata}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`请求失败，状态码：${response.status}`);
    }

    const data: PlayerConfigResp = await response.json();

    if (data.code !== 0) {
      throw new Error(`API错误: ${data.message}`);
    }

    // 优先选择AI中文字幕，如果没有，选择其他中文字幕
    let selectedSub: SubtitleItem | undefined;

    for (const sub of data.data.subtitle.subtitles) {
      if (sub.lan === "ai-zh" && !selectedSub) {
        selectedSub = sub;
        break; // 优先AI字幕
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

  // 获取字幕内容
  static async getSubtitle(subtitleURL: string): Promise<BilibiliSubtitle> {
    const url = subtitleURL.startsWith("//")
      ? `https:${subtitleURL}`
      : subtitleURL;

    const response = await this.fetchWithHeaders(url);
    const data: BilibiliSubtitle = await response.json();

    return data;
  }

  // 获取完整字幕信息
  static async getSubtitleFromCID(
    cid: number,
    bvid: string,
    sessdata?: string
  ): Promise<BilibiliSubtitle> {
    const subtitleItem = await this.getSubtitleURL(cid, bvid, sessdata);
    return this.getSubtitle(subtitleItem.subtitle_url);
  }

  // 获取所有可用字幕
  static async getAvailableSubtitles(
    cid: number,
    bvid: string,
    sessdata?: string
  ): Promise<SubtitleItem[]> {
    const url = `${this.BASE_URL}/x/player/v2?cid=${cid}&bvid=${bvid}`;

    const headers: Record<string, string> = {
      "User-Agent": this.USER_AGENT,
      Referer: "https://www.bilibili.com",
    };

    if (sessdata) {
      headers["Cookie"] = `SESSDATA=${sessdata}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`请求失败，状态码：${response.status}`);
    }

    const data: PlayerConfigResp = await response.json();

    if (data.code !== 0) {
      throw new Error(`API错误: ${data.message}`);
    }

    return data.data.subtitle.subtitles;
  }

  private static async fetchWithHeaders(url: string): Promise<Response> {
    return fetch(url, {
      headers: {
        "User-Agent": this.USER_AGENT,
        Referer: "https://www.bilibili.com",
      },
    });
  }
}
