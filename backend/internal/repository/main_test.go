//go:build integration

package repository

import (
	"context"
	"fmt"
	"os"
	"testing"

	"go.uber.org/goleak"

	"github.com/meisterfy/meisterfy/testutil"
)

var sharedDB *testutil.PostgresContainer

func TestMain(m *testing.M) {
	sharedDB = testutil.NewPostgresContainer(nil)

	exitCode := m.Run()

	// Close the pool before checking for goroutine leaks so pgxpool
	// background goroutines have time to exit before goleak scans.
	sharedDB.Cleanup(context.Background())

	if err := goleak.Find(); err != nil {
		fmt.Fprintf(os.Stderr, "goleak: %v\n", err)
		exitCode = 1
	}

	os.Exit(exitCode)
}
