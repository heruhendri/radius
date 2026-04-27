package notifications

import (
	"net/http"
	"strconv"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/notifications")
	{
		g.GET("", ListNotifications)
		g.PUT("/:id/read", MarkRead)
		g.PUT("/read-all", MarkAllRead)
		g.DELETE("/:id", DeleteNotification)
	}
}

func ListNotifications(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
	isRead := c.Query("isRead")
	notifType := c.Query("type")
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 30
	}

	query := database.DB.Model(&models.Notification{})
	if isRead == "false" {
		query = query.Where("isRead = ?", false)
	}
	if isRead == "true" {
		query = query.Where("isRead = ?", true)
	}
	if notifType != "" {
		query = query.Where("type = ?", notifType)
	}

	var total int64
	query.Count(&total)

	var unread int64
	database.DB.Model(&models.Notification{}).Where("isRead = ?", false).Count(&unread)

	var notifs []models.Notification
	query.Order("createdAt DESC").Offset((page - 1) * limit).Limit(limit).Find(&notifs)

	c.JSON(http.StatusOK, gin.H{
		"data":   notifs,
		"total":  total,
		"unread": unread,
	})
}

func MarkRead(c *gin.Context) {
	id := c.Param("id")
	database.DB.Model(&models.Notification{}).Where("id = ?", id).Update("isRead", true)
	c.JSON(http.StatusOK, gin.H{"message": "OK"})
}

func MarkAllRead(c *gin.Context) {
	database.DB.Model(&models.Notification{}).Where("isRead = ?", false).Update("isRead", true)
	c.JSON(http.StatusOK, gin.H{"message": "Semua notifikasi sudah dibaca"})
}

func DeleteNotification(c *gin.Context) {
	id := c.Param("id")
	database.DB.Where("id = ?", id).Delete(&models.Notification{})
	c.JSON(http.StatusOK, gin.H{"message": "Notifikasi dihapus"})
}
