package main

import (
	"fmt"
	"log"

	"radius-buildup/internal/config"
	"radius-buildup/internal/database"
	"radius-buildup/internal/middleware"
	"radius-buildup/internal/modules/activity"
	"radius-buildup/internal/modules/admin"
	"radius-buildup/internal/modules/agent"
	"radius-buildup/internal/modules/analytics"
	"radius-buildup/internal/modules/auth"
	"radius-buildup/internal/modules/backup"
	"radius-buildup/internal/modules/billing"
	"radius-buildup/internal/modules/company"
	"radius-buildup/internal/modules/cron"
	"radius-buildup/internal/modules/customer"
	"radius-buildup/internal/modules/customerportal"
	"radius-buildup/internal/modules/dashboard"
	"radius-buildup/internal/modules/email"
	"radius-buildup/internal/modules/evoucher"
	"radius-buildup/internal/modules/freeradius"
	"radius-buildup/internal/modules/genieacs"
	"radius-buildup/internal/modules/health"
	"radius-buildup/internal/modules/hotspot"
	"radius-buildup/internal/modules/inventory"
	"radius-buildup/internal/modules/isolation"
	"radius-buildup/internal/modules/keuangan"
	"radius-buildup/internal/modules/manualpayments"
	"radius-buildup/internal/modules/mikrotik"
	"radius-buildup/internal/modules/network"
	"radius-buildup/internal/modules/notifications"
	"radius-buildup/internal/modules/olt"
	"radius-buildup/internal/modules/payment"
	"radius-buildup/internal/modules/permissions"
	"radius-buildup/internal/modules/pppoe"
	"radius-buildup/internal/modules/public"
	"radius-buildup/internal/modules/push"
	"radius-buildup/internal/modules/radiusprotocol"
	"radius-buildup/internal/modules/referrals"
	"radius-buildup/internal/modules/registrations"
	"radius-buildup/internal/modules/router"
	"radius-buildup/internal/modules/sessions"
	"radius-buildup/internal/modules/settings"
	"radius-buildup/internal/modules/suspend"
	"radius-buildup/internal/modules/system"
	"radius-buildup/internal/modules/technician"
	"radius-buildup/internal/modules/telegram"
	"radius-buildup/internal/modules/tickets"
	"radius-buildup/internal/modules/topup"
	"radius-buildup/internal/modules/upload"
	"radius-buildup/internal/modules/users"
	"radius-buildup/internal/modules/vouchertemplates"
	"radius-buildup/internal/modules/whatsapp"
	"radius-buildup/internal/modules/workorders"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("❌ Failed to load config: %v", err)
	}

	log.Printf("🚀 Starting Radius Buildup Go API [%s]", cfg.Env)

	// Connect to database
	_, err = database.Connect(cfg)
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}

	// Initialize background cron jobs
	cron.InitCron()
	defer cron.StopCron()

	// Setup Gin
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// Middleware
	r.Use(middleware.CORS())

	// API Routes
	api := r.Group("/api")
	{
		// Public routes (no auth needed)
		health.RegisterRoutes(api)
		auth.RegisterRoutes(api, cfg)
		company.RegisterPublicRoutes(api)
		payment.RegisterPublicRoutes(api)
		public.RegisterRoutes(api)
		registrations.RegisterPublicRoutes(api)
		agent.RegisterPublicRoutes(api, cfg)
		technician.RegisterPublicRoutes(api, cfg)
		evoucher.RegisterPublicRoutes(api)
		customerportal.RegisterPublicRoutes(api, cfg)
		push.RegisterPublicRoutes(api)
		radiusprotocol.RegisterRoutes(api) // called by FreeRADIUS, no admin JWT

		// Protected routes (JWT required)
		protected := api.Group("")
		protected.Use(middleware.AuthRequired(cfg))
		{
			auth.RegisterProtectedRoutes(protected)
			pppoe.RegisterRoutes(protected)
			router.RegisterRoutes(protected)
			billing.RegisterRoutes(protected)
			dashboard.RegisterRoutes(protected)
			sessions.RegisterRoutes(protected)
			company.RegisterRoutes(protected)
			activity.RegisterRoutes(protected)
			hotspot.RegisterRoutes(protected)
			admin.RegisterRoutes(protected)
			customer.RegisterRoutes(protected)
			mikrotik.RegisterRoutes(protected)
			payment.RegisterRoutes(protected)
			whatsapp.RegisterRoutes(protected)
			olt.RegisterRoutes(protected)
			// Core modules
			users.RegisterRoutes(protected)
			permissions.RegisterRoutes(protected)
			agent.RegisterRoutes(protected)
			technician.RegisterRoutes(protected)
			tickets.RegisterRoutes(protected)
			notifications.RegisterRoutes(protected)
			keuangan.RegisterRoutes(protected)
			inventory.RegisterRoutes(protected)
			backup.RegisterRoutes(protected)
			registrations.RegisterRoutes(protected)
			settings.RegisterRoutes(protected)
			upload.RegisterRoutes(protected)
			evoucher.RegisterRoutes(protected)
			vouchertemplates.RegisterRoutes(protected)
			manualpayments.RegisterRoutes(protected)
			email.RegisterRoutes(protected)
			freeradius.RegisterRoutes(protected)
			workorders.RegisterRoutes(protected)
			// New modules
			analytics.RegisterRoutes(protected)
			genieacs.RegisterRoutes(protected)
			isolation.RegisterRoutes(protected)
			network.RegisterRoutes(protected)
			// paymentgateway routes handled by Next.js (has real Prisma DB data)
			push.RegisterRoutes(protected)
			referrals.RegisterRoutes(protected)
			suspend.RegisterRoutes(protected)
			system.RegisterRoutes(protected)
			telegram.RegisterRoutes(protected)
			topup.RegisterRoutes(protected)
		}

		// Customer portal (uses customer JWT)
		customerportal.RegisterRoutes(api, cfg)
	}

	// Root endpoint
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"name":    cfg.AppName,
			"version": "1.0.0",
			"engine":  "Go + Gin",
			"docs":    fmt.Sprintf("http://localhost:%s/api/health", cfg.Port),
		})
	})

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("🌐 Server listening on http://localhost%s", addr)
	log.Printf("📡 Health check: http://localhost%s/api/health", addr)

	if err := r.Run(addr); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}
}
