//go:build smoke

package smoke

import (
	"os"
	"testing"
)

var baseURL string

func TestMain(m *testing.M) {
	baseURL = os.Getenv("SMOKE_TARGET_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}
	os.Exit(m.Run())
}
