// backend/middleware/error.go
package middleware

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"runtime/debug"

	chimw "github.com/go-chi/chi/v5/middleware"
)

// Recoverer catches panics and returns a structured 500 error response.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rvr := recover(); rvr != nil {
				reqID := chimw.GetReqID(r.Context())

				slog.Error("panic recovered",
					"error", rvr,
					"request_id", reqID,
					"stack", string(debug.Stack()),
				)

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "internal_error",
						"message": "an unexpected error occurred",
					},
				})
			}
		}()

		next.ServeHTTP(w, r)
	})
}
