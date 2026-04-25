package api

import (
	"encoding/json"
	"net/http"
)

type HealthHandler struct {
	SetupRequired func() bool
}

func (h *HealthHandler) Handle(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":         "ok",
		"setup_required": h.SetupRequired(),
	})
}
