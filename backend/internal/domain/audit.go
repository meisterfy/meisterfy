package domain

import "time"

type AuditEntry struct {
	ID         string
	TenantID   string
	UserID     string
	UserName   string
	Action     string
	EntityType string
	EntityID   string
	EntityName *string
	Before     any
	After      any
	IP         *string
	CreatedAt  *time.Time
}

type AuditLogFilter struct {
	TenantID   string
	UserID     *string
	EntityType *string
	EntityID   *string
	Limit      int
	Offset     int
}
