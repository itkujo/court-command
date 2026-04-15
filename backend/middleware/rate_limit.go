// backend/middleware/rate_limit.go
package middleware

import (
	"net/http"
	"sync"
	"time"
)

// RateLimiter is a simple in-memory token-bucket rate limiter keyed by IP.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     int           // tokens added per interval
	burst    int           // max tokens
	interval time.Duration // refill interval
}

type visitor struct {
	tokens   int
	lastSeen time.Time
}

// NewRateLimiter creates a new rate limiter.
// rate is the number of requests allowed per interval, burst is the max burst size.
func NewRateLimiter(rate, burst int, interval time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		burst:    burst,
		interval: interval,
	}
	go rl.cleanup()
	return rl
}

// cleanup periodically removes stale visitors.
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		for ip, v := range rl.visitors {
			if time.Since(v.lastSeen) > 10*time.Minute {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// allow checks whether a request from the given key should be allowed.
func (rl *RateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[key]
	if !exists {
		rl.visitors[key] = &visitor{tokens: rl.burst - 1, lastSeen: time.Now()}
		return true
	}

	// Refill tokens based on elapsed time
	elapsed := time.Since(v.lastSeen)
	refill := int(elapsed/rl.interval) * rl.rate
	v.tokens += refill
	if v.tokens > rl.burst {
		v.tokens = rl.burst
	}
	v.lastSeen = time.Now()

	if v.tokens <= 0 {
		return false
	}
	v.tokens--
	return true
}

// RateLimit returns middleware that limits requests by client IP.
func RateLimit(rate, burst int, interval time.Duration) func(http.Handler) http.Handler {
	limiter := NewRateLimiter(rate, burst, interval)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.RemoteAddr
			if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
				key = forwarded
			}

			if !limiter.allow(key) {
				writeError(w, http.StatusTooManyRequests, "rate_limited", "too many requests")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
