package upload

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/upload")
	{
		g.POST("/logo", UploadLogo)
		g.POST("/payment-proof", UploadPaymentProof)
		g.POST("/pppoe-customer", UploadPppoeCustomer)
		g.POST("/id-card", UploadIDCard)
	}
}

const maxFileSize = 5 << 20 // 5MB

func saveUpload(c *gin.Context, fieldName string, allowedTypes []string, destDir string) (string, error) {
	file, header, err := c.Request.FormFile(fieldName)
	if err != nil {
		return "", fmt.Errorf("file tidak ditemukan: %s", err.Error())
	}
	defer file.Close()

	if header.Size > maxFileSize {
		return "", fmt.Errorf("ukuran file terlalu besar (max 5MB)")
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowed := false
	for _, t := range allowedTypes {
		if ext == t {
			allowed = true
			break
		}
	}
	if !allowed {
		return "", fmt.Errorf("format file tidak didukung: %s", ext)
	}

	if err := os.MkdirAll(destDir, 0750); err != nil {
		return "", fmt.Errorf("gagal membuat direktori: %s", err.Error())
	}

	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	destPath := filepath.Join(destDir, filename)

	if err := c.SaveUploadedFile(header, destPath); err != nil {
		return "", fmt.Errorf("gagal menyimpan file: %s", err.Error())
	}

	// Return public URL path
	// Replace backslash for cross-platform
	publicPath := strings.ReplaceAll(destPath, string(os.PathSeparator), "/")
	// Strip leading path to return relative /uploads/... path
	idx := strings.Index(publicPath, "/uploads/")
	if idx >= 0 {
		publicPath = publicPath[idx:]
	}

	return publicPath, nil
}

func UploadLogo(c *gin.Context) {
	url, err := saveUpload(c, "file", []string{".png", ".jpg", ".jpeg", ".svg", ".webp"}, "public/uploads/logos")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

func UploadPaymentProof(c *gin.Context) {
	url, err := saveUpload(c, "file", []string{".png", ".jpg", ".jpeg", ".webp", ".pdf"}, "public/uploads/payments")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

func UploadPppoeCustomer(c *gin.Context) {
	url, err := saveUpload(c, "file", []string{".png", ".jpg", ".jpeg", ".webp"}, "public/uploads/customers")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

func UploadIDCard(c *gin.Context) {
	url, err := saveUpload(c, "file", []string{".png", ".jpg", ".jpeg", ".webp"}, "public/uploads/id-cards")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}
