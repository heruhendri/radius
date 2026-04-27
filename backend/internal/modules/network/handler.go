package network

import (
	"net/http"
	"time"

	"radius-buildup/internal/database"
	"radius-buildup/internal/util"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	// Network topology - fiber paths
	fp := r.Group("/network/fiber-paths")
	{
		fp.GET("", ListFiberPaths)
		fp.POST("", CreateFiberPath)
		fp.PUT("/:id", UpdateFiberPath)
		fp.DELETE("/:id", DeleteFiberPath)
	}

	// Fiber cables
	fc := r.Group("/network/cables")
	{
		fc.GET("", ListFiberCables)
		fc.POST("", CreateFiberCable)
		fc.GET("/:id", GetFiberCable)
		fc.PUT("/:id", UpdateFiberCable)
		fc.DELETE("/:id", DeleteFiberCable)
	}

	// Network nodes (poles, vaults, etc.)
	nn := r.Group("/network/nodes")
	{
		nn.GET("", ListNetworkNodes)
		nn.POST("", CreateNetworkNode)
		nn.PUT("/:id", UpdateNetworkNode)
		nn.DELETE("/:id", DeleteNetworkNode)
	}

	// Joint closures
	jc := r.Group("/network/closures")
	{
		jc.GET("", ListJointClosures)
		jc.POST("", CreateJointClosure)
		jc.PUT("/:id", UpdateJointClosure)
		jc.DELETE("/:id", DeleteJointClosure)
	}

	// OTBs
	otb := r.Group("/network/otbs")
	{
		otb.GET("", ListOTBs)
		otb.POST("", CreateOTB)
		otb.PUT("/:id", UpdateOTB)
		otb.DELETE("/:id", DeleteOTB)
	}

	// ODP
	odp := r.Group("/network/odp")
	{
		odp.GET("", ListODP)
		odp.POST("", CreateODP)
		odp.PUT("/:id", UpdateODP)
		odp.DELETE("/:id", DeleteODP)
	}

	// OLT (optical line terminal) - network
	olt := r.Group("/network/olt")
	{
		olt.GET("", ListNetworkOLT)
		olt.POST("", CreateNetworkOLT)
		olt.PUT("/:id", UpdateNetworkOLT)
	}

	// ODC (optical distribution cabinet)
	odc := r.Group("/network/odc")
	{
		odc.GET("", ListODC)
		odc.POST("", CreateODC)
		odc.PUT("/:id", UpdateODC)
	}

	// VPN
	r.GET("/network/vpn/servers", ListVPNServers)
	r.POST("/network/vpn/servers", CreateVPNServer)
	r.PUT("/network/vpn/servers/:id", UpdateVPNServer)
	r.DELETE("/network/vpn/servers/:id", DeleteVPNServer)
	r.GET("/network/vpn/clients", ListVPNClients)
}

// ============================================================================
// Generic helpers
// ============================================================================

func listTable(table string, c *gin.Context) {
	search := c.Query("search")
	page := 1

	query := database.DB.Table(table)
	if search != "" {
		query = query.Where("name LIKE ?", "%"+search+"%")
	}

	var total int64
	database.DB.Table(table).Count(&total)

	var rows []map[string]interface{}
	query.Offset((page - 1) * 50).Limit(50).Scan(&rows)
	if rows == nil {
		rows = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"data": rows, "total": total})
}

func createRecord(table string, c *gin.Context) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	input["id"] = util.NewID()
	input["createdAt"] = time.Now()
	input["updatedAt"] = time.Now()
	if err := database.DB.Table(table).Create(input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": input, "message": "Data dibuat"})
}

func updateRecord(table string, c *gin.Context) {
	id := c.Param("id")
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	input["updatedAt"] = time.Now()
	database.DB.Table(table).Where("id = ?", id).Updates(input)
	c.JSON(http.StatusOK, gin.H{"message": "Data diupdate"})
}

func deleteRecord(table string, c *gin.Context) {
	id := c.Param("id")
	database.DB.Table(table).Where("id = ?", id).Delete(nil)
	c.JSON(http.StatusOK, gin.H{"message": "Data dihapus"})
}

