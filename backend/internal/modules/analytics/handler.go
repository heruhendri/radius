package analytics

import (
	"net/http"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/models"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	r.GET("/admin/analytics", GetAnalytics)
	r.GET("/admin/laporan", GetLaporan)
	r.GET("/admin/laporan/export", ExportLaporan)
	r.GET("/dashboard/analytics", GetDashboardAnalytics)
	r.GET("/dashboard/traffic", GetDashboardTraffic)
	r.GET("/admin/agent-deposits", ListAgentDeposits)
}

func GetAnalytics(c *gin.Context) {
	period := c.DefaultQuery("period", "month")
	now := time.Now()

	var startDate time.Time
	switch period {
	case "week":
		startDate = now.AddDate(0, 0, -7)
	case "year":
		startDate = now.AddDate(-1, 0, 0)
	default:
		startDate = now.AddDate(0, -1, 0)
	}

	var newUsers int64
	database.DB.Model(&models.PppoeUser{}).Where("createdAt >= ?", startDate).Count(&newUsers)

	var activeUsers int64
	database.DB.Model(&models.PppoeUser{}).Where("status = ?", "active").Count(&activeUsers)

	var paidInvoices struct {
		Count int64
		Total float64
	}
	database.DB.Model(&models.Invoice{}).
		Select("COUNT(*) as count, COALESCE(SUM(amount), 0) as total").
		Where("status = ? AND paidAt >= ?", "PAID", startDate).
		Scan(&paidInvoices)

	var expiredUsers int64
	database.DB.Model(&models.PppoeUser{}).
		Where("status = ? OR (expiredAt IS NOT NULL AND expiredAt < ?)", "expired", now).
		Count(&expiredUsers)

	c.JSON(http.StatusOK, gin.H{
		"period":       period,
		"newUsers":     newUsers,
		"activeUsers":  activeUsers,
		"expiredUsers": expiredUsers,
		"paidInvoices": paidInvoices.Count,
		"totalRevenue": paidInvoices.Total,
	})
}

func GetLaporan(c *gin.Context) {
	from := c.Query("from")
	to := c.Query("to")

	var startDate, endDate time.Time
	if from != "" {
		startDate, _ = time.Parse("2006-01-02", from)
	} else {
		startDate = time.Now().AddDate(0, -1, 0)
	}
	if to != "" {
		endDate, _ = time.Parse("2006-01-02", to)
	} else {
		endDate = time.Now()
	}

	// Revenue by period
	type RevenueRow struct {
		Month string  `json:"month"`
		Total float64 `json:"total"`
		Count int64   `json:"count"`
	}
	var revenue []RevenueRow
	database.DB.Model(&models.Invoice{}).
		Select("DATE_FORMAT(paidAt, '%Y-%m') as month, SUM(amount) as total, COUNT(*) as count").
		Where("status = ? AND paidAt BETWEEN ? AND ?", "PAID", startDate, endDate).
		Group("month").
		Order("month ASC").
		Scan(&revenue)

	var activeUsers, newUsers, expiredUsers int64
	database.DB.Model(&models.PppoeUser{}).Where("status = ?", "active").Count(&activeUsers)
	database.DB.Model(&models.PppoeUser{}).Where("createdAt BETWEEN ? AND ?", startDate, endDate).Count(&newUsers)
	database.DB.Model(&models.PppoeUser{}).Where("status = ?", "expired").Count(&expiredUsers)

	c.JSON(http.StatusOK, gin.H{
		"revenue":      revenue,
		"activeUsers":  activeUsers,
		"newUsers":     newUsers,
		"expiredUsers": expiredUsers,
		"from":         startDate,
		"to":           endDate,
	})
}

func ExportLaporan(c *gin.Context) {
	from := c.Query("from")
	to := c.Query("to")
	_ = from
	_ = to
	c.JSON(http.StatusOK, gin.H{"message": "Export laporan (CSV/Excel) belum diimplementasi di Go backend"})
}

func GetDashboardAnalytics(c *gin.Context) {
	var activeUsers, totalUsers, expiredUsers int64
	database.DB.Model(&models.PppoeUser{}).Where("status = ?", "active").Count(&activeUsers)
	database.DB.Model(&models.PppoeUser{}).Count(&totalUsers)
	database.DB.Model(&models.PppoeUser{}).Where("status = ?", "expired").Count(&expiredUsers)

	var pendingInvoices int64
	var totalRevenue float64
	database.DB.Model(&models.Invoice{}).Where("status = ?", "PENDING").Count(&pendingInvoices)
	database.DB.Model(&models.Invoice{}).Where("status = ? AND paidAt >= ?", "PAID", time.Now().AddDate(0, -1, 0)).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalRevenue)

	c.JSON(http.StatusOK, gin.H{
		"activeUsers":     activeUsers,
		"totalUsers":      totalUsers,
		"expiredUsers":    expiredUsers,
		"pendingInvoices": pendingInvoices,
		"monthlyRevenue":  totalRevenue,
	})
}

func GetDashboardTraffic(c *gin.Context) {
	// Return recent sessions as traffic data
	var sessions []models.Session
	database.DB.Order("startTime DESC").Limit(100).Find(&sessions)
	c.JSON(http.StatusOK, gin.H{"data": sessions})
}

func ListAgentDeposits(c *gin.Context) {
	status := c.Query("status")
	query := database.DB.Model(&models.Transaction{}).Preload("Category")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var txns []models.Transaction
	query.Order("createdAt DESC").Limit(50).Find(&txns)
	c.JSON(http.StatusOK, gin.H{"data": txns, "total": total})
}
