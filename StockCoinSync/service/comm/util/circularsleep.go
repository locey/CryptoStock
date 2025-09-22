package util

import "time"

type CircularSleepTime struct {
	value int
	max   int
}

func NewCircularSleepTime(max int) *CircularSleepTime {
	return &CircularSleepTime{1, max}
}

func (c *CircularSleepTime) Inc() {
	c.value = 1 + ((c.value % c.max) % c.max)
}

func (c *CircularSleepTime) Get() int {
	return c.value
}
func (c *CircularSleepTime) Reset() {
	c.value = 1
}

func (c *CircularSleepTime) Sleep() {
	duration := time.Duration(c.Get()) * time.Second
	select {
	case <-time.After(duration):
		c.Inc()
	}
}
