package workorders

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
	g := r.Group("/work-orders")
	{
		g.GET("", ListWorkOrders)
		g.POST("", CreateWorkOrder)
		g.GET("/:id", GetWorkOrder)
		g.PUT("/:id", UpdateWorkOrder)
		g.PATCH("/:id/status", UpdateStatus)
		g.DELETE("/:id", DeleteWorkOrder)
	}
}

func ListWorkOrders(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	technicianID := c.Query("technicianId")
	search := c.Query("search")
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := database.DB.Model(&models.WorkOrder{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if technicianID != "" {
		query = query.Where("technicianId = ?", technicianID)
	}
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("title LIKE ? OR description LIKE ? OR customerName LIKE ?", like, like, like)
	}

	var total int64
	query.Count(&total)

	var orders []models.WorkOrder
	query.Preload("Technician").Order("createdAt DESC").Offset((page - 1) * limit).Limit(limit).Find(&orders)

	c.JSON(http.StatusOK, gin.H{
		"data": orders,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

type WorkOrderInput struct {
	TechnicianID    *string  `json:"technicianId"`
	CustomerName    string   `json:"customerName"`
	CustomerPhone   string   `json:"customerPhone"`
	CustomerAddress string   `json:"customerAddress"`
	IssueType       string   `json:"issueType"`
	Description     string   `json:"description"`
	Priority        string   `json:"priority"`
	Notes           *string  `json:"notes"`
	ScheduledDate   *string  `json:"scheduledDate"`
	EstimatedHours  *float64 `json:"estimatedHours"`
}

func CreateWorkOrder(c *gin.Context) {
	var input WorkOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	priority := input.Priority
	if priority == "" {
		priority = "MEDIUM"
	}
	issueType := input.IssueType
	if issueType == "" {
		issueType = "OTHER"
	}

	var scheduledDate *time.Time
	if input.ScheduledDate != nil {
		t, err := time.Parse(time.RFC3339, *input.ScheduledDate)
		if err == nil {
			scheduledDate = &t
		}
	}

	order := models.WorkOrder{
		ID:              util.NewID(),
		TechnicianID:    input.TechnicianID,
		CustomerName:    input.CustomerName,
		CustomerPhone:   input.CustomerPhone,
		CustomerAddress: input.CustomerAddress,
		IssueType:       issueType,
		Description:     input.Description,
		Priority:        priority,
		Status:          "OPEN",
		Notes:           input.Notes,
		ScheduledDate:   scheduledDate,
		EstimatedHours:  input.EstimatedHours,
	}
	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": order})
}

func GetWorkOrder(c *gin.Context) {
	id := c.Param("id")
	var order models.WorkOrder
	if err := database.DB.Preload("Technician").First(&order, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Work order tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
}

func UpdateWorkOrder(c *gin.Context) {
	id := c.Param("id")
	var order models.WorkOrder
	if err := database.DB.First(&order, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Work order tidak ditemukan"})
		return
	}

	var input WorkOrderInput
	c.ShouldBindJSON(&input)

	updates := map[string]interface{}{"updatedAt": time.Now()}
	if input.TechnicianID != nil {
		updates["technicianId"] = input.TechnicianID
	}
	if input.Description != "" {
		updates["description"] = input.Description
	}
	if input.Priority != "" {
		updates["priority"] = input.Priority
	}
	if input.Notes != nil {
		updates["notes"] = input.Notes
	}
	if input.CustomerName != "" {
		updates["customerName"] = input.CustomerName
	}
	if input.CustomerPhone != "" {
		updates["customerPhone"] = input.CustomerPhone
	}
	if input.CustomerAddress != "" {
		updates["customerAddress"] = input.CustomerAddress
	}
	if input.IssueType != "" {
		updates["issueType"] = input.IssueType
	}

	database.DB.Model(&order).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Work order diupdate"})
}

func UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		Status          string  `json:"status" binding:"required"`
		Notes           *string `json:"notes"`
		TechnicianNotes *string `json:"technicianNotes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"status":    input.Status,
		"updatedAt": time.Now(),
	}
	if input.Notes != nil {
		updates["notes"] = input.Notes
	}
	if input.TechnicianNotes != nil {
		updates["technicianNotes"] = input.TechnicianNotes
	}
	if input.Status == "COMPLETED" {
		now := time.Now()
		updates["completedAt"] = &now
	}

	database.DB.Model(&models.WorkOrder{}).Where("id = ?", id).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Status work order diupdate"})
}

func DeleteWorkOrder(c *gin.Context) {
	id := c.Param("id")
	database.DB.Where("id = ?", id).Delete(&models.WorkOrder{})
	c.JSON(http.StatusOK, gin.H{"message": "Work order dihapus"})
}
