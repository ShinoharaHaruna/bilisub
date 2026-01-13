package utils

import (
	"regexp"
	"strings"
)

var invalidFilenameChars = regexp.MustCompile(`[<>:"/\\|?*\r\n]+`)

// SanitizeFilename 将字符串转换为安全的文件名。
func SanitizeFilename(name string) string {
	safe := invalidFilenameChars.ReplaceAllString(name, "_")
	safe = strings.TrimSpace(safe)
	if safe == "" {
		return "subtitle"
	}
	// 避免连续的下划线
	safe = regexp.MustCompile(`_+`).ReplaceAllString(safe, "_")
	return safe
}
