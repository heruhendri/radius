package inventory

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
	g := r.Group("/inventory")
	{
		// Items
		g.GET("/items", ListItems)
		g.GET("/items/:id", GetItem)
		g.POST("/items", CreateItem)
		g.PUT("/items/:id", UpdateItem)
		g.DELETE("/items/:id", DeleteItem)

		// Movements
		g.GET("/movements", ListMovements)
		g.POST("/movements", CreateMovement)

		// Categories
		g.GET("/categories", ListCategories)
		g.POST("/categories", CreateCategory)
		g.PUT("/categories/:id", UpdateCategory)
		g.DELETE("/categories/:id", DeleteCategory)

		// Suppliers
		g.GET("/suppliers", ListSuppliers)
		g.POST("/suppliers", CreateSupplier)
		g.PUT("/suppliers/:id", UpdateSupplier)
		g.DELETE("/suppliers/:id", DeleteSupplier)
	}
}

// ============================================================================
// Items
// ============================================================================

func ListItems(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")
	categoryID := c.Query("categoryId")
	supplierID := c.Query("supplierId")
	lowStock := c.Query("lowStock") // "true" = only low stock items
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := database.DB.Model(&models.InventoryItem{}).Where("isActive = ?", true)
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("name LIKE ? OR sku LIKE ?", like, like)
	}
	if categoryID != "" {
		query = query.Where("categoryId = ?", categoryID)
	}
	if supplierID != "" {
		query = query.Where("supplierId = ?", supplierID)
	}
	if lowStock == "true" {
		query = query.Where("currentStock <= minimumStock")
	}

	var total int64
	query.Count(&total)

	var items []models.InventoryItem
	query.Preload("Category").Preload("Supplier").
		Order("name").Offset((page - 1) * limit).Limit(limit).Find(&items)

	c.JSON(http.StatusOK, gin.H{
		"data": items,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

func GetItem(c *gin.Context) {
	id := c.Param("id")
	var item models.InventoryItem
	if err := database.DB.Preload("Category").Preload("Supplier").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

type ItemInput struct {
	SKU           string  `json:"sku" binding:"required"`
	Name          string  `json:"name" binding:"required"`
	Description   *string `json:"description"`
	CategoryID    *string `json:"categoryId"`
	SupplierID    *string `json:"supplierId"`
	Unit          string  `json:"unit"`
	MinimumStock  int     `json:"minimumStock"`
	CurrentStock  int     `json:"currentStock"`
	PurchasePrice int     `json:"purchasePrice"`
	SellingPrice  int     `json:"sellingPrice"`
	Location      *string `json:"location"`
	Notes         *string `json:"notes"`
}

func CreateItem(c *gin.Context) {
	var input ItemInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	unit := input.Unit
	if unit == "" {
		unit = "pcs"
	}

	item := models.InventoryItem{
		ID:            util.NewID(),
		SKU:           input.SKU,
		Name:          input.Name,
		Description:   input.Description,
		CategoryID:    input.CategoryID,
		SupplierID:    input.SupplierID,
		Unit:          unit,
		MinimumStock:  input.MinimumStock,
		CurrentStock:  input.CurrentStock,
		PurchasePrice: input.PurchasePrice,
		SellingPrice:  input.SellingPrice,
		Location:      input.Location,
		Notes:         input.Notes,
		IsActive:      true,
	}
	if err := database.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": item})
}

func UpdateItem(c *gin.Context) {
	id := c.Param("id")
	var item models.InventoryItem
	if err := database.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item tidak ditemukan"})
		return
	}

	var input ItemInput
	c.ShouldBindJSON(&input)
	updates := map[string]interface{}{"updatedAt": time.Now()}
	if input.Name != "" {
		updates["name"] = input.Name
	}
	if input.Description != nil {
		updates["description"] = input.Description
	}
	if input.CategoryID != nil {
		updates["categoryId"] = input.CategoryID
	}
	if input.SupplierID != nil {
		updates["supplierId"] = input.SupplierID
	}
	if input.Unit != "" {
		updates["unit"] = input.Unit
	}
	if input.PurchasePrice > 0 {
		updates["purchasePrice"] = input.PurchasePrice
	}
	if input.SellingPrice > 0 {
		updates["sellingPrice"] = input.SellingPrice
	}
	if input.Location != nil {
		updates["location"] = input.Location
	}
	updates["minimumStock"] = input.MinimumStock

	database.DB.Model(&item).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Item diupdate"})
}

func DeleteItem(c *gin.Context) {
	id := c.Param("id")
	database.DB.Model(&models.InventoryItem{}).Where("id = ?", id).Update("isActive", false)
	c.JSON(http.StatusOK, gin.H{"message": "Item dihapus"})
}

// ============================================================================
// Movements
// ============================================================================

func ListMovements(c *gin.Context) {
	itemID := c.Query("itemId")
	movType := c.Query("movementType")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit < 1 || limit > 200 {
		limit = 50
	}

	query := database.DB.Model(&models.InventoryMovement{})
	if itemID != "" {
		query = query.Where("itemId = ?", itemID)
	}
	if movType != "" {
		query = query.Where("movementType = ?", movType)
	}

	var movements []models.InventoryMovement
	query.Preload("Item").Order("createdAt DESC").Limit(limit).Find(&movements)
	c.JSON(http.StatusOK, gin.H{"data": movements})
}

type MovementInput struct {
	ItemID       string  `json:"itemId" binding:"required"`
	MovementType string  `json:"movementType" binding:"required"` // IN, OUT, ADJUSTMENT
	Quantity     int     `json:"quantity" binding:"required"`
	ReferenceNo  *string `json:"referenceNo"`
	Notes        *string `json:"notes"`
}

func CreateMovement(c *gin.Context) {
	var input MovementInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var item models.InventoryItem
	if err := database.DB.First(&item, "id = ?", input.ItemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item tidak ditemukan"})
		return
	}

	prevStock := item.CurrentStock
	var newStock int
	switch input.MovementType {
	case "IN":
		newStock = prevStock + input.Quantity
	case "OUT":
		newStock = prevStock - input.Quantity
		if newStock < 0 {
			newStock = 0
		}
	case "ADJUSTMENT":
		newStock = input.Quantity
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "movementType tidak valid (IN, OUT, ADJUSTMENT)"})
		return
	}

	userID, _ := c.Get("userId")
	userName, _ := c.Get("name")
	uid := ""
	uname := ""
	if v, ok := userID.(string); ok {
		uid = v
	}
	if v, ok := userName.(string); ok {
		uname = v
	}

	mov := models.InventoryMovement{
		ID:            util.NewID(),
		ItemID:        input.ItemID,
		MovementType:  input.MovementType,
		Quantity:      input.Quantity,
		PreviousStock: prevStock,
		NewStock:      newStock,
		ReferenceNo:   input.ReferenceNo,
		Notes:         input.Notes,
		UserID:        &uid,
		UserName:      &uname,
	}
	database.DB.Create(&mov)

	// Update item stock
	database.DB.Model(&item).Updates(map[string]interface{}{
		"currentStock": newStock,
		"updatedAt":    time.Now(),
	})

	c.JSON(http.StatusCreated, gin.H{"data": mov, "newStock": newStock})
}

