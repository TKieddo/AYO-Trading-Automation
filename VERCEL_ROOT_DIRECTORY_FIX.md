# Fix Vercel Build Error: Python Package Detection

## Problem
Vercel is trying to build the Python package (`pyproject.toml`) at the root instead of building the Next.js dashboard. Error:
```
poetry.core.masonry.utils.module.ModuleOrPackageNotFoundError: No file/folder found for package trading-agent
```

## Root Cause
Vercel auto-detects `pyproject.toml` and tries to build it as a Python package, even though we only want to deploy the Next.js dashboard.

## Solutions (Try in Order)

### ✅ Solution 1: Set Root Directory in Vercel Dashboard (MOST IMPORTANT!)

**This is the primary fix - do this first!**

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project: **AYO-Trading-Automation**
3. Go to **Settings** → **General**
4. Scroll to **Root Directory**
5. Set it to: `dashboard`
6. Click **Save**
7. Redeploy

This tells Vercel to only look at the `dashboard` folder and completely ignore the root `pyproject.toml`.

### ✅ Solution 2: Files Already Created

I've created these files to help Vercel ignore Python:

- **`.vercelignore`** - Excludes Python files from deployment
- **`vercel.json`** - Configures build commands to use dashboard directory  
- **`package.json`** - Makes root appear as Node.js project (may help Vercel prioritize)

### Solution 3: Manual Override (If Above Doesn't Work)

If Vercel still tries to build Python, you can:

1. **Temporarily rename `pyproject.toml`**:
   ```bash
   git mv pyproject.toml pyproject.toml.backup
   git commit -m "Temporarily hide pyproject.toml for Vercel"
   git push
   ```
   
2. Deploy on Vercel
   
3. **Rename it back** (if needed for local development):
   ```bash
   git mv pyproject.toml.backup pyproject.toml
   git commit -m "Restore pyproject.toml"
   git push
   ```

## Files Created/Updated

- ✅ `.vercelignore` - Excludes Python files from deployment
- ✅ `vercel.json` - Configures build commands to use dashboard directory
- ✅ `package.json` - Root package.json to indicate Node.js project

## Next Steps

1. **CRITICAL: Set Root Directory in Vercel Dashboard**
   - Go to: https://vercel.com/dashboard → Your Project → Settings → General
   - Set **Root Directory** to: `dashboard`
   - Save

2. **Commit and push the new files**:
   ```bash
   git add .vercelignore vercel.json package.json VERCEL_ROOT_DIRECTORY_FIX.md
   git commit -m "Configure Vercel to build only dashboard, ignore Python"
   git push
   ```

3. **Redeploy on Vercel**
   - The build should now only process the Next.js dashboard
   - Python backend code will be ignored

## Verification

After setting the root directory and redeploying, you should see:
- ✅ Build starts with `npm install` (not Python/uv)
- ✅ Build completes with Next.js build
- ✅ No Python-related errors

If you still see Python build errors, the root directory setting didn't take effect - double-check it's set to `dashboard` in Vercel dashboard.
