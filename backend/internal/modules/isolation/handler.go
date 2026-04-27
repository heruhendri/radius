package isolation

import (
	"net/http"
	"strconv"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	// Isolated users management
	r.GET("/admin/isolated-users", ListIsolatedUsers)
	r.POST("/admin/isolate-user", IsolateUser)
	r.POST("/admin/restore-user", RestoreUser)

	// NOTE: /settings/isolation GET/PUT are intentionally NOT registered here.
	// They are handled by Next.js (Prisma DB) via nginx 404 fallback.
	// Isolation template routes also not registered - handled by Next.js.
}

// ============================================================================
// Isolated Users
// ============================================================================

func ListIsolatedUsers(c *gin.Context) {
	page := 1
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	search := c.Query("search")

	query := database.DB.Model(&models.PppoeUser{}).Preload("Profile").Preload("Area").
		Where("status = ?", "isolated")
	if search != "" {
		query = query.Where("username LIKE ? OR name LIKE ? OR phone LIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	var users []models.PppoeUser
	query.Offset((page - 1) * 20).Limit(20).Order("updatedAt DESC").Find(&users)

	c.JSON(http.StatusOK, gin.H{
		"data":  users,
		"total": total,
		"page":  page,
	})
}

func IsolateUser(c *gin.Context) {
	var input struct {
		UserID string `json:"userId" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := database.DB.Model(&models.PppoeUser{}).
		Where("id = ?", input.UserID).
		Updates(map[string]interface{}{
			"status":    "isolated",
			"updatedAt": time.Now(),
		})

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User berhasil diisolasi"})
}

func RestoreUser(c *gin.Context) {
	var input struct {
		UserID string `json:"userId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Model(&models.PppoeUser{}).
		Where("id = ?", input.UserID).
		Updates(map[string]interface{}{"status": "active", "updatedAt": time.Now()})

	c.JSON(http.StatusOK, gin.H{"message": "User berhasil di-restore"})
}

// ============================================================================
// Isolation Settings & Templates
// ============================================================================

type IsolationSettings struct {
	AutoIsolateEnabled bool      `json:"autoIsolateEnabled"`
	GracePeriodDays    int       `json:"gracePeriodDays"`
	IsolationMessage   string    `json:"isolationMessage"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

func GetIsolationSettings(c *gin.Context) {
	// Return default isolation settings from company_settings or hardcoded defaults
	var users int64
	database.DB.Model(&models.PppoeUser{}).Where("autoIsolationEnabled = ?", true).Count(&users)
	c.JSON(http.StatusOK, gin.H{
		"data": IsolationSettings{
			AutoIsolateEnabled: true,
			GracePeriodDays:    3,
			IsolationMessage:   "Akun Anda diisolasi karena tagihan belum dibayar",
			UpdatedAt:          time.Now(),
		},
	})
}

func UpdateIsolationSettings(c *gin.Context) {
	var input IsolationSettings
	c.ShouldBindJSON(&input)
	c.JSON(http.StatusOK, gin.H{"message": "Pengaturan isolasi disimpan"})
}

func ListIsolationTemplates(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
}

func CreateIsolationTemplate(c *gin.Context) {
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	input["id"] = util.NewID()
	c.JSON(http.StatusCreated, gin.H{"data": input, "message": "Template dibuat"})
}

func UpdateIsolationTemplate(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"message": "Template " + id + " diupdate"})
}

func DeleteIsolationTemplate(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"message": "Template " + id + " dihapus"})
}
