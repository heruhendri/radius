package freeradius

import (
	"bufio"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/freeradius")
	{
		g.GET("/status", GetStatus)
		g.POST("/start", StartService)
		g.POST("/stop", StopService)
		g.POST("/restart", RestartService)
		g.GET("/logs", GetLogs)
		g.GET("/radcheck", GetRadcheck)
		g.GET("/radcheck/:username", GetUserRadcheck)
	}
}

func runSystemctl(action string) (string, error) {
	cmd := exec.Command("systemctl", action, "freeradius")
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func GetStatus(c *gin.Context) {
	cmd := exec.Command("systemctl", "is-active", "freeradius")
	out, _ := cmd.Output()
	active := strings.TrimSpace(string(out)) == "active"

	cmd2 := exec.Command("systemctl", "status", "freeradius", "--no-pager", "-l", "--output=short")
	out2, _ := cmd2.Output()

	c.JSON(http.StatusOK, gin.H{
		"active":  active,
		"status":  strings.TrimSpace(string(out)),
		"details": string(out2),
	})
}

func StartService(c *gin.Context) {
	out, err := runSystemctl("start")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal start freeradius", "detail": out})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "FreeRADIUS berhasil distart"})
}

func StopService(c *gin.Context) {
	out, err := runSystemctl("stop")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal stop freeradius", "detail": out})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "FreeRADIUS berhasil distop"})
}

func RestartService(c *gin.Context) {
	out, err := runSystemctl("restart")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal restart freeradius", "detail": out})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "FreeRADIUS berhasil direstart"})
}

func GetLogs(c *gin.Context) {
	lines := c.DefaultQuery("lines", "100")

	cmd := exec.Command("journalctl", "-u", "freeradius", "-n", lines, "--no-pager", "--output=short")
	out, err := cmd.Output()
	if err != nil {
		// Fallback: try reading log file
		cmd2 := exec.Command("tail", fmt.Sprintf("-n%s", lines), "/var/log/freeradius/radius.log")
		out, err = cmd2.Output()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca log freeradius"})
			return
		}
	}

	var logLines []string
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		logLines = append(logLines, scanner.Text())
	}
	c.JSON(http.StatusOK, gin.H{"data": logLines})
}

// GetRadcheck returns recent radcheck entries
func GetRadcheck(c *gin.Context) {
	username := c.Query("username")
	limit := c.DefaultQuery("limit", "100")
	_ = limit

	type RadCheck struct {
		ID        uint   `json:"id"`
		Username  string `json:"username"`
		Attribute string `json:"attribute"`
		Op        string `json:"op"`
		Value     string `json:"value"`
	}

	query := database.DB.Table("radcheck")
	if username != "" {
		query = query.Where("username = ?", username)
	}

	var entries []RadCheck
	query.Order("id DESC").Limit(100).Find(&entries)
	c.JSON(http.StatusOK, gin.H{"data": entries})
}

func GetUserRadcheck(c *gin.Context) {
	username := c.Param("username")

	// Check from PPPoE users
	var user models.PppoeUser
	database.DB.First(&user, "username = ?", username)

	type RadCheck struct {
		ID        uint   `json:"id"`
		Username  string `json:"username"`
		Attribute string `json:"attribute"`
		Op        string `json:"op"`
		Value     string `json:"value"`
	}

	var radcheck []RadCheck
	database.DB.Table("radcheck").Where("username = ?", username).Find(&radcheck)

	c.JSON(http.StatusOK, gin.H{
		"user":      user,
		"radcheck":  radcheck,
		"checkedAt": time.Now(),
	})
}
