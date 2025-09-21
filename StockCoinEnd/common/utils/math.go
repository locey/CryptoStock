package utils

// Min returns the smaller of x or y.
func Min(x, y int) int {
	if x > y {
		return y
	}
	return x
}

// Max returns the larger of x or y.
func Max(x, y int64) int64 {
	if x < y {
		return y
	}
	return x
}