// ============================================================================
// Categories
// ============================================================================

func ListCategories(c *gin.Context) {
	var cats []models.InventoryCategory
	database.DB.Order("name").Find(&cats)
	c.JSON(http.StatusOK, gin.H{"data": cats})
}

type CategoryInput struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
}

func CreateCategory(c *gin.Context) {
	var input CategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cat := models.InventoryCategory{ID: util.NewID(), Name: input.Name, Description: input.Description}
	database.DB.Create(&cat)
	c.JSON(http.StatusCreated, gin.H{"data": cat})
}

func UpdateCategory(c *gin.Context) {
	id := c.Param("id")
	updates := map[string]interface{}{"updatedAt": time.Now()}
	var input CategoryInput
	c.ShouldBindJSON(&input)
	if input.Name != "" {
		updates["name"] = input.Name
	}
	if input.Description != nil {
		updates["description"] = input.Description
	}
	database.DB.Model(&models.InventoryCategory{}).Where("id = ?", id).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Kategori diupdate"})
}

func DeleteCategory(c *gin.Context) {
	id := c.Param("id")
	database.DB.Where("id = ?", id).Delete(&models.InventoryCategory{})
	c.JSON(http.StatusOK, gin.H{"message": "Kategori dihapus"})
}

// ============================================================================
// Suppliers
// ============================================================================

func ListSuppliers(c *gin.Context) {
	var suppliers []models.InventorySupplier
	database.DB.Where("isActive = ?", true).Order("name").Find(&suppliers)
	c.JSON(http.StatusOK, gin.H{"data": suppliers})
}

type SupplierInput struct {
	Name        string  `json:"name" binding:"required"`
	ContactName *string `json:"contactName"`
	Phone       *string `json:"phone"`
	Email       *string `json:"email"`
	Address     *string `json:"address"`
	Notes       *string `json:"notes"`
}

func CreateSupplier(c *gin.Context) {
	var input SupplierInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	supplier := models.InventorySupplier{
		ID:          util.NewID(),
		Name:        input.Name,
		ContactName: input.ContactName,
		Phone:       input.Phone,
		Email:       input.Email,
		Address:     input.Address,
		Notes:       input.Notes,
		IsActive:    true,
	}
	database.DB.Create(&supplier)
	c.JSON(http.StatusCreated, gin.H{"data": supplier})
}

func UpdateSupplier(c *gin.Context) {
	id := c.Param("id")
	updates := map[string]interface{}{"updatedAt": time.Now()}
	var input SupplierInput
	c.ShouldBindJSON(&input)
	if input.Name != "" {
		updates["name"] = input.Name
	}
	if input.ContactName != nil {
		updates["contactName"] = input.ContactName
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
	database.DB.Model(&models.InventorySupplier{}).Where("id = ?", id).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "Supplier diupdate"})
}

func DeleteSupplier(c *gin.Context) {
	id := c.Param("id")
	database.DB.Model(&models.InventorySupplier{}).Where("id = ?", id).Update("isActive", false)
	c.JSON(http.StatusOK, gin.H{"message": "Supplier dihapus"})
}
