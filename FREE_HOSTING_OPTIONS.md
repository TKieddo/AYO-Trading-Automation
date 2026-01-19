# 🆓 Free Hosting Options for Trading Agent (Testing Phase)

## Understanding Platform Pricing

### Key Concepts:

1. **Long-Running Services** (Your Trading Agent):
   - Runs 24/7 continuously
   - Consumes CPU/RAM resources constantly
   - Most platforms charge for this by the hour

2. **API Requests** (Frontend → Backend):
   - Each page load makes requests
   - These are usually free or very cheap
   - Not the main cost concern

3. **Your Trading Agent**:
   - Runs continuously (not request-based)
   - Makes API calls to exchanges every interval (e.g., every 1hr)
   - Needs to stay "awake" 24/7

---

## ❌ Platforms That WON'T Work for Free

### Railway (Free Tier):
- ✅ $5 credit/month
- ❌ **Charges ~$5-10/month for a continuously running service**
- ❌ Your $5 credit will be used up in ~2 weeks
- ⚠️ **Not free for 24/7 services**

### Render (Free Tier):
- ✅ Free for web services
- ❌ **Spins down after 15 minutes of inactivity**
- ❌ Your trading bot will stop trading when inactive
- ❌ **Not suitable for trading bots**

### Fly.io (Free Tier):
- ✅ 3 shared VMs free
- ⚠️ Limited resources, may throttle
- ⚠️ Can work but might be unreliable

---

## ✅ Best FREE Options for Testing

### Option 1: Oracle Cloud Always Free (RECOMMENDED - Best for Testing)

**What you get:**
- ✅ **2 Always-Free VMs** (ARM-based)
- ✅ **200GB storage**
- ✅ **10TB data transfer/month**
- ✅ **Runs 24/7 forever - truly free**
- ✅ Perfect for testing trading bots

**Setup:**
1. Sign up: https://www.oracle.com/cloud/free/
2. Create an "Always Free" VM instance
3. Choose ARM-based instance (Ampere A1)
4. Install Python, Poetry, and your code
5. Run agent as a systemd service

**Limitations:**
- ARM architecture (may need to compile some packages)
- Limited to 2 VMs
- But **completely free forever** for testing

**Cost:** $0/month (truly free)

---

### Option 2: Keep Running Locally (Easiest for Testing)

**What you need:**
- Your computer running 24/7
- Or a spare laptop/old computer

**Setup:**
- Just run: `poetry run python src/main.py --assets ETH ZEC SOL BNB BTC --interval 1hr`
- Keep terminal open
- Or use PM2/systemd to run in background

**Pros:**
- ✅ Completely free
- ✅ Full control
- ✅ No limits

**Cons:**
- ❌ Computer must stay on
- ❌ Not accessible if computer is off

**Cost:** $0/month (just electricity)

---

### Option 3: AWS Free Tier (12 Months)

**What you get:**
- ✅ **750 hours/month of t2.micro instance** (enough for 1 VM 24/7)
- ✅ **Free for 12 months**
- ✅ Good for testing

**Setup:**
1. Sign up: https://aws.amazon.com/free/
2. Launch EC2 t2.micro instance
3. Install Python, Poetry
4. Run agent

