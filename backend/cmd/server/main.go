package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/mkt-maestro/mkt-maestro/internal/adjuster"
	"github.com/mkt-maestro/mkt-maestro/internal/api"
	"github.com/mkt-maestro/mkt-maestro/internal/config"
	"github.com/mkt-maestro/mkt-maestro/internal/connector/googleads"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/provider/llm"
	"github.com/mkt-maestro/mkt-maestro/internal/scheduler"
	"github.com/mkt-maestro/mkt-maestro/internal/service/media"
	mcpserver "github.com/mkt-maestro/mkt-maestro/internal/mcp"
	mcpresources "github.com/mkt-maestro/mkt-maestro/internal/mcp/resources"
	mcptools "github.com/mkt-maestro/mkt-maestro/internal/mcp/tools"
	"github.com/mkt-maestro/mkt-maestro/internal/middleware"
	"github.com/mkt-maestro/mkt-maestro/internal/repository"

	// Register all integration provider schemas.
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/anthropic"
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/brevo"
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/gemini"
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/googleads"
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/groq"
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/kimi"
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/meta"
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/openai"
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/r2"
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/s3"
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/resend"
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/sentry"
)

//go:embed all:ui/dist
var uiFS embed.FS

func makeAdsFactory(tenantRepo *repository.TenantRepository, integrationRepo *repository.IntegrationRepository, resourceRepo *repository.ConnectorResourceRepository) mcptools.AdsClientFactory {
	return func(ctx context.Context, tenantID string) (*googleads.Client, *domain.Tenant, error) {
		tenant, err := tenantRepo.GetByID(ctx, tenantID)
		if err != nil {
			return nil, nil, fmt.Errorf("tenant %q not found", tenantID)
		}
		resources, err := resourceRepo.List(ctx, tenantID, domain.ProviderGoogleAds, "ad_account")
		if err != nil || len(resources) == 0 {
			return nil, nil, fmt.Errorf("tenant %q has no google_ads ad_account resource", tenantID)
		}
		integration, err := integrationRepo.GetForTenant(ctx, tenantID, "google_ads")
		if err != nil {
			return nil, nil, fmt.Errorf("no connected Google Ads integration for tenant %q", tenantID)
		}
		creds := integration.GoogleAdsCredentials()
		if creds == nil {
			return nil, nil, fmt.Errorf("Google Ads integration for tenant %q is missing credentials", tenantID)
		}
		return googleads.NewClient(resources[0].ResourceID, *creds), tenant, nil
	}
}

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config error", "err", err)
		os.Exit(1)
	}

	// Initialize Sentry if DSN is configured.
	if cfg.SentryDSN != "" {
		err := sentry.Init(sentry.ClientOptions{
			Dsn:              cfg.SentryDSN,
			Environment:      cfg.AppEnv,
			Release:          "mkt-maestro@1.0.0",
			TracesSampleRate: 0.2,
		})
		if err != nil {
			slog.Error("sentry init error", "err", err)
		} else {
			slog.Info("sentry initialized")
			defer sentry.Flush(2 * time.Second)
		}
	}

	ctx := context.Background()
	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		slog.Error("db config parse error", "err", err)
		os.Exit(1)
	}
	poolCfg.ConnConfig.Tracer = &middleware.QueryCounter{}
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		slog.Error("db connect error", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		slog.Error("db ping error", "err", err)
		os.Exit(1)
	}
	slog.Info("database connected")

	userRepo           := repository.NewUserRepository(pool)
	rbacRepo           := repository.NewRBACRepository(pool)
	tenantRepo         := repository.NewTenantRepository(pool)
	postRepo           := repository.NewPostRepository(pool)
	campaignRepo       := repository.NewCampaignRepository(pool)
	alertRepo          := repository.NewAlertRepository(pool)
	agentRunRepo       := repository.NewAgentRunRepository(pool)
	integrationRepo       := repository.NewIntegrationRepository(pool, []byte(cfg.CredentialKey))
	metricsRepo           := repository.NewMetricsRepository(pool)
	connectorResourceRepo := repository.NewConnectorResourceRepository(pool)
	campaignReportRepo         := repository.NewCampaignReportRepository(pool)
	auditLogRepo               := repository.NewAuditLogRepository(pool)
	pendingAdjustmentRepo      := repository.NewPendingAdjustmentRepository(pool)
	mcpApiKeyRepo              := repository.NewMcpApiKeyRepository(pool)
	legalRepo                  := repository.NewLegalRepository(pool)
	jwtSvc := domain.NewJWTService(cfg.JWTSecret)

	mediaResolver := media.NewLocalResolver(cfg.BaseURL)

	mcpSrv := mcpserver.NewServer("mkt-maestro", "1.0.0")
	adsFactory := makeAdsFactory(tenantRepo, integrationRepo, connectorResourceRepo)
	llmSelector := llm.NewProviderSelector(integrationRepo)
	mcptools.RegisterContentTools(mcpSrv, mcptools.ContentRepos{
		Tenants:   tenantRepo,
		Posts:     postRepo,
		Campaigns: campaignRepo,
	})
	mcptools.RegisterAdsTools(mcpSrv, adsFactory)
	mcptools.RegisterLLMTools(mcpSrv, llmSelector)
	mcptools.RegisterMonitoringTools(mcpSrv, mcptools.MonitoringRepos{
		Metrics:    metricsRepo,
		Alerts:     alertRepo,
		AgentRuns:  agentRunRepo,
		AdsFactory: adsFactory,
	})
	mcpresources.RegisterTenantResources(mcpSrv, mcpresources.TenantResourceRepos{
		Tenants: tenantRepo,
		Posts:   postRepo,
	})

	r := chi.NewRouter()
	r.Use(chimw.RealIP)
	r.Use(middleware.SentryHubMiddleware)
	r.Use(middleware.SentryRecovery)
	r.Use(chimw.Recoverer)
	r.Use(middleware.RequestLogger(slog.Default()))
	r.Use(middleware.NPlus1Detector)
	r.Use(middleware.SecurityHeaders)
	r.Use(chimw.RequestSize(4 * 1024 * 1024)) // 4 MB global limit

	r.Get("/health", api.NewHealthHandler(userRepo).Handle)

	r.Post("/setup", api.NewSetupHandler(userRepo, tenantRepo, rbacRepo, jwtSvc, cfg.CookieDomain, cfg.IsProduction()).Create)

	authHandler         := api.NewAuthHandler(userRepo, rbacRepo, legalRepo, jwtSvc, cfg.CookieDomain, cfg.IsProduction())
	usersHandler        := api.NewAdminUsersHandler(userRepo, rbacRepo, auditLogRepo)
	rolesHandler        := api.NewAdminRolesHandler(rbacRepo)
	tenantsHandler      := api.NewAdminTenantsHandler(tenantRepo, rbacRepo, auditLogRepo)
	postsHandler        := api.NewAdminPostsHandler(postRepo, auditLogRepo)
	campaignsHandler    := api.NewAdminCampaignsHandler(campaignRepo)
	googleAdsHandler    := api.NewAdminGoogleAdsHandler(integrationRepo, connectorResourceRepo, tenantRepo, metricsRepo, alertRepo)
	integrationsHandler := api.NewAdminIntegrationsHandler(integrationRepo, auditLogRepo)
	auditLogHandler     := api.NewAdminAuditLogHandler(auditLogRepo)
	oauthGoogleAds      := api.NewOAuthGoogleAdsHandler(integrationRepo, cfg.BaseURL)
	oauthMeta           := api.NewOAuthMetaHandler(integrationRepo, connectorResourceRepo, cfg.BaseURL)
	metaPublish              := api.NewMetaPublishHandler(postRepo, integrationRepo, connectorResourceRepo, mediaResolver)
	connectorResourcesHandler := api.NewConnectorResourcesHandler(connectorResourceRepo)
	mediaHandler            := api.NewMediaHandler(cfg.StoragePath, postRepo)
	aiGenerateHandler       := api.NewAIGenerateHandler(llmSelector)
	campaignReportsHandler           := api.NewCampaignReportsHandler(campaignReportRepo)
	pendingAdjustmentsHandler        := api.NewAdminPendingAdjustmentsHandler(pendingAdjustmentRepo)
	mcpKeysHandler                   := api.NewAdminMcpKeysHandler(mcpApiKeyRepo)
	legalHandler                     := api.NewLegalHandler(legalRepo)

	// All non-streaming routes get a 30s request timeout.
	// The /ai/generate SSE endpoint is registered outside this group.
	r.Group(func(r chi.Router) {
		r.Use(chimw.Timeout(30 * time.Second))

		r.Route("/auth", func(r chi.Router) {
			r.Use(middleware.AdminCORS(cfg.AdminCORSOrigins))
			r.With(middleware.RateLimitLogin).Post("/login", authHandler.Login)
			r.Post("/refresh", authHandler.Refresh)
			r.Post("/logout", authHandler.Logout)
			r.Group(func(r chi.Router) {
				r.Use(middleware.AuthenticateAdmin(jwtSvc))
				r.Get("/me", authHandler.Me)
				r.Put("/me", authHandler.UpdateMe)
				r.Post("/change-password", authHandler.ChangePassword)
				r.Post("/accept-terms", authHandler.AcceptTerms)
			})
			// Google Ads OAuth — redirect-based flow, no auth middleware
			r.Get("/google-ads/start", oauthGoogleAds.Start)
			r.Get("/google-ads/callback", oauthGoogleAds.Callback)
			// Meta OAuth
			r.Get("/meta/start", oauthMeta.Start)
			r.Get("/meta/callback", oauthMeta.Callback)
		})
	
		r.Route("/admin", func(r chi.Router) {
			r.Use(middleware.AdminCORS(cfg.AdminCORSOrigins))
			r.Use(middleware.AuthenticateAdmin(jwtSvc))
	
			r.With(middleware.RequirePermission("view-any:user")).Get("/users", usersHandler.List)
			r.With(middleware.RequirePermission("create:user")).Post("/users", usersHandler.Create)
			r.With(middleware.RequirePermission("view:user")).Get("/users/{id}", usersHandler.Get)
			r.With(middleware.RequirePermission("update:user")).Put("/users/{id}", usersHandler.Update)
			r.With(middleware.RequirePermission("delete:user")).Delete("/users/{id}", usersHandler.Delete)
			r.With(middleware.RequirePermission("update:user")).Post("/users/{id}/reactivate", usersHandler.Reactivate)
			r.With(middleware.RequirePermission("update:user")).Put("/users/{id}/role", usersHandler.AssignRole)
	
			r.With(middleware.RequirePermission("view-any:role")).Get("/roles", rolesHandler.List)
			r.With(middleware.RequirePermission("create:role")).Post("/roles", rolesHandler.Create)
			r.With(middleware.RequirePermission("view:role")).Get("/roles/{id}", rolesHandler.Get)
			r.With(middleware.RequirePermission("update:role")).Put("/roles/{id}", rolesHandler.Update)
			r.With(middleware.RequirePermission("delete:role")).Delete("/roles/{id}", rolesHandler.Delete)
			r.With(middleware.RequirePermission("view:role")).Get("/permissions", rolesHandler.ListPermissions)
	
			// integrations
			r.With(middleware.RequireSystemRole("platform_admin")).Get("/integrations", integrationsHandler.List)
			r.With(middleware.RequireSystemRole("platform_admin")).Get("/integrations/providers", integrationsHandler.ListProviders)
			r.With(middleware.RequireSystemRole("platform_admin")).Post("/integrations", integrationsHandler.Create)
			r.With(middleware.RequireSystemRole("platform_admin")).Get("/integrations/{id}", integrationsHandler.Get)
			r.With(middleware.RequireSystemRole("platform_admin")).Put("/integrations/{id}", integrationsHandler.Update)
			r.With(middleware.RequireSystemRole("platform_admin")).Delete("/integrations/{id}", integrationsHandler.Delete)
			r.With(middleware.RequireSystemRole("platform_admin")).Post("/integrations/{id}/test", integrationsHandler.Test)
			r.With(middleware.RequireSystemRole("platform_admin")).Put("/integrations/{id}/tenants", integrationsHandler.SetTenants)

			// system role management — platform admin only
			r.With(middleware.RequireSystemRole("platform_admin")).Put("/users/{id}/system-role", usersHandler.SetSystemRole)

			// legal terms — platform admin only
			r.Route("/legal", func(r chi.Router) {
				r.Use(middleware.RequireSystemRole("platform_admin"))
				r.Get("/versions", legalHandler.List)
				r.Post("/versions", legalHandler.Create)
				r.Get("/versions/{id}", legalHandler.Get)
				r.Put("/versions/{id}", legalHandler.Update)
			})
	
			// tenants
			r.With(middleware.RequirePermission("view-any:tenant")).Get("/tenants", tenantsHandler.List)
			r.With(middleware.RequirePermission("create:tenant")).Post("/tenants", tenantsHandler.Create)
			r.Route("/tenants/{tenantId}", func(r chi.Router) {
				r.Use(middleware.RequireTenantMatch)
	
				r.With(middleware.RequirePermission("view:tenant")).Get("/", tenantsHandler.Get)
				r.With(middleware.RequirePermission("update:tenant")).Put("/", tenantsHandler.Update)
				r.With(middleware.RequirePermission("delete:tenant")).Delete("/", tenantsHandler.Delete)
	
				// posts
				r.With(middleware.RequirePermission("view:post")).Get("/posts", postsHandler.List)
				r.With(middleware.RequirePermission("create:post")).Post("/posts", postsHandler.Create)
				r.With(middleware.RequirePermission("view:post")).Get("/posts/{id}", postsHandler.Get)
				r.With(middleware.RequirePermission("create:post")).Put("/posts/{id}", postsHandler.Update)
				r.Patch("/posts/{id}/status", postsHandler.UpdateStatus)
				r.With(middleware.RequirePermission("delete:post")).Delete("/posts/{id}", postsHandler.Delete)
	
				// campaigns
				r.With(middleware.RequirePermission("view:campaign")).Get("/campaigns/live", googleAdsHandler.LiveCampaigns)
				r.With(middleware.RequirePermission("view:campaign")).Get("/campaigns/live/{campaignId}", googleAdsHandler.LiveCampaignDetail)
				r.With(middleware.RequirePermission("view:campaign")).Get("/campaigns/live/{campaignId}/devices", googleAdsHandler.LiveCampaignDevices)
				r.With(middleware.RequirePermission("view:campaign")).Get("/campaigns/live/{campaignId}/hourly", googleAdsHandler.LiveCampaignHourly)
				r.With(middleware.RequirePermission("view:campaign")).Get("/campaigns/live/{campaignId}/impression-share", googleAdsHandler.LiveCampaignImpressionShare)
				r.With(middleware.RequirePermission("view:campaign")).Get("/campaigns/live/{campaignId}/search-terms", googleAdsHandler.LiveCampaignSearchTerms)
				r.With(middleware.RequirePermission("view:campaign")).Get("/campaigns/live/{campaignId}/quality-scores", googleAdsHandler.LiveCampaignQualityScores)
				r.With(middleware.RequirePermission("view:campaign")).Get("/campaigns/live/{campaignId}/keywords", googleAdsHandler.LiveCampaignKeywords)
				r.With(middleware.RequirePermission("manage:campaign")).Post("/campaigns/sync-history", googleAdsHandler.SyncHistory)
				r.With(middleware.RequirePermission("view:campaign")).Get("/metrics", googleAdsHandler.GetMetrics)
				r.With(middleware.RequirePermission("view:campaign")).Get("/campaigns", campaignsHandler.List)
				r.With(middleware.RequirePermission("manage:campaign")).Post("/campaigns", campaignsHandler.Create)
				r.With(middleware.RequirePermission("view:campaign")).Get("/campaigns/{slug}", campaignsHandler.Get)
				r.With(middleware.RequirePermission("manage:campaign")).Put("/campaigns/{slug}", campaignsHandler.Update)
				r.With(middleware.RequirePermission("manage:campaign")).Delete("/campaigns/{id}", campaignsHandler.Delete)
				r.With(middleware.RequirePermission("manage:campaign")).Post("/campaigns/{id}/deploy", campaignsHandler.Deploy)
	
				// AI reports (persist generated reports per campaign)
				r.With(middleware.RequirePermission("view:report")).Get("/campaigns/{campaignId}/ai-reports", campaignReportsHandler.List)
				r.With(middleware.RequirePermission("create:report")).Post("/campaigns/{campaignId}/ai-reports", campaignReportsHandler.Save)
	
				// generic connector resources
				r.With(middleware.RequirePermission("view:integrations")).Get("/connectors", connectorResourcesHandler.List)
	
				// meta publishing
				r.Get("/meta/accounts", metaPublish.ListAccounts)
				r.With(middleware.RequirePermission("publish:post")).Post("/meta/publish", metaPublish.Publish)
	
				// pending adjustments
				r.With(middleware.RequirePermission("view:campaign")).Get("/pending-adjustments", pendingAdjustmentsHandler.List)
				r.With(middleware.RequirePermission("manage:campaign")).Post("/pending-adjustments/{id}/approve", pendingAdjustmentsHandler.Approve)
				r.With(middleware.RequirePermission("manage:campaign")).Post("/pending-adjustments/{id}/reject", pendingAdjustmentsHandler.Reject)

				// mcp api keys
				r.With(middleware.RequirePermission("manage:mcp-keys")).Get("/mcp-keys", mcpKeysHandler.List)
				r.With(middleware.RequirePermission("manage:mcp-keys")).Post("/mcp-keys", mcpKeysHandler.Create)
				r.With(middleware.RequirePermission("manage:mcp-keys")).Delete("/mcp-keys/{keyId}", mcpKeysHandler.Revoke)

				// audit log
				r.With(middleware.RequirePermission("view-any:user")).Get("/audit-log", auditLogHandler.List)
			})
		})
	
		// Media file serving (public GET) and upload/delete (authenticated)
		r.Get("/api/media/{tenantId}/{filename}", mediaHandler.Serve)
		r.Group(func(r chi.Router) {
			r.Use(middleware.AdminCORS(cfg.AdminCORSOrigins))
			r.Use(middleware.AuthenticateAdmin(jwtSvc))
			r.Post("/api/media/{tenantId}/{postId}", mediaHandler.Upload)
			r.Delete("/api/media/{tenantId}/{postId}", mediaHandler.Delete)
		})
	
	}) // end timeout group

	// SSE streaming — no timeout middleware (would kill the stream at 30s)
	r.Route("/ai", func(r chi.Router) {
		r.Use(middleware.AdminCORS(cfg.AdminCORSOrigins))
		r.Use(middleware.AuthenticateAdmin(jwtSvc))
		r.Post("/generate", aiGenerateHandler.Generate)
	})

	r.Group(func(r chi.Router) {
		r.Use(chimw.Timeout(30 * time.Second))

		// Tenant-scoped AI routes (providers list lives here to keep tenant context clear)
		r.Route("/admin/tenants/{tenantId}/ai", func(r chi.Router) {
			r.Use(middleware.AdminCORS(cfg.AdminCORSOrigins))
			r.Use(middleware.AuthenticateAdmin(jwtSvc))
			r.Use(middleware.RequireTenantMatch)
			r.Get("/providers", aiGenerateHandler.ListProviders)
		})

		// Tenant-scoped Google Ads status
		r.Route("/admin/tenants/{tenantId}/google-ads", func(r chi.Router) {
			r.Use(middleware.AdminCORS(cfg.AdminCORSOrigins))
			r.Use(middleware.AuthenticateAdmin(jwtSvc))
			r.Use(middleware.RequireTenantMatch)
			r.Get("/status", googleAdsHandler.Status)
		})

	}) // end timeout group

	r.Route("/mcp", func(r chi.Router) {
		r.Use(middleware.AuthenticateMCPKey(mcpApiKeyRepo))
		r.Post("/", mcpSrv.ServeHTTP)
		r.Get("/", mcpSrv.ServeHTTP)
		r.Delete("/", mcpSrv.ServeHTTP)
	})

	// Serve SvelteKit SPA
	if cfg.DevFrontendURL != "" {
		// In dev mode: proxy all frontend requests to the Vite dev server (HMR enabled).
		// Rewrites Host so Vite accepts the request, and returns a self-refreshing loading
		// page while Vite is still starting up instead of a raw 502.
		target, err := url.Parse(cfg.DevFrontendURL)
		if err != nil {
			slog.Error("invalid DEV_FRONTEND_URL", "err", err)
			os.Exit(1)
		}
		proxy := httputil.NewSingleHostReverseProxy(target)
		// Rewrite Host header so Vite matches its own virtualHost expectation.
		originalDirector := proxy.Director
		proxy.Director = func(req *http.Request) {
			originalDirector(req)
			req.Host = target.Host
		}
		// Fail fast when Vite is still booting, then show a self-refreshing loading page.
		proxy.Transport = &http.Transport{
			DialContext:         (&net.Dialer{Timeout: 2 * time.Second}).DialContext,
			TLSHandshakeTimeout: 2 * time.Second,
		}
		proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, _ error) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Refresh", "2")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`<!doctype html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#64748b"><p>⏳ Starting dev server…</p></body></html>`))
		}
		slog.Info("proxying frontend to Vite", "url", cfg.DevFrontendURL)
		r.Handle("/*", proxy)
	} else {
		// In production: serve embedded ui/dist with SPA fallback to 200.html
		distFS, err := fs.Sub(uiFS, "ui/dist")
		if err != nil {
			slog.Error("ui/dist embed error", "err", err)
			os.Exit(1)
		}
		fileServer := http.FileServer(http.FS(distFS))
		r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if _, ferr := distFS.Open(req.URL.Path[1:]); ferr != nil {
				content, rerr := fs.ReadFile(distFS, "200.html")
				if rerr != nil {
					http.NotFound(w, req)
					return
				}
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(content)
				return
			}
			fileServer.ServeHTTP(w, req)
		}))
	}

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 5 * time.Minute, // generous for SSE; chi Timeout(30s) protects regular routes
		IdleTimeout:  60 * time.Second,
	}

	// Background scheduler — shares lifetime with the server process.
	schedCtx, schedCancel := context.WithCancel(ctx)
	defer schedCancel()
	adjEngine := adjuster.New(metricsRepo, connectorResourceRepo)
	sched := scheduler.New(
		tenantRepo, agentRunRepo, metricsRepo,
		scheduler.AdsClientFactory(adsFactory), llmSelector,
		adjEngine, pendingAdjustmentRepo, auditLogRepo, alertRepo, connectorResourceRepo,
	)
	go sched.Start(schedCtx)

	go func() {
		slog.Info("server starting", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down...")
	schedCancel()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "err", err)
	}
	fmt.Println("bye")
}
