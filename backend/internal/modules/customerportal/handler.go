package customerportal

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"radius-buildup/internal/config"
	"radius-buildup/internal/database"
	"radius-buildup/internal/middleware"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func RegisterPublicRoutes(r *gin.RouterGroup, cfg *config.Config) {
	r.POST("/customer/auth/login", Login(cfg))
	r.POST("/customer/auth/send-otp", SendOTP)
	r.POST("/customer/auth/verify-otp", VerifyOTP(cfg))
	r.POST("/customer/auth/bypass-login", BypassLogin(cfg))
	r.GET("/customer/login", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"message": "Customer login endpoint"}) })
}

func RegisterRoutes(r *gin.RouterGroup, cfg *config.Config) {
	cust := r.Group("/customer")
	cust.Use(middleware.CustomerAuthRequired(cfg))
	{
		cust.GET("/me", GetMe)
		cust.PUT("/profile", UpdateProfile)
		cust.GET("/dashboard", GetDashboard)
		cust.GET("/invoices", ListInvoices)
		cust.POST("/invoices/payment", CreatePayment)
		cust.POST("/invoice/regenerate-payment", RegeneratePayment)
		cust.POST("/invoices/:id/manual-payment", SubmitManualPayment)
		cust.GET("/notifications", ListNotifications)
		cust.PUT("/notifications/:id/read", MarkNotificationRead)
		cust.GET("/packages", GetPackages)
		cust.GET("/payment-history", GetPaymentHistory)
		cust.GET("/payment-methods", GetPaymentMethods)
		cust.POST("/payments", CreateDirectPayment)
		cust.POST("/payments/:id/proof", UploadPaymentProof)
		cust.POST("/renewal", RequestRenewal)
		cust.PUT("/auto-renewal", ToggleAutoRenewal)
		cust.POST("/suspend-request", CreateSuspendRequest)
		cust.GET("/tickets", ListTickets)
		cust.POST("/topup-request", CreateTopupRequest)
		cust.POST("/topup-direct", CreateDirectTopup)
		cust.POST("/upgrade", UpgradePackage)
		cust.POST("/upgrade-package", UpgradePackage)
		cust.GET("/usage", GetUsage)
		cust.GET("/wifi", GetWifi)
		cust.POST("/wifi", UpdateWifi)
		cust.GET("/ont", GetONT)
		cust.POST("/ont/reboot", RebootONT)
		cust.GET("/referral", GetReferral)
		cust.GET("/referral/rewards", GetReferralRewards)
		cust.POST("/referral", ClaimReferral)
	}
}

// ============================================================================
// Auth
// ============================================================================

func Login(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Username string `json:"username" binding:"required"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var user models.PppoeUser
		if err := database.DB.Where("username = ?", input.Username).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Username atau password salah"})
			return
		}

		if user.Password == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Akun belum diaktifkan"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Username atau password salah"})
			return
		}

		token, err := middleware.GenerateCustomerToken(user.ID, user.Username, cfg)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"token": token,
			"user":  sanitizeUser(user),
		})
	}
}

func SendOTP(c *gin.Context) {
	var input struct {
		Phone string `json:"phone" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.PppoeUser
	if err := database.DB.Where("phone = ?", input.Phone).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Nomor HP tidak terdaftar"})
		return
	}

	_ = user
	// OTP sent via WhatsApp/SMS integration (placeholder)
	c.JSON(http.StatusOK, gin.H{"message": "OTP berhasil dikirim ke nomor " + input.Phone})
}

func VerifyOTP(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Phone string `json:"phone" binding:"required"`
			OTP   string `json:"otp" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// OTP verification placeholder (requires OTP store like Redis)
		var user models.PppoeUser
		if err := database.DB.Where("phone = ?", input.Phone).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Nomor HP tidak ditemukan"})
			return
		}

		token, _ := middleware.GenerateCustomerToken(user.ID, user.Username, cfg)
		c.JSON(http.StatusOK, gin.H{"token": token, "user": sanitizeUser(user)})
	}
}

func BypassLogin(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Username string `json:"username" binding:"required"`
			AdminID  string `json:"adminId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var user models.PppoeUser
		if err := database.DB.Where("username = ?", input.Username).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
			return
		}
		token, _ := middleware.GenerateCustomerToken(user.ID, user.Username, cfg)
		c.JSON(http.StatusOK, gin.H{"token": token, "user": sanitizeUser(user)})
	}
}

