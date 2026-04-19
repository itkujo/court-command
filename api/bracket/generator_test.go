package bracket

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeEntries(n int) []SeedEntry {
	entries := make([]SeedEntry, n)
	for i := 0; i < n; i++ {
		entries[i] = SeedEntry{Seed: i + 1, TeamID: int64(100 + i)}
	}
	return entries
}

func TestNextPowerOfTwo(t *testing.T) {
	tests := []struct {
		input    int
		expected int
	}{
		{1, 1},
		{2, 2},
		{3, 4},
		{4, 4},
		{5, 8},
		{7, 8},
		{8, 8},
		{9, 16},
		{16, 16},
	}
	for _, tc := range tests {
		assert.Equal(t, tc.expected, nextPowerOfTwo(tc.input), "nextPowerOfTwo(%d)", tc.input)
	}
}

func TestBracketSeedOrder(t *testing.T) {
	// For 4 teams: [1,4,2,3] means seed 1 vs seed 4, seed 2 vs seed 3
	order := bracketSeedOrder(4)
	assert.Equal(t, []int{1, 4, 2, 3}, order)

	// For 8 teams: [1,8,4,5,2,7,3,6]
	order8 := bracketSeedOrder(8)
	assert.Equal(t, []int{1, 8, 4, 5, 2, 7, 3, 6}, order8)
}

func TestGenerateSingleElimination_PowerOfTwo(t *testing.T) {
	entries := makeEntries(4)

	matches, err := GenerateSingleElimination(entries)
	require.NoError(t, err)

	// 4 teams = 3 matches (2 semis + 1 final)
	assert.Len(t, matches, 3)

	// Check rounds
	round1 := filterByRound(matches, 1)
	round2 := filterByRound(matches, 2)
	assert.Len(t, round1, 2, "should have 2 first-round matches")
	assert.Len(t, round2, 1, "should have 1 final")

	// Finals should have no next match
	finals := round2[0]
	assert.Equal(t, 0, finals.NextMatchNumber)
	assert.Equal(t, "Finals", finals.RoundName)

	// First round matches should wire to finals
	for _, m := range round1 {
		assert.Equal(t, finals.MatchNumber, m.NextMatchNumber)
		assert.Contains(t, []int{1, 2}, m.NextMatchSlot)
	}

	// No byes with power-of-two
	for _, m := range matches {
		assert.False(t, m.IsBye, "no byes expected for power-of-two")
	}
}

func TestGenerateSingleElimination_WithByes(t *testing.T) {
	entries := makeEntries(3)

	matches, err := GenerateSingleElimination(entries)
	require.NoError(t, err)

	// 3 teams -> bracket size 4 -> 3 matches, 1 bye
	assert.Len(t, matches, 3)

	byeMatches := 0
	for _, m := range matches {
		if m.IsBye {
			byeMatches++
			assert.NotZero(t, m.ByeWinnerSeed, "bye match should have a winner seed")
		}
	}
	assert.Equal(t, 1, byeMatches, "should have 1 bye match")
}

func TestGenerateSingleElimination_8Teams(t *testing.T) {
	entries := makeEntries(8)

	matches, err := GenerateSingleElimination(entries)
	require.NoError(t, err)

	// 8 teams = 7 matches (4 + 2 + 1)
	assert.Len(t, matches, 7)

	round1 := filterByRound(matches, 1)
	round2 := filterByRound(matches, 2)
	round3 := filterByRound(matches, 3)

	assert.Len(t, round1, 4, "quarterfinals")
	assert.Len(t, round2, 2, "semifinals")
	assert.Len(t, round3, 1, "finals")

	// Round names
	assert.Equal(t, "Quarterfinals", round1[0].RoundName)
	assert.Equal(t, "Semifinals", round2[0].RoundName)
	assert.Equal(t, "Finals", round3[0].RoundName)
}

func TestGenerateSingleElimination_TooFewEntries(t *testing.T) {
	_, err := GenerateSingleElimination([]SeedEntry{{Seed: 1, TeamID: 1}})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "at least 2")
}

func TestGenerateDoubleElimination(t *testing.T) {
	entries := makeEntries(4)

	matches, err := GenerateDoubleElimination(entries)
	require.NoError(t, err)

	// Should have winners bracket + losers bracket + grand finals
	assert.Greater(t, len(matches), 3, "double elim should have more matches than single elim")

	// Last match should be grand finals
	last := matches[len(matches)-1]
	assert.Equal(t, "Grand Finals", last.RoundName)

	// Grand finals should have no next match
	assert.Equal(t, 0, last.NextMatchNumber)
}

func TestGenerateDoubleElimination_TooFewEntries(t *testing.T) {
	_, err := GenerateDoubleElimination([]SeedEntry{{Seed: 1, TeamID: 1}})
	assert.Error(t, err)
}

func TestGenerateRoundRobin_4Teams(t *testing.T) {
	entries := makeEntries(4)

	matches, err := GenerateRoundRobin(entries)
	require.NoError(t, err)

	// 4 teams = C(4,2) = 6 matches
	assert.Len(t, matches, 6)

	// Each team should appear in exactly 3 matches
	teamCounts := make(map[int]int)
	for _, m := range matches {
		teamCounts[m.Team1Seed]++
		teamCounts[m.Team2Seed]++
	}
	for seed := 1; seed <= 4; seed++ {
		assert.Equal(t, 3, teamCounts[seed], "seed %d should play 3 matches", seed)
	}

	// Should be 3 rounds
	maxRound := 0
	for _, m := range matches {
		if m.Round > maxRound {
			maxRound = m.Round
		}
	}
	assert.Equal(t, 3, maxRound)
}

func TestGenerateRoundRobin_OddTeams(t *testing.T) {
	entries := makeEntries(5)

	matches, err := GenerateRoundRobin(entries)
	require.NoError(t, err)

	// 5 teams = C(5,2) = 10 matches
	assert.Len(t, matches, 10)

	// Each team should appear in exactly 4 matches
	teamCounts := make(map[int]int)
	for _, m := range matches {
		teamCounts[m.Team1Seed]++
		teamCounts[m.Team2Seed]++
	}
	for seed := 1; seed <= 5; seed++ {
		assert.Equal(t, 4, teamCounts[seed], "seed %d should play 4 matches", seed)
	}
}

func TestGenerateRoundRobin_TooFewEntries(t *testing.T) {
	_, err := GenerateRoundRobin([]SeedEntry{{Seed: 1, TeamID: 1}})
	assert.Error(t, err)
}

func TestGenerateRoundRobin_2Teams(t *testing.T) {
	entries := makeEntries(2)

	matches, err := GenerateRoundRobin(entries)
	require.NoError(t, err)

	assert.Len(t, matches, 1)
	assert.Equal(t, 1, matches[0].Team1Seed)
	assert.Equal(t, 2, matches[0].Team2Seed)
}

// filterByRound returns matches for a specific round.
func filterByRound(matches []BracketMatch, round int) []BracketMatch {
	var result []BracketMatch
	for _, m := range matches {
		if m.Round == round {
			result = append(result, m)
		}
	}
	return result
}
