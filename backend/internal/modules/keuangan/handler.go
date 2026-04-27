package keuangan

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
	// Transactions
	tx := r.Group("/keuangan")
	{
		tx.GET("/transactions", ListTransactions)
		tx.POST("/transactions", CreateTransaction)
		tx.PUT("/transactions/:id", UpdateTransaction)
		tx.DELETE("/transactions/:id", DeleteTransaction)
		tx.GET("/export", ExportTransactions)

		// Categories
		tx.GET("/categories", ListCategories)
		tx.POST("/categories", CreateCategory)
		tx.PUT("/categories/:id", UpdateCategory)
		tx.DELETE("/categories/:id", DeleteCategory)
	}
}

// ============================================================================
// Transactions
// ============================================================================

func ListTransactions(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	txType := c.Query("type") // INCOME, EXPENSE
	categoryID := c.Query("categoryId")
	search := c.Query("search")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := database.DB.Model(&models.Transaction{})
	if txType != "" {
		query = query.Where("type = ?", txType)
	}
	if categoryID != "" {
		query = query.Where("categoryId = ?", categoryID)
	}
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("description LIKE ? OR reference LIKE ?", like, like)
	}
	if startDate != "" {
		t, _ := time.Parse("2006-01-02", startDate)
		query = query.Where("date >= ?", t)
	}
	if endDate != "" {
		t, _ := time.Parse("2006-01-02", endDate)
		query = query.Where("date <= ?", t.Add(24*time.Hour-time.Second))
	}

	var total int64
	query.Count(&total)

	// Aggregate stats
	var incomeTotal, expenseTotal int64
	database.DB.Model(&models.Transaction{}).
		Where("type = ?", "INCOME").Select("COALESCE(SUM(amount),0)").Scan(&incomeTotal)
	database.DB.Model(&models.Transaction{}).
		Where("type = ?", "EXPENSE").Select("COALESCE(SUM(amount),0)").Scan(&expenseTotal)

	var txns []models.Transaction
	query.Preload("Category").Order("date DESC, createdAt DESC").
		Offset((page - 1) * limit).Limit(limit).Find(&txns)

	c.JSON(http.StatusOK, gin.H{
		"transactions": txns,
		"stats": gin.H{
			"totalIncome":  incomeTotal,
			"totalExpense": expenseTotal,
			"balance":      incomeTotal - expenseTotal,
		},
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

type TransactionInput struct {
	CategoryID  string  `json:"categoryId" binding:"required"`
	Type        string  `json:"type" binding:"required"`
	Amount      int     `json:"amount" binding:"required,min=1"`
	Description string  `json:"description" binding:"required"`
	Date        string  `json:"date"` // YYYY-MM-DD
	Reference   *string `json:"reference"`
	Notes       *string `json:"notes"`
}

func CreateTransaction(c *gin.Context) {
	var input TransactionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userId")
	createdBy := ""
	if v, ok := userID.(string); ok {
		createdBy = v
	}

	date := time.Now()
	if input.Date != "" {
		date, _ = time.Parse("2006-01-02", input.Date)
	}

	txn := models.Transaction{
		ID:          util.NewID(),
		CategoryID:  input.CategoryID,
		Type:        input.Type,
		Amount:      input.Amount,
		Description: input.Description,
		Date:        date,
		Reference:   input.Reference,
		Notes:       input.Notes,
		CreatedBy:   &createdBy,
	}
	if err := database.DB.Create(&txn).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": txn, "message": "Transaksi berhasil dibuat"})
}

func UpdateTransaction(c *gin.Context) {
	id := c.Param("id")
	var txn models.Transaction
	if err := database.DB.First(&txn, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaksi tidak ditemukan"})
		return
	}

	var input TransactionInput
	c.ShouldBindJSON(&input)

	updates := map[string]interface{}{"updatedAt": time.Now()}
	if input.CategoryID != "" {
		updates["categoryId"] = input.CategoryID
	}
	if input.Type != "" {
		updates["type"] = input.Type
	}
	if input.Amount > 0 {
		updates["amount"] = input.Amount
	}
	if input.Description != "" {
		updates["description"] = input.Description
	}
	if input.Reference != nil {
		updates["reference"] = input.Reference
	}
	if input.Notes != nil {
		updates["notes"] = input.Notes
	}
	if input.Date != "" {
		d, _ := time.Parse("2006-01-02", input.Date)
		updates["date"] = d
	}

	database.DB.Model(&txn).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Transaksi berhasil diupdate"})
}

func DeleteTransaction(c *gin.Context) {
	id := c.Param("id")
	database.DB.Where("id = ?", id).Delete(&models.Transaction{})
	c.JSON(http.StatusOK, gin.H{"message": "Transaksi dihapus"})
}

func ExportTransactions(c *gin.Context) {
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")

	query := database.DB.Model(&models.Transaction{})
	if startDate != "" {
		t, _ := time.Parse("2006-01-02", startDate)
		query = query.Where("date >= ?", t)
	}
	if endDate != "" {
		t, _ := time.Parse("2006-01-02", endDate)
		query = query.Where("date <= ?", t.Add(24*time.Hour-time.Second))
	}

	var txns []models.Transaction
	query.Preload("Category").Order("date DESC").Find(&txns)
	c.JSON(http.StatusOK, gin.H{"data": txns})
}

// ============================================================================
// Categories
// ============================================================================

func ListCategories(c *gin.Context) {
	catType := c.Query("type")
	query := database.DB.Model(&models.TransactionCategory{})
	if catType != "" {
		query = query.Where("type = ?", catType)
	}

	var cats []models.TransactionCategory
	query.Where("isActive = ?", true).Order("name").Find(&cats)
	c.JSON(http.StatusOK, gin.H{"success": true, "categories": cats})
}

type CategoryInput struct {
	Name        string  `json:"name" binding:"required"`
	Type        string  `json:"type" binding:"required"`
	Description *string `json:"description"`
}

func CreateCategory(c *gin.Context) {
	var input CategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cat := models.TransactionCategory{
		ID:          util.NewID(),
		Name:        input.Name,
		Type:        input.Type,
		Description: input.Description,
		IsActive:    true,
	}
	database.DB.Create(&cat)
	c.JSON(http.StatusCreated, gin.H{"data": cat})
}

func UpdateCategory(c *gin.Context) {
	id := c.Param("id")
	var cat models.TransactionCategory
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
	if input.Type != "" {
		updates["type"] = input.Type
	}
	if input.Description != nil {
		updates["description"] = input.Description
	}

	database.DB.Model(&cat).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Kategori diupdate"})
}

func DeleteCategory(c *gin.Context) {
	id := c.Param("id")
	database.DB.Model(&models.TransactionCategory{}).Where("id = ?", id).Update("isActive", false)
	c.JSON(http.StatusOK, gin.H{"message": "Kategori dihapus"})
}
