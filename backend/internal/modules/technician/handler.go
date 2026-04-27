package technician

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"radius-buildup/internal/config"
	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func RegisterPublicRoutes(r *gin.RouterGroup, cfg *config.Config) {
	tech := r.Group("/technician/auth")
	{
		tech.POST("/login", func(c *gin.Context) { Login(c, cfg) })
		tech.POST("/request-otp", RequestOTP)
		tech.POST("/verify-otp", func(c *gin.Context) { VerifyOTP(c, cfg) })
	}
}

func RegisterRoutes(r *gin.RouterGroup) {
	// Admin management of technicians
	admin := r.Group("/admin/technicians")
	{
		admin.GET("", ListAdminTechnicians)
		admin.POST("", CreateAdminTechnician)
		admin.PUT("/:id", UpdateAdminTechnician)
		admin.DELETE("/:id", DeleteAdminTechnician)
	}

	// Technician's own endpoints
	g := r.Group("/technician")
	{
		g.GET("/profile", GetProfile)
		g.GET("/tickets", ListTickets)
		g.PATCH("/tickets/:id", UpdateTicket)
		g.GET("/work-orders", ListWorkOrders)
		g.PATCH("/work-orders/:id", UpdateWorkOrder)
		g.GET("/customers", ListCustomers)
	}
}

// ============================================================================
// Auth
// ============================================================================

type LoginInput struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func Login(c *gin.Context, cfg *config.Config) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var admin models.AdminUser
	if err := database.DB.Where("username = ? AND role = ?", input.Username, "TECHNICIAN").First(&admin).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Username atau password salah"})
		return
	}
	if !admin.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akun tidak aktif"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Username atau password salah"})
		return
	}

	now := time.Now()
	database.DB.Model(&admin).Update("lastLogin", now)

	token, _ := generateToken(admin.ID, admin.Username, admin.Name, admin.Role, cfg.JWTSecret)
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  gin.H{"id": admin.ID, "name": admin.Name, "role": admin.Role},
	})
}

type RequestOTPInput struct {
	Phone string `json:"phone" binding:"required"`
}

func RequestOTP(c *gin.Context) {
	var input RequestOTPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var tech models.Technician
	if err := database.DB.Where("phoneNumber = ? AND isActive = ?", input.Phone, true).First(&tech).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Nomor HP tidak terdaftar"})
		return
	}

	// Generate 6-digit OTP
	otp := generateOTP()
	expiry := time.Now().Add(5 * time.Minute)

	techOtp := models.TechnicianOtp{
		ID:           util.NewID(),
		TechnicianID: tech.ID,
		PhoneNumber:  input.Phone,
		OtpCode:      otp,
		IsUsed:       false,
		ExpiresAt:    expiry,
	}
	database.DB.Create(&techOtp)

	// In real implementation: send OTP via WhatsApp
	c.JSON(http.StatusOK, gin.H{
		"message":   "OTP berhasil dikirim ke WhatsApp",
		"expiresAt": expiry,
		// Only for development: remove in production
		// "otp": otp,
	})
}

type VerifyOTPInput struct {
	Phone string `json:"phone" binding:"required"`
	OTP   string `json:"otp" binding:"required"`
}

func VerifyOTP(c *gin.Context, cfg *config.Config) {
	var input VerifyOTPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var techOtp models.TechnicianOtp
	if err := database.DB.Where(
		"phoneNumber = ? AND otpCode = ? AND isUsed = ? AND expiresAt > ?",
		input.Phone, input.OTP, false, time.Now(),
	).First(&techOtp).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "OTP tidak valid atau sudah kadaluarsa"})
		return
	}

	// Mark OTP as used
	database.DB.Model(&techOtp).Update("isUsed", true)

	var tech models.Technician
	database.DB.First(&tech, "id = ?", techOtp.TechnicianID)

	now := time.Now()
	database.DB.Model(&tech).Update("lastLoginAt", now)

	token, _ := generateToken(tech.ID, tech.PhoneNumber, tech.Name, "TECHNICIAN", cfg.JWTSecret)
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"technician": gin.H{
			"id": tech.ID, "name": tech.Name, "phone": tech.PhoneNumber,
		},
	})
}

// ============================================================================
// Profile
// ============================================================================

