package agent

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"radius-buildup/internal/config"
	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func RegisterPublicRoutes(r *gin.RouterGroup, cfg *config.Config) {
	r.POST("/agent/login", func(c *gin.Context) { Login(c, cfg) })
}

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/agent")
	{
		g.GET("/dashboard", Dashboard)
		g.GET("/sessions", ListSessions)
		g.GET("/notifications", ListNotifications)
		g.PUT("/notifications/:id/read", MarkNotificationRead)
		g.GET("/deposits", ListDeposits)
		g.POST("/deposits", CreateDeposit)
		g.GET("/vouchers", ListVouchers)
	}
}

// ============================================================================
// Auth
// ============================================================================

type LoginInput struct {
	Phone string `json:"phone" binding:"required"`
}

func Login(c *gin.Context, cfg *config.Config) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var ag models.Agent
	if err := database.DB.Where("phone = ?", input.Phone).First(&ag).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Nomor HP tidak terdaftar"})
		return
	}
	if !ag.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akun agent tidak aktif"})
		return
	}

	// Update lastLogin
	now := time.Now()
	database.DB.Model(&ag).Update("lastLogin", now)

	// Generate JWT
	secret := cfg.AgentJWTSecret
	if secret == "" {
		secret = cfg.JWTSecret
	}
	claims := jwt.MapClaims{
		"agentId": ag.ID,
		"name":    ag.Name,
		"phone":   ag.Phone,
		"role":    "AGENT",
		"exp":     time.Now().Add(7 * 24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": signed,
		"agent": gin.H{
			"id": ag.ID, "name": ag.Name, "phone": ag.Phone,
			"balance": ag.Balance, "minBalance": ag.MinBalance,
		},
	})
}

// ============================================================================
// Dashboard
// ============================================================================

func Dashboard(c *gin.Context) {
	agentID := getAgentID(c)
	if agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	var ag models.Agent
	database.DB.First(&ag, "id = ?", agentID)

	// Stats: this month
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	var monthSales []models.AgentSale
	database.DB.Where("agentId = ? AND createdAt >= ?", agentID, startOfMonth).Find(&monthSales)

	var monthIncome int
	for _, s := range monthSales {
		monthIncome += s.Amount
	}

	// Vouchers paginated
	var total int64
	database.DB.Model(&models.HotspotVoucher{}).Where("agentId = ?", agentID).Count(&total)

	var vouchers []models.HotspotVoucher
	database.DB.Where("agentId = ?", agentID).
		Preload("Profile").
		Order("createdAt DESC").
		Offset((page - 1) * limit).Limit(limit).
		Find(&vouchers)

	c.JSON(http.StatusOK, gin.H{
		"agent":       ag,
		"monthIncome": monthIncome,
		"monthSales":  len(monthSales),
		"vouchers": gin.H{
			"data": vouchers,
			"pagination": gin.H{
				"page": page, "limit": limit, "total": total,
				"totalPages": int(math.Ceil(float64(total) / float64(limit))),
			},
		},
	})
}

// ============================================================================
// Sessions
// ============================================================================

func ListSessions(c *gin.Context) {
	agentID := getAgentID(c)
	if agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get agent's router to show relevant sessions
	var ag models.Agent
	database.DB.First(&ag, "id = ?", agentID)

	query := database.DB.Model(&models.Session{}).Where("acctstoptime IS NULL")
	if ag.RouterID != nil {
		// Filter by NAS IP of agent's router
		var router models.Router
		if database.DB.First(&router, "id = ?", *ag.RouterID).Error == nil {
			query = query.Where("nasipaddress = ?", router.Nasname)
		}
	}

	var sessions []models.Session
	query.Order("acctstarttime DESC").Limit(100).Find(&sessions)

	c.JSON(http.StatusOK, gin.H{"data": sessions})
}

// ============================================================================
// Notifications
// ============================================================================

func ListNotifications(c *gin.Context) {
	agentID := getAgentID(c)
	if agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var notifs []models.AgentNotification
	database.DB.Where("agentId = ?", agentID).Order("createdAt DESC").Limit(50).Find(&notifs)

	var unread int64
	database.DB.Model(&models.AgentNotification{}).Where("agentId = ? AND isRead = ?", agentID, false).Count(&unread)

	c.JSON(http.StatusOK, gin.H{"data": notifs, "unread": unread})
}

func MarkNotificationRead(c *gin.Context) {
	agentID := getAgentID(c)
	id := c.Param("id")

	database.DB.Model(&models.AgentNotification{}).
		Where("id = ? AND agentId = ?", id, agentID).
		Update("isRead", true)

	c.JSON(http.StatusOK, gin.H{"message": "OK"})
}

// ============================================================================
// Deposits
// ============================================================================

func ListDeposits(c *gin.Context) {
	agentID := getAgentID(c)
	if agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	var total int64
	database.DB.Model(&models.AgentDeposit{}).Where("agentId = ?", agentID).Count(&total)

	var deposits []models.AgentDeposit
	database.DB.Where("agentId = ?", agentID).
		Order("createdAt DESC").
		Offset((page - 1) * limit).Limit(limit).
		Find(&deposits)

	c.JSON(http.StatusOK, gin.H{
		"data": deposits,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

type CreateDepositInput struct {
	Amount int    `json:"amount" binding:"required,min=10000"`
	Note   string `json:"note"`
}

func CreateDeposit(c *gin.Context) {
	agentID := getAgentID(c)
	if agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var input CreateDepositInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	deposit := models.AgentDeposit{
		ID:      util.NewID(),
		AgentID: agentID,
		Amount:  input.Amount,
		Status:  "PENDING",
		Note:    &input.Note,
	}
	if err := database.DB.Create(&deposit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": deposit, "message": "Permintaan deposit berhasil dibuat"})
}

// ============================================================================
// Vouchers
// ============================================================================

func ListVouchers(c *gin.Context) {
	agentID := getAgentID(c)
	if agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := database.DB.Model(&models.HotspotVoucher{}).Where("agentId = ?", agentID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var vouchers []models.HotspotVoucher
	query.Preload("Profile").Order("createdAt DESC").
		Offset((page - 1) * limit).Limit(limit).Find(&vouchers)

	c.JSON(http.StatusOK, gin.H{
		"data": vouchers,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

// ============================================================================
// Helper
// ============================================================================

func getAgentID(c *gin.Context) string {
	// Try from JWT claims set by middleware, then fallback to header
	if v, exists := c.Get("agentId"); exists {
		if s, ok := v.(string); ok {
			return s
		}
	}
	// Also try from standard user claims (if routed via general auth)
	if v, exists := c.Get("userId"); exists {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
