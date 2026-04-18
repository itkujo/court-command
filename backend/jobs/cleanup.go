package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/court-command/court-command/service"
)

// StartQuickMatchCleanup starts a background goroutine that periodically
// cleans up expired quick matches. Runs every hour.
func StartQuickMatchCleanup(ctx context.Context, matchService *service.MatchService, logger *slog.Logger) {
	ticker := time.NewTicker(1 * time.Hour)

	go func() {
		// Run once on startup after a short delay, respecting context cancellation
		select {
		case <-time.After(10 * time.Second):
			runCleanup(ctx, matchService, logger)
		case <-ctx.Done():
			ticker.Stop()
			logger.Info("quick match cleanup stopped before initial run")
			return
		}

		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				logger.Info("quick match cleanup stopped")
				return
			case <-ticker.C:
				runCleanup(ctx, matchService, logger)
			}
		}
	}()

	logger.Info("quick match cleanup job started", "interval", "1h")
}

func runCleanup(ctx context.Context, matchService *service.MatchService, logger *slog.Logger) {
	err := matchService.CleanupExpiredQuickMatches(ctx)
	if err != nil {
		logger.Error("quick match cleanup failed", "error", err)
	} else {
		logger.Debug("quick match cleanup completed")
	}
}

// StartUploadCleanup starts a background goroutine that cleans orphaned uploads daily.
// Deletes upload files not referenced by any entity and older than 7 days.
func StartUploadCleanup(ctx context.Context, uploadService *service.UploadService, logger *slog.Logger) {
	ticker := time.NewTicker(24 * time.Hour)

	go func() {
		// Initial delay
		select {
		case <-time.After(30 * time.Second):
			runUploadCleanup(ctx, uploadService, logger)
		case <-ctx.Done():
			ticker.Stop()
			return
		}

		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				logger.Info("upload cleanup stopped")
				return
			case <-ticker.C:
				runUploadCleanup(ctx, uploadService, logger)
			}
		}
	}()

	logger.Info("upload orphan cleanup job started", "interval", "24h", "min_age", "7d")
}

func runUploadCleanup(ctx context.Context, uploadService *service.UploadService, logger *slog.Logger) {
	count, err := uploadService.CleanOrphanedUploads(ctx, 7*24*time.Hour)
	if err != nil {
		logger.Error("upload orphan cleanup failed", "error", err)
	} else if count > 0 {
		logger.Info("upload orphan cleanup completed", "deleted", count)
	}
}