func getRecord(table string, c *gin.Context) {
	id := c.Param("id")
	var row map[string]interface{}
	if err := database.DB.Table(table).Where("id = ?", id).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": row})
}

// ============================================================================
// Fiber Paths
// ============================================================================

func ListFiberPaths(c *gin.Context)  { listTable("network_fiber_paths", c) }
func CreateFiberPath(c *gin.Context) { createRecord("network_fiber_paths", c) }
func UpdateFiberPath(c *gin.Context) { updateRecord("network_fiber_paths", c) }
func DeleteFiberPath(c *gin.Context) { deleteRecord("network_fiber_paths", c) }

// ============================================================================
// Fiber Cables
// ============================================================================

func ListFiberCables(c *gin.Context)  { listTable("fiber_cables", c) }
func GetFiberCable(c *gin.Context)    { getRecord("fiber_cables", c) }
func CreateFiberCable(c *gin.Context) { createRecord("fiber_cables", c) }
func UpdateFiberCable(c *gin.Context) { updateRecord("fiber_cables", c) }
func DeleteFiberCable(c *gin.Context) { deleteRecord("fiber_cables", c) }

// ============================================================================
// Network Nodes
// ============================================================================

func ListNetworkNodes(c *gin.Context)  { listTable("network_nodes", c) }
func CreateNetworkNode(c *gin.Context) { createRecord("network_nodes", c) }
func UpdateNetworkNode(c *gin.Context) { updateRecord("network_nodes", c) }
func DeleteNetworkNode(c *gin.Context) { deleteRecord("network_nodes", c) }

// ============================================================================
// Joint Closures
// ============================================================================

func ListJointClosures(c *gin.Context)  { listTable("network_joint_closures", c) }
func CreateJointClosure(c *gin.Context) { createRecord("network_joint_closures", c) }
func UpdateJointClosure(c *gin.Context) { updateRecord("network_joint_closures", c) }
func DeleteJointClosure(c *gin.Context) { deleteRecord("network_joint_closures", c) }

// ============================================================================
// OTBs
// ============================================================================

func ListOTBs(c *gin.Context)  { listTable("network_otbs", c) }
func CreateOTB(c *gin.Context) { createRecord("network_otbs", c) }
func UpdateOTB(c *gin.Context) { updateRecord("network_otbs", c) }
func DeleteOTB(c *gin.Context) { deleteRecord("network_otbs", c) }

// ============================================================================
// ODP
// ============================================================================

func ListODP(c *gin.Context)   { listTable("networkODP", c) }
func CreateODP(c *gin.Context) { createRecord("networkODP", c) }
func UpdateODP(c *gin.Context) { updateRecord("networkODP", c) }
func DeleteODP(c *gin.Context) { deleteRecord("networkODP", c) }

// ============================================================================
// OLT (Network)
// ============================================================================

func ListNetworkOLT(c *gin.Context)   { listTable("networkOLT", c) }
func CreateNetworkOLT(c *gin.Context) { createRecord("networkOLT", c) }
func UpdateNetworkOLT(c *gin.Context) { updateRecord("networkOLT", c) }

// ============================================================================
// ODC
// ============================================================================

func ListODC(c *gin.Context)   { listTable("networkODC", c) }
func CreateODC(c *gin.Context) { createRecord("networkODC", c) }
func UpdateODC(c *gin.Context) { updateRecord("networkODC", c) }

// ============================================================================
// VPN
// ============================================================================

func ListVPNServers(c *gin.Context) {
	var rows []map[string]interface{}
	database.DB.Table("vpnServer").Scan(&rows)
	if rows == nil {
		rows = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

func CreateVPNServer(c *gin.Context) { createRecord("vpnServer", c) }
func UpdateVPNServer(c *gin.Context) { updateRecord("vpnServer", c) }
func DeleteVPNServer(c *gin.Context) { deleteRecord("vpnServer", c) }

func ListVPNClients(c *gin.Context) {
	var rows []map[string]interface{}
	database.DB.Table("vpnClient").Scan(&rows)
	if rows == nil {
		rows = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