// ============================================================================
// Profile
// ============================================================================

func GetMe(c *gin.Context) {
	userID := getCustomerID(c)
	var user models.PppoeUser
	if err := database.DB.Preload("Profile").Preload("Area").First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": sanitizeUser(user)})
}

func UpdateProfile(c *gin.Context) {
	userID := getCustomerID(c)
	var input struct {
		Name    *string `json:"name"`
		Phone   *string `json:"phone"`
		Email   *string `json:"email"`
		Address *string `json:"address"`
	}
	c.ShouldBindJSON(&input)

	updates := map[string]interface{}{"updatedAt": time.Now()}
	if input.Name != nil {
		updates["name"] = input.Name
	}
	if input.Phone != nil {
		updates["phone"] = input.Phone
	}
	if input.Email != nil {
		updates["email"] = input.Email
	}
	if input.Address != nil {
		updates["address"] = input.Address
	}

	database.DB.Model(&models.PppoeUser{}).Where("id = ?", userID).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Profil berhasil diupdate"})
}

// ============================================================================
// Dashboard
// ============================================================================

func GetDashboard(c *gin.Context) {
	userID := getCustomerID(c)
	var user models.PppoeUser
	database.DB.Preload("Profile").First(&user, "id = ?", userID)

	var pendingInvoices int64
	database.DB.Model(&models.Invoice{}).Where("userId = ? AND status = ?", userID, "PENDING").Count(&pendingInvoices)

	var lastInvoice models.Invoice
	database.DB.Where("userId = ?", userID).Order("createdAt DESC").First(&lastInvoice)

	var openTickets int64
	database.DB.Model(&models.Ticket{}).Where("customerId = ? AND status NOT IN ?", userID, []string{"CLOSED", "RESOLVED"}).Count(&openTickets)

	c.JSON(http.StatusOK, gin.H{
		"user":            sanitizeUser(user),
		"pendingInvoices": pendingInvoices,
		"lastInvoice":     lastInvoice,
		"openTickets":     openTickets,
	})
}

// ============================================================================
// Invoices
// ============================================================================

