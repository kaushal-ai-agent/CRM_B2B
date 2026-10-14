# Instagram Integration Guide

The SalesOS AI Agent integrates with the Instagram Graph API to automatically respond to DMs based on live inventory and FAQ data.

## Configuration & Credentials

Instagram Graph API credentials must be stored securely. Because the AI Agent operates as a decoupled microservice (FastAPI), these credentials are **not** stored in the Django backend. 

Instead, they must be added to the `.env` file within the `agent_service/` directory.

### 1. Where to Add Credentials

Create or edit the file at:
**`agent_service/.env`**

Add the following keys:

```env
# Enable or disable the Instagram channel listener
IG_ENABLED=true

# Your Facebook App ID
IG_APP_ID=your_app_id_here

# Your Facebook App Secret (used to verify webhook signatures)
IG_APP_SECRET=your_app_secret_here

# A Long-Lived Page Access Token for the Instagram Professional Account
IG_ACCESS_TOKEN=your_page_access_token_here

# The Instagram Professional Account ID
IG_ACCOUNT_ID=your_ig_account_id_here

# The custom string you define when setting up Webhooks in the Meta Developer Portal
IG_VERIFY_TOKEN=your_custom_verify_token_here
```

### 2. Testing via the UI

You can update basic configuration (App ID, Account ID, Verify Token) on the fly for testing using the **Agent Settings** page in the UI (`/admin/agent-settings`). However, for security reasons, the `IG_APP_SECRET` and `IG_ACCESS_TOKEN` cannot be modified via the frontend UI and **must** be set in the `.env` file.

Settings updated via the UI are stored in memory and will revert to the `.env` values when the `agent_service` container is restarted.

### 3. Docker Deployment

When deploying via `docker-compose`, ensure the environment variables are correctly mapped or your `.env` file is present in the `agent_service` context. The provided `docker-compose.yml` automatically passes these variables through to the `agent_service` container.

```yaml
  agent_service:
    environment:
      - IG_ENABLED=${IG_ENABLED:-false}
      - IG_VERIFY_TOKEN=${IG_VERIFY_TOKEN}
      - IG_ACCESS_TOKEN=${IG_ACCESS_TOKEN}
      - IG_APP_ID=${IG_APP_ID}
      - IG_APP_SECRET=${IG_APP_SECRET}
      - IG_ACCOUNT_ID=${IG_ACCOUNT_ID}
```

### 4. Webhook Setup (Meta Developer Portal)

When setting up your Meta App:
1. Go to Webhooks -> Edit Subscription.
2. Callback URL: `https://<your-domain>/api/v1/agent/webhooks/instagram` (Ensure it is exposed via HTTPS/ngrok for local testing).
3. Verify Token: Enter the value you set for `IG_VERIFY_TOKEN`.
4. Subscribe to the `messages` field for the Instagram object.
