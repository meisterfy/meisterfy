package repository

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mkt-maestro/mkt-maestro/internal/crypto"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/repository/db"
)

type IntegrationRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	key     []byte
}

func NewIntegrationRepository(pool *pgxpool.Pool, key []byte) *IntegrationRepository {
	return &IntegrationRepository{pool: pool, queries: db.New(pool), key: key}
}

func (r *IntegrationRepository) List(ctx context.Context) ([]*domain.Integration, error) {
	rows, err := r.queries.ListIntegrations(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	integrations := make([]*domain.Integration, len(rows))
	for i, row := range rows {
		ig := r.mapIntegration(row)
		tenantIDs, _ := r.queries.GetTenantsForIntegration(ctx, row.ID)
		ig.TenantIDs = tenantIDs
		integrations[i] = ig
	}
	return integrations, nil
}

func (r *IntegrationRepository) GetByID(ctx context.Context, id string) (*domain.Integration, error) {
	row, err := r.queries.GetIntegrationByID(ctx, id)
	if err != nil {
		return nil, mapError(err)
	}
	ig := r.mapIntegration(row)
	ig.TenantIDs, _ = r.queries.GetTenantsForIntegration(ctx, id)
	return ig, nil
}

func (r *IntegrationRepository) GetForTenant(ctx context.Context, tenantID, provider string) (*domain.Integration, error) {
	row, err := r.queries.GetIntegrationForTenant(ctx, db.GetIntegrationForTenantParams{
		TenantID: tenantID,
		Provider: provider,
	})
	if err != nil {
		return nil, mapError(err)
	}
	return r.mapIntegration(row), nil
}

func (r *IntegrationRepository) encryptSecret(s *string) (*string, error) {
	if len(r.key) == 0 {
		return s, nil
	}
	return crypto.EncryptPtr(r.key, s)
}

func (r *IntegrationRepository) decryptSecret(s *string) *string {
	if len(r.key) == 0 {
		return s
	}
	dec, err := crypto.DecryptPtr(r.key, s)
	if err != nil {
		return s // return raw if decryption fails (e.g. unencrypted legacy value)
	}
	return dec
}

func (r *IntegrationRepository) Create(ctx context.Context, ig *domain.Integration) error {
	secret, err := r.encryptSecret(ig.OAuthClientSecret)
	if err != nil {
		return err
	}
	devToken, err := r.encryptSecret(ig.DeveloperToken)
	if err != nil {
		return err
	}
	return mapError(r.queries.CreateIntegration(ctx, db.CreateIntegrationParams{
		ID:                ig.ID,
		Name:              ig.Name,
		Provider:          string(ig.Provider),
		Group:             string(ig.Group),
		OauthClientID:     ig.OAuthClientID,
		OauthClientSecret: secret,
		DeveloperToken:    devToken,
		LoginCustomerID:   ig.LoginCustomerID,
		Status:            string(ig.Status),
		Config:            r.encryptConfig(ig.Config),
	}))
}

func (r *IntegrationRepository) Update(ctx context.Context, ig *domain.Integration) error {
	secret, err := r.encryptSecret(ig.OAuthClientSecret)
	if err != nil {
		return err
	}
	devToken, err := r.encryptSecret(ig.DeveloperToken)
	if err != nil {
		return err
	}
	refreshToken, err := r.encryptSecret(ig.RefreshToken)
	if err != nil {
		return err
	}
	return mapError(r.queries.UpdateIntegration(ctx, db.UpdateIntegrationParams{
		ID:                ig.ID,
		Name:              ig.Name,
		OauthClientID:     ig.OAuthClientID,
		OauthClientSecret: secret,
		DeveloperToken:    devToken,
		LoginCustomerID:   ig.LoginCustomerID,
		RefreshToken:      refreshToken,
		Status:            string(ig.Status),
		ErrorMessage:      ig.ErrorMessage,
		Config:            r.encryptConfig(ig.Config),
	}))
}

func (r *IntegrationRepository) Delete(ctx context.Context, id string) error {
	return mapError(r.queries.DeleteIntegration(ctx, id))
}

func (r *IntegrationRepository) SetTenants(ctx context.Context, integrationID string, tenantIDs []string) error {
	if err := r.queries.DeleteIntegrationTenants(ctx, integrationID); err != nil {
		return mapError(err)
	}
	for _, tid := range tenantIDs {
		if err := r.queries.InsertIntegrationTenant(ctx, db.InsertIntegrationTenantParams{
			IntegrationID: integrationID,
			TenantID:      tid,
		}); err != nil {
			return mapError(err)
		}
	}
	return nil
}

func (r *IntegrationRepository) mapIntegration(row db.Integration) *domain.Integration {
	return &domain.Integration{
		ID:                row.ID,
		Name:              row.Name,
		Provider:          domain.IntegrationProvider(row.Provider),
		Group:             domain.IntegrationGroup(row.Group),
		OAuthClientID:     row.OauthClientID,
		OAuthClientSecret: r.decryptSecret(row.OauthClientSecret),
		DeveloperToken:    r.decryptSecret(row.DeveloperToken),
		LoginCustomerID:   row.LoginCustomerID,
		RefreshToken:      r.decryptSecret(row.RefreshToken),
		Status:            domain.IntegrationStatus(row.Status),
		ErrorMessage:      row.ErrorMessage,
		Config:            r.decryptConfig(row.Config),
		CreatedAt:         row.CreatedAt,
		UpdatedAt:         row.UpdatedAt,
	}
}

func (r *IntegrationRepository) encryptConfig(cfg map[string]any) json.RawMessage {
	if len(cfg) == 0 {
		cfg = map[string]any{}
	}
	plain, _ := json.Marshal(cfg)
	if len(r.key) == 0 {
		return plain
	}
	enc, err := crypto.Encrypt(r.key, string(plain))
	if err != nil {
		return plain
	}
	quoted, _ := json.Marshal(enc)
	return quoted
}

func (r *IntegrationRepository) decryptConfig(raw json.RawMessage) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	if len(r.key) > 0 && len(raw) > 2 && raw[0] == '"' {
		var ciphertext string
		if json.Unmarshal(raw, &ciphertext) == nil {
			if plain, err := crypto.Decrypt(r.key, ciphertext); err == nil {
				var out map[string]any
				if json.Unmarshal([]byte(plain), &out) == nil {
					return out
				}
			}
		}
	}
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	if out == nil {
		return map[string]any{}
	}
	return out
}
