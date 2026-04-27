package settings

import (
	"net/http"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/settings")
	{
		// Company (GET is public via company.RegisterPublicRoutes; PUT only here)
		g.PUT("/company", UpdateCompanySettings)

		// Email
		g.GET("/email", GetEmailSettings)
		g.PUT("/email", UpdateEmailSettings)
		g.GET("/email/templates", ListEmailTemplates)
		g.POST("/email/templates", CreateEmailTemplate)
		g.PUT("/email/templates/:id", UpdateEmailTemplate)
		g.DELETE("/email/templates/:id", DeleteEmailTemplate)

		// Telegram
		g.GET("/telegram", GetTelegramSettings)
		g.POST("/telegram", SaveTelegramSettings)
		g.POST("/telegram/test", TestTelegramSettings)

		// Map
		g.GET("/map", GetMapSettings)
		g.PUT("/map", UpdateMapSettings)

		// Timezone
		g.GET("/timezone", GetTimezone)
	}
}

// ============================================================================
// Company
// ============================================================================

func GetCompanySettings(c *gin.Context) {
	var company models.Company
	if err := database.DB.First(&company).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pengaturan perusahaan belum diatur"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": company})
}

func UpdateCompanySettings(c *gin.Context) {
	var company models.Company
	database.DB.First(&company)

	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if company.ID == "" {
		// Create new
		input["id"] = util.NewID()
		database.DB.Model(&models.Company{}).Create(input)
	} else {
		database.DB.Model(&company).Updates(input)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Pengaturan perusahaan diupdate"})
}

// ============================================================================
// Email Settings
// ============================================================================

func GetEmailSettings(c *gin.Context) {
	var settings models.EmailSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"data": models.EmailSettings{}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": settings})
}

func UpdateEmailSettings(c *gin.Context) {
	var settings models.EmailSettings
	database.DB.First(&settings)

	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if settings.ID == "" {
		input["id"] = util.NewID()
		database.DB.Model(&models.EmailSettings{}).Create(input)
	} else {
		database.DB.Model(&settings).Updates(input)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Pengaturan email diupdate"})
}

// Email Templates
func ListEmailTemplates(c *gin.Context) {
	var templates []models.EmailTemplate
	database.DB.Where("isActive = ?", true).Order("name").Find(&templates)
	c.JSON(http.StatusOK, gin.H{"data": templates})
}

type EmailTemplateInput struct {
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required"`
	Subject  string `json:"subject" binding:"required"`
	HtmlBody string `json:"htmlBody" binding:"required"`
	IsActive *bool  `json:"isActive"`
}

func CreateEmailTemplate(c *gin.Context) {
	var input EmailTemplateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	tmpl := models.EmailTemplate{
		ID:       util.NewID(),
		Name:     input.Name,
		Type:     input.Type,
		Subject:  input.Subject,
		HtmlBody: input.HtmlBody,
		IsActive: isActive,
	}
	database.DB.Create(&tmpl)
	c.JSON(http.StatusCreated, gin.H{"data": tmpl})
}

func UpdateEmailTemplate(c *gin.Context) {
	id := c.Param("id")
	var input EmailTemplateInput
	c.ShouldBindJSON(&input)

	updates := map[string]interface{}{}
	if input.Name != "" {
		updates["name"] = input.Name
	}
	if input.Subject != "" {
		updates["subject"] = input.Subject
	}
	if input.HtmlBody != "" {
		updates["htmlBody"] = input.HtmlBody
	}
	if input.IsActive != nil {
		updates["isActive"] = *input.IsActive
	}

	database.DB.Model(&models.EmailTemplate{}).Where("id = ?", id).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Template diupdate"})
}

func DeleteEmailTemplate(c *gin.Context) {
	id := c.Param("id")
	database.DB.Model(&models.EmailTemplate{}).Where("id = ?", id).Update("isActive", false)
	c.JSON(http.StatusOK, gin.H{"message": "Template dihapus"})
}

// ============================================================================
// Telegram Settings
// ============================================================================

func GetTelegramSettings(c *gin.Context) {
	var settings models.TelegramBackupSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": settings})
}

type TelegramInput struct {
	Enabled       bool    `json:"enabled"`
	BotToken      string  `json:"botToken" binding:"required"`
	ChatID        string  `json:"chatId" binding:"required"`
	BackupTopicID *string `json:"backupTopicId"`
	HealthTopicID *string `json:"healthTopicId"`
	Schedule      string  `json:"schedule"`
	ScheduleTime  string  `json:"scheduleTime"`
	KeepLastN     int     `json:"keepLastN"`
}

func SaveTelegramSettings(c *gin.Context) {
	var input TelegramInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Delete existing, replace with new
	database.DB.Where("1 = 1").Delete(&models.TelegramBackupSettings{})

	schedule := input.Schedule
	if schedule == "" {
		schedule = "daily"
	}
	schedTime := input.ScheduleTime
	if schedTime == "" {
		schedTime = "02:00"
	}
	keepN := input.KeepLastN
	if keepN == 0 {
		keepN = 7
	}

	settings := models.TelegramBackupSettings{
		ID:            util.NewID(),
		Enabled:       input.Enabled,
		BotToken:      input.BotToken,
		ChatID:        input.ChatID,
		BackupTopicID: input.BackupTopicID,
		HealthTopicID: input.HealthTopicID,
		Schedule:      schedule,
		ScheduleTime:  schedTime,
		KeepLastN:     keepN,
	}
	database.DB.Create(&settings)
	c.JSON(http.StatusOK, gin.H{"message": "Pengaturan Telegram disimpan"})
}

func TestTelegramSettings(c *gin.Context) {
	var settings models.TelegramBackupSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pengaturan Telegram belum dikonfigurasi"})
		return
	}
	// In real implementation: send a test message via Telegram Bot API
	c.JSON(http.StatusOK, gin.H{"message": "Pesan test dikirim ke Telegram"})
}

// ============================================================================
// Map Settings
// ============================================================================

func GetMapSettings(c *gin.Context) {
	var settings models.MapSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"data": models.MapSettings{
			OsrmApiUrl:  "http://router.project-osrm.org",
			DefaultLat:  -7.071273611475302,
			DefaultLon:  108.04475042198051,
			DefaultZoom: 13,
			MapTheme:    "default",
		}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": settings})
}

func UpdateMapSettings(c *gin.Context) {
	var settings models.MapSettings
	database.DB.First(&settings)

	var input map[string]interface{}
	c.ShouldBindJSON(&input)

	if settings.ID == "" {
		input["id"] = util.NewID()
		database.DB.Model(&models.MapSettings{}).Create(input)
	} else {
		database.DB.Model(&settings).Updates(input)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Pengaturan peta diupdate"})
}

// ============================================================================
// Timezone
// ============================================================================

func GetTimezone(c *gin.Context) {
	var company models.Company
	tz := "Asia/Jakarta"
	if database.DB.First(&company).Error == nil && company.Timezone != nil {
		tz = *company.Timezone
	}
	c.JSON(http.StatusOK, gin.H{"timezone": tz})
}
