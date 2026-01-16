# Pepperstone cTrader API Credentials Guide

## 🔑 Where to Get Your Credentials

**Answer: You get them from cTrader, but through your Pepperstone account.**

### Why the Confusion?

Pepperstone uses **cTrader** as their trading platform. When you trade with Pepperstone, you're actually using cTrader's platform. Therefore:
- The **API credentials** come from **cTrader Open API**
- But you **access them** through your **Pepperstone account**
- They are **cTrader API credentials**, not Pepperstone-specific credentials

---

## 📋 Step-by-Step: How to Get Your Credentials

### Step 1: Open a Pepperstone Account

1. Go to [Pepperstone.com](https://www.pepperstone.com)
2. Open a **demo account** first (recommended for testing)
3. Or open a **live account** if you're ready

### Step 2: Access cTrader Open API

1. **Log into your Pepperstone account**
2. Navigate to **cTrader** platform
3. Look for **"API"** or **"Open API"** section in your account settings
4. Or go directly to: [cTrader Open API Portal](https://openapi.ctrader.com)

### Step 3: Create API Application

1. In the cTrader Open API portal, click **"Create Application"** or **"Register Application"**
2. Fill in the application details:
   - **Application Name**: e.g., "Trading Bot"
   - **Redirect URI**: (can be `http://localhost` for testing)
   - **Scopes**: Select **"trading"** scope (required for placing orders)

### Step 4: Get Your Credentials

After creating the application, you'll receive:

1. **Client ID** → This is your `PEPPERSTONE_CLIENT_ID`
2. **Client Secret** → This is your `PEPPERSTONE_CLIENT_SECRET`
3. **Account ID** → This is your `PEPPERSTONE_ACCOUNT_ID` (found in your cTrader account)

---

## 🔧 Setting Up Your .env File

Once you have the credentials, add them to your `.env` file:

```env
# Pepperstone cTrader API Credentials
# Get these from: cTrader Open API Portal (accessed through Pepperstone account)
PEPPERSTONE_CLIENT_ID=your_client_id_from_ctrader
PEPPERSTONE_CLIENT_SECRET=your_client_secret_from_ctrader
PEPPERSTONE_ACCOUNT_ID=your_account_id_from_pepperstone
PEPPERSTONE_ENVIRONMENT=demo  # Use "demo" for testing, "live" for real trading
```

---

## 📍 Where Each Credential Comes From

| Credential | Where to Find It |
|------------|------------------|
| **PEPPERSTONE_CLIENT_ID** | cTrader Open API Portal → Your Application → Client ID |
| **PEPPERSTONE_CLIENT_SECRET** | cTrader Open API Portal → Your Application → Client Secret |
| **PEPPERSTONE_ACCOUNT_ID** | Pepperstone/cTrader Account Dashboard → Account Number |
| **PEPPERSTONE_ENVIRONMENT** | Set to `demo` or `live` based on your account type |

---

## 🎯 Quick Answer

**Q: Do I get Client ID and Secret from cTrader or Pepperstone?**

**A: From cTrader, but you access cTrader through your Pepperstone account.**

- **cTrader** provides the API (it's cTrader Open API)
- **Pepperstone** is your broker (they use cTrader platform)
- You log into **Pepperstone** → Access **cTrader** → Get **cTrader API credentials**

Think of it like this:
- **Pepperstone** = Your broker (like a bank)
- **cTrader** = The trading platform (like an app)
- **cTrader Open API** = The API to control the platform programmatically

---

## ✅ Verification Steps

1. **Check your credentials work:**
   ```python
   # Test script
   from src.trading.pepperstone_api import PepperstoneAPI
   import asyncio
   
   async def test():
       api = PepperstoneAPI()
       state = await api.get_user_state()
       print(f"Balance: ${state['balance']}")
   
   asyncio.run(test())
   ```

2. **If you get authentication errors:**
   - Double-check Client ID and Secret are correct
   - Make sure you selected "trading" scope when creating the application
   - Verify Account ID matches your Pepperstone account number
   - Check that `PEPPERSTONE_ENVIRONMENT` matches your account type (demo/live)

---

## 🔗 Useful Links

- **Pepperstone Website**: https://www.pepperstone.com
- **cTrader Open API Documentation**: https://openapi.ctrader.com
- **cTrader Open API Portal**: https://openapi.ctrader.com (login with Pepperstone credentials)

---

## 💡 Pro Tips

1. **Start with Demo**: Always test with `PEPPERSTONE_ENVIRONMENT=demo` first
2. **Keep Secrets Safe**: Never commit your `.env` file to git
3. **Test Connection**: Run a simple balance check before trading
4. **Check Scopes**: Make sure your API application has "trading" scope enabled

---

## ❓ Still Confused?

If you're still not sure where to find these:

1. **Contact Pepperstone Support** and ask: "How do I get cTrader Open API credentials?"
2. **Check Pepperstone Help Center** for "API" or "cTrader API" documentation
3. **Look in your Pepperstone account dashboard** for "API" or "Developer" section

The key is: **cTrader API credentials, accessed through your Pepperstone account**.
