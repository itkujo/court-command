// api/handler/dashboard.go
package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// DashboardHandler handles player dashboard requests.
type DashboardHandler struct {
	dashboardSvc *service.DashboardService
}

// NewDashboardHandler creates a new DashboardHandler.
func NewDashboardHandler(svc *service.DashboardService) *DashboardHandler {
	return &DashboardHandler{dashboardSvc: svc}
}

// Routes returns the Chi routes for the dashboard.
func (h *DashboardHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.GetDashboard)
	return r
}

// GetDashboard handles GET /api/v1/dashboard
func (h *DashboardHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	data, err := h.dashboardSvc.GetDashboard(r.Context(), sess.UserID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "DASHBOARD_FAILED", "Failed to load dashboard")
		return
	}

	Success(w, data)
}
