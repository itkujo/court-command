// api/middleware/bodylimit.go
package middleware

import "net/http"

// MaxBodySize returns a middleware that limits the size of request bodies.
// If the body exceeds maxBytes, the server returns 413 Request Entity Too Large.
func MaxBodySize(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			next.ServeHTTP(w, r)
		})
	}
}
