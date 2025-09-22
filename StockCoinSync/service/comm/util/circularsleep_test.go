package util

import (
	"testing"
	"time"
)

func TestCircularSleepTime(t *testing.T) {
	c := NewCircularSleepTime(5)

	// Test initial value
	if c.Get() != 1 {
		t.Errorf("Unexpected initial value: expected 1, got %d", c.Get())
	}

	// Test increment
	c.Inc()
	if c.Get() != 2 {
		t.Errorf("Unexpected value after increment: expected 2, got %d", c.Get())
	}

	// Test reset
	c.Reset()
	if c.Get() != 1 {
		t.Errorf("Unexpected value after reset: expected 1, got %d", c.Get())
	}
	c.Inc()
	c.Inc()
	c.Inc()
	c.Inc()
	c.Inc()

	// Test sleep
	start := time.Now()
	c.Sleep()
	elapsed := time.Since(start)
	if elapsed < time.Second || elapsed > time.Second*5+time.Millisecond {
		t.Errorf("Unexpected sleep duration: expected between 1 and 5 seconds, got %s", elapsed)
	}
}
