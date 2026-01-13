package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"bilisub/pkg/api"
	"bilisub/pkg/model"
	"bilisub/pkg/utils"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("用法: bilisub <BV号 或 视频链接>")
		os.Exit(1)
	}

	input := os.Args[1]

	// 提取BV号
	re := regexp.MustCompile(`BV[a-zA-Z0-9]+`)
	bvid := re.FindString(input)
	if bvid == "" {
		log.Fatal("无法提取BV号，请提供有效的BV号或视频链接")
	}

	log.Printf("开始处理BV号: %s", bvid)

	// 获取CID、分P信息和标题
	cid, pages, title, duration, err := api.GetCID(bvid)
	if err != nil {
		log.Fatal("获取CID失败:", err)
	}

	log.Printf("视频标题: %s", title)
	log.Printf("分P数量: %d", len(pages))

	type candidate struct {
		cid      int64
		label    string
		duration int
	}

	candidates := []candidate{
		{cid: cid, label: "P1", duration: duration},
	}

	seen := map[int64]struct{}{cid: {}}
	for _, page := range pages {
		if _, ok := seen[page.CID]; ok {
			continue
		}
		seen[page.CID] = struct{}{}
		label := fmt.Sprintf("P%d", page.Page)
		if page.Part != "" {
			label = fmt.Sprintf("%s_%s", label, page.Part)
		}
		candidates = append(candidates, candidate{
			cid:      page.CID,
			label:    label,
			duration: page.Duration,
		})
	}

	var (
		subtitle   *model.Subtitle
		usedLabel  string
		fetchError error
	)

	for _, c := range candidates {
		subtitle, fetchError = api.GetSubtitleFromCID(c.cid, bvid)
		if fetchError == nil {
			usedLabel = c.label
			break
		}
		log.Printf("尝试 %s 失败: %v", c.label, fetchError)
	}

	if fetchError != nil {
		log.Fatal("获取字幕失败:", fetchError)
	}
	log.Printf("获取字幕成功，使用 %s", usedLabel)

	if err := writeSubtitleToFile(bvid, title, usedLabel, subtitle); err != nil {
		log.Fatal("写入字幕失败:", err)
	}
	log.Printf("字幕已保存到 output 目录")
}

func writeSubtitleToFile(bvid, title, label string, subtitle *model.Subtitle) error {
	if err := os.MkdirAll("output", 0o755); err != nil {
		return err
	}

	baseName := fmt.Sprintf("%s_%s", bvid, utils.SanitizeFilename(title))
	if label != "" {
		baseName = fmt.Sprintf("%s_%s", baseName, utils.SanitizeFilename(label))
	}
	target := filepath.Join("output", baseName+".txt")

	var builder strings.Builder
	for _, line := range subtitle.Body {
		text := strings.TrimSpace(line.Content)
		if text == "" {
			continue
		}
		builder.WriteString(text)
		builder.WriteByte('\n')
	}

	content := strings.TrimSpace(builder.String())
	if content != "" {
		content += "\n"
	}

	return os.WriteFile(target, []byte(content), 0o644)
}
