package collectionfilter

import (
	"fmt"
	"testing"
)

func TestNewBloomFilter(t *testing.T) {
	bf := New(nil, nil, "optimism", "EZSwap")
	exist := bf.Contains("0x085f81803db511dc19d0ce93f74e6a8937b58b81")
	fmt.Println("0x085f81803db511dc19d0ce93f74e6a8937b58b81 is ", exist)
	bf.Add("0x085f81803db511dc19d0ce93f74e6a8937b58b81")
	exist = bf.Contains("0x085f81803db511dc19d0ce93f74e6a8937b58b81")
	fmt.Println("0x085f81803db511dc19d0ce93f74e6a8937b58b81 is ", exist)
}

func TestFilter(t *testing.T) {
	filter := New(nil, nil, "optimism", "EZSwap")

	// Test Add and Contains.
	filter.Add("Test")
	if !filter.Contains("Test") {
		t.Error("Expected Filter to contain 'Test'")
	}

	// Test case insensitivity.
	if !filter.Contains("test") {
		t.Error("Expected Filter to contain 'test'")
	}

	// Test Remove.
	filter.Remove("Test")
	if filter.Contains("Test") {
		t.Error("Expected Filter to not contain 'Test'")
	}
}
