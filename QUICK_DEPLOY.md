# 🚀 Quick Deploy to Vercel - Step by Step

## Option 1: Deploy via Vercel Dashboard (EASIEST - Recommended)

### Step 1: Push to GitHub First

1. **Create GitHub Repository**:
   - Go to https://github.com/new
   - Name it: `ai-trading-platform` (or any name)
   - Don't initialize with README
   - Click "Create repository"

2. **Push Your Code**:
   ```bash
   cd C:\Users\tsebi\Downloads\ai-trading-agent-master
   git init
   git add .
   git commit -m "Initial commit - AI Trading Platform"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ai-trading-platform.git
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` with your GitHub username

### Step 2: Deploy to Vercel

1. **Go to Vercel**: https://vercel.com/signup
   - Sign up with GitHub (easiest)

2. **Import Project**:
   - Click "Add New Project"
   - Select your GitHub repository
   - Click "Import"

3. **Configure Project**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: Click "Edit" → Type: `dashboard`
   - **Build Command**: `npm run build` (auto)
   - **Output Directory**: `.next` (auto)
   - **Install Command**: `npm install` (auto)

4. **Environment Variables** (Optional for now):
   - Click "Environment Variables"
   - Add: `NEXT_PUBLIC_BASE_URL` = `https://your-project.vercel.app`
   - (You'll get the actual URL after first deploy)

5. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes
   - Done! 🎉

### Step 3: Get Your URL

After deployment, you'll see:
- **Your URL**: `https://ai-trading-platform-xxxxx.vercel.app`
- Copy this URL!

### Step 4: Update cTrader Registration

Use your Vercel URL:
- **Company Website**: `https://ai-trading-platform-xxxxx.vercel.app`
- **Redirect URL**: `https://ai-trading-platform-xxxxx.vercel.app/api/callback`

---

## Option 2: Deploy via Vercel CLI (Alternative)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

```bash
cd dashboard
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? **Your account**
- Link to existing project? **No**
- Project name? **ai-trading-platform** (or any name)
- Directory? **./** (current directory)
- Override settings? **No**

### Step 4: Production Deploy

```bash
vercel --prod
```

---

## What Happens After Deployment

1. ✅ Your site is live at: `https://your-project.vercel.app`
2. ✅ Landing page: `https://your-project.vercel.app/landing`
3. ✅ Dashboard: `https://your-project.vercel.app/dashboard`
4. ✅ Every git push = automatic new deployment

## Troubleshooting

### "Build Failed"
- Check Vercel build logs
- Ensure `dashboard/package.json` exists
- Verify Node.js version (Vercel uses 18+)

### "Module Not Found"
- Check all dependencies in `package.json`
- Vercel installs automatically

### "Environment Variable Error"
- Add variables in Vercel Dashboard → Settings → Environment Variables
- Restart deployment after adding

---

## Quick Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel account created
- [ ] Project imported from GitHub
- [ ] Root directory set to `dashboard`
- [ ] Deployed successfully
- [ ] Got your Vercel URL
- [ ] Used URL for cTrader registration

**Ready? Start with Step 1 above!** 🚀
