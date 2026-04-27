package public

import (
	"net/http"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/public")
	{
		g.GET("/company", GetCompany)
		g.GET("/areas", GetAreas)
		g.GET("/profiles", GetProfiles)
		g.GET("/stats", GetStats)
		g.GET("/check-availability", CheckAvailability)
	}
}

func GetCompany(c *gin.Context) {
	var company models.Company
	if err := database.DB.First(&company).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": company})
}

func GetAreas(c *gin.Context) {
	var areas []models.Area
	database.DB.Where("isActive = ?", true).Order("name").Find(&areas)
	c.JSON(http.StatusOK, gin.H{"data": areas})
}

func GetProfiles(c *gin.Context) {
	areaID := c.Query("areaId")
	query := database.DB.Model(&models.PppoeProfile{}).Where("isActive = ?", true)
	if areaID != "" {
		// filter by area (join via PppoeProfileArea or filter on area column)
		query = query.Where("areaId = ? OR areaId IS NULL", areaID)
	}
	var profiles []models.PppoeProfile
	query.Order("price").Find(&profiles)
	c.JSON(http.StatusOK, gin.H{"data": profiles})
}

func GetStats(c *gin.Context) {
	var activeCustomers int64
	database.DB.Model(&models.PppoeUser{}).Where("status = ?", "active").Count(&activeCustomers)

	var totalCustomers int64
	database.DB.Model(&models.PppoeUser{}).Count(&totalCustomers)

	c.JSON(http.StatusOK, gin.H{
		"activeCustomers": activeCustomers,
		"totalCustomers":  totalCustomers,
	})
}

func CheckAvailability(c *gin.Context) {
	areaID := c.Query("areaId")
	if areaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "areaId diperlukan"})
		return
	}

	var area models.Area
	if err := database.DB.First(&area, "id = ?", areaID).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"available": false, "message": "Area tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"available": area.IsActive,
		"area":      area,
	})
}
