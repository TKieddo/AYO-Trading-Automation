# Start Python Backtest API Server
# This bridges Next.js API calls to Python backtesting engine

Write-Host "🚀 Starting Python Backtest API Server..." -ForegroundColor Green
Write-Host ""

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found! Please install Python first." -ForegroundColor Red
    exit 1
}

# Check if required packages are installed
Write-Host "📦 Checking dependencies..." -ForegroundColor Yellow
python -c "import fastapi, uvicorn, pandas, pandas_ta" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Missing dependencies. Installing..." -ForegroundColor Yellow
    Write-Host "   Installing: fastapi, uvicorn, pandas, pandas-ta, requests..." -ForegroundColor Gray
    python -m pip install fastapi uvicorn pandas pandas-ta requests --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to install dependencies. Please run: pip install fastapi uvicorn pandas pandas-ta requests" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ All dependencies available" -ForegroundColor Green
}

Write-Host ""
Write-Host "🌐 Starting server on http://localhost:8000" -ForegroundColor Cyan
Write-Host "📊 Backtest API ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the server
python src/api/backtest_server.py

