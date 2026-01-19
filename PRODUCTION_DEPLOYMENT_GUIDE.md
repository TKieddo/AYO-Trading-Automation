# 🚀 Production Deployment Guide

## Overview

Your platform has **two separate components** that need different hosting:

1. **Next.js Dashboard** → Deploys to **Vercel** (frontend)
2. **Python Trading Agent** → Needs separate hosting (backend)

---

## Part 1: Deploying Next.js Dashboard to Vercel

### Step 1: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ai-trading-platform.git
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com and sign up
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `dashboard`
   - Build/Output settings are auto-detected

### Step 3: Set Environment Variables in Vercel

In Vercel Dashboard → Your Project → Settings → Environment Variables:

#### Required Variables:
```env
# Base URL (will be your Vercel URL after first deploy)
NEXT_PUBLIC_BASE_URL=https://your-project.vercel.app

# Python Backend URL (update after deploying backend)
NEXT_PUBLIC_API_URL=https://your-backend-url.com

# Supabase (if using)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### Important Notes:
- ✅ **Vercel automatically provides these at build time** - no `.env` file needed
- ✅ Variables are encrypted and secure
- ✅ Use `NEXT_PUBLIC_` prefix only for client-side variables
- ✅ Server-side variables (like `SUPABASE_SERVICE_ROLE_KEY`) are never exposed to the browser

### Step 4: Deploy

Click "Deploy" and wait ~2-3 minutes. Your dashboard will be live!

---

## Part 2: Deploying Python Trading Agent

**Vercel cannot run Python applications.** You need a separate hosting service.

### Option A: Railway (Recommended - Easiest)

Railway is perfect for Python apps with persistent processes.

#### Setup:

1. **Sign up**: https://railway.app
2. **Create New Project** → "Deploy from GitHub repo"
3. **Select your repository**
4. **Configure**:
   - **Root Directory**: Leave empty (or set to project root)
   - **Build Command**: `pip install poetry && poetry install`
   - **Start Command**: `poetry run python src/main.py --assets ETH ZEC SOL BNB BTC --interval 1hr`

#### Environment Variables in Railway:

In Railway Dashboard → Your Service → Variables, add all your `.env` variables:

```env
# Exchange Configuration (choose one)
ASTER_USER_ADDRESS=your_address
ASTER_SIGNER_ADDRESS=your_signer
ASTER_PRIVATE_KEY=your_private_key

# OR Binance
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret

# LLM Configuration
DEEPSEEK_API_KEY=your_key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Trading Settings
MARGIN_PER_POSITION=100
LEVERAGE=10
TAKE_PROFIT_PERCENT=5.0
STOP_LOSS_PERCENT=3.0

# API Port (Railway provides PORT automatically)
API_PORT=3000

# Supabase (if using)
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
```

#### Important:
- ✅ Railway automatically provides a `PORT` environment variable
- ✅ Your app will be accessible at: `https://your-app.railway.app`
- ✅ Update `NEXT_PUBLIC_API_URL` in Vercel to point to this URL

---

### Option B: Render (Alternative)

1. **Sign up**: https://render.com
2. **New** → **Web Service**
3. **Connect GitHub repository**
4. **Configure**:
   - **Environment**: Python 3
   - **Build Command**: `pip install poetry && poetry install`
   - **Start Command**: `poetry run python src/main.py --assets ETH ZEC SOL BNB BTC --interval 1hr`
5. **Add Environment Variables** (same as Railway above)

---

### Option C: Fly.io (Advanced)

1. **Install Fly CLI**: `curl -L https://fly.io/install.sh | sh`
2. **Login**: `fly auth login`
3. **Create app**: `fly launch`
4. **Deploy**: `fly deploy`

Create `fly.toml`:
```toml
app = "your-app-name"
primary_region = "iad"

[build]

[env]
  PORT = "3000"

[[services]]
  internal_port = 3000
  protocol = "tcp"
```

---

### Option D: Keep Running on Your Server (VPS/Cloud)

If you have a VPS (DigitalOcean, AWS EC2, etc.):

#### Using systemd (Linux):

Create `/etc/systemd/system/trading-agent.service`:

```ini
[Unit]
Description=AI Trading Agent
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/ai-trading-agent-master
Environment="PATH=/home/your-username/.local/share/pypoetry/venv/bin"
ExecStart=/home/your-username/.local/share/pypoetry/venv/bin/python src/main.py --assets ETH ZEC SOL BNB BTC --interval 1hr
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable trading-agent
sudo systemctl start trading-agent
sudo systemctl status trading-agent
```

#### Using PM2 (Node.js process manager for Python):

```bash
npm install -g pm2
pm2 start "poetry run python src/main.py --assets ETH ZEC SOL BNB BTC --interval 1hr" --name trading-agent
pm2 save
pm2 startup  # Auto-start on reboot
```

---

## Part 3: Environment Variables Summary

### What Happens to `.env` File?

**Local Development:**
- ✅ Use `.env` file in project root
- ✅ Loaded automatically by `dotenv` in Python
- ✅ Never commit to Git (should be in `.gitignore`)

**Production (Vercel):**
- ❌ No `.env` file
- ✅ Set variables in Vercel Dashboard → Settings → Environment Variables
- ✅ Variables are encrypted and secure
- ✅ Available at build time and runtime

