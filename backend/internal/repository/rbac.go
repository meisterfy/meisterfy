package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/repository/db"
)

type RBACRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewRBACRepository(pool *pgxpool.Pool) *RBACRepository {
	return &RBACRepository{pool: pool, queries: db.New(pool)}
}

func (r *RBACRepository) GetPermissionsForUser(ctx context.Context, userID, tenantID string) ([]string, error) {
	return r.queries.GetPermissionsForUser(ctx, db.GetPermissionsForUserParams{
		UserID:   userID,
		TenantID: tenantID,
	})
}

func (r *RBACRepository) GetTenantsForUser(ctx context.Context, userID string) ([]string, error) {
	return r.queries.GetTenantsForUser(ctx, userID)
}

func (r *RBACRepository) AssignRole(ctx context.Context, userID, tenantID, roleID string) error {
	return mapError(r.queries.AssignRoleToUser(ctx, db.AssignRoleToUserParams{
		UserID:   userID,
		TenantID: tenantID,
		RoleID:   roleID,
	}))
}

func (r *RBACRepository) RemoveRole(ctx context.Context, userID, tenantID, roleID string) error {
	return mapError(r.queries.RemoveRoleFromUser(ctx, db.RemoveRoleFromUserParams{
		UserID:   userID,
		TenantID: tenantID,
		RoleID:   roleID,
	}))
}

func (r *RBACRepository) ListRoles(ctx context.Context, tenantID string) ([]domain.Role, error) {
	rows, err := r.queries.ListRoles(ctx, &tenantID)
	if err != nil {
		return nil, mapError(err)
	}
	roles := make([]domain.Role, len(rows))
	for i, row := range rows {
		perms, _ := r.queries.GetPermissionsForRole(ctx, row.ID)
		roles[i] = mapRole(row, perms)
	}
	return roles, nil
}

func (r *RBACRepository) GetRoleByID(ctx context.Context, id string) (*domain.Role, error) {
	row, err := r.queries.GetRoleByID(ctx, id)
	if err != nil {
		return nil, mapError(err)
	}
	perms, _ := r.queries.GetPermissionsForRole(ctx, row.ID)
	role := mapRole(row, perms)
	return &role, nil
}

func (r *RBACRepository) CreateRole(ctx context.Context, role *domain.Role) error {
	return mapError(r.queries.CreateRole(ctx, db.CreateRoleParams{
		ID:       role.ID,
		Name:     role.Name,
		TenantID: role.TenantID,
	}))
}

func (r *RBACRepository) UpdateRole(ctx context.Context, id, name string) error {
	_, err := r.pool.Exec(ctx, `UPDATE roles SET name = $1 WHERE id = $2`, name, id)
	return mapError(err)
}

func (r *RBACRepository) DeleteRole(ctx context.Context, id string) error {
	return mapError(r.queries.DeleteRole(ctx, id))
}

func (r *RBACRepository) SetRolePermissions(ctx context.Context, roleID string, permNames []string) error {
	if err := r.queries.DeleteRolePermissions(ctx, roleID); err != nil {
		return mapError(err)
	}
	if len(permNames) == 0 {
		return nil
	}
	return mapError(r.queries.SetRolePermissions(ctx, db.SetRolePermissionsParams{
		RoleID:  roleID,
		Column2: permNames,
	}))
}

func (r *RBACRepository) ListPermissions(ctx context.Context) ([]domain.Permission, error) {
	rows, err := r.queries.ListPermissions(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	perms := make([]domain.Permission, len(rows))
	for i, row := range rows {
		perms[i] = domain.Permission{ID: row.ID, Name: row.Name}
	}
	return perms, nil
}

func (r *RBACRepository) GetRoleForUser(ctx context.Context, userID, tenantID string) (*domain.Role, error) {
	const q = `
		SELECT r.id, r.name, r.tenant_id
		FROM roles r
		JOIN user_tenant_roles utr ON utr.role_id = r.id
		WHERE utr.user_id = $1 AND utr.tenant_id = $2
		LIMIT 1
	`
	var role domain.Role
	var tid *string
	err := r.pool.QueryRow(ctx, q, userID, tenantID).Scan(&role.ID, &role.Name, &tid)
	if err != nil {
		if errors.Is(mapError(err), domain.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	role.TenantID = tid
	return &role, nil
}

func (r *RBACRepository) GetRolesForUsers(ctx context.Context, userIDs []string, tenantID string) (map[string]*domain.Role, error) {
	if len(userIDs) == 0 {
		return map[string]*domain.Role{}, nil
	}
	const q = `
		SELECT r.id, r.name, r.tenant_id, utr.user_id
		FROM roles r
		JOIN user_tenant_roles utr ON utr.role_id = r.id
		WHERE utr.user_id = ANY($1) AND utr.tenant_id = $2
	`
	rows, err := r.pool.Query(ctx, q, userIDs, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]*domain.Role, len(userIDs))
	for rows.Next() {
		var role domain.Role
		var tid *string
		var uid string
		if err := rows.Scan(&role.ID, &role.Name, &tid, &uid); err != nil {
			return nil, err
		}
		role.TenantID = tid
		out[uid] = &role
	}
	return out, rows.Err()
}

func (r *RBACRepository) RemoveAllRolesForUserInTenant(ctx context.Context, userID, tenantID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM user_tenant_roles WHERE user_id = $1 AND tenant_id = $2`,
		userID, tenantID,
	)
	return err
}

func mapRole(row db.Role, perms []string) domain.Role {
	return domain.Role{
		ID:          row.ID,
		Name:        row.Name,
		TenantID:    row.TenantID,
		Permissions: perms,
	}
}
