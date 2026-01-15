"""FastAPI server for backtesting API.
Run this to bridge Next.js API calls to Python backtesting."""

import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uvicorn
import asyncio
from src.api.backtest_api import run_backtest

app = FastAPI(title="Trading Backtest API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BacktestRequest(BaseModel):
    strategy_id: str
    strategy_json: Dict[str, Any]
    symbol: str
    timeframe: str
    start_date: str
    end_date: str
    initial_capital: float = 300.0


@app.post("/backtest/run")
async def execute_backtest(request: BacktestRequest):
    """Execute a backtest."""
    try:
        result = await run_backtest(
            strategy_id=request.strategy_id,
            strategy_json=request.strategy_json,
            symbol=request.symbol,
            timeframe=request.timeframe,
            start_date=request.start_date,
            end_date=request.end_date,
            initial_capital=request.initial_capital
        )
        
        if result["success"]:
            return result["result"]
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Backtest failed"))
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    """Health check."""
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

