package permissions

import (
	"net/http"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/permissions")
	{
		g.GET("", ListPermissions)
		g.GET("/role/:role", GetRolePermissions)
		g.POST("/role-templates", SetRolePermissions)
	}
}

// ListPermissions returns all permissions grouped by category
func ListPermissions(c *gin.Context) {
	var perms []models.Permission
	database.DB.Where("isActive = ?", true).Order("category, name").Find(&perms)

	grouped := make(map[string][]models.Permission)
	for _, p := range perms {
		grouped[p.Category] = append(grouped[p.Category], p)
	}

	c.JSON(http.StatusOK, gin.H{"data": grouped})
}

// GetRolePermissions returns permission keys for a specific role
func GetRolePermissions(c *gin.Context) {
	role := c.Param("role")
	var rolePerms []models.RolePermission
	database.DB.Where("role = ?", role).Preload("Permission").Find(&rolePerms)

	keys := make([]string, 0, len(rolePerms))
	for _, rp := range rolePerms {
		if rp.Permission != nil {
			keys = append(keys, rp.Permission.Key)
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": keys})
}

type SetRolePermsInput struct {
	Role          string   `json:"role" binding:"required"`
	PermissionIDs []string `json:"permissionIds"`
}

// SetRolePermissions replaces permissions template for a role
func SetRolePermissions(c *gin.Context) {
	var input SetRolePermsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Where("role = ?", input.Role).Delete(&models.RolePermission{})
	for _, pid := range input.PermissionIDs {
		rp := models.RolePermission{
			ID:           util.NewID(),
			Role:         input.Role,
			PermissionID: pid,
		}
		database.DB.Create(&rp)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role permissions berhasil diupdate"})
}