func GetProfile(c *gin.Context) {
	userID, _ := c.Get("userId")
	role, _ := c.Get("role")

	if role == "TECHNICIAN" {
		var tech models.Technician
		if err := database.DB.Where("id = ? OR phoneNumber = ?", userID, userID).First(&tech).Error; err != nil {
			// Fallback to adminUser
			var admin models.AdminUser
			database.DB.First(&admin, "id = ?", userID)
			c.JSON(http.StatusOK, gin.H{"data": admin})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": tech})
		return
	}

	var admin models.AdminUser
	database.DB.First(&admin, "id = ?", userID)
	c.JSON(http.StatusOK, gin.H{"data": admin})
}

// ============================================================================
// Tickets (technician view)
// ============================================================================

func ListTickets(c *gin.Context) {
	userID, _ := c.Get("userId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	assigned := c.Query("assigned") // "me" = only my tickets
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := database.DB.Model(&models.Ticket{})
	if assigned == "me" {
		query = query.Where("assignedToId = ?", userID)
	} else {
		query = query.Where("status IN ('OPEN','IN_PROGRESS') OR assignedToId = ?", userID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var tickets []models.Ticket
	query.Preload("Category").Order("createdAt DESC").
		Offset((page - 1) * limit).Limit(limit).Find(&tickets)

	c.JSON(http.StatusOK, gin.H{
		"data": tickets,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

type UpdateTicketInput struct {
	Status     *string `json:"status"`
	Claim      bool    `json:"claim"`
	Message    *string `json:"message"`
	IsInternal bool    `json:"isInternal"`
	SenderName string  `json:"senderName"`
}

func UpdateTicket(c *gin.Context) {
	id := c.Param("id")
	userID, _ := c.Get("userId")
	userName, _ := c.Get("name")

	var ticket models.Ticket
	if err := database.DB.First(&ticket, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tiket tidak ditemukan"})
		return
	}

	var input UpdateTicketInput
	c.ShouldBindJSON(&input)

	updates := map[string]interface{}{"updatedAt": time.Now()}

	if input.Claim {
		uid := userID.(string)
		assignType := "TECHNICIAN"
		updates["assignedToId"] = uid
		updates["assignedToType"] = assignType
		updates["status"] = "IN_PROGRESS"
	}
	if input.Status != nil {
		updates["status"] = *input.Status
		if *input.Status == "RESOLVED" {
			updates["resolvedAt"] = time.Now()
		} else if *input.Status == "CLOSED" {
			updates["closedAt"] = time.Now()
		}
	}
	if input.Message != nil && *input.Message != "" {
		name := "Teknisi"
		if n, ok := userName.(string); ok && n != "" {
			name = n
		}
		if input.SenderName != "" {
			name = input.SenderName
		}
		uid := ""
		if v, ok := userID.(string); ok {
			uid = v
		}
		msg := models.TicketMessage{
			ID:         util.NewID(),
			TicketID:   id,
			SenderType: "TECHNICIAN",
			SenderID:   &uid,
			SenderName: name,
			Message:    *input.Message,
			IsInternal: input.IsInternal,
		}
		database.DB.Create(&msg)
		now := time.Now()
		updates["lastResponseAt"] = now
	}

	database.DB.Model(&ticket).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Tiket berhasil diupdate"})
}

// ============================================================================
// Work Orders
// ============================================================================

func ListWorkOrders(c *gin.Context) {
	userID, _ := c.Get("userId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := database.DB.Model(&models.WorkOrder{}).Where("technicianId = ?", userID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var orders []models.WorkOrder
	query.Order("createdAt DESC").Offset((page - 1) * limit).Limit(limit).Find(&orders)

	c.JSON(http.StatusOK, gin.H{
		"data": orders,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

type UpdateWorkOrderInput struct {
	Status          *string  `json:"status"`
	TechnicianNotes *string  `json:"technicianNotes"`
	EstimatedHours  *float64 `json:"estimatedHours"`
}

func UpdateWorkOrder(c *gin.Context) {
	id := c.Param("id")
	var wo models.WorkOrder
	if err := database.DB.First(&wo, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Work order tidak ditemukan"})
		return
	}

	var input UpdateWorkOrderInput
	c.ShouldBindJSON(&input)

	updates := map[string]interface{}{"updatedAt": time.Now()}
	if input.Status != nil {
		updates["status"] = *input.Status
		if *input.Status == "COMPLETED" {
			updates["completedAt"] = time.Now()
		}
	}
	if input.TechnicianNotes != nil {
		updates["technicianNotes"] = *input.TechnicianNotes
	}
	if input.EstimatedHours != nil {
		updates["estimatedHours"] = *input.EstimatedHours
	}

	database.DB.Model(&wo).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Work order berhasil diupdate"})
}

// ============================================================================
// Customers
// ============================================================================

func ListCustomers(c *gin.Context) {
	search := c.Query("search")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := database.DB.Model(&models.PppoeUser{})
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("name LIKE ? OR username LIKE ? OR phone LIKE ? OR address LIKE ?", like, like, like, like)
	}

	var users []models.PppoeUser
	query.Select("id, name, username, phone, address, status, profileId, routerId").
		Preload("Profile").Preload("Area").
		Order("name").Limit(limit).Find(&users)

	c.JSON(http.StatusOK, gin.H{"data": users})
}

// ============================================================================
// Helpers
// ============================================================================

func generateToken(id, username, name, role, secret string) (string, error) {
	claims := jwt.MapClaims{
		"userId":   id,
		"username": username,
		"name":     name,
		"role":     role,
		"exp":      time.Now().Add(7 * 24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func generateOTP() string {
	import_time := time.Now().UnixNano() % 1000000
	return strconv.FormatInt(import_time, 10)
}

// ============================================================================
// Admin Technician Management
// ============================================================================

func ListAdminTechnicians(c *gin.Context) {
	search := c.Query("search")
	isActiveStr := c.Query("isActive")

	query := database.DB.Model(&models.Technician{})
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("name LIKE ? OR phoneNumber LIKE ? OR email LIKE ?", like, like, like)
	}
	if isActiveStr != "" {
		isActive := isActiveStr == "true"
		query = query.Where("isActive = ?", isActive)
	}

	var technicians []models.Technician
	if err := query.Order("createdAt DESC").Find(&technicians).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch technicians"})
		return
	}
	c.JSON(http.StatusOK, technicians)
}

type CreateTechnicianInput struct {
	Name        string  `json:"name" binding:"required"`
	PhoneNumber string  `json:"phoneNumber" binding:"required"`
	Email       *string `json:"email"`
	IsActive    *bool   `json:"isActive"`
	RequireOtp  *bool   `json:"requireOtp"`
}

func CreateAdminTechnician(c *gin.Context) {
	var input CreateTechnicianInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Normalize phone
	phone := normalizePhone(input.PhoneNumber)
	var existing models.Technician
	if err := database.DB.Where("phoneNumber = ?", phone).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Nomor HP sudah terdaftar"})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	requireOtp := true
	if input.RequireOtp != nil {
		requireOtp = *input.RequireOtp
	}

	tech := models.Technician{
		ID:          util.NewID(),
		Name:        input.Name,
		PhoneNumber: phone,
		Email:       input.Email,
		IsActive:    isActive,
		RequireOtp:  requireOtp,
	}
	if err := database.DB.Create(&tech).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create technician"})
		return
	}
	c.JSON(http.StatusCreated, tech)
}

type UpdateTechnicianInput struct {
	Name        *string `json:"name"`
	PhoneNumber *string `json:"phoneNumber"`
	Email       *string `json:"email"`
	IsActive    *bool   `json:"isActive"`
	RequireOtp  *bool   `json:"requireOtp"`
}

func UpdateAdminTechnician(c *gin.Context) {
	id := c.Param("id")
	var tech models.Technician
	if err := database.DB.First(&tech, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Technician not found"})
		return
	}

	var input UpdateTechnicianInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.Name != nil {
		updates["name"] = *input.Name
	}
	if input.PhoneNumber != nil {
		updates["phoneNumber"] = normalizePhone(*input.PhoneNumber)
	}
	if input.Email != nil {
		updates["email"] = *input.Email
	}
	if input.IsActive != nil {
		updates["isActive"] = *input.IsActive
	}
	if input.RequireOtp != nil {
		updates["requireOtp"] = *input.RequireOtp
	}

	if err := database.DB.Model(&tech).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update technician"})
		return
	}
	c.JSON(http.StatusOK, tech)
}

func DeleteAdminTechnician(c *gin.Context) {
	id := c.Param("id")
	var tech models.Technician
	if err := database.DB.First(&tech, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Technician not found"})
		return
	}
	if err := database.DB.Delete(&tech).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete technician"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Technician deleted"})
}

func normalizePhone(phone string) string {
	// Remove non-digits
	digits := ""
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			digits += string(r)
		}
	}
	if len(digits) > 0 {
		if digits[:1] == "0" {
			return "62" + digits[1:]
		}
		if len(digits) >= 2 && digits[:2] == "62" {
			return digits
		}
		return "62" + digits
	}
	return phone
}
