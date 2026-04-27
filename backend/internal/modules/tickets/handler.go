package tickets

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/tickets")
	{
		g.GET("", ListTickets)
		g.GET("/:id", GetTicket)
		g.POST("", CreateTicket)
		g.PATCH("/:id", UpdateTicket)
		g.DELETE("/:id", DeleteTicket)
		g.GET("/:id/messages", ListMessages)
		g.POST("/:id/messages", AddMessage)
		g.GET("/stats", GetStats)
	}

	// Categories
	cat := r.Group("/tickets/categories")
	{
		cat.GET("", ListCategories)
		cat.POST("", CreateCategory)
		cat.PUT("/:id", UpdateCategory)
		cat.DELETE("/:id", DeleteCategory)
	}
}

// ============================================================================
// Tickets CRUD
// ============================================================================

func ListTickets(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	priority := c.Query("priority")
	search := c.Query("search")
	assignedToID := c.Query("assignedToId")
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := database.DB.Model(&models.Ticket{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if priority != "" {
		query = query.Where("priority = ?", priority)
	}
	if assignedToID != "" {
		query = query.Where("assignedToId = ?", assignedToID)
	}
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("ticketNumber LIKE ? OR customerName LIKE ? OR subject LIKE ?", like, like, like)
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

func GetTicket(c *gin.Context) {
	id := c.Param("id")
	var ticket models.Ticket
	if err := database.DB.Preload("Category").Preload("Messages").First(&ticket, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tiket tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ticket})
}

type CreateTicketInput struct {
	CustomerID    *string `json:"customerId"`
	CustomerName  string  `json:"customerName" binding:"required"`
	CustomerEmail *string `json:"customerEmail"`
	CustomerPhone string  `json:"customerPhone" binding:"required"`
	Subject       string  `json:"subject" binding:"required"`
	Description   string  `json:"description" binding:"required"`
	CategoryID    *string `json:"categoryId"`
	Priority      string  `json:"priority"`
}

func CreateTicket(c *gin.Context) {
	var input CreateTicketInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	priority := input.Priority
	if priority == "" {
		priority = "MEDIUM"
	}

	// Auto-generate ticket number
	var count int64
	database.DB.Model(&models.Ticket{}).Count(&count)
	ticketNumber := "TKT-" + time.Now().Format("060102") + "-" + strconv.FormatInt(count+1, 10)

	ticket := models.Ticket{
		ID:            util.NewID(),
		TicketNumber:  ticketNumber,
		CustomerID:    input.CustomerID,
		CustomerName:  input.CustomerName,
		CustomerEmail: input.CustomerEmail,
		CustomerPhone: input.CustomerPhone,
		Subject:       input.Subject,
		Description:   input.Description,
		CategoryID:    input.CategoryID,
		Priority:      priority,
		Status:        "OPEN",
	}

	if err := database.DB.Create(&ticket).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": ticket, "message": "Tiket berhasil dibuat"})
}

type UpdateTicketInput struct {
	Status         *string `json:"status"`
	Priority       *string `json:"priority"`
	AssignedToID   *string `json:"assignedToId"`
	AssignedToType *string `json:"assignedToType"`
	CategoryID     *string `json:"categoryId"`
}

func UpdateTicket(c *gin.Context) {
	id := c.Param("id")
	var ticket models.Ticket
	if err := database.DB.First(&ticket, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tiket tidak ditemukan"})
		return
	}

	var input UpdateTicketInput
	c.ShouldBindJSON(&input)

	updates := map[string]interface{}{"updatedAt": time.Now()}
	if input.Status != nil {
		updates["status"] = *input.Status
		if *input.Status == "RESOLVED" {
			updates["resolvedAt"] = time.Now()
		}
		if *input.Status == "CLOSED" {
			updates["closedAt"] = time.Now()
		}
	}
	if input.Priority != nil {
		updates["priority"] = *input.Priority
	}
	if input.AssignedToID != nil {
		updates["assignedToId"] = *input.AssignedToID
	}
	if input.AssignedToType != nil {
		updates["assignedToType"] = *input.AssignedToType
	}
	if input.CategoryID != nil {
		updates["categoryId"] = *input.CategoryID
	}

	database.DB.Model(&ticket).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Tiket berhasil diupdate"})
}

func DeleteTicket(c *gin.Context) {
	id := c.Param("id")
	database.DB.Where("ticketId = ?", id).Delete(&models.TicketMessage{})
	database.DB.Where("id = ?", id).Delete(&models.Ticket{})
	c.JSON(http.StatusOK, gin.H{"message": "Tiket berhasil dihapus"})
}

// ============================================================================
// Messages
// ============================================================================

func ListMessages(c *gin.Context) {
	id := c.Param("id")
	var msgs []models.TicketMessage
	database.DB.Where("ticketId = ?", id).Order("createdAt ASC").Find(&msgs)
	c.JSON(http.StatusOK, gin.H{"data": msgs})
}

type AddMessageInput struct {
	SenderType string `json:"senderType" binding:"required"` // CUSTOMER, ADMIN, TECHNICIAN
	SenderID   string `json:"senderId"`
	SenderName string `json:"senderName" binding:"required"`
	Message    string `json:"message" binding:"required"`
	IsInternal bool   `json:"isInternal"`
}

func AddMessage(c *gin.Context) {
	ticketID := c.Param("id")
	var input AddMessageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var ticket models.Ticket
	if err := database.DB.First(&ticket, "id = ?", ticketID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tiket tidak ditemukan"})
		return
	}

	senderID := input.SenderID
	msg := models.TicketMessage{
		ID:         util.NewID(),
		TicketID:   ticketID,
		SenderType: input.SenderType,
		SenderID:   &senderID,
		SenderName: input.SenderName,
		Message:    input.Message,
		IsInternal: input.IsInternal,
	}
	database.DB.Create(&msg)

	// Update ticket lastResponseAt
	now := time.Now()
	database.DB.Model(&ticket).Updates(map[string]interface{}{
		"lastResponseAt": now,
		"updatedAt":      now,
	})

	c.JSON(http.StatusCreated, gin.H{"data": msg})
}

// ============================================================================
// Stats
// ============================================================================

func GetStats(c *gin.Context) {
	statuses := []string{"OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"}
	stats := make(map[string]int64)

	for _, s := range statuses {
		var count int64
		database.DB.Model(&models.Ticket{}).Where("status = ?", s).Count(&count)
		stats[s] = count
	}

	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// ============================================================================
// Categories
// ============================================================================

func ListCategories(c *gin.Context) {
	var cats []models.TicketCategory
	database.DB.Order("name").Find(&cats)

	// Attach ticket count
	type CategoryWithCount struct {
		models.TicketCategory
		TicketCount int64 `json:"ticketCount"`
	}
	result := make([]CategoryWithCount, 0, len(cats))
	for _, cat := range cats {
		var count int64
		database.DB.Model(&models.Ticket{}).Where("categoryId = ?", cat.ID).Count(&count)
		result = append(result, CategoryWithCount{cat, count})
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

type CategoryInput struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Color       *string `json:"color"`
	IsActive    *bool   `json:"isActive"`
}

func CreateCategory(c *gin.Context) {
	var input CategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var count int64
	database.DB.Model(&models.TicketCategory{}).Where("name = ?", input.Name).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Nama kategori sudah ada"})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	cat := models.TicketCategory{
		ID:          util.NewID(),
		Name:        input.Name,
		Description: input.Description,
		Color:       input.Color,
		IsActive:    isActive,
	}
	database.DB.Create(&cat)
	c.JSON(http.StatusCreated, gin.H{"data": cat})
}

func UpdateCategory(c *gin.Context) {
	id := c.Param("id")
	var cat models.TicketCategory
	if err := database.DB.First(&cat, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kategori tidak ditemukan"})
		return
	}

	var input CategoryInput
	c.ShouldBindJSON(&input)

	updates := map[string]interface{}{"updatedAt": time.Now()}
	if input.Name != "" {
		updates["name"] = input.Name
	}
	if input.Description != nil {
		updates["description"] = input.Description
	}
	if input.Color != nil {
		updates["color"] = input.Color
	}
	if input.IsActive != nil {
		updates["isActive"] = *input.IsActive
	}

	database.DB.Model(&cat).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Kategori berhasil diupdate"})
}

func DeleteCategory(c *gin.Context) {
	id := c.Param("id")
	database.DB.Where("id = ?", id).Delete(&models.TicketCategory{})
	c.JSON(http.StatusOK, gin.H{"message": "Kategori berhasil dihapus"})
}