**Production (Python Backend - Railway/Render/etc.):**
- ❌ No `.env` file
- ✅ Set variables in hosting platform's dashboard
- ✅ Variables are encrypted and secure
- ✅ Available at runtime

---

## Part 4: Complete Deployment Checklist

### Dashboard (Vercel):
- [ ] Code pushed to GitHub
- [ ] Vercel project created
- [ ] Root directory set to `dashboard`
- [ ] Environment variables added:
  - [ ] `NEXT_PUBLIC_BASE_URL`
  - [ ] `NEXT_PUBLIC_API_URL` (update after backend deploy)
  - [ ] Supabase variables (if using)
- [ ] Deployed successfully
- [ ] Dashboard accessible at Vercel URL

### Python Agent (Railway/Render/etc.):
- [ ] Account created on hosting platform
- [ ] Project/service created
- [ ] GitHub repository connected
- [ ] Build command configured
- [ ] Start command configured with assets and interval
- [ ] All environment variables added:
  - [ ] Exchange credentials (Aster or Binance)
  - [ ] LLM API keys
  - [ ] Trading settings
  - [ ] Supabase credentials (if using)
- [ ] Deployed successfully
- [ ] Backend accessible at hosting URL

### Final Steps:
- [ ] Update `NEXT_PUBLIC_API_URL` in Vercel to point to backend URL
- [ ] Test dashboard → backend connection
- [ ] Verify agent is running and trading
- [ ] Set up monitoring/alerts (optional)

---

## Part 5: Running Agent with Different Configurations

### Changing Assets or Interval:

**Option 1: Update Start Command in Hosting Platform**
- Go to your hosting dashboard (Railway/Render/etc.)
- Edit the start command
- Change: `--assets ETH ZEC SOL BNB BTC --interval 1hr`
- Redeploy

**Option 2: Use Environment Variables (Recommended)**

Modify `src/main.py` to read from environment variables:

```python
# In src/main.py, modify the argument parser:
parser.add_argument('--assets', default=os.getenv('TRADING_ASSETS', 'BTC ETH').split())
parser.add_argument('--interval', default=os.getenv('TRADING_INTERVAL', '1hr'))
```

Then in hosting platform, add:
```env
TRADING_ASSETS=ETH ZEC SOL BNB BTC
TRADING_INTERVAL=1hr
```

This way you can change configuration without redeploying!

---

## Part 6: Monitoring & Maintenance

### Check if Agent is Running:

**Railway/Render:**
- Dashboard shows "Running" status
- View logs in real-time
- Set up alerts for crashes

**VPS/Server:**
```bash
# systemd
sudo systemctl status trading-agent

# PM2
pm2 status
pm2 logs trading-agent
```

### View Logs:

**Railway/Render:**
- Dashboard → Logs tab

**VPS:**
```bash
# systemd
sudo journalctl -u trading-agent -f

# PM2
pm2 logs trading-agent
```

### Restart Agent:

**Railway/Render:**
- Dashboard → Restart button

**VPS:**
```bash
# systemd
sudo systemctl restart trading-agent

# PM2
pm2 restart trading-agent
```

---

## Troubleshooting

### Agent Not Starting:
- ✅ Check environment variables are set correctly
- ✅ Verify API keys are valid
- ✅ Check logs for errors
- ✅ Ensure start command is correct

### Dashboard Can't Connect to Backend:
- ✅ Verify `NEXT_PUBLIC_API_URL` points to correct backend URL
- ✅ Check backend is running and accessible
- ✅ Verify CORS settings (if needed)
- ✅ Check firewall/network settings

### Environment Variables Not Working:
- ✅ Restart deployment after adding variables
- ✅ Verify variable names match code exactly
- ✅ Check for typos or extra spaces
- ✅ Ensure `NEXT_PUBLIC_` prefix for client-side vars

---

## Cost Estimates

### Vercel (Dashboard):
- ✅ **Free tier**: Unlimited deployments, 100GB bandwidth
- ✅ **Pro**: $20/month (if needed for more features)

### Railway (Python Agent):
- ✅ **Free tier**: $5 credit/month (usually enough for small apps)
- ✅ **Pro**: Pay-as-you-go (~$5-20/month depending on usage)

### Render:
- ✅ **Free tier**: Spins down after inactivity (not ideal for trading bot)
- ✅ **Starter**: $7/month (always-on)

### Fly.io:
- ✅ **Free tier**: 3 shared VMs
- ✅ **Pay-as-you-go**: ~$5-15/month

---

## Security Best Practices

1. ✅ **Never commit `.env` files** to Git
2. ✅ **Use environment variables** in hosting platforms
3. ✅ **Rotate API keys** regularly
4. ✅ **Use separate keys** for development and production
5. ✅ **Enable 2FA** on all hosting accounts
6. ✅ **Monitor logs** for suspicious activity
7. ✅ **Set up alerts** for errors or crashes

---

## Next Steps

1. ✅ Deploy dashboard to Vercel
2. ✅ Deploy Python agent to Railway/Render
3. ✅ Connect dashboard to backend
4. ✅ Test full integration
5. ✅ Set up monitoring
6. ✅ Start trading! 🚀

---

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **Render Docs**: https://render.com/docs
- **Fly.io Docs**: https://fly.io/docs
