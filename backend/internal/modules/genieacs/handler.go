package genieacs

import (
	"net/http"
	"os"

	"radius-buildup/internal/database"

	"github.com/gin-gonic/gin"
)

// GenieACS settings from database
type GenieacsSettings struct {
	ID       string `json:"id"`
	URL      string `json:"url"`
	Username string `json:"username"`
	Password string `json:"password"`
	Enabled  bool   `json:"enabled"`
}

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/genieacs")
	{
		g.GET("/devices", ListDevices)
		g.GET("/devices/:id", GetDevice)
		g.POST("/devices/:id/reboot", RebootDevice)
		g.POST("/devices/:id/factory-reset", FactoryResetDevice)
		g.GET("/devices/:id/parameters", GetDeviceParameters)
		g.PUT("/devices/:id/parameters", SetDeviceParameters)
		g.POST("/devices/:id/task", CreateDeviceTask)
		g.GET("/faults", ListFaults)
		g.POST("/faults/:id/delete", DeleteFault)
	}

	s := r.Group("/settings/genieacs")
	{
		s.GET("", GetSettings)
		s.PUT("", SaveSettings)
		s.POST("/test", TestConnection)
	}
}

func getGenieacsURL() string {
	url := os.Getenv("GENIEACS_URL")
	if url == "" {
		// Try from database
		var settings map[string]interface{}
		database.DB.Table("genieacsSettings").First(&settings)
		if u, ok := settings["url"].(string); ok && u != "" {
			return u
		}
		return "http://localhost:7557"
	}
	return url
}

func proxyGenieACS(method, path string, body interface{}, c *gin.Context) {
	// GenieACS integration placeholder
	// In production: forward request to GenieACS server via HTTP client
	c.JSON(http.StatusNotImplemented, gin.H{
		"message": "GenieACS proxy - server: " + getGenieacsURL() + path,
		"method":  method,
	})
}

func ListDevices(c *gin.Context) {
	proxyGenieACS("GET", "/devices", nil, c)
}

func GetDevice(c *gin.Context) {
	id := c.Param("id")
	proxyGenieACS("GET", "/devices/"+id, nil, c)
}

func RebootDevice(c *gin.Context) {
	id := c.Param("id")
	proxyGenieACS("POST", "/devices/"+id+"/tasks", map[string]interface{}{
		"name": "reboot",
	}, c)
}

func FactoryResetDevice(c *gin.Context) {
	id := c.Param("id")
	proxyGenieACS("POST", "/devices/"+id+"/tasks", map[string]interface{}{
		"name": "factoryReset",
	}, c)
}

func GetDeviceParameters(c *gin.Context) {
	id := c.Param("id")
	proxyGenieACS("GET", "/devices/"+id, nil, c)
}

func SetDeviceParameters(c *gin.Context) {
	id := c.Param("id")
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	proxyGenieACS("POST", "/devices/"+id+"/tasks", input, c)
}

func CreateDeviceTask(c *gin.Context) {
	id := c.Param("id")
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	proxyGenieACS("POST", "/devices/"+id+"/tasks", input, c)
}

func ListFaults(c *gin.Context) {
	proxyGenieACS("GET", "/faults", nil, c)
}

func DeleteFault(c *gin.Context) {
	id := c.Param("id")
	proxyGenieACS("DELETE", "/faults/"+id, nil, c)
}

func GetSettings(c *gin.Context) {
	var settings map[string]interface{}
	if err := database.DB.Table("genieacsSettings").First(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}
	// Don't expose password
	delete(settings, "password")
	c.JSON(http.StatusOK, gin.H{"data": settings})
}

func SaveSettings(c *gin.Context) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Table("genieacsSettings").Where("1 = 1").Delete(nil)
	if input["id"] == nil || input["id"] == "" {
		input["id"] = "genieacs-1"
	}
	database.DB.Table("genieacsSettings").Create(input)
	c.JSON(http.StatusOK, gin.H{"message": "Pengaturan GenieACS disimpan"})
}

func TestConnection(c *gin.Context) {
	url := getGenieacsURL()
	c.JSON(http.StatusOK, gin.H{
		"message": "Test koneksi ke GenieACS: " + url,
		"url":     url,
	})
}
