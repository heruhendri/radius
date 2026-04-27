package registrations

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

func RegisterPublicRoutes(r *gin.RouterGroup) {
	r.POST("/public/upload-registration", CreateRegistration)
}

func RegisterRoutes(r *gin.RouterGroup) {
	// Primary path (legacy) + admin alias both point to the same handlers
	for _, prefix := range []string{"/registrations", "/admin/registrations"} {
		g := r.Group(prefix)
		{
			g.GET("", ListRegistrations)
			g.GET("/:id", GetRegistration)
			g.PATCH("/:id/approve", ApproveRegistration)
			g.PATCH("/:id/reject", RejectRegistration)
			g.PATCH("/:id/mark-installed", MarkInstalled)
			g.DELETE("/:id", DeleteRegistration)
			g.POST("/:id/approve", ApproveRegistration)
			g.POST("/:id/reject", RejectRegistration)
			g.POST("/:id/mark-installed", MarkInstalled)
		}
	}
}

// ============================================================================
// Public
// ============================================================================

type CreateRegistrationInput struct {
	Name            string   `json:"name" binding:"required"`
	Phone           string   `json:"phone" binding:"required"`
	Email           *string  `json:"email"`
	Address         string   `json:"address" binding:"required"`
	ProfileID       string   `json:"profileId" binding:"required"`
	AreaID          *string  `json:"areaId"`
	Notes           *string  `json:"notes"`
	ReferralCode    *string  `json:"referralCode"`
	Latitude        *float64 `json:"latitude"`
	Longitude       *float64 `json:"longitude"`
	IDCardNumber    *string  `json:"idCardNumber"`
	IDCardPhoto     *string  `json:"idCardPhoto"`
	InstallationFee float64  `json:"installationFee"`
}

func CreateRegistration(c *gin.Context) {
	var input CreateRegistrationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check phone unique
	var count int64
	database.DB.Model(&models.RegistrationRequest{}).Where("phone = ?", input.Phone).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Nomor HP sudah terdaftar"})
		return
	}

	// Validate profile
	var profile models.PppoeProfile
	if err := database.DB.First(&profile, "id = ? AND isActive = ?", input.ProfileID, true).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Paket tidak ditemukan atau tidak aktif"})
		return
	}

	reg := models.RegistrationRequest{
		ID:              util.NewID(),
		Name:            input.Name,
		Phone:           input.Phone,
		Email:           input.Email,
		Address:         input.Address,
		ProfileID:       input.ProfileID,
		AreaID:          input.AreaID,
		Notes:           input.Notes,
		ReferralCode:    input.ReferralCode,
		Latitude:        input.Latitude,
		Longitude:       input.Longitude,
		IDCardNumber:    input.IDCardNumber,
		IDCardPhoto:     input.IDCardPhoto,
		InstallationFee: input.InstallationFee,
		Status:          "PENDING",
	}

	if err := database.DB.Create(&reg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Pendaftaran berhasil! Admin akan segera menghubungi Anda.",
		"id":      reg.ID,
	})
}

// ============================================================================
// Admin
// ============================================================================

func ListRegistrations(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	search := c.Query("search")
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := database.DB.Model(&models.RegistrationRequest{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("name LIKE ? OR phone LIKE ? OR address LIKE ?", like, like, like)
	}

	var total int64
	query.Count(&total)

	// Count by status
	type StatusCount struct {
		Status string
		Count  int64
	}
	var statusCounts []StatusCount
	database.DB.Model(&models.RegistrationRequest{}).
		Select("status, COUNT(*) as count").
		Group("status").Scan(&statusCounts)

	var regs []models.RegistrationRequest
	query.Order("createdAt DESC").Offset((page - 1) * limit).Limit(limit).Find(&regs)

	c.JSON(http.StatusOK, gin.H{
		"data":         regs,
		"statusCounts": statusCounts,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

func GetRegistration(c *gin.Context) {
	id := c.Param("id")
	var reg models.RegistrationRequest
	if err := database.DB.First(&reg, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pendaftaran tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": reg})
}

func ApproveRegistration(c *gin.Context) {
	id := c.Param("id")
	var reg models.RegistrationRequest
	if err := database.DB.First(&reg, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pendaftaran tidak ditemukan"})
		return
	}
	if reg.Status != "PENDING" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hanya pendaftaran PENDING yang bisa disetujui"})
		return
	}
	database.DB.Model(&reg).Updates(map[string]interface{}{
		"status":    "APPROVED",
		"updatedAt": time.Now(),
	})
	c.JSON(http.StatusOK, gin.H{"message": "Pendaftaran disetujui"})
}

func RejectRegistration(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&input)

	database.DB.Model(&models.RegistrationRequest{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":          "REJECTED",
		"rejectionReason": input.Reason,
		"updatedAt":       time.Now(),
	})
	c.JSON(http.StatusOK, gin.H{"message": "Pendaftaran ditolak"})
}

func MarkInstalled(c *gin.Context) {
	id := c.Param("id")
	database.DB.Model(&models.RegistrationRequest{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":    "INSTALLED",
		"updatedAt": time.Now(),
	})
	c.JSON(http.StatusOK, gin.H{"message": "Pendaftaran ditandai sudah dipasang"})
}

func DeleteRegistration(c *gin.Context) {
	id := c.Param("id")
	database.DB.Where("id = ?", id).Delete(&models.RegistrationRequest{})
	c.JSON(http.StatusOK, gin.H{"message": "Pendaftaran dihapus"})
}
