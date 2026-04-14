// backend/middleware/auth.go
package middleware

import (
	"context"
	"net/http"

	"github.com/court-command/court-command/handler"
	"github.com/court-command/court-command/session"
)

type sessionContextKey struct{}

// SessionData returns the session data from the request context, or nil if not authenticated.
func SessionData(ctx context.Context) *session.Data {
	if data, ok := ctx.Value(sessionContextKey{}).(*session.Data); ok {
		return data
	}
	return nil
}

// RequireAuth is a middleware that requires a valid session cookie.
// If the session is invalid or missing, it returns 401 Unauthorized.
func RequireAuth(store *session.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(session.SessionCookieName)
			if err != nil {
				handler.Unauthorized(w, "authentication required")
				return
			}

			data, err := store.Get(r.Context(), cookie.Value)
			if err != nil {
				handler.InternalError(w, "session lookup failed")
				return
			}
			if data == nil {
				handler.Unauthorized(w, "session expired or invalid")
				return
			}

			ctx := context.WithValue(r.Context(), sessionContextKey{}, data)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole returns a middleware that checks the authenticated user has one of the allowed roles.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	roleSet := make(map[string]bool, len(roles))
	for _, r := range roles {
		roleSet[r] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			data := SessionData(r.Context())
			if data == nil {
				handler.Unauthorized(w, "authentication required")
				return
			}

			if !roleSet[data.Role] {
				handler.Forbidden(w, "insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
