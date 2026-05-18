package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/repository/db"
)

type UserRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool, queries: db.New(pool)}
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	row, err := r.queries.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, mapError(err)
	}
	return mapUser(row), nil
}

func (r *UserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	row, err := r.queries.GetUserByID(ctx, id)
	if err != nil {
		return nil, mapError(err)
	}
	return mapUser(row), nil
}

func (r *UserRepository) List(ctx context.Context) ([]*domain.User, error) {
	rows, err := r.queries.ListUsers(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	users := make([]*domain.User, len(rows))
	for i, row := range rows {
		users[i] = mapUser(row)
	}
	return users, nil
}

func (r *UserRepository) Create(ctx context.Context, u *domain.User) error {
	return mapError(r.queries.CreateUser(ctx, db.CreateUserParams{
		ID:           u.ID,
		Name:         u.Name,
		Email:        u.Email,
		PasswordHash: u.PasswordHash,
		Locale:       u.Locale,
		Timezone:     u.Timezone,
		IsActive:     u.IsActive,
	}))
}

func (r *UserRepository) Update(ctx context.Context, u *domain.User) error {
	return mapError(r.queries.UpdateUser(ctx, db.UpdateUserParams{
		ID:       u.ID,
		Name:     u.Name,
		Email:    u.Email,
		Locale:   u.Locale,
		Timezone: u.Timezone,
		IsActive: u.IsActive,
	}))
}

func (r *UserRepository) UpdatePasswordHash(ctx context.Context, id, hash string) error {
	return mapError(r.queries.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{
		ID:           id,
		PasswordHash: hash,
	}))
}

func (r *UserRepository) Delete(ctx context.Context, id string) error {
	return mapError(r.queries.DeleteUser(ctx, id))
}

func (r *UserRepository) ListForTenant(ctx context.Context, tenantID string, active *bool) ([]*domain.User, error) {
	q := `
		SELECT u.id, u.name, u.email, u.password_hash, u.locale, u.timezone, u.is_active, u.system_role, u.created_at, u.updated_at
		FROM users u
		JOIN user_tenant_roles utr ON utr.user_id = u.id
		WHERE utr.tenant_id = $1
	`
	args := []any{tenantID}
	if active != nil {
		q += ` AND u.is_active = $2`
		args = append(args, *active)
	}
	q += ` ORDER BY u.created_at DESC`

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()
	var users []*domain.User
	for rows.Next() {
		var u db.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Locale, &u.Timezone, &u.IsActive, &u.SystemRole, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, mapUser(u))
	}
	return users, rows.Err()
}

func (r *UserRepository) Count(ctx context.Context) (int64, error) {
	return r.queries.CountUsers(ctx)
}

func (r *UserRepository) SetSystemRole(ctx context.Context, userID, role string) error {
	return mapError(r.queries.SetUserSystemRole(ctx, db.SetUserSystemRoleParams{
		ID:         userID,
		SystemRole: role,
	}))
}

func mapUser(row db.User) *domain.User {
	return &domain.User{
		ID:           row.ID,
		Name:         row.Name,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		Locale:       row.Locale,
		Timezone:     row.Timezone,
		IsActive:     row.IsActive,
		SystemRole:   row.SystemRole,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}
}
