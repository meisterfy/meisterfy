package connector

import (
	"net"
	"net/http"
	"time"
)

// StreamingHTTPClient returns an HTTP client suited to long-lived streaming
// responses (e.g. LLM SSE). It bounds connection setup and time-to-first-byte
// so a stalled upstream cannot pin a goroutine indefinitely, without a total
// timeout that would truncate a legitimately long in-flight stream.
func StreamingHTTPClient() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			DialContext:           (&net.Dialer{Timeout: 10 * time.Second}).DialContext,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: 60 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			IdleConnTimeout:       90 * time.Second,
		},
	}
}
