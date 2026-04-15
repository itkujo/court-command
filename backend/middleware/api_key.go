// backend/middleware/api_key.go
package middleware

import (
	"net/http"
	"strings"

	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// ApiKeyAuth is middleware that authenticates requests using an API key in the
// Authorization header (Bearer token). On success it injects a synthetic session
// into the context so downstream handlers can use session.SessionData(ctx) as
// normal.
func ApiKeyAuth(apiKeySvc *service.ApiKeyService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
				writeError(w, http.StatusUnauthorized, "unauthorized", "API key required")
				return
			}

			rawKey := strings.TrimPrefix(auth, "Bearer ")

			apiKey, err := apiKeySvc.ValidateApiKey(r.Context(), rawKey)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "unauthorized", "invalid or expired API key")
				return
			}

			// Build a synthetic session from the API key owner.
			data := &session.Data{
				UserID: apiKey.UserID,
				Role:   "api_key",
			}

			ctx := session.SetSessionData(r.Context(), data)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// NOTE: writeError is defined in auth.go within the same package.
