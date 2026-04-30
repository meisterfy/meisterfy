package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5"
)

// queryCountKey is the context key for per-request query counting.
type queryCountKey struct{}

// NPlus1Threshold is the number of queries above which a warning is logged.
const NPlus1Threshold = 15

// QueryCounter wraps pgx QueryTracer to count queries per request.
type QueryCounter struct{}

func (qt *QueryCounter) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	v := ctx.Value(queryCountKey{})
	if v == nil {
		return ctx
	}
	counter := v.(*atomic.Int32)
	counter.Add(1)
	return ctx
}

func (qt *QueryCounter) TraceQueryEnd(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryEndData) {}

func (qt *QueryCounter) TraceBatchStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceBatchStartData) context.Context {
	return ctx
}

func (qt *QueryCounter) TraceBatchQuery(ctx context.Context, conn *pgx.Conn, data pgx.TraceBatchQueryData) {}

func (qt *QueryCounter) TraceBatchEnd(ctx context.Context, conn *pgx.Conn, data pgx.TraceBatchEndData) {}

func (qt *QueryCounter) TraceConnectStart(ctx context.Context, data pgx.TraceConnectStartData) context.Context {
	return ctx
}

func (qt *QueryCounter) TraceConnectEnd(ctx context.Context, data pgx.TraceConnectEndData) {}

func (qt *QueryCounter) TracePrepareStart(ctx context.Context, conn *pgx.Conn, data pgx.TracePrepareStartData) context.Context {
	return ctx
}

func (qt *QueryCounter) TracePrepareEnd(ctx context.Context, conn *pgx.Conn, data pgx.TracePrepareEndData) {}

func (qt *QueryCounter) TraceCopyFromStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceCopyFromStartData) context.Context {
	return ctx
}

func (qt *QueryCounter) TraceCopyFromEnd(ctx context.Context, conn *pgx.Conn, data pgx.TraceCopyFromEndData) {}

// NPlus1Detector is an HTTP middleware that counts queries per request and logs warnings.
func NPlus1Detector(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip static assets and health checks.
		if strings.HasPrefix(r.URL.Path, "/api/media/") || r.URL.Path == "/health" || r.URL.Path == "/mcp" {
			next.ServeHTTP(w, r)
			return
		}

		var counter atomic.Int32
		ctx := context.WithValue(r.Context(), queryCountKey{}, &counter)
		r = r.WithContext(ctx)

		start := time.Now()
		next.ServeHTTP(w, r)
		elapsed := time.Since(start)

		count := counter.Load()
		if count > NPlus1Threshold {
			slog.Warn("potential n+1 query detected",
				"method", r.Method,
				"path", r.URL.Path,
				"query_count", count,
				"threshold", NPlus1Threshold,
				"duration_ms", elapsed.Milliseconds(),
			)
		}
	})
}
