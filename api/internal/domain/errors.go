package domain

import "errors"

var (
	ErrNotFound          = errors.New("not found")
	ErrUnauthorized      = errors.New("unauthorized")
	ErrForbidden         = errors.New("forbidden")
	ErrConflict          = errors.New("conflict")
	ErrInvalid           = errors.New("invalid input")
	ErrExpired           = errors.New("token expired")
	ErrInvalidCredentials = errors.New("invalid credentials")
)
