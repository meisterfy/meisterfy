package googleads

import (
	"fmt"
	"regexp"
)

var (
	reNumeric = regexp.MustCompile(`^\d+$`)
	reDate    = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
)

func validateCampaignID(id string) error {
	if !reNumeric.MatchString(id) {
		return fmt.Errorf("invalid campaign id: %q", id)
	}
	return nil
}

func validateDate(d string) error {
	if !reDate.MatchString(d) {
		return fmt.Errorf("invalid date: %q", d)
	}
	return nil
}
