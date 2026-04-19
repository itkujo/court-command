package service

import (
	"regexp"
	"strings"
)

// generateSlug creates a URL-safe slug from a name.
var slugRegexp = regexp.MustCompile(`[^a-z0-9]+`)

func generateSlug(name string) string {
	slug := strings.ToLower(name)
	slug = slugRegexp.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "item"
	}
	return slug
}
