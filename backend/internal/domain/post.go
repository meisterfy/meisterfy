package domain

import "time"

type PostStatus string

const (
	PostStatusDraft              PostStatus = "draft"
	PostStatusApproved           PostStatus = "approved"
	PostStatusScheduled          PostStatus = "scheduled"
	PostStatusPublished          PostStatus = "published"
	PostStatusFailed             PostStatus = "failed"
	PostStatusPartiallyPublished PostStatus = "partially_published"
)

var ValidTransitions = map[PostStatus][]PostStatus{
	PostStatusDraft:              {PostStatusApproved},
	PostStatusApproved:           {PostStatusDraft, PostStatusScheduled, PostStatusPublished},
	PostStatusScheduled:          {PostStatusApproved, PostStatusPublished, PostStatusFailed, PostStatusPartiallyPublished},
	PostStatusPublished:          {},
	PostStatusFailed:             {PostStatusScheduled},
	PostStatusPartiallyPublished: {PostStatusScheduled},
}

func (s PostStatus) CanTransitionTo(next PostStatus) bool {
	for _, allowed := range ValidTransitions[s] {
		if allowed == next {
			return true
		}
	}
	return false
}

type PostWorkflow struct {
	Strategy *struct {
		Framework string `json:"framework"`
		Reasoning string `json:"reasoning"`
	} `json:"strategy,omitempty"`
	Clarity *struct {
		Changes string `json:"changes"`
	} `json:"clarity,omitempty"`
	Impact *struct {
		Changes string `json:"changes"`
	} `json:"impact,omitempty"`
}

type Post struct {
	ID                  string
	TenantID            string
	Status              PostStatus
	Title               *string
	Content             string
	Hashtags            []string
	MediaType           *string
	Workflow            *PostWorkflow
	MediaPath           *string
	Platforms           []string
	ScheduledDate       *string
	ScheduledTime       *string
	ConnectorResourceID *string
	PublishedAt         *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type PostPublishResult struct {
	ID           string
	PostID       string
	TenantID     string // populated by ListPendingSync (join with posts); empty in other queries
	Platform     string
	Provider     string
	ExternalID   *string
	Status       string
	ErrorMessage *string
	PublishedAt  *time.Time
	CreatedAt    time.Time
}

type PostInsight struct {
	ID              string
	PublishResultID string
	PostID          string
	Platform        string
	InsightWindow   string
	Metrics         map[string]any
	RawResponse     map[string]any
	SyncedAt        time.Time
}
