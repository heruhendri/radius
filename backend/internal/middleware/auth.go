package middleware

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"radius-buildup/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/hkdf"
)

// ============================================================
// NextAuth JWE session-cookie support
// ============================================================

// deriveNextAuthKey derives the 32-byte AES key from NEXTAUTH_SECRET
// using HKDF-SHA256 with the salt/info that NextAuth v4 uses.
func deriveNextAuthKey(secret string) ([]byte, error) {
	r := hkdf.New(sha256.New, []byte(secret), []byte(""), []byte("NextAuth.js Generated Encryption Key"))
	key := make([]byte, 32)
	if _, err := io.ReadFull(r, key); err != nil {
		return nil, err
	}
	return key, nil
}

// decodeBase64URL decodes a base64url string (with or without padding).
func decodeBase64URL(s string) ([]byte, error) {
	// Restore padding
	switch len(s) % 4 {
	case 2:
		s += "=="
	case 3:
		s += "="
	}
	return base64.URLEncoding.DecodeString(s)
}

// decodeNextAuthCookie decodes a NextAuth v4 JWE session cookie and returns
// the map of claims it contains.  NextAuth uses alg=dir enc=A256GCM.
func decodeNextAuthCookie(tokenString, secret string) (map[string]interface{}, error) {
	parts := strings.Split(tokenString, ".")
	if len(parts) != 5 {
		return nil, fmt.Errorf("invalid JWE: need 5 parts, got %d", len(parts))
	}
	// parts: header . encryptedKey . iv . ciphertext . tag
	// For alg=dir the encrypted-key part is empty.

	iv, err := decodeBase64URL(parts[2])
	if err != nil {
		return nil, fmt.Errorf("decode IV: %w", err)
	}
	ciphertext, err := decodeBase64URL(parts[3])
	if err != nil {
		return nil, fmt.Errorf("decode ciphertext: %w", err)
	}
	tag, err := decodeBase64URL(parts[4])
	if err != nil {
		return nil, fmt.Errorf("decode tag: %w", err)
	}

	key, err := deriveNextAuthKey(secret)
	if err != nil {
		return nil, fmt.Errorf("key derivation: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new GCM: %w", err)
	}

	// AAD for AES-GCM in JWE = ASCII bytes of the base64url-encoded protected header
	aad := []byte(parts[0])
	// GCM: ciphertext || tag (Open expects them concatenated)
	combined := append(ciphertext, tag...)
	plaintext, err := gcm.Open(nil, iv, combined, aad)
	if err != nil {
		return nil, fmt.Errorf("GCM decrypt: %w", err)
	}

	var claims map[string]interface{}
	if err := json.Unmarshal(plaintext, &claims); err != nil {
		return nil, fmt.Errorf("unmarshal payload: %w", err)
	}
	return claims, nil
}

// JWTClaims holds the JWT token claims
type JWTClaims struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// GenerateToken creates a JWT token for a user
func GenerateToken(cfg *config.Config, userID, username, name, role string) (string, error) {
	claims := JWTClaims{
		UserID:   userID,
		Username: username,
		Name:     name,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "radius-buildup-go",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

// AuthRequired is a Gin middleware that checks for a valid JWT token.
// It accepts either:
//  1. An "Authorization: Bearer <token>" header (Go-issued HS256 JWT), or
//  2. A "next-auth.session-token" cookie (NextAuth v4 JWE).
func AuthRequired(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// ── 1. Try Bearer token (Go-issued HS256 JWT) ──────────────────────
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			claims := &JWTClaims{}
			token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
				return []byte(cfg.JWTSecret), nil
			})
			if err != nil || !token.Valid {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid atau sudah expired"})
				c.Abort()
				return
			}
			c.Set("userId", claims.UserID)
			c.Set("username", claims.Username)
			c.Set("name", claims.Name)
			c.Set("role", claims.Role)
			c.Next()
			return
		}

		// ── 2. Try NextAuth session cookie (JWE) ───────────────────────────
		// NextAuth uses "next-auth.session-token" on HTTP and
		// "__Secure-next-auth.session-token" on HTTPS.
		cookieNames := []string{"next-auth.session-token", "__Secure-next-auth.session-token"}
		var cookieValue string
		for _, name := range cookieNames {
			if v, err := c.Cookie(name); err == nil && v != "" {
				cookieValue = v
				break
			}
		}

		if cookieValue != "" {
			payload, err := decodeNextAuthCookie(cookieValue, cfg.JWTSecret)
			if err == nil {
				// Check expiry
				if exp, ok := payload["exp"].(float64); ok {
					if time.Now().Unix() > int64(exp) {
						c.JSON(http.StatusUnauthorized, gin.H{"error": "Session expired"})
						c.Abort()
						return
					}
				}
				userID, _ := payload["id"].(string)
				username, _ := payload["username"].(string)
				name, _ := payload["name"].(string)
				role, _ := payload["role"].(string)
				if userID == "" {
					userID, _ = payload["sub"].(string)
				}
				if userID == "" || username == "" {
					c.JSON(http.StatusUnauthorized, gin.H{"error": "Session tidak valid"})
					c.Abort()
					return
				}
				c.Set("userId", userID)
				c.Set("username", username)
				c.Set("name", name)
				c.Set("role", role)
				c.Next()
				return
			}
		}

		// ── 3. Nothing worked ──────────────────────────────────────────────
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak ditemukan"})
		c.Abort()
	}
}

// CustomerJWTClaims holds the JWT token claims for customer (PPPoE user)
type CustomerJWTClaims struct {
	CustomerID string `json:"customerId"`
	Username   string `json:"username"`
	jwt.RegisteredClaims
}

// GenerateCustomerToken creates a JWT token for a PPPoE customer
func GenerateCustomerToken(customerID, username string, cfg *config.Config) (string, error) {
	claims := CustomerJWTClaims{
		CustomerID: customerID,
		Username:   username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "radius-buildup-go-customer",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

// CustomerAuthRequired middleware for customer portal
func CustomerAuthRequired(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak ditemukan"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Format token salah"})
			c.Abort()
			return
		}

		claims := &CustomerJWTClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid atau sudah expired"})
			c.Abort()
			return
		}

		c.Set("customerId", claims.CustomerID)
		c.Set("username", claims.Username)
		c.Next()
	}
}
