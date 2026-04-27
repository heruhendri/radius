package vouchertemplates

import (
	"net/http"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/voucher-templates")
	{
		g.GET("", ListTemplates)
		g.POST("", CreateTemplate)
		g.GET("/:id", GetTemplate)
		g.PUT("/:id", UpdateTemplate)
		g.DELETE("/:id", DeleteTemplate)
	}
}

func ListTemplates(c *gin.Context) {
	var templates []models.VoucherTemplate
	database.DB.Order("isDefault desc, name").Find(&templates)
	if templates == nil {
		templates = []models.VoucherTemplate{}
	}
	c.JSON(http.StatusOK, templates)
}

func GetTemplate(c *gin.Context) {
	id := c.Param("id")
	var tmpl models.VoucherTemplate
	if err := database.DB.First(&tmpl, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tmpl})
}

type TemplateInput struct {
	Name         string `json:"name" binding:"required"`
	HtmlTemplate string `json:"htmlTemplate" binding:"required"`
	IsDefault    *bool  `json:"isDefault"`
	IsActive     *bool  `json:"isActive"`
}

func CreateTemplate(c *gin.Context) {
	var input TemplateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	isDefault := false
	if input.IsDefault != nil {
		isDefault = *input.IsDefault
	}

	tmpl := models.VoucherTemplate{
		ID:           util.NewID(),
		Name:         input.Name,
		HtmlTemplate: input.HtmlTemplate,
		IsDefault:    isDefault,
		IsActive:     isActive,
	}
	database.DB.Create(&tmpl)
	c.JSON(http.StatusCreated, gin.H{"data": tmpl})
}

func UpdateTemplate(c *gin.Context) {
	id := c.Param("id")
	var tmpl models.VoucherTemplate
	if err := database.DB.First(&tmpl, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template tidak ditemukan"})
		return
	}

	var input TemplateInput
	c.ShouldBindJSON(&input)

	updates := map[string]interface{}{"updatedAt": time.Now()}
	if input.Name != "" {
		updates["name"] = input.Name
	}
	if input.HtmlTemplate != "" {
		updates["htmlTemplate"] = input.HtmlTemplate
	}
	if input.IsActive != nil {
		updates["isActive"] = *input.IsActive
	}
	if input.IsDefault != nil {
		updates["isDefault"] = *input.IsDefault
	}

	database.DB.Model(&tmpl).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Template diupdate"})
}

func DeleteTemplate(c *gin.Context) {
	id := c.Param("id")
	database.DB.Model(&models.VoucherTemplate{}).Where("id = ?", id).Update("isActive", false)
	c.JSON(http.StatusOK, gin.H{"message": "Template dihapus"})
}
