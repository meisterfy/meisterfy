package connector

import "strconv"

// ConfigString reads a string value from a provider config map.
// Returns def if the key is absent, not a string, or empty.
func ConfigString(cfg map[string]any, key, def string) string {
	if cfg == nil {
		return def
	}
	v, ok := cfg[key]
	if !ok {
		return def
	}
	s, ok := v.(string)
	if !ok || s == "" {
		return def
	}
	return s
}

// ConfigFloat reads a float64 value from a provider config map.
// Accepts stored float64 or a string representation (e.g. "0.7" from select fields).
// Returns def if the key is absent, zero, or unparseable.
func ConfigFloat(cfg map[string]any, key string, def float64) float64 {
	if cfg == nil {
		return def
	}
	v, ok := cfg[key]
	if !ok {
		return def
	}
	switch val := v.(type) {
	case float64:
		if val == 0 {
			return def
		}
		return val
	case string:
		f, err := strconv.ParseFloat(val, 64)
		if err != nil || f == 0 {
			return def
		}
		return f
	}
	return def
}
