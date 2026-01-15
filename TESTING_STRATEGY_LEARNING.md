# Testing Strategy Learning - Quick Guide

## 🎯 How to Test

### Step 1: Navigate to Trading Page
1. Go to your dashboard
2. Click **"Trading"** in the footer (or go to `/trading`)
3. Click the **"Learn from Video"** tab

### Step 2: Enter Video URL
1. You'll see a large input field labeled **"Video URL"**
2. Paste your YouTube or video URL (e.g., `https://www.youtube.com/watch?v=...`)
3. **What happens:**
   - A green confirmation message appears: "URL entered! Ready to extract strategy"
   - The button below changes from gray (disabled) to **GREEN** (enabled)

### Step 3: Click Extract Strategy
1. Look for the large **green button** that says **"Extract Strategy from Video"**
2. It's below the URL input field
3. Click it!

### Step 4: Wait for Processing
- Button shows "Processing Video..." with a spinner
- This may take a few seconds (currently returns a placeholder response)

### Step 5: View Results
- Success message appears in green box
- Strategy is saved to database
- Go to **"Strategy Library"** tab to see your strategy

---

## 🔍 Troubleshooting

### Button is Gray/Disabled?
- **Check**: Did you paste a URL in the input field?
- **Solution**: The button only enables when a URL is entered
- **Visual**: You should see a green confirmation message when URL is entered

### Button Not Visible?
- **Check**: Are you on the "Learn from Video" tab?
- **Solution**: Click the "Learn from Video" tab (middle tab)

### No Response After Clicking?
- **Check**: Browser console for errors (F12)
- **Check**: Is the dashboard API running?
- **Check**: Database connection (Supabase)

---

## 📍 Where to Find Everything

### Trading Page Location:
- **Footer Link**: "Trading" (first link in footer)
- **Direct URL**: `/trading`

### Tabs:
1. **Backtest Dashboard** - View backtest results
2. **Learn from Video** ← **YOU ARE HERE**
3. **Strategy Library** - View all strategies

### Button Location:
- **Below** the URL input field
- Large green button with sparkles icon
- Text: "Extract Strategy from Video"

---

## ✅ Visual Indicators

### When URL is Empty:
- Button: Gray, disabled
- Message: "⬆️ Enter a video URL above to enable this button"

### When URL is Entered:
- Green confirmation box appears
- Button: Green, enabled, clickable
- Button text: "Extract Strategy from Video"

### When Processing:
- Button: Shows spinner
- Button text: "Processing Video..."
- Button: Disabled during processing

### When Complete:
- Green success message
- Strategy details shown
- Link to Strategy Library

---

## 🎨 Button Appearance

**Enabled (Green):**
- Large, prominent green gradient button
- Sparkles icon on left
- Text: "Extract Strategy from Video"
- Hover effect: Slightly brighter

**Disabled (Gray):**
- Gray background
- Gray text
- Not clickable
- Shows helper text below

---

## 🚀 Quick Test

1. **Go to**: `/trading` page
2. **Click**: "Learn from Video" tab
3. **Paste**: Any YouTube URL (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
4. **See**: Green confirmation message appears
5. **See**: Button turns green and becomes clickable
6. **Click**: "Extract Strategy from Video" button
7. **Wait**: Processing message appears
8. **See**: Success message with strategy details

---

**The button should be very visible now - it's a large green button below the URL input!** 🟢

