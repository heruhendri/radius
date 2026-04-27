package util

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"strings"
	"time"
)

// NewID generates a cuid-compatible unique ID (compatible with Prisma @default(cuid()))
func NewID() string {
	ts := time.Now().UnixMilli()
	b := make([]byte, 15)
	rand.Read(b)
	encoded := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)
	return fmt.Sprintf("c%s%s", base36(ts), strings.ToLower(encoded[:16]))
}

func base36(n int64) string {
	const chars = "0123456789abcdefghijklmnopqrstuvwxyz"
	if n == 0 {
		return "0"
	}
	result := ""
	for n > 0 {
		result = string(chars[n%36]) + result
		n /= 36
	}
	return result
}
