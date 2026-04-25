package api

import (
	"encoding/json"
	"net/http"
)

// JSON writes a JSON-encoded body with the given status code.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Error writes a standard {"error": "message"} JSON response.
func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]string{"error": message})
}

func Unauthorized(w http.ResponseWriter)         { Error(w, http.StatusUnauthorized, "unauthorized") }
func Forbidden(w http.ResponseWriter)            { Error(w, http.StatusForbidden, "forbidden") }
func NotFound(w http.ResponseWriter)             { Error(w, http.StatusNotFound, "not found") }
func InternalError(w http.ResponseWriter)        { Error(w, http.StatusInternalServerError, "internal server error") }
func UnprocessableEntity(w http.ResponseWriter, msg string) {
	Error(w, http.StatusUnprocessableEntity, msg)
}
