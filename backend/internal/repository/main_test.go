//go:build integration

package repository

import (
	"context"
	"fmt"
	"os"
	"testing"

	"go.uber.org/goleak"

	"github.com/rush-maestro/rush-maestro/testutil"
)

var sharedDB *testutil.PostgresContainer

func TestMain(m *testing.M) {
	sharedDB = testutil.NewPostgresContainer(nil)

	exitCode := 0
	defer func() {
		sharedDB.Cleanup(context.Background())
		os.Exit(exitCode)
	}()

	exitCode = m.Run()

	if err := goleak.Find(); err != nil {
		fmt.Fprintf(os.Stderr, "goleak: %v\n", err)
		exitCode = 1
	}
}
