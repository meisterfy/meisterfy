---
name: publish-social-post
description: Publishes an approved social media post (image/video + caption) to Instagram via the Meta Graph API container flow.
---
# Publish Social Post

## Prerequisites

The root `.env` must contain:
- `META_PAGE_ACCESS_TOKEN` — a Page Access Token with `instagram_basic`, `instagram_content_publish` permissions.
- `META_PAGE_ID` — the Facebook Page ID linked to the Instagram account.
- `META_INSTAGRAM_ACCOUNT_ID` — the Instagram Business Account ID.
- `MEDIA_PUBLIC_BASE_URL` — a public URL where the UI's `/api/media` endpoint is accessible (e.g., from ngrok). Instagram requires a public URL to download the media file.

## Steps

When the user asks to publish a post:

1. Identify `client_id` and `post_filename`.
2. Verify the post status is `approved` in `clients/<client_id>/posts/<post_filename>.json`. Stop if not.
3. Verify a media file exists for the post (e.g., same name prefix with `.jpg`, `.png`, or `.mp4`). Ask user to attach one if missing.
4. Verify all required env vars above are set. Guide the user to set them if missing.
5. Run the publish script from the project root:
   ```bash
   bun scripts/publish-social-post.ts <client_id> <post_filename>
   ```
6. Report the output. On success, local status is automatically updated to `published`.
7. Note: Instagram requires the media to be a publicly accessible URL. If `MEDIA_PUBLIC_BASE_URL` is not configured, suggest running `ngrok http 5173` and setting the tunnel URL.
