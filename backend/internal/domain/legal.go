package domain

import (
	"strings"
	"time"
)

type TermBlock struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type LegalTermVersion struct {
	ID             string
	Version        int
	FallbackLocale string
	Translations   map[string][]TermBlock
	EffectiveAt    time.Time
	CreatedBy      *string
	CreatedAt      time.Time
}

// ResolveBlocks returns blocks for the best matching locale.
// Priority: exact locale → base language (e.g. "pt" from "pt-BR") → FallbackLocale.
func (v *LegalTermVersion) ResolveBlocks(locale string) ([]TermBlock, string) {
	if b, ok := v.Translations[locale]; ok {
		return b, locale
	}
	if idx := strings.Index(locale, "-"); idx > 0 {
		base := locale[:idx]
		if b, ok := v.Translations[base]; ok {
			return b, base
		}
	}
	return v.Translations[v.FallbackLocale], v.FallbackLocale
}
