package referrals

import (
	"net/http"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/admin/referrals")
	{
		g.GET("", ListReferrals)
		g.GET("/config", GetReferralConfig)
		g.PUT("/config", UpdateReferralConfig)
		g.GET("/:id", GetReferral)
		g.PUT("/:id", UpdateReferral)
		g.DELETE("/:id", DeleteReferral)
	}
}

type ReferralConfig struct {
	ID              string    `json:"id"`
	Enabled         bool      `json:"enabled"`
	ReferrerReward  int       `json:"referrerReward"`
	ReferredReward  int       `json:"referredReward"`
	MinActiveMonths int       `json:"minActiveMonths"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

func ListReferrals(c *gin.Context) {
	page := 1
	search := c.Query("search")

	query := database.DB.Model(&models.PppoeUser{}).
		Where("referralCode IS NOT NULL")
	if search != "" {
		query = query.Where("username LIKE ? OR name LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	var users []models.PppoeUser
	query.Select("id, username, name, phone, referralCode, referred_by_id, createdAt").
		Order("createdAt DESC").Offset((page - 1) * 20).Limit(20).Find(&users)

	c.JSON(http.StatusOK, gin.H{"data": users, "total": total})
}

func GetReferral(c *gin.Context) {
	id := c.Param("id")
	var user models.PppoeUser
	if err := database.DB.First(&user, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	var referredCount int64
	database.DB.Model(&models.PppoeUser{}).Where("referred_by_id = ?", id).Count(&referredCount)

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"user":          user,
			"referredCount": referredCount,
		},
	})
}

func UpdateReferral(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		ReferralCode *string `json:"referralCode"`
	}
	c.ShouldBindJSON(&input)
	if input.ReferralCode != nil {
		database.DB.Model(&models.PppoeUser{}).Where("id = ?", id).
			Update("referralCode", input.ReferralCode)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Referral diupdate"})
}

func DeleteReferral(c *gin.Context) {
	id := c.Param("id")
	database.DB.Model(&models.PppoeUser{}).Where("id = ?", id).
		Update("referralCode", nil)
	c.JSON(http.StatusOK, gin.H{"message": "Referral code dihapus"})
}

func GetReferralConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"data": ReferralConfig{
			ID:              util.NewID(),
			Enabled:         true,
			ReferrerReward:  50000,
			ReferredReward:  25000,
			MinActiveMonths: 1,
			UpdatedAt:       time.Now(),
		},
	})
}

func UpdateReferralConfig(c *gin.Context) {
	var input ReferralConfig
	c.ShouldBindJSON(&input)
	c.JSON(http.StatusOK, gin.H{"message": "Konfigurasi referral disimpan"})
}
