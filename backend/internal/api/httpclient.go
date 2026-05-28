package api

import (
	"net/http"
	"time"
)

// externalHTTPClient bounds outbound calls to OAuth/token providers so a
// stalled upstream cannot hold the request open indefinitely.
var externalHTTPClient = &http.Client{Timeout: 30 * time.Second}
