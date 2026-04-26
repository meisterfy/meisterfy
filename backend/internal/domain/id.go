package domain

import (
	"sync"
	"time"

	"github.com/oklog/ulid/v2"
)

var (
	entropy     = ulid.Monotonic(ulid.DefaultEntropy(), 0)
	entropyLock sync.Mutex
)

// NewID generates a new ULID string. Safe for concurrent use.
func NewID() string {
	entropyLock.Lock()
	defer entropyLock.Unlock()
	return ulid.MustNew(ulid.Timestamp(time.Now()), entropy).String()
}
