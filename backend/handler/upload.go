// backend/handler/upload.go
package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// UploadHandler handles file upload HTTP requests.
type UploadHandler struct {
	uploadSvc *service.UploadService
}

// NewUploadHandler creates a new UploadHandler.
func NewUploadHandler(uploadSvc *service.UploadService) *UploadHandler {
	return &UploadHandler{uploadSvc: uploadSvc}
}

// Routes returns a chi.Router with all upload routes mounted.
func (h *UploadHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Post("/", h.Upload)
	r.Get("/", h.ListUploads)
	r.Delete("/{uploadID}", h.DeleteUpload)

	return r
}

// Upload handles POST /api/v1/uploads
func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	// Limit request body to 10MB + overhead
	r.Body = http.MaxBytesReader(w, r.Body, service.MaxUploadSize+1024)

	if err := r.ParseMultipartForm(service.MaxUploadSize); err != nil {
		BadRequest(w, "failed to parse multipart form: "+err.Error())
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		BadRequest(w, "file field is required")
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	var entityType *string
	if et := r.FormValue("entity_type"); et != "" {
		entityType = &et
	}

	var entityID *int64
	if eid := r.FormValue("entity_id"); eid != "" {
		parsed, err := strconv.ParseInt(eid, 10, 64)
		if err != nil {
			BadRequest(w, "invalid entity_id")
			return
		}
		entityID = &parsed
	}

	result, err := h.uploadSvc.SaveFile(
		r.Context(),
		sess.UserID,
		file,
		header.Filename,
		contentType,
		header.Size,
		entityType,
		entityID,
	)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, result)
}

// ListUploads handles GET /api/v1/uploads
func (h *UploadHandler) ListUploads(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	limit, offset := parsePagination(r)

	uploads, total, err := h.uploadSvc.ListUploads(r.Context(), sess.UserID, limit, offset)
	if err != nil {
		InternalError(w, "failed to list uploads")
		return
	}

	Paginated(w, uploads, total, int(limit), int(offset))
}

// DeleteUpload handles DELETE /api/v1/uploads/{uploadID}
func (h *UploadHandler) DeleteUpload(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	uploadID, err := strconv.ParseInt(chi.URLParam(r, "uploadID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid upload ID")
		return
	}

	if err := h.uploadSvc.DeleteUpload(r.Context(), uploadID, sess.UserID); err != nil {
		HandleServiceError(w, err)
		return
	}

	NoContent(w)
}
