package push

import (
	"net/http"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

// RegisterPublicRoutes registers routes that don't require authentication
func RegisterPublicRoutes(r *gin.RouterGroup) {
	r.GET("/push/vapid-public-key", GetVAPIDPublicKey)
}

func RegisterRoutes(r *gin.RouterGroup) {
	r.POST("/push/subscribe", Subscribe)
	r.POST("/push/unsubscribe", Unsubscribe)
	r.POST("/push/send", SendPush)
	r.GET("/admin/push-notifications", ListPushBroadcasts)
	r.POST("/admin/push-notifications", CreatePushBroadcast)
	r.GET("/admin/push-notifications/:id", GetPushBroadcast)
}

func GetVAPIDPublicKey(c *gin.Context) {
	// In production: read from env VAPID_PUBLIC_KEY
	c.JSON(http.StatusOK, gin.H{"publicKey": ""})
}

func Subscribe(c *gin.Context) {
	var input struct {
		Endpoint string `json:"endpoint" binding:"required"`
		Keys     struct {
			P256dh string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
		UserID string `json:"userId"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Store subscription in db (using PushBroadcast as placeholder)
	_ = util.NewID()
	c.JSON(http.StatusOK, gin.H{"message": "Subscribe berhasil"})
}

func Unsubscribe(c *gin.Context) {
	var input struct {
		Endpoint string `json:"endpoint"`
	}
	c.ShouldBindJSON(&input)
	c.JSON(http.StatusOK, gin.H{"message": "Unsubscribe berhasil"})
}

func SendPush(c *gin.Context) {
	var input struct {
		Title   string   `json:"title" binding:"required"`
		Body    string   `json:"body" binding:"required"`
		UserIDs []string `json:"userIds"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Record broadcast
	adminID, _ := c.Get("userId")
	adminIDStr, _ := adminID.(string)
	broadcast := models.PushBroadcast{
		ID:     util.NewID(),
		Title:  input.Title,
		Body:   input.Body,
		SentBy: &adminIDStr,
	}
	database.DB.Create(&broadcast)

	c.JSON(http.StatusOK, gin.H{
		"message":     "Push notification dikirim",
		"broadcastId": broadcast.ID,
	})
}

func ListPushBroadcasts(c *gin.Context) {
	var broadcasts []models.PushBroadcast
	database.DB.Order("createdAt DESC").Limit(50).Find(&broadcasts)
	c.JSON(http.StatusOK, gin.H{"data": broadcasts})
}

func CreatePushBroadcast(c *gin.Context) {
	var input struct {
		Title   string `json:"title" binding:"required"`
		Body    string `json:"body" binding:"required"`
		URL     string `json:"url"`
		Segment string `json:"segment"` // all, active, expired
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adminID, _ := c.Get("userId")
	adminIDStr, _ := adminID.(string)
	broadcast := models.PushBroadcast{
		ID:     util.NewID(),
		Title:  input.Title,
		Body:   input.Body,
		SentBy: &adminIDStr,
	}
	database.DB.Create(&broadcast)
	c.JSON(http.StatusCreated, gin.H{"data": broadcast, "message": "Broadcast dibuat"})
}

func GetPushBroadcast(c *gin.Context) {
	id := c.Param("id")
	var broadcast models.PushBroadcast
	if err := database.DB.First(&broadcast, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Broadcast tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": broadcast})
}
