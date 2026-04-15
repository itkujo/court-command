package bracket

// DetermineSlotInNextMatch returns which team slot (1 or 2) the winner of
// a match should fill in the next match. Convention: odd match numbers
// fill slot 1, even match numbers fill slot 2.
//
// This is used as a fallback when the bracket generator hasn't explicitly
// set NextMatchSlot — for example when manually wiring matches.
func DetermineSlotInNextMatch(matchNumber int) int {
	if matchNumber%2 == 1 {
		return 1 // odd -> team1 slot
	}
	return 2 // even -> team2 slot
}