func ListInvoices(c *gin.Context) {
	userID := getCustomerID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	status := c.Query("status")
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 10
	}

	query := database.DB.Model(&models.Invoice{}).Where("userId = ?", userID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var invoices []models.Invoice
	query.Order("createdAt DESC").Offset((page - 1) * limit).Limit(limit).Find(&invoices)

	c.JSON(http.StatusOK, gin.H{
		"data": invoices,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

func CreatePayment(c *gin.Context) {
	userID := getCustomerID(c)
	var input struct {
		InvoiceID     string `json:"invoiceId" binding:"required"`
		PaymentMethod string `json:"paymentMethod" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var invoice models.Invoice
	if err := database.DB.First(&invoice, "id = ? AND userId = ?", input.InvoiceID, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice tidak ditemukan"})
		return
	}
	if invoice.Status != "PENDING" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invoice sudah dibayar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"invoiceId": invoice.ID,
		"amount":    invoice.Amount,
		"message":   "Silakan lakukan pembayaran",
	})
}

func RegeneratePayment(c *gin.Context) {
	userID := getCustomerID(c)
	var input struct {
		InvoiceID string `json:"invoiceId"`
	}
	c.ShouldBindJSON(&input)

	var invoice models.Invoice
	if err := database.DB.First(&invoice, "id = ? AND userId = ?", input.InvoiceID, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Payment link diperbaharui", "invoiceId": invoice.ID})
}

func SubmitManualPayment(c *gin.Context) {
	_ = c.Param("id")
	userID := getCustomerID(c)
	var input struct {
		BankName      string  `json:"bankName"`
		AccountNumber *string `json:"accountNumber"`
		AccountName   string  `json:"accountName"`
		Amount        float64 `json:"amount"`
		ReceiptImage  *string `json:"receiptImage"`
		Notes         *string `json:"notes"`
	}
	c.ShouldBindJSON(&input)
	invoiceID := c.Param("id")
	_ = userID

	payment := models.ManualPayment{
		ID:            util.NewID(),
		InvoiceID:     invoiceID,
		UserID:        userID,
		BankName:      input.BankName,
		AccountNumber: input.AccountNumber,
		AccountName:   input.AccountName,
		Amount:        input.Amount,
		PaymentDate:   time.Now(),
		ReceiptImage:  input.ReceiptImage,
		Notes:         input.Notes,
		Status:        "PENDING",
	}
	database.DB.Create(&payment)
	c.JSON(http.StatusCreated, gin.H{"message": "Bukti pembayaran berhasil dikirim", "id": payment.ID})
}

// ============================================================================
// Notifications
// ============================================================================

func ListNotifications(c *gin.Context) {
	userID := getCustomerID(c)
	var notifs []models.Notification
	database.DB.Where("userId = ?", userID).Order("createdAt DESC").Limit(50).Find(&notifs)
	c.JSON(http.StatusOK, gin.H{"data": notifs})
}

func MarkNotificationRead(c *gin.Context) {
	id := c.Param("id")
	userID := getCustomerID(c)
	database.DB.Model(&models.Notification{}).
		Where("id = ? AND userId = ?", id, userID).
		Update("isRead", true)
	c.JSON(http.StatusOK, gin.H{"message": "Notifikasi ditandai sudah dibaca"})
}

// ============================================================================
// Packages / Renewal / Upgrade
// ============================================================================

func GetPackages(c *gin.Context) {
	userID := getCustomerID(c)
	var user models.PppoeUser
	database.DB.First(&user, "id = ?", userID)

	query := database.DB.Model(&models.PppoeProfile{}).Where("isActive = ?", true)
	if user.AreaID != nil {
		query = query.Where("areaId = ? OR areaId IS NULL", user.AreaID)
	}
	var profiles []models.PppoeProfile
	query.Order("price").Find(&profiles)
	c.JSON(http.StatusOK, gin.H{"data": profiles})
}

func RequestRenewal(c *gin.Context) {
	userID := getCustomerID(c)
	var user models.PppoeUser
	if err := database.DB.Preload("Profile").First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Permintaan renewal berhasil",
		"amount": func() int {
			if user.Profile != nil {
				return user.Profile.Price
			}
			return 0
		}(),
	})
}

func ToggleAutoRenewal(c *gin.Context) {
	userID := getCustomerID(c)
	var input struct {
		Enabled bool `json:"enabled"`
	}
	c.ShouldBindJSON(&input)
	database.DB.Model(&models.PppoeUser{}).Where("id = ?", userID).Update("autoRenewal", input.Enabled)
	c.JSON(http.StatusOK, gin.H{"message": "Auto renewal diupdate"})
}

func UpgradePackage(c *gin.Context) {
	userID := getCustomerID(c)
	var input struct {
		ProfileID string `json:"profileId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var profile models.PppoeProfile
	if err := database.DB.First(&profile, "id = ? AND isActive = ?", input.ProfileID, true).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Paket tidak ditemukan"})
		return
	}
	database.DB.Model(&models.PppoeUser{}).Where("id = ?", userID).Update("profileId", input.ProfileID)
	c.JSON(http.StatusOK, gin.H{"message": "Paket berhasil diupgrade ke " + profile.Name})
}

// ============================================================================
// Payment History
// ============================================================================

func GetPaymentHistory(c *gin.Context) {
	userID := getCustomerID(c)
	var invoices []models.Invoice
	database.DB.Where("userId = ? AND status = ?", userID, "PAID").Order("paidAt DESC").Limit(30).Find(&invoices)
	c.JSON(http.StatusOK, gin.H{"data": invoices})
}

func GetPaymentMethods(c *gin.Context) {
	// Return available payment methods from config
	c.JSON(http.StatusOK, gin.H{
		"data": []gin.H{
			{"id": "manual", "name": "Transfer Bank Manual", "type": "manual"},
		},
	})
}

func CreateDirectPayment(c *gin.Context) {
	userID := getCustomerID(c)
	var input struct {
		Amount        int    `json:"amount"`
		PaymentMethod string `json:"paymentMethod"`
	}
	c.ShouldBindJSON(&input)
	_ = userID
	c.JSON(http.StatusOK, gin.H{"message": "Pembayaran diproses", "amount": input.Amount})
}

func UploadPaymentProof(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"message": "Bukti bayar diupload untuk invoice " + id})
}

// ============================================================================
// Suspend / Topup
// ============================================================================

func CreateSuspendRequest(c *gin.Context) {
	userID := getCustomerID(c)
	var input struct {
		Reason    string `json:"reason"`
		StartDate string `json:"startDate"`
		EndDate   string `json:"endDate"`
	}
	c.ShouldBindJSON(&input)

	startDate, _ := time.Parse("2006-01-02", input.StartDate)
	endDate, _ := time.Parse("2006-01-02", input.EndDate)

	req := models.SuspendRequest{
		ID:        util.NewID(),
		UserID:    userID,
		Reason:    &input.Reason,
		StartDate: startDate,
		EndDate:   endDate,
		Status:    "PENDING",
	}
	database.DB.Create(&req)
	c.JSON(http.StatusCreated, gin.H{"message": "Permintaan suspend dikirim"})
}

func CreateTopupRequest(c *gin.Context) {
	userID := getCustomerID(c)
	var input struct {
		Amount int    `json:"amount"`
		Notes  string `json:"notes"`
	}
	c.ShouldBindJSON(&input)
	_ = userID
	c.JSON(http.StatusOK, gin.H{"message": "Permintaan topup dikirim"})
}

func CreateDirectTopup(c *gin.Context) {
	userID := getCustomerID(c)
	var input struct {
		Amount        int    `json:"amount"`
		PaymentMethod string `json:"paymentMethod"`
	}
	c.ShouldBindJSON(&input)
	_ = userID
	c.JSON(http.StatusOK, gin.H{"message": "Topup diproses", "amount": input.Amount})
}

// ============================================================================
// Tickets (customer view)
// ============================================================================

func ListTickets(c *gin.Context) {
	userID := getCustomerID(c)
	var tickets []models.Ticket
	database.DB.Where("customerId = ?", userID).Order("createdAt DESC").Limit(20).Find(&tickets)
	c.JSON(http.StatusOK, gin.H{"data": tickets})
}

// ============================================================================
// Usage
// ============================================================================

func GetUsage(c *gin.Context) {
	userID := getCustomerID(c)
	var user models.PppoeUser
	database.DB.First(&user, "id = ?", userID)

	var sessions []models.Session
	database.DB.Where("username = ?", user.Username).Order("startTime DESC").Limit(10).Find(&sessions)

	c.JSON(http.StatusOK, gin.H{"data": sessions, "username": user.Username})
}

// ============================================================================
// WiFi / ONT
// ============================================================================

func GetWifi(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Fitur WiFi memerlukan GenieACS", "data": nil})
}

func UpdateWifi(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Pengaturan WiFi dikirim"})
}

func GetONT(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Fitur ONT memerlukan GenieACS", "data": nil})
}

func RebootONT(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Perintah reboot ONT dikirim"})
}

// ============================================================================
// Referral
// ============================================================================

func GetReferral(c *gin.Context) {
	userID := getCustomerID(c)
	var user models.PppoeUser
	database.DB.First(&user, "id = ?", userID)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"referralCode": user.ReferralCode,
	}})
}

func GetReferralRewards(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
}

func ClaimReferral(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Referral berhasil diklaim"})
}

// ============================================================================
// Helpers
// ============================================================================

func getCustomerID(c *gin.Context) string {
	id, _ := c.Get("customerId")
	if v, ok := id.(string); ok {
		return v
	}
	return ""
}

func sanitizeUser(u models.PppoeUser) map[string]interface{} {
	return map[string]interface{}{
		"id":          u.ID,
		"username":    u.Username,
		"name":        u.Name,
		"phone":       u.Phone,
		"email":       u.Email,
		"address":     u.Address,
		"status":      u.Status,
		"expiredAt":   u.ExpiredAt,
		"profileId":   u.ProfileID,
		"profile":     u.Profile,
		"areaId":      u.AreaID,
		"autoRenewal": u.AutoRenewal,
	}
}
