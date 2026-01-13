package model

// Page 分P信息
type Page struct {
	CID  int64  `json:"cid"`
	Page int    `json:"page"`
	Part string `json:"part"`
	// Duration 单位：秒
	Duration int `json:"duration"`
}

// VideoInfoResp 视频基础信息响应
type VideoInfoResp struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	TTL     int    `json:"ttl"`
	Data    struct {
		BVID  string `json:"bvid"`
		AID   int64  `json:"aid"`
		CID   int64  `json:"cid"`
		Title string `json:"title"`
		// Duration 单位：秒
		Duration int    `json:"duration"`
		Pages    []Page `json:"pages"`
	} `json:"data"`
}

// PlayerConfigResp 播放器配置响应
type PlayerConfigResp struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	TTL     int    `json:"ttl"`
	Data    struct {
		Subtitle struct {
			AllowSubmit bool           `json:"allow_submit"`
			Lan         string         `json:"lan"`
			LanDoc      string         `json:"lan_doc"`
			Subtitles   []SubtitleItem `json:"subtitles"`
		} `json:"subtitle"`
	} `json:"data"`
}

// SubtitleItem 字幕项
type SubtitleItem struct {
	ID          int64  `json:"id"`
	Lan         string `json:"lan"`
	LanDoc      string `json:"lan_doc"`
	IsLock      bool   `json:"is_lock"`
	SubtitleURL string `json:"subtitle_url"`
	Type        int    `json:"type"`
	IDStr       string `json:"id_str"`
	AIType      int    `json:"ai_type"`
	AIStatus    int    `json:"ai_status"`
}

// SubtitleLine 单行字幕
type SubtitleLine struct {
	From     float64 `json:"from"`
	To       float64 `json:"to"`
	SID      int     `json:"sid"`
	Location int     `json:"location"`
	Content  string  `json:"content"`
	Music    float64 `json:"music"`
}

// Subtitle 字幕文件结构体
type Subtitle struct {
	FontSize        float64        `json:"font_size"`
	FontColor       string         `json:"font_color"`
	BackgroundAlpha float64        `json:"background_alpha"`
	BackgroundColor string         `json:"background_color"`
	Stroke          string         `json:"Stroke"`
	Type            string         `json:"type"`
	Lang            string         `json:"lang"`
	Version         string         `json:"version"`
	Body            []SubtitleLine `json:"body"`
}
