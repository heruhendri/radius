package backup

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/backup")
	{
		g.GET("", ListBackups)
		g.POST("", TriggerBackup)
		g.GET("/history", ListBackups)
		g.GET("/health", BackupHealth)
		g.DELETE("/:id", DeleteBackup)
	}
}

// ListBackups returns last 50 backup records
func ListBackups(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit < 1 || limit > 200 {
		limit = 50
	}

	var backups []models.BackupHistory
	database.DB.Order("createdAt DESC").Limit(limit).Find(&backups)
	c.JSON(http.StatusOK, gin.H{"data": backups})
}

// TriggerBackup runs mysqldump and records result
func TriggerBackup(c *gin.Context) {
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")

	if dbHost == "" {
		dbHost = "localhost"
	}
	if dbPort == "" {
		dbPort = "3306"
	}

	// Create backup directory
	backupDir := "/var/backups/salfanet"
	if err := os.MkdirAll(backupDir, 0750); err != nil {
		backupDir = "/tmp/salfanet-backups"
		os.MkdirAll(backupDir, 0750)
	}

	filename := fmt.Sprintf("backup_%s.sql", time.Now().Format("20060102_150405"))
	filepath := filepath.Join(backupDir, filename)

	// Run mysqldump
	args := []string{
		fmt.Sprintf("-h%s", dbHost),
		fmt.Sprintf("-P%s", dbPort),
		fmt.Sprintf("-u%s", dbUser),
		fmt.Sprintf("-p%s", dbPassword),
		"--single-transaction",
		"--routines",
		"--triggers",
		"-r", filepath,
		dbName,
	}

	cmd := exec.Command("mysqldump", args...)
	startedAt := time.Now()
	var backupErr error
	output, err := cmd.CombinedOutput()
	if err != nil {
		backupErr = fmt.Errorf("%s: %s", err.Error(), string(output))
	}

	duration := int(time.Since(startedAt).Milliseconds())
	status := "success"
	var errMsg *string
	var filesize int64

	if backupErr != nil {
		status = "failed"
		msg := backupErr.Error()
		errMsg = &msg
	} else {
		if info, err := os.Stat(filepath); err == nil {
			filesize = info.Size()
		}
	}

	history := models.BackupHistory{
		ID:       util.NewID(),
		Filename: filename,
		Filepath: &filepath,
		Filesize: filesize,
		Type:     "manual",
		Status:   status,
		Method:   "local",
		Error:    errMsg,
	}

	_ = duration
	database.DB.Create(&history)

	if status == "failed" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Backup gagal", "detail": errMsg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Backup berhasil",
		"filename": filename,
		"filesize": filesize,
	})
}

func BackupHealth(c *gin.Context) {
	var lastSuccess models.BackupHistory
	database.DB.Where("status = ?", "success").Order("createdAt DESC").First(&lastSuccess)

	var totalCount int64
	database.DB.Model(&models.BackupHistory{}).Count(&totalCount)

	c.JSON(http.StatusOK, gin.H{
		"lastSuccess": lastSuccess,
		"totalCount":  totalCount,
	})
}

func DeleteBackup(c *gin.Context) {
	id := c.Param("id")
	var backup models.BackupHistory
	if err := database.DB.First(&backup, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup tidak ditemukan"})
		return
	}
	// Remove file if exists
	if backup.Filepath != nil {
		os.Remove(*backup.Filepath)
	}
	database.DB.Delete(&backup)
	c.JSON(http.StatusOK, gin.H{"message": "Backup dihapus"})
}
