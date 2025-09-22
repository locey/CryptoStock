package util

import (
	"fmt"
	"testing"
)

func TestTime(t *testing.T) {
	eventTimeStr := "2023-03-06T09:10:08.010914+00:00"
	expirationTimeStr := "2023-04-06T09:10:02.000000+00:00"

	// 输出时间戳
	fmt.Println("event_timestamp:", TimeParse(eventTimeStr))
	fmt.Println("expiration_date:", TimeParse(expirationTimeStr))
}
