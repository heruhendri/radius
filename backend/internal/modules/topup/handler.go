package topup

import (
	"net/http"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"

	"github.com/gin-gonic/gin"
)

// TopupRequest stored in manual_payments with type=TOPUP
func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/admin/topup-requests")
	{
		g.GET("", ListTopupRequests)
		g.GET("/:id", GetTopupRequest)
		g.POST("/:id/approve", ApproveTopupRequest)
		g.POST("/:id/reject", RejectTopupRequest)
	}
}

func ListTopupRequests(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	query := database.DB.Model(&models.ManualPayment{}).Preload("User")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var payments []models.ManualPayment
	query.Order("createdAt DESC").Limit(50).Find(&payments)
	c.JSON(http.StatusOK, gin.H{"data": payments, "total": total})
}

func GetTopupRequest(c *gin.Context) {
	id := c.Param("id")
	var payment models.ManualPayment
	if err := database.DB.First(&payment, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Topup request tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": payment})
}

func ApproveTopupRequest(c *gin.Context) {
	id := c.Param("id")
	var payment models.ManualPayment
	if err := database.DB.First(&payment, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Topup request tidak ditemukan"})
		return
	}

	now := time.Now()
	database.DB.Model(&models.ManualPayment{}).Where("id = ?", id).
		Updates(map[string]interface{}{"status": "APPROVED", "updatedAt": &now})

	// Add balance to customer
	database.DB.Model(&models.PppoeUser{}).Where("id = ?", payment.UserID).
		Update("balance", database.DB.Raw("balance + ?", int(payment.Amount)))

	c.JSON(http.StatusOK, gin.H{"message": "Topup diapprove, saldo ditambahkan"})
}

func RejectTopupRequest(c *gin.Context) {
	id := c.Param("id")
	now := time.Now()
	database.DB.Model(&models.ManualPayment{}).Where("id = ?", id).
		Updates(map[string]interface{}{"status": "REJECTED", "updatedAt": &now})
	c.JSON(http.StatusOK, gin.H{"message": "Topup request ditolak"})
}

// Admin: Direct topup (add balance)
func DirectTopup(c *gin.Context) {
	var input struct {
		UserID string `json:"userId" binding:"required"`
		Amount int    `json:"amount" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.PppoeUser
	if err := database.DB.First(&user, "id = ?", input.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	newBalance := user.Balance + input.Amount
	database.DB.Model(&models.PppoeUser{}).Where("id = ?", input.UserID).
		Updates(map[string]interface{}{"balance": newBalance, "updatedAt": time.Now()})

	c.JSON(http.StatusOK, gin.H{
		"message":    "Topup berhasil",
		"newBalance": newBalance,
	})
}
