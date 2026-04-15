// backend/handler/pod.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// PodHandler handles pod HTTP requests.
type PodHandler struct {
	podSvc *service.PodService
}

// NewPodHandler creates a new PodHandler.
func NewPodHandler(svc *service.PodService) *PodHandler {
	return &PodHandler{podSvc: svc}
}

// Routes returns a chi.Router with all pod routes mounted.
// Expects to be mounted under /divisions/{divisionID}/pods.
func (h *PodHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public routes
	r.Get("/", h.ListPods)
	r.Get("/{podID}", h.GetPod)

	// Authenticated routes
	r.Post("/", h.CreatePod)
	r.Patch("/{podID}", h.UpdatePod)
	r.Delete("/{podID}", h.DeletePod)

	return r
}

// CreatePod creates a new pod.
func (h *PodHandler) CreatePod(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	divisionID, err := parseDivisionID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	var body struct {
		Name      string `json:"name"`
		SortOrder *int32 `json:"sort_order"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.CreatePodParams{
		DivisionID: divisionID,
		Name:       body.Name,
	}

	if body.SortOrder != nil {
		params.SortOrder = pgtype.Int4{Int32: *body.SortOrder, Valid: true}
	}

	pod, err := h.podSvc.Create(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, pod)
}

// GetPod retrieves a pod by ID.
func (h *PodHandler) GetPod(w http.ResponseWriter, r *http.Request) {
	podID, err := strconv.ParseInt(chi.URLParam(r, "podID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid pod ID")
		return
	}

	pod, err := h.podSvc.GetByID(r.Context(), podID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, pod)
}

// ListPods lists pods for a division.
func (h *PodHandler) ListPods(w http.ResponseWriter, r *http.Request) {
	divisionID, err := parseDivisionID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	pods, total, err := h.podSvc.ListByDivision(r.Context(), divisionID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, pods, total, len(pods), 0)
}

// UpdatePod updates a pod.
func (h *PodHandler) UpdatePod(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	podID, err := strconv.ParseInt(chi.URLParam(r, "podID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid pod ID")
		return
	}

	var body struct {
		Name      *string `json:"name"`
		SortOrder *int32  `json:"sort_order"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdatePodParams{
		Name: body.Name,
	}

	if body.SortOrder != nil {
		params.SortOrder = pgtype.Int4{Int32: *body.SortOrder, Valid: true}
	}

	pod, err := h.podSvc.Update(r.Context(), podID, params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, pod)
}

// DeletePod soft-deletes a pod.
func (h *PodHandler) DeletePod(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	podID, err := strconv.ParseInt(chi.URLParam(r, "podID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid pod ID")
		return
	}

	if err := h.podSvc.Delete(r.Context(), podID); err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, map[string]string{"message": "pod deleted"})
}
