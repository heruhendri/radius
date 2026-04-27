package evoucher

import (
	"net/http"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

func RegisterPublicRoutes(r *gin.RouterGroup) {
	r.GET("/public/evoucher/profiles", ListPublicProfiles)
	r.POST("/public/evoucher/purchase", PurchaseVoucher)
	r.GET("/public/evoucher/order/:token", GetOrderByToken)
}

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/evoucher")
	{
		g.GET("/orders", ListOrders)
		g.GET("/orders/:id", GetOrder)
		g.PUT("/orders/:id/approve", ApproveOrder)
		g.PUT("/orders/:id/reject", RejectOrder)
	}
}

// ============================================================================
// Public routes
// ============================================================================

func ListPublicProfiles(c *gin.Context) {
	var profiles []models.HotspotProfile
	database.DB.Where("isActive = ?", true).Order("price").Find(&profiles)
	c.JSON(http.StatusOK, gin.H{"data": profiles})
}

type PurchaseInput struct {
	ProfileID     string  `json:"profileId" binding:"required"`
	CustomerName  string  `json:"customerName" binding:"required"`
	CustomerPhone string  `json:"customerPhone" binding:"required"`
	CustomerEmail *string `json:"customerEmail"`
	Quantity      int     `json:"quantity"`
}

func PurchaseVoucher(c *gin.Context) {
	var input PurchaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var profile models.HotspotProfile
	if err := database.DB.First(&profile, "id = ? AND isActive = ?", input.ProfileID, true).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Profil tidak ditemukan"})
		return
	}

	qty := input.Quantity
	if qty < 1 {
		qty = 1
	}

	paymentToken := util.NewID()
	total := profile.SellingPrice * qty
	orderNumber := "ORD-" + paymentToken[:8]

	order := models.VoucherOrder{
		ID:            util.NewID(),
		OrderNumber:   orderNumber,
		ProfileID:     input.ProfileID,
		CustomerName:  input.CustomerName,
		CustomerPhone: input.CustomerPhone,
		CustomerEmail: input.CustomerEmail,
		Quantity:      qty,
		TotalAmount:   total,
		Status:        "PENDING",
		PaymentToken:  &paymentToken,
	}

	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":     "Pesanan berhasil dibuat. Silakan lakukan pembayaran.",
		"orderNumber": orderNumber,
		"token":       paymentToken,
		"orderId":     order.ID,
		"total":       total,
	})
}

func GetOrderByToken(c *gin.Context) {
	token := c.Param("token")
	var order models.VoucherOrder
	if err := database.DB.First(&order, "paymentToken = ? OR orderNumber = ?", token, token).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pesanan tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
}

// ============================================================================
// Admin routes
// ============================================================================

func ListOrders(c *gin.Context) {
	status := c.Query("status")
	query := database.DB.Model(&models.VoucherOrder{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var orders []models.VoucherOrder
	query.Preload("Profile").Order("createdAt DESC").Find(&orders)
	c.JSON(http.StatusOK, gin.H{"data": orders})
}

func GetOrder(c *gin.Context) {
	id := c.Param("id")
	var order models.VoucherOrder
	if err := database.DB.Preload("Profile").First(&order, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pesanan tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
}

func ApproveOrder(c *gin.Context) {
	id := c.Param("id")
	now := time.Now()
	database.DB.Model(&models.VoucherOrder{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":    "APPROVED",
		"paidAt":    &now,
		"updatedAt": now,
	})
	c.JSON(http.StatusOK, gin.H{"message": "Pesanan disetujui"})
}

func RejectOrder(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&input)
	database.DB.Model(&models.VoucherOrder{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":    "REJECTED",
		"notes":     input.Reason,
		"updatedAt": time.Now(),
	})
	c.JSON(http.StatusOK, gin.H{"message": "Pesanan ditolak"})
}
