//go:build integration

package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/testutil"
)

func TestPostRepository_CreateAndGet(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-post", "Post Tenant")

	post := testutil.NewTestPost("post-1", "tenant-post", "Hello world")
	post.Title = testutil.Ptr("My Title")
	post.MediaType = testutil.Ptr("image")
	post.Hashtags = []string{"#test"}
	post.Platforms = []string{"instagram"}

	if err := repo.Create(ctx, post); err != nil {
		t.Fatalf("create post: %v", err)
	}

	got, err := repo.GetByID(ctx, "post-1")
	if err != nil {
		t.Fatalf("get post: %v", err)
	}
	if got.Content != "Hello world" {
		t.Errorf("content = %q, want %q", got.Content, "Hello world")
	}
	if got.Title == nil || *got.Title != "My Title" {
		t.Errorf("title mismatch")
	}
	if len(got.Hashtags) != 1 || got.Hashtags[0] != "#test" {
		t.Errorf("hashtags = %v, want [#test]", got.Hashtags)
	}
}

func TestPostRepository_ListByStatus(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-post2", "Post Tenant 2")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "p1", "tenant-post2", "draft content", string(domain.PostStatusDraft))
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "p2", "tenant-post2", "approved content", string(domain.PostStatusApproved))

	list, err := repo.ListByStatus(ctx, "tenant-post2", string(domain.PostStatusDraft))
	if err != nil {
		t.Fatalf("list by status: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("len(list) = %d, want 1", len(list))
	}
}

func TestPostRepository_UpdateAndDelete(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-post3", "Post Tenant 3")
	post := testutil.NewTestPost("post-3", "tenant-post3", "original")
	if err := repo.Create(ctx, post); err != nil {
		t.Fatalf("create: %v", err)
	}

	post.Content = "updated"
	if err := repo.Update(ctx, post); err != nil {
		t.Fatalf("update: %v", err)
	}

	got, err := repo.GetByID(ctx, "post-3")
	if err != nil {
		t.Fatalf("get after update: %v", err)
	}
	if got.Content != "updated" {
		t.Errorf("content = %q, want %q", got.Content, "updated")
	}

	if err := repo.Delete(ctx, "post-3", "tenant-post3"); err != nil {
		t.Fatalf("delete: %v", err)
	}

	_, err = repo.GetByID(ctx, "post-3")
	if err == nil {
		t.Error("expected error after delete, got nil")
	}
}

func TestPostRepository_GetByID_NotFound(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostRepository(sharedDB.Pool)

	_, err := repo.GetByID(ctx, "post-nonexistent")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestPostRepository_Create_DuplicateID(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-post-dup", "Post Dup Tenant")
	post := testutil.NewTestPost("post-dup", "tenant-post-dup", "content")

	if err := repo.Create(ctx, post); err != nil {
		t.Fatalf("first create: %v", err)
	}
	if err := repo.Create(ctx, post); err == nil {
		t.Error("expected error on duplicate ID, got nil")
	}
}

func TestPostRepository_List(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-post-list", "Post List Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "pl-1", "tenant-post-list", "post one", "draft")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "pl-2", "tenant-post-list", "post two", "approved")

	list, err := repo.List(ctx, "tenant-post-list")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 2 {
		t.Errorf("len(list) = %d, want 2", len(list))
	}
}

func TestPostRepository_GetByIDAndTenant(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-post-gbt", "Post GBT Tenant")
	post := testutil.NewTestPost("post-gbt", "tenant-post-gbt", "tenant scoped")
	if err := repo.Create(ctx, post); err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := repo.GetByIDAndTenant(ctx, "post-gbt", "tenant-post-gbt")
	if err != nil {
		t.Fatalf("get by id and tenant: %v", err)
	}
	if got.Content != "tenant scoped" {
		t.Errorf("content = %q, want %q", got.Content, "tenant scoped")
	}

	_, err = repo.GetByIDAndTenant(ctx, "post-gbt", "wrong-tenant")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for wrong tenant, got %v", err)
	}
}

func TestPostRepository_UpdateStatus(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-post-us", "Post US Tenant")
	post := testutil.NewTestPost("post-us", "tenant-post-us", "status test")
	if err := repo.Create(ctx, post); err != nil {
		t.Fatalf("create: %v", err)
	}

	if err := repo.UpdateStatus(ctx, "post-us", "tenant-post-us", "published", nil); err != nil {
		t.Fatalf("update status: %v", err)
	}

	got, err := repo.GetByID(ctx, "post-us")
	if err != nil {
		t.Fatalf("get after status update: %v", err)
	}
	if string(got.Status) != "published" {
		t.Errorf("status = %q, want %q", got.Status, "published")
	}
}
