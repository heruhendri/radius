package telegram

import (
	"fmt"
	"net/http"
	"os/exec"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/telegram")
	{
		g.GET("/settings", GetSettings)
		g.POST("/settings", SaveSettings)
		g.POST("/test", TestMessage)
		g.POST("/test-backup", TestBackupMessage)
		g.POST("/send-backup", SendBackup)
		g.POST("/send-health", SendHealth)
	}
}

func GetSettings(c *gin.Context) {
	var settings models.TelegramBackupSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": settings})
}

func SaveSettings(c *gin.Context) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Where("1 = 1").Delete(&models.TelegramBackupSettings{})
	input["id"] = fmt.Sprintf("tg-%d", time.Now().UnixNano())
	database.DB.Model(&models.TelegramBackupSettings{}).Create(input)
	c.JSON(http.StatusOK, gin.H{"message": "Pengaturan Telegram disimpan"})
}

func TestMessage(c *gin.Context) {
	var settings models.TelegramBackupSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Telegram belum dikonfigurasi"})
		return
	}
	sendTelegramMessage(settings.BotToken, settings.ChatID, "✅ Test pesan dari SALFANET RADIUS - "+time.Now().Format("2006-01-02 15:04:05"))
	c.JSON(http.StatusOK, gin.H{"message": "Pesan test dikirim"})
}

func TestBackupMessage(c *gin.Context) {
	var settings models.TelegramBackupSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Telegram belum dikonfigurasi"})
		return
	}
	msg := fmt.Sprintf("🗄️ *Test Backup Notification*\n📅 %s\n✅ Backup test berhasil", time.Now().Format("2006-01-02 15:04:05"))
	sendTelegramMessage(settings.BotToken, settings.ChatID, msg)
	c.JSON(http.StatusOK, gin.H{"message": "Test backup notification dikirim"})
}

func SendBackup(c *gin.Context) {
	var settings models.TelegramBackupSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Telegram belum dikonfigurasi"})
		return
	}

	var lastBackup models.BackupHistory
	database.DB.Where("status = ?", "success").Order("createdAt DESC").First(&lastBackup)

	msg := fmt.Sprintf("🗄️ *Backup Report*\n📅 %s\n📁 %s\n💾 %d bytes",
		time.Now().Format("2006-01-02 15:04:05"),
		lastBackup.Filename,
		lastBackup.Filesize,
	)
	sendTelegramMessage(settings.BotToken, settings.ChatID, msg)
	c.JSON(http.StatusOK, gin.H{"message": "Laporan backup dikirim ke Telegram"})
}

func SendHealth(c *gin.Context) {
	var settings models.TelegramBackupSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Telegram belum dikonfigurasi"})
		return
	}

	var activeUsers, totalUsers int64
	database.DB.Model(&models.PppoeUser{}).Where("status = ?", "active").Count(&activeUsers)
	database.DB.Model(&models.PppoeUser{}).Count(&totalUsers)

	msg := fmt.Sprintf("💚 *Health Check - %s*\n👥 Pelanggan Aktif: %d\n📊 Total Pelanggan: %d",
		time.Now().Format("2006-01-02 15:04:05"),
		activeUsers,
		totalUsers,
	)
	sendTelegramMessage(settings.BotToken, settings.ChatID, msg)
	c.JSON(http.StatusOK, gin.H{"message": "Health report dikirim ke Telegram"})
}

func sendTelegramMessage(botToken, chatID, text string) error {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	cmd := exec.Command("curl", "-s", "-X", "POST", url,
		"-d", fmt.Sprintf("chat_id=%s", chatID),
		"-d", "parse_mode=Markdown",
		"--data-urlencode", fmt.Sprintf("text=%s", text),
	)
	return cmd.Run()
}
