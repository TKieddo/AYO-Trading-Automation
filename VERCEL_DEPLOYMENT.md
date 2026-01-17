# Vercel Deployment Guide

## Quick Deploy to Vercel

### Prerequisites
1. Vercel account (free): https://vercel.com/signup
2. GitHub account (to connect repository)
3. Node.js installed locally (for testing)

### Step 1: Prepare Your Repository

1. **Push your code to GitHub** (if not already):
```bash
git init
git add .
git commit -m "Initial commit - AI Trading Platform"
git remote add origin https://github.com/yourusername/ai-trading-platform.git
git push -u origin main
```

### Step 2: Deploy Dashboard to Vercel

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Click "Add New Project"**
3. **Import your GitHub repository**
4. **Configure Project**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `dashboard`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

### Step 3: Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

#### Required Variables:
```env
# API Configuration
NEXT_PUBLIC_BASE_URL=https://your-project.vercel.app
NEXT_PUBLIC_API_URL=http://localhost:3000

# Supabase (if using)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# Exchange APIs (for client-side - be careful with secrets!)
# Note: API keys should be server-side only in production
```

#### Important Notes:
- **Never expose private keys** in client-side environment variables
- Use `NEXT_PUBLIC_` prefix only for public variables
- Private keys should be in server-side API routes only

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for build to complete (~2-3 minutes)
3. Your site will be live at: `https://your-project.vercel.app`

### Step 5: Update cTrader Registration

Use your Vercel URL:
- **Company Website**: `https://your-project.vercel.app`
- **Redirect URL**: `https://your-project.vercel.app/api/callback` (if using OAuth)

## Project Structure

```
ai-trading-agent-master/
├── dashboard/          # Next.js app (deploys to Vercel)
│   ├── app/
│   ├── components/
│   ├── public/
│   └── package.json
├── src/               # Python backend (separate deployment)
└── vercel.json        # Vercel configuration
```

## Deployment Options

### Option 1: Dashboard Only (Recommended for now)
- Deploy Next.js dashboard to Vercel
- Run Python backend separately (local/server)
- Dashboard connects to backend via API

### Option 2: Full Stack (Advanced)
- Deploy Next.js dashboard to Vercel
- Deploy Python backend to:
  - Railway (https://railway.app)
  - Render (https://render.com)
  - Fly.io (https://fly.io)
  - Or keep on your server

## Environment Variables Setup

### For Vercel (Dashboard):
```env
NEXT_PUBLIC_BASE_URL=https://your-project.vercel.app
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

### For Backend (Separate):
Keep your `.env` file with:
```env
ASTER_USER_ADDRESS=...
ASTER_SIGNER_ADDRESS=...
ASTER_PRIVATE_KEY=...
# Exchange credentials (choose one):
# For Aster:
ASTER_USER_ADDRESS=...
ASTER_SIGNER_ADDRESS=...
ASTER_PRIVATE_KEY=...

# For Binance:
BINANCE_API_KEY=...
BINANCE_API_SECRET=...
# etc.
```

## Custom Domain (Optional)

1. In Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records as instructed
4. SSL certificate auto-generated

## Continuous Deployment

- Every push to `main` branch = automatic deployment
- Preview deployments for pull requests
- Rollback to previous versions anytime

## Troubleshooting

### Build Fails
- Check Node.js version (Vercel uses Node 18+)
- Check for missing dependencies
- Review build logs in Vercel dashboard

### API Connection Issues
- Ensure backend is running and accessible
- Check CORS settings
- Verify environment variables

### Environment Variables Not Working
- Restart deployment after adding variables
- Check variable names match code
- Ensure `NEXT_PUBLIC_` prefix for client-side vars

## Next Steps

1. ✅ Deploy dashboard to Vercel
2. ✅ Get your Vercel URL
3. ✅ Use URL for cTrader registration
4. ✅ Set up backend deployment (separate)
5. ✅ Connect dashboard to backend

## Support

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Vercel Support: support@vercel.com
