package manualpayments

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/manual-payments")
	{
		g.GET("", ListManualPayments)
		g.GET("/:id", GetManualPayment)
		g.PUT("/:id", UpdateManualPayment)
		g.PUT("/:id/verify", VerifyManualPayment)
		g.PUT("/:id/reject", RejectManualPayment)
	}
}

func ListManualPayments(c *gin.Context) {
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

	query := database.DB.Model(&models.ManualPayment{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("customerName LIKE ? OR customerPhone LIKE ? OR invoiceNumber LIKE ?", like, like, like)
	}

	var total int64
	query.Count(&total)

	var payments []models.ManualPayment
	query.Order("createdAt DESC").Offset((page - 1) * limit).Limit(limit).Find(&payments)

	c.JSON(http.StatusOK, gin.H{
		"data": payments,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

func GetManualPayment(c *gin.Context) {
	id := c.Param("id")
	var payment models.ManualPayment
	if err := database.DB.First(&payment, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pembayaran manual tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": payment})
}

func UpdateManualPayment(c *gin.Context) {
	id := c.Param("id")
	var payment models.ManualPayment
	if err := database.DB.First(&payment, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pembayaran manual tidak ditemukan"})
		return
	}

	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	input["updatedAt"] = time.Now()
	database.DB.Model(&payment).Updates(input)
	c.JSON(http.StatusOK, gin.H{"message": "Pembayaran diupdate"})
}

func VerifyManualPayment(c *gin.Context) {
	id := c.Param("id")
	var payment models.ManualPayment
	if err := database.DB.First(&payment, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pembayaran manual tidak ditemukan"})
		return
	}

	userID, _ := c.Get("userId")
	userName, _ := c.Get("name")
	uid := ""
	uname := ""
	if v, ok := userID.(string); ok {
		uid = v
	}
	if v, ok := userName.(string); ok {
		uname = v
	}
	now := time.Now()

	database.DB.Model(&payment).Updates(map[string]interface{}{
		"status":       "VERIFIED",
		"verifiedAt":   &now,
		"verifiedBy":   &uid,
		"verifierName": &uname,
		"updatedAt":    now,
	})
	c.JSON(http.StatusOK, gin.H{"message": "Pembayaran diverifikasi"})
}

func RejectManualPayment(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&input)

	database.DB.Model(&models.ManualPayment{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":          "REJECTED",
		"rejectionReason": input.Reason,
		"updatedAt":       time.Now(),
	})
	c.JSON(http.StatusOK, gin.H{"message": "Pembayaran ditolak"})
}
