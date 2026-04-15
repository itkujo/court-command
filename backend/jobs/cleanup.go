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
