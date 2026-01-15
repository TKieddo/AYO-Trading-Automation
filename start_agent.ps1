# AI Trading Agent Starter Script
# This script starts the trading agent and provides access to the dashboard

Write-Host "=== AI Trading Agent ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your API keys." -ForegroundColor Yellow
    exit 1
}

# Start the agent
Write-Host "Starting trading agent..." -ForegroundColor Green
Write-Host "The agent will run in this window." -ForegroundColor Yellow
Write-Host ""
Write-Host "Once started, you can access:" -ForegroundColor Cyan
Write-Host "  • Dashboard: http://localhost:3000/diary" -ForegroundColor White
Write-Host "  • Logs:      http://localhost:3000/logs" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the agent." -ForegroundColor Yellow
Write-Host ""
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host ""

# Run the agent
poetry run python src/main.py --assets BTC ETH SOL BNB DOGE --interval 5m