**Limitations:**
- ⚠️ Only free for 12 months
- ⚠️ After that, ~$8-10/month
- ⚠️ Need credit card (but won't charge if you stay in free tier)

**Cost:** $0/month (first 12 months), then ~$8-10/month

---

### Option 4: Google Cloud Free Tier (90 Days)

**What you get:**
- ✅ **$300 credit for 90 days**
- ✅ Enough to run a small VM for testing

**Limitations:**
- ⚠️ Only 90 days free
- ⚠️ Need credit card

**Cost:** $0/month (first 90 days), then pay-as-you-go

---

## 🎯 Recommended Setup for Testing

### For True Free Testing (No Credit Card):

**Use Oracle Cloud Always Free:**
1. Sign up for Oracle Cloud (free tier)
2. Create ARM-based VM
3. Deploy your Python agent
4. Run 24/7 for free forever

### For Quick Testing (Local):

**Keep running on your computer:**
- Just run the agent locally
- Dashboard on Vercel (free)
- Agent on your computer
- Update `NEXT_PUBLIC_API_URL` to point to your computer's IP (or use ngrok for tunneling)

---

## 📊 Cost Comparison

| Platform | Free Tier | 24/7 Service | Best For |
|----------|-----------|--------------|----------|
| **Oracle Cloud** | ✅ Always Free | ✅ Yes | **Testing (Recommended)** |
| **Local Computer** | ✅ Free | ✅ Yes | Quick testing |
| **AWS Free Tier** | ✅ 12 months | ✅ Yes | Testing (limited time) |
| **Railway** | ⚠️ $5 credit | ✅ Yes | Paid usage |
| **Render** | ❌ Spins down | ❌ No | Not for bots |
| **Fly.io** | ⚠️ Limited | ⚠️ Maybe | Might work |

---

## 🚀 Quick Setup: Oracle Cloud (Free Forever)

### Step 1: Sign Up
1. Go to https://www.oracle.com/cloud/free/
2. Create account (need credit card for verification, but won't charge if you use Always Free)
3. Verify account

### Step 2: Create VM
1. Go to "Compute" → "Instances"
2. Click "Create Instance"
3. **Important:** Select "Always Free" shape
4. Choose "Ampere A1" (ARM-based)
5. Select Ubuntu 22.04
6. Create instance

### Step 3: Connect and Setup
```bash
# SSH into your VM (Oracle provides connection command)
ssh opc@your-vm-ip

# Install Python and Poetry
sudo apt update
sudo apt install python3.12 python3-pip -y
curl -sSL https://install.python-poetry.org | python3 -

# Clone your repository
git clone https://github.com/YOUR_USERNAME/ai-trading-platform.git
cd ai-trading-platform

# Install dependencies
poetry install

# Create .env file with your API keys
nano .env
# Paste your environment variables

# Run agent as systemd service (runs in background, auto-restarts)
sudo nano /etc/systemd/system/trading-agent.service
```

### Step 4: Create systemd Service
```ini
[Unit]
Description=AI Trading Agent
After=network.target

[Service]
Type=simple
User=opc
WorkingDirectory=/home/opc/ai-trading-platform
Environment="PATH=/home/opc/.local/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/home/opc/.local/bin/poetry run python src/main.py --assets ETH ZEC SOL BNB BTC --interval 1hr
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Step 5: Start Service
```bash
sudo systemctl enable trading-agent
sudo systemctl start trading-agent
sudo systemctl status trading-agent
```

### Step 6: View Logs
```bash
sudo journalctl -u trading-agent -f
```

---

## 🔧 Alternative: Local Setup with ngrok (Free)

If you want to test with Vercel dashboard but run agent locally:

### Step 1: Run Agent Locally
```bash
poetry run python src/main.py --assets ETH ZEC SOL BNB BTC --interval 1hr
```

### Step 2: Expose with ngrok (Free)
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000
```

### Step 3: Update Vercel Environment Variable
- Get ngrok URL (e.g., `https://abc123.ngrok.io`)
- Update `NEXT_PUBLIC_API_URL` in Vercel to: `https://abc123.ngrok.io`

**Note:** Free ngrok URLs change on restart, but good for testing.

---

## 💡 Understanding "Requests" vs "Services"

### Your Trading Agent (Service):
- **Type:** Long-running process
- **Runs:** 24/7 continuously
- **Cost:** Based on CPU/RAM usage per hour
- **Platforms charge:** By compute time (hours × resources)

### API Requests (Frontend → Backend):
- **Type:** HTTP requests
- **Frequency:** When user visits dashboard
- **Cost:** Usually free or very cheap
- **Platforms charge:** Per request (usually free tier includes millions)

### Your Situation:
- ✅ **Dashboard on Vercel:** Free (request-based, Vercel free tier is generous)
- ⚠️ **Agent on Railway:** Costs money (service-based, $5-10/month)
- ✅ **Agent on Oracle Cloud:** Free (always-free tier)
- ✅ **Agent locally:** Free (your computer)

---

## 🎯 Final Recommendation

**For Testing (Free):**
1. **Dashboard:** Deploy to Vercel (free)
2. **Agent:** Run on Oracle Cloud Always Free VM (free forever)
   - OR run locally on your computer (free)

**For Production (Later):**
- Once you're ready to pay, Railway/Render are good options
- Or continue with Oracle Cloud (still very cheap ~$5-10/month for better resources)

---

## ⚠️ Important Notes

1. **Railway/Render free tiers are NOT suitable** for 24/7 trading bots
2. **Oracle Cloud Always Free** is the best truly free option
3. **Running locally** is free but requires your computer to stay on
4. **Vercel dashboard** is free (request-based, not service-based)

---

## 📝 Summary

- ✅ **Vercel (Dashboard):** Free - request-based, generous free tier
- ❌ **Railway (Agent):** Not free - charges for 24/7 services
- ❌ **Render (Agent):** Not suitable - spins down after inactivity
- ✅ **Oracle Cloud (Agent):** Free - always-free tier, perfect for testing
- ✅ **Local (Agent):** Free - just keep your computer on

**Best combo for free testing:**
- Dashboard: Vercel (free)
- Agent: Oracle Cloud Always Free VM (free) OR your local computer (free)
