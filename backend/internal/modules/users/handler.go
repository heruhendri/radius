package users

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func RegisterRoutes(r *gin.RouterGroup) {
	// Support both /users and /admin/users paths
	for _, prefix := range []string{"/users", "/admin/users"} {
		g := r.Group(prefix)
		{
			g.GET("", ListAdminUsers)
			g.GET("/:id", GetAdminUser)
			g.POST("", CreateAdminUser)
			g.PUT("/:id", UpdateAdminUser)
			g.DELETE("/:id", DeleteAdminUser)
			g.PUT("/:id/permissions", SetUserPermissions)
			g.GET("/:id/permissions", GetUserPermissions)
			g.DELETE("/:id/permissions", ResetUserPermissions)
		}
	}
}

// ListAdminUsers returns all admin users with their permissions
func ListAdminUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")
	role := c.Query("role")
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := database.DB.Model(&models.AdminUser{})
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("username LIKE ? OR name LIKE ? OR email LIKE ?", like, like, like)
	}
	if role != "" {
		query = query.Where("role = ?", role)
	}

	var total int64
	query.Count(&total)

	var users []models.AdminUser
	query.Preload("UserPermissions.Permission").
		Order("createdAt DESC").
		Offset((page - 1) * limit).Limit(limit).
		Find(&users)

	c.JSON(http.StatusOK, gin.H{
		"data": users,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

// GetAdminUser returns a single admin user
func GetAdminUser(c *gin.Context) {
	id := c.Param("id")
	var user models.AdminUser
	if err := database.DB.Preload("UserPermissions.Permission").First(&user, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": user})
}

type CreateUserInput struct {
	Username    string   `json:"username" binding:"required"`
	Email       *string  `json:"email"`
	Password    string   `json:"password" binding:"required,min=6"`
	Name        string   `json:"name" binding:"required"`
	Role        string   `json:"role"`
	Phone       *string  `json:"phone"`
	IsActive    *bool    `json:"isActive"`
	Permissions []string `json:"permissions"` // permission IDs
}

// CreateAdminUser creates a new admin user
func CreateAdminUser(c *gin.Context) {
	var input CreateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check username unique
	var count int64
	database.DB.Model(&models.AdminUser{}).Where("username = ?", input.Username).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Username sudah digunakan"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hash password"})
		return
	}

	role := input.Role
	if role == "" {
		role = "CUSTOMER_SERVICE"
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	user := models.AdminUser{
		ID:       util.NewID(),
		Username: input.Username,
		Email:    input.Email,
		Password: string(hashed),
		Name:     input.Name,
		Role:     role,
		IsActive: isActive,
		Phone:    input.Phone,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Set permissions if provided
	if len(input.Permissions) > 0 {
		setPermissions(user.ID, input.Permissions)
	}

	c.JSON(http.StatusCreated, gin.H{"data": user, "message": "User berhasil dibuat"})
}

type UpdateUserInput struct {
	Email    *string `json:"email"`
	Password *string `json:"password"`
	Name     *string `json:"name"`
	Role     *string `json:"role"`
	Phone    *string `json:"phone"`
	IsActive *bool   `json:"isActive"`
}

// UpdateAdminUser updates an admin user
func UpdateAdminUser(c *gin.Context) {
	id := c.Param("id")
	var user models.AdminUser
	if err := database.DB.First(&user, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	var input UpdateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{"updatedAt": time.Now()}
	if input.Email != nil {
		updates["email"] = input.Email
	}
	if input.Name != nil {
		updates["name"] = *input.Name
	}
	if input.Role != nil {
		updates["role"] = *input.Role
	}
	if input.Phone != nil {
		updates["phone"] = input.Phone
	}
	if input.IsActive != nil {
		updates["isActive"] = *input.IsActive
	}
	if input.Password != nil && *input.Password != "" {
		hashed, _ := bcrypt.GenerateFromPassword([]byte(*input.Password), bcrypt.DefaultCost)
		updates["password"] = string(hashed)
	}

	database.DB.Model(&user).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"data": user, "message": "User berhasil diupdate"})
}

// DeleteAdminUser soft-deletes an admin user
func DeleteAdminUser(c *gin.Context) {
	id := c.Param("id")
	var user models.AdminUser
	if err := database.DB.First(&user, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}
	database.DB.Delete(&user)
	c.JSON(http.StatusOK, gin.H{"message": "User berhasil dihapus"})
}

// GetUserPermissions returns all permissions for a user
// Falls back to role-template permissions when user has no custom permissions
func GetUserPermissions(c *gin.Context) {
	id := c.Param("id")

	// Check custom user permissions
	var perms []models.UserPermission
	database.DB.Where("userId = ?", id).Preload("Permission").Find(&perms)

	keys := make([]string, 0, len(perms))
	for _, p := range perms {
		if p.Permission != nil {
			keys = append(keys, p.Permission.Key)
		}
	}

	// If no custom permissions, fall back to role template
	if len(keys) == 0 {
		var user models.AdminUser
		if err := database.DB.Select("id, role").First(&user, "id = ?", id).Error; err == nil {
			if user.Role == "SUPER_ADMIN" {
				// Super admin gets all permissions
				var allPerms []models.Permission
				database.DB.Find(&allPerms)
				for _, p := range allPerms {
					keys = append(keys, p.Key)
				}
			} else {
				// Other roles: get from role_permissions table
				var rolePerms []models.RolePermission
				database.DB.Where("role = ?", user.Role).Preload("Permission").Find(&rolePerms)
				for _, rp := range rolePerms {
					if rp.Permission != nil {
						keys = append(keys, rp.Permission.Key)
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "permissions": keys})
}

type SetPermissionsInput struct {
	PermissionIDs []string `json:"permissionIds"`
}

// SetUserPermissions replaces all permissions for a user
func SetUserPermissions(c *gin.Context) {
	id := c.Param("id")
	var input SetPermissionsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Delete existing
	database.DB.Where("userId = ?", id).Delete(&models.UserPermission{})
	// Set new
	setPermissions(id, input.PermissionIDs)

	c.JSON(http.StatusOK, gin.H{"message": "Permissions berhasil diupdate"})
}

func setPermissions(userID string, permIDs []string) {
	for _, pid := range permIDs {
		perm := models.UserPermission{
			ID:           util.NewID(),
			UserID:       userID,
			PermissionID: pid,
		}
		database.DB.Create(&perm)
	}
}

// ResetUserPermissions deletes all custom permissions (reset to role defaults)
func ResetUserPermissions(c *gin.Context) {
	id := c.Param("id")
	database.DB.Where("userId = ?", id).Delete(&models.UserPermission{})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Permissions reset to role template"})
}

// suppress unused import warnings for time/strconv used elsewhere
var _ = time.Now
var _ = strconv.Itoa
