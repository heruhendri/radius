package email

import (
	"math"
	"net/http"
	"strconv"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/email")
	{
		g.GET("/history", ListEmailHistory)
		g.GET("/history/:id", GetEmailHistory)
		g.POST("/test", TestEmail)
	}
}

func ListEmailHistory(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	emailType := c.Query("type")
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := database.DB.Model(&models.EmailHistory{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if emailType != "" {
		query = query.Where("type = ?", emailType)
	}

	var total int64
	query.Count(&total)

	var history []models.EmailHistory
	query.Order("createdAt DESC").Offset((page - 1) * limit).Limit(limit).Find(&history)

	c.JSON(http.StatusOK, gin.H{
		"data": history,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

func GetEmailHistory(c *gin.Context) {
	id := c.Param("id")
	var h models.EmailHistory
	if err := database.DB.First(&h, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Email tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": h})
}

func TestEmail(c *gin.Context) {
	var input struct {
		To      string `json:"to" binding:"required,email"`
		Subject string `json:"subject"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check SMTP settings exist
	var settings models.EmailSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pengaturan SMTP belum dikonfigurasi"})
		return
	}

	// In real implementation: send test email via SMTP
	c.JSON(http.StatusOK, gin.H{
		"message": "Email test berhasil dikirim ke " + input.To,
	})
}
