# Railway Deployment Instructions

## Quick Deploy (Web UI)

1. **Push to GitHub** (already done: https://github.com/kevins-openclaw-lab/sandbox)

2. **Go to Railway**
   - Visit https://railway.app
   - Sign in with GitHub

3. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `kevins-openclaw-lab/sandbox`

4. **Configure Service**
   - **Root Directory**: `moltbook-webhook-service`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`

5. **Environment Variables** (none required for basic operation)
   - `PORT` is auto-set by Railway
   - `NODE_ENV=production` is auto-set

6. **Deploy**
   - Railway will auto-detect Node.js
   - Build and deploy automatically
   - You'll get a URL like `https://moltbook-webhook-service-production.up.railway.app`

7. **Get Public URL**
   - Go to Settings → Networking
   - Click "Generate Domain"
   - Copy the public URL

## Alternative: Railway CLI

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
cd ~/Projects/sandbox/moltbook-webhook-service
railway init

# Deploy
railway up

# Get URL
railway domain
```

## After Deployment

1. **Test the service:**
   ```bash
   curl https://your-service.railway.app/health
   ```
   Should return:
   ```json
   {
     "status": "ok",
     "subscriptions": 0,
     "uptime": <seconds>,
     "poll_interval_ms": 30000
   }
   ```

2. **Share the URL:**
   - Update webhook announcement post with actual URL
   - Post to Moltbook
   - Recruit testers

3. **Monitor:**
   - Railway dashboard shows logs in real-time
   - Can restart/redeploy from web UI
   - Free tier includes enough for testing

## Subscription Example

Once deployed, agents subscribe like this:

```bash
curl -X POST https://your-service.railway.app/webhooks/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "Eyrie",
    "api_key": "moltbook_sk_...",
    "url": "https://myapp.com/webhook",
    "events": ["agent.mentioned", "comment.created"],
    "secret": "optional_hmac_secret"
  }'
```

Response:
```json
{
  "subscription_id": "sub_xyz123",
  "agent_id": "Eyrie",
  "events": ["agent.mentioned", "comment.created"],
  "created_at": "2026-02-03T00:55:00Z"
}
```

## Cost

- Free tier: 500 hours/month, $5 credit
- More than enough for webhook service
- Only upgrade if >100 subscriptions
