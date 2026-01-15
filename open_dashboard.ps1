# Quick script to open the dashboard in your browser

Write-Host "Opening trading agent dashboard..." -ForegroundColor Cyan

# Check if server is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/diary" -UseBasicParsing -TimeoutSec 2
    Write-Host "✓ Server is running!" -ForegroundColor Green
    
    # Open in browser
    Start-Process "http://localhost:3000/diary"
    Write-Host ""
    Write-Host "Dashboard opened in browser!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Available endpoints:" -ForegroundColor Cyan
    Write-Host "  • Dashboard (trades): http://localhost:3000/diary" -ForegroundColor White
    Write-Host "  • Logs:              http://localhost:3000/logs" -ForegroundColor White
    Write-Host "  • Logs (download):    http://localhost:3000/logs?download=1" -ForegroundColor White
    Write-Host ""
    Write-Host "Current configuration:" -ForegroundColor Cyan
    Write-Host "  • Assets: BTC, ETH, SOL, BNB, DOGE" -ForegroundColor White
    Write-Host "  • Interval: 5 minutes" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "✗ Server is not running or not accessible" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure the agent is running first:" -ForegroundColor Yellow
    Write-Host "  .\start_agent.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Or manually run:" -ForegroundColor Yellow
    Write-Host '  poetry run python src/main.py --assets BTC ETH --interval 1h' -ForegroundColor White
}

