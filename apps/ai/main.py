from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Flexi AI Layer", version="1.0.0")


class PortfolioPayload(BaseModel):
    equity_pct: float = Field(default=0)
    small_cap_pct: float = Field(default=0)
    crypto_pct: float = Field(default=0)
    concentration_ratio: float = Field(default=0)
    volatility_score: float = Field(default=0)


class ChatPayload(BaseModel):
    question: str
    context: dict[str, Any] | None = None


class ModerationPayload(BaseModel):
    content: str


def score_portfolio(p: PortfolioPayload) -> float:
    return (
        (p.equity_pct * 0.25)
        + (p.small_cap_pct * 0.20)
        + (p.crypto_pct * 0.20)
        + (p.concentration_ratio * 0.15)
        + (p.volatility_score * 0.20)
    )


@app.get("/health")
def health():
    return {"status": True, "service": "flexi-ai"}


@app.post("/agents/portfolio/risk-score")
def portfolio_risk(payload: PortfolioPayload):
    score = round(score_portfolio(payload), 2)
    level = "low" if score <= 3 else "moderate" if score <= 6 else "high"
    return {
        "status": True,
        "risk_score": score,
        "risk_level": level,
        "rebalance_hint": "Rebalance if allocation deviates >10% from target model.",
    }


@app.post("/agents/expense/analyze")
def expense_analyze(payload: dict[str, Any]):
    return {
        "status": True,
        "insights": [
            "Dining expenses increased compared to previous period.",
            "Recurring subscriptions detected.",
            "Consider increasing SIP from monthly surplus.",
        ],
        "input": payload,
    }


@app.post("/agents/sentiment/classify")
def sentiment_classify(payload: dict[str, Any]):
    text = str(payload.get("text", "")).lower()
    sentiment = "neutral"
    if "bullish" in text:
        sentiment = "bullish"
    elif "bearish" in text:
        sentiment = "bearish"
    return {"status": True, "sentiment": sentiment, "confidence_score": 0.78}


@app.post("/agents/compliance/moderate")
def compliance_moderate(payload: ModerationPayload):
    blocked = ["guaranteed returns", "100% safe", "no risk", "buy now before it explodes"]
    text = payload.content.lower()
    hit = next((w for w in blocked if w in text), None)
    return {
        "status": True,
        "decision": "flagged" if hit else "approved",
        "risk_level": "high" if hit else "low",
        "reason": f"Detected prohibited phrase: {hit}" if hit else "No prohibited pattern detected",
    }


@app.post("/agents/chat/ask")
def chat(payload: ChatPayload):
    # Guardrail response: informational only, no direct buy/sell instruction.
    return {
        "status": True,
        "answer": "This is informational guidance. Review your diversification and risk profile before investing decisions.",
        "confidence_score": 0.9,
        "context_used": payload.context or {},
    }
