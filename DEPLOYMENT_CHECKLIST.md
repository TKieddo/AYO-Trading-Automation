# 🚀 Vercel Deployment Checklist

## Pre-Deployment Steps

### ✅ 1. Code Preparation
- [x] Vercel configuration file created (`vercel.json`)
- [x] Landing page created (`/landing`)
- [x] Environment variables template created
- [x] Next.js config updated for production

### ✅ 2. GitHub Setup
- [ ] Push code to GitHub repository
- [ ] Ensure `dashboard/` folder is in root
- [ ] Verify `.gitignore` excludes sensitive files

### ✅ 3. Vercel Account
- [ ] Create Vercel account: https://vercel.com/signup
- [ ] Connect GitHub account to Vercel

## Deployment Steps

### Step 1: Deploy to Vercel

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Click "Add New Project"**
3. **Import GitHub Repository**
4. **Configure Project**:
   ```
   Framework Preset: Next.js
   Root Directory: dashboard
   Build Command: npm run build (auto)
   Output Directory: .next (auto)
   Install Command: npm install (auto)
   ```

### Step 2: Set Environment Variables

In Vercel → Your Project → Settings → Environment Variables:

```env
NEXT_PUBLIC_BASE_URL=https://your-project.vercel.app
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

**Important**: 
- Replace `your-project` with your actual Vercel project name
- Replace `your-backend-url.com` with your Python backend URL (if deployed separately)

### Step 3: Deploy

1. Click **"Deploy"**
2. Wait for build (~2-3 minutes)
3. Your site will be live!

### Step 4: Get Your URL

After deployment, you'll get:
- **Production URL**: `https://your-project.vercel.app`
- **Preview URLs**: For each branch/PR

## Post-Deployment

### ✅ Update cTrader Registration

Use your Vercel URL:
- **Company Website**: `https://your-project.vercel.app`
- **Redirect URL**: `https://your-project.vercel.app/api/callback`

### ✅ Test Your Deployment

1. Visit: `https://your-project.vercel.app`
2. Visit: `https://your-project.vercel.app/landing` (landing page)
3. Visit: `https://your-project.vercel.app/dashboard` (main dashboard)

### ✅ Custom Domain (Optional)

1. Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS as instructed
4. SSL auto-configured

## File Structure

```
your-repo/
├── dashboard/              # Next.js app (deploys to Vercel)
│   ├── app/
│   ├── components/
│   ├── public/
│   ├── vercel.json        # ✅ Created
│   ├── .vercelignore      # ✅ Created
│   └── package.json
├── src/                   # Python backend (separate)
└── VERCEL_DEPLOYMENT.md   # ✅ Full guide
```

## Quick Deploy Command (Alternative)

If you have Vercel CLI installed:

```bash
cd dashboard
npm install -g vercel
vercel
```

Follow the prompts to deploy.

## Troubleshooting

### Build Fails
- Check Node.js version (Vercel uses 18+)
- Review build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`

### Environment Variables Not Working
- Restart deployment after adding variables
- Check variable names match code
- Use `NEXT_PUBLIC_` prefix for client-side vars only

### API Connection Issues
- Update `NEXT_PUBLIC_API_URL` to your backend URL
- Check CORS settings on backend
- Verify backend is accessible

## Next Steps After Deployment

1. ✅ Get your Vercel URL
2. ✅ Use it for cTrader registration
3. ✅ Set up backend deployment (separate)
4. ✅ Connect dashboard to backend
5. ✅ Test full integration

## Support

- Vercel Docs: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Vercel Support: support@vercel.com

---

**Ready to deploy?** Follow the steps above and you'll be live in minutes! 🚀
