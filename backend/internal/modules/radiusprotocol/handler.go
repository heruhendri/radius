package radiusprotocol

import (
	"fmt"
	"net/http"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers RADIUS protocol routes (called by FreeRADIUS REST module)
func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/radius")
	{
		g.POST("/authorize", Authorize)
		g.POST("/accounting", Accounting)
		g.POST("/post-auth", PostAuth)
		g.POST("/coa", CoA)
	}
}

// Authorize handles RADIUS Access-Request
// FreeRADIUS calls this to check if a user can connect
func Authorize(c *gin.Context) {
	username := c.PostForm("User-Name")
	if username == "" {
		// Try JSON body
		var body struct {
			Username string `json:"User-Name"`
		}
		c.ShouldBindJSON(&body)
		username = body.Username
	}

	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User-Name required"})
		return
	}

	var user models.PppoeUser
	if err := database.DB.Preload("Profile").Where("username = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"Reply-Message": "User tidak ditemukan",
			"Auth-Type":     "Reject",
		})
		return
	}

	if user.Status == "isolated" || user.Status == "disabled" {
		c.JSON(http.StatusForbidden, gin.H{
			"Reply-Message": "Akun dinonaktifkan atau diisolasi",
			"Auth-Type":     "Reject",
		})
		return
	}

	if user.ExpiredAt != nil && user.ExpiredAt.Before(time.Now()) {
		c.JSON(http.StatusForbidden, gin.H{
			"Reply-Message": "Akun sudah expired",
			"Auth-Type":     "Reject",
		})
		return
	}

	response := gin.H{
		"Auth-Type":     "Accept",
		"Reply-Message": "Welcome " + user.Name,
	}

	if user.Profile != nil {
		rateLimit := ""
		if user.Profile.RateLimit != nil {
			rateLimit = *user.Profile.RateLimit
		}
		if rateLimit == "" {
			rateLimit = fmt.Sprintf("%dM/%dM", user.Profile.UploadSpeed, user.Profile.DownloadSpeed)
		}
		response["Mikrotik-Rate-Limit"] = rateLimit
	}
	if user.IPAddress != nil {
		response["Framed-IP-Address"] = *user.IPAddress
	}

	c.JSON(http.StatusOK, response)
}

// Accounting handles RADIUS Accounting-Request
func Accounting(c *gin.Context) {
	statusType := c.PostForm("Acct-Status-Type")
	username := c.PostForm("User-Name")
	nasIP := c.PostForm("NAS-IP-Address")
	sessionID := c.PostForm("Acct-Session-Id")

	if username == "" || sessionID == "" {
		var body struct {
			StatusType string `json:"Acct-Status-Type"`
			Username   string `json:"User-Name"`
			NasIP      string `json:"NAS-IP-Address"`
			SessionID  string `json:"Acct-Session-Id"`
		}
		c.ShouldBindJSON(&body)
		statusType = body.StatusType
		username = body.Username
		nasIP = body.NasIP
		sessionID = body.SessionID
	}

	switch statusType {
	case "Start":
		// Find user ID
		var user models.PppoeUser
		database.DB.Where("username = ?", username).First(&user)

		uid := &user.ID
		session := models.Session{
			ID:            util.NewID(),
			Username:      username,
			UserID:        uid,
			NasIPAddress:  nasIP,
			SessionID:     sessionID,
			StartTime:     time.Now(),
			UploadBytes:   0,
			DownloadBytes: 0,
		}
		database.DB.Create(&session)

	case "Stop":
		now := time.Now()
		inputOctets := c.PostForm("Acct-Input-Octets")
		outputOctets := c.PostForm("Acct-Output-Octets")
		_ = inputOctets
		_ = outputOctets

		database.DB.Model(&models.Session{}).
			Where("sessionId = ?", sessionID).
			Updates(map[string]interface{}{
				"stopTime": &now,
			})

	case "Alive", "Interim-Update":
		database.DB.Model(&models.Session{}).
			Where("sessionId = ?", sessionID).
			Update("updatedAt", time.Now())
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// PostAuth handles RADIUS Post-Auth (after authentication)
func PostAuth(c *gin.Context) {
	username := c.PostForm("User-Name")
	authType := c.PostForm("Auth-Type")

	if authType == "Reject" {
		// Log failed auth
		return
	}

	// Update last login time
	if username != "" {
		database.DB.Model(&models.PppoeUser{}).
			Where("username = ?", username).
			Update("lastSyncAt", time.Now())
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// CoA handles Change of Authorization (disconnect/change session)
func CoA(c *gin.Context) {
	var input struct {
		Username string `json:"username"`
		Action   string `json:"action"` // disconnect, change-rate
		NewRate  string `json:"newRate"`
	}
	c.ShouldBindJSON(&input)

	c.JSON(http.StatusOK, gin.H{
		"message":  "CoA request diterima",
		"username": input.Username,
		"action":   input.Action,
	})
}
