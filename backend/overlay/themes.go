package overlay

// Theme defines a curated overlay visual theme.
type Theme struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Defaults    ThemeDefaults `json:"defaults"`
}

// ThemeDefaults holds the default CSS custom property values for a theme.
type ThemeDefaults struct {
	Primary        string `json:"primary"`         // --primary
	Secondary      string `json:"secondary"`       // --secondary
	Accent         string `json:"accent"`          // --accent
	Background     string `json:"background"`      // --bg
	Text           string `json:"text"`            // --text
	FontFamily     string `json:"font_family"`     // --font-family
	BorderRadius   string `json:"border_radius"`   // --radius
	AnimationStyle string `json:"animation_style"` // slide, fade, scale, none
}

// AllThemes is the registry of available themes.
var AllThemes = []Theme{
	{
		ID:          "classic",
		Name:        "Classic",
		Description: "Traditional broadcast look with clean lines and solid backgrounds",
		Defaults: ThemeDefaults{
			Primary:        "#1e3a5f",
			Secondary:      "#ffffff",
			Accent:         "#e63946",
			Background:     "#0a0a0a",
			Text:           "#ffffff",
			FontFamily:     "'Inter', sans-serif",
			BorderRadius:   "4px",
			AnimationStyle: "slide",
		},
	},
	{
		ID:          "modern",
		Name:        "Modern",
		Description: "Contemporary design with rounded corners and soft shadows",
		Defaults: ThemeDefaults{
			Primary:        "#3b82f6",
			Secondary:      "#f8fafc",
			Accent:         "#f59e0b",
			Background:     "#111827",
			Text:           "#f9fafb",
			FontFamily:     "'Plus Jakarta Sans', sans-serif",
			BorderRadius:   "12px",
			AnimationStyle: "fade",
		},
	},
	{
		ID:          "minimal",
		Name:        "Minimal",
		Description: "Clean, understated design with maximum readability",
		Defaults: ThemeDefaults{
			Primary:        "#18181b",
			Secondary:      "#fafafa",
			Accent:         "#22c55e",
			Background:     "transparent",
			Text:           "#ffffff",
			FontFamily:     "'Geist', sans-serif",
			BorderRadius:   "2px",
			AnimationStyle: "fade",
		},
	},
	{
		ID:          "bold",
		Name:        "Bold",
		Description: "High-contrast design with strong colors and thick borders",
		Defaults: ThemeDefaults{
			Primary:        "#dc2626",
			Secondary:      "#fef2f2",
			Accent:         "#facc15",
			Background:     "#000000",
			Text:           "#ffffff",
			FontFamily:     "'Oswald', sans-serif",
			BorderRadius:   "0px",
			AnimationStyle: "scale",
		},
	},
	{
		ID:          "dark",
		Name:        "Dark",
		Description: "Sleek dark theme optimized for OBS chroma-free overlays",
		Defaults: ThemeDefaults{
			Primary:        "#6366f1",
			Secondary:      "#1e1b4b",
			Accent:         "#818cf8",
			Background:     "rgba(0,0,0,0.85)",
			Text:           "#e2e8f0",
			FontFamily:     "'JetBrains Mono', monospace",
			BorderRadius:   "8px",
			AnimationStyle: "slide",
		},
	},
	{
		ID:          "broadcast_pro",
		Name:        "Broadcast Pro",
		Description: "Professional TV broadcast style with gradient accents",
		Defaults: ThemeDefaults{
			Primary:        "#0f172a",
			Secondary:      "#f1f5f9",
			Accent:         "#0ea5e9",
			Background:     "#020617",
			Text:           "#ffffff",
			FontFamily:     "'Roboto Condensed', sans-serif",
			BorderRadius:   "6px",
			AnimationStyle: "slide",
		},
	},
}

// GetTheme returns a theme by ID, or the classic theme if not found.
func GetTheme(id string) Theme {
	for _, t := range AllThemes {
		if t.ID == id {
			return t
		}
	}
	return AllThemes[0] // classic as fallback
}

// ListThemeIDs returns all available theme IDs.
func ListThemeIDs() []string {
	ids := make([]string, len(AllThemes))
	for i, t := range AllThemes {
		ids[i] = t.ID
	}
	return ids
}
