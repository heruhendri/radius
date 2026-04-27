package system

import (
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/admin/system")
	{
		g.GET("/info", GetSystemInfo)
		g.GET("/freeradius-backup", ListFreeradiusBackups)
		g.POST("/freeradius-backup", CreateFreeradiusBackup)
		g.GET("/freeradius-backup/:file", DownloadFreeradiusBackup)
	}
	// FreeRADIUS status endpoint (used by dashboard)
	r.GET("/system/radius", GetRadiusStatus)
	r.POST("/system/radius", PostRadiusAction)
}

func GetSystemInfo(c *gin.Context) {
	hostname, _ := os.Hostname()

	var totalUsers, activeUsers, expiredUsers int64
	database.DB.Model(&models.PppoeUser{}).Count(&totalUsers)
	database.DB.Model(&models.PppoeUser{}).Where("status = ?", "active").Count(&activeUsers)
	database.DB.Model(&models.PppoeUser{}).Where("status = ?", "expired").Count(&expiredUsers)

	var activeOnline int64
	database.DB.Model(&models.Session{}).Where("stopTime IS NULL").Count(&activeOnline)

	var pendingInvoices int64
	database.DB.Model(&models.Invoice{}).Where("status = ?", "PENDING").Count(&pendingInvoices)

	c.JSON(http.StatusOK, gin.H{
		"hostname":        hostname,
		"goVersion":       runtime.Version(),
		"goOS":            runtime.GOOS,
		"goArch":          runtime.GOARCH,
		"numCPU":          runtime.NumCPU(),
		"numGoroutine":    runtime.NumGoroutine(),
		"uptime":          time.Now().Unix(),
		"database":        "connected",
		"totalUsers":      totalUsers,
		"activeUsers":     activeUsers,
		"expiredUsers":    expiredUsers,
		"activeOnline":    activeOnline,
		"pendingInvoices": pendingInvoices,
	})
}

func ListFreeradiusBackups(c *gin.Context) {
	backupDir := "/etc/freeradius/backup"
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
		return
	}

	var files []gin.H
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, _ := entry.Info()
		files = append(files, gin.H{
			"name": entry.Name(),
			"size": func() int64 {
				if info != nil {
					return info.Size()
				}
				return 0
			}(),
			"modTime": func() time.Time {
				if info != nil {
					return info.ModTime()
				}
				return time.Time{}
			}(),
		})
	}
	if files == nil {
		files = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"data": files})
}

func CreateFreeradiusBackup(c *gin.Context) {
	backupDir := "/etc/freeradius/backup"
	os.MkdirAll(backupDir, 0750)

	timestamp := time.Now().Format("20060102-150405")
	tarFile := backupDir + "/freeradius-" + timestamp + ".tar.gz"

	cmd := exec.Command("tar", "-czf", tarFile, "/etc/freeradius/3.0")
	if err := cmd.Run(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat backup: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Backup FreeRADIUS berhasil",
		"filename": "freeradius-" + timestamp + ".tar.gz",
	})
}

func DownloadFreeradiusBackup(c *gin.Context) {
	file := c.Param("file")
	// Basic path traversal protection
	for _, ch := range file {
		if ch == '/' || ch == '\\' || ch == '.' && len(file) > 1 && file[0] == '.' {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama file tidak valid"})
			return
		}
	}
	backupPath := "/etc/freeradius/backup/" + file
	c.FileAttachment(backupPath, file)
}

// GetRadiusStatus checks FreeRADIUS service status via systemctl
func GetRadiusStatus(c *gin.Context) {
	out, err := exec.Command("systemctl", "status", "freeradius").Output()
	status := "stopped"
	uptime := "N/A"

	if err == nil || len(out) > 0 {
		output := string(out)
		if strings.Contains(output, "Active: active (running)") {
			status = "running"
			// Try to parse uptime: "since ...; Xs ago"
			if idx := strings.Index(output, " ago"); idx > 0 {
				start := strings.LastIndex(output[:idx], "; ")
				if start >= 0 {
					uptime = strings.TrimSpace(output[start+2 : idx])
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"status":  status,
		"uptime":  uptime,
	})
}

type RadiusActionInput struct {
	Action string `json:"action"`
}

// PostRadiusAction handles restart/start/stop of FreeRADIUS
func PostRadiusAction(c *gin.Context) {
	var input RadiusActionInput
	if err := c.ShouldBindJSON(&input); err != nil || input.Action == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "action required"})
		return
	}

	var cmd *exec.Cmd
	switch input.Action {
	case "restart":
		cmd = exec.Command("systemctl", "restart", "freeradius")
	case "start":
		cmd = exec.Command("systemctl", "start", "freeradius")
	case "stop":
		cmd = exec.Command("systemctl", "stop", "freeradius")
	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid action"})
		return
	}

	if err := cmd.Run(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "FreeRADIUS " + input.Action + " berhasil"})
}
