package paymentgateway

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// PaymentGatewayConfig stores payment gateway configuration
type PaymentGatewayConfig struct {
	Provider     string    `json:"provider"` // midtrans, xendit, etc.
	ServerKey    string    `json:"serverKey"`
	ClientKey    string    `json:"clientKey"`
	MerchantID   string    `json:"merchantId"`
	IsProduction bool      `json:"isProduction"`
	WebhookURL   string    `json:"webhookUrl"`
	CallbackURL  string    `json:"callbackUrl"`
	Enabled      bool      `json:"enabled"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/payment-gateway")
	{
		g.GET("/config", GetConfig)
		g.PUT("/config", UpdateConfig)
		g.GET("/webhook-logs", GetWebhookLogs)
		g.POST("/webhook/:provider", HandleWebhook)
		g.GET("/status", GetStatus)
	}
}

func GetConfig(c *gin.Context) {
	// In production: read from database or env
	c.JSON(http.StatusOK, gin.H{
		"data": PaymentGatewayConfig{
			Provider:     "midtrans",
			IsProduction: false,
			Enabled:      false,
			UpdatedAt:    time.Now(),
		},
	})
}

func UpdateConfig(c *gin.Context) {
	var input PaymentGatewayConfig
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// In production: save to database
	c.JSON(http.StatusOK, gin.H{"message": "Konfigurasi payment gateway disimpan"})
}

func GetWebhookLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
}

func HandleWebhook(c *gin.Context) {
	provider := c.Param("provider")
	var payload map[string]interface{}
	c.ShouldBindJSON(&payload)

	// Log webhook
	c.JSON(http.StatusOK, gin.H{
		"status":   "received",
		"provider": provider,
	})
}

func GetStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"enabled":  false,
		"provider": "midtrans",
		"status":   "not configured",
	})
}
