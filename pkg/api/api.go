package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"bilisub/pkg/model"
)

const BaseURL = "https://api.bilibili.com"

// GetCID 通过BV号获取视频的CID、分P信息和标题
func GetCID(bvid string) (int64, []model.Page, string, int, error) {
	url := fmt.Sprintf("%s/x/web-interface/view?bvid=%s", BaseURL, bvid)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, nil, "", 0, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, "", 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return 0, nil, "", 0, errors.New("请求失败，状态码：" + resp.Status)
	}

	var videoResp model.VideoInfoResp
	if err := json.NewDecoder(resp.Body).Decode(&videoResp); err != nil {
		return 0, nil, "", 0, err
	}

	if videoResp.Code != 0 {
		return 0, nil, "", 0, errors.New("API错误：" + videoResp.Message)
	}

	return videoResp.Data.CID, videoResp.Data.Pages, videoResp.Data.Title, videoResp.Data.Duration, nil
}

// GetSubtitleURL 通过CID和BV号获取AI字幕的下载链接
func GetSubtitleURL(cid int64, bvid string) (string, error) {
	url := fmt.Sprintf("%s/x/player/v2?cid=%d&bvid=%s", BaseURL, cid, bvid)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com")

	sessdata := os.Getenv("SESSDATA")
	if sessdata != "" {
		req.Header.Set("Cookie", "SESSDATA="+sessdata)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", errors.New("请求失败，状态码：" + resp.Status)
	}

	var playerResp model.PlayerConfigResp
	if err := json.NewDecoder(resp.Body).Decode(&playerResp); err != nil {
		return "", err
	}

	if playerResp.Code != 0 {
		return "", errors.New("API错误：" + playerResp.Message)
	}

	// 查找AI中文字幕，如果没有，找其他中文字幕
	var selectedSub *model.SubtitleItem
	for _, sub := range playerResp.Data.Subtitle.Subtitles {
		if sub.Lan == "ai-zh" && selectedSub == nil {
			selectedSub = &sub
			break // 优先AI字幕
		} else if strings.Contains(sub.LanDoc, "中文") && selectedSub == nil {
			selectedSub = &sub
		}
	}

	if selectedSub == nil {
		return "", errors.New("未找到中文字幕")
	}

	log.Printf("选择字幕: lan=%s, lan_doc=%s", selectedSub.Lan, selectedSub.LanDoc)

	// 补全URL
	if strings.HasPrefix(selectedSub.SubtitleURL, "//") {
		return "https:" + selectedSub.SubtitleURL, nil
	}
	return selectedSub.SubtitleURL, nil
}

// GetSubtitleFromCID 通过CID获取字幕
func GetSubtitleFromCID(cid int64, bvid string) (*model.Subtitle, error) {
	subtitleURL, err := GetSubtitleURL(cid, bvid)
	if err != nil {
		return nil, err
	}
	return GetSubtitle(subtitleURL)
}

// GetSubtitle 下载字幕文件
func GetSubtitle(subtitleURL string) (*model.Subtitle, error) {
	req, err := http.NewRequest("GET", subtitleURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, errors.New("请求失败，状态码：" + resp.Status)
	}

	var subtitle model.Subtitle
	if err := json.NewDecoder(resp.Body).Decode(&subtitle); err != nil {
		return nil, err
	}

	return &subtitle, nil
}
