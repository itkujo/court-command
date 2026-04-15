package bracket

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDetermineSlotInNextMatch(t *testing.T) {
	tests := []struct {
		matchNumber  int
		expectedSlot int
	}{
		{1, 1}, // odd -> slot 1
		{2, 2}, // even -> slot 2
		{3, 1}, // odd -> slot 1
		{4, 2}, // even -> slot 2
		{5, 1},
		{6, 2},
		{7, 1},
		{8, 2},
		{99, 1},
		{100, 2},
	}
	for _, tc := range tests {
		result := DetermineSlotInNextMatch(tc.matchNumber)
		assert.Equal(t, tc.expectedSlot, result, "matchNumber=%d", tc.matchNumber)
	}
}
