package suspend

import (
	"net/http"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/admin/suspend-requests")
	{
		g.GET("", ListSuspendRequests)
		g.GET("/:id", GetSuspendRequest)
		g.PATCH("/:id", UpdateSuspendRequest)
		g.POST("/:id/approve", ApproveSuspendRequest)
		g.POST("/:id/reject", RejectSuspendRequest)
	}
}

func ListSuspendRequests(c *gin.Context) {
	status := c.Query("status")
	query := database.DB.Model(&models.SuspendRequest{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var total int64
	query.Count(&total)
	var requests []models.SuspendRequest
	query.Order("requestedAt DESC").Limit(50).Find(&requests)
	c.JSON(http.StatusOK, gin.H{"data": requests, "total": total})
}

func GetSuspendRequest(c *gin.Context) {
	id := c.Param("id")
	var req models.SuspendRequest
	if err := database.DB.First(&req, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": req})
}

func UpdateSuspendRequest(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		Status     string `json:"status"`
		AdminNotes string `json:"adminNotes"`
	}
	c.ShouldBindJSON(&input)
	database.DB.Model(&models.SuspendRequest{}).Where("id = ?", id).
		Updates(map[string]interface{}{"status": input.Status, "adminNotes": input.AdminNotes, "updatedAt": time.Now()})
	c.JSON(http.StatusOK, gin.H{"message": "Suspend request diupdate"})
}

func ApproveSuspendRequest(c *gin.Context) {
	id := c.Param("id")
	var req models.SuspendRequest
	if err := database.DB.First(&req, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request tidak ditemukan"})
		return
	}

	database.DB.Model(&models.SuspendRequest{}).Where("id = ?", id).
		Updates(map[string]interface{}{"status": "APPROVED", "updatedAt": time.Now()})
	// Suspend the user
	database.DB.Model(&models.PppoeUser{}).Where("id = ?", req.UserID).
		Updates(map[string]interface{}{"status": "suspended", "updatedAt": time.Now()})

	c.JSON(http.StatusOK, gin.H{"message": "Suspend request diapprove"})
}

func RejectSuspendRequest(c *gin.Context) {
	id := c.Param("id")
	database.DB.Model(&models.SuspendRequest{}).Where("id = ?", id).
		Updates(map[string]interface{}{"status": "REJECTED", "updatedAt": time.Now()})
	c.JSON(http.StatusOK, gin.H{"message": "Suspend request ditolak"})
}
