package util

import "time"

func TimeParse(timeStr string) int64 {
	parse, _ := time.Parse(time.RFC3339Nano, timeStr)
	return parse.UnixNano() / int64(time.Millisecond)
}
