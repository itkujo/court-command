// backend/session/context.go
package session

import "context"

type sessionContextKey struct{}

// SessionData returns the session data from the request context, or nil if not authenticated.
func SessionData(ctx context.Context) *Data {
	if data, ok := ctx.Value(sessionContextKey{}).(*Data); ok {
		return data
	}
	return nil
}

// SetSessionData stores session data in the context and returns the new context.
func SetSessionData(ctx context.Context, data *Data) context.Context {
	return context.WithValue(ctx, sessionContextKey{}, data)
}
