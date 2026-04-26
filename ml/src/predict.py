from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import pandas as pd

from feature_engineering import FRAUD_INPUT_COLUMNS, build_reason_flags, engineer_features
from train_model import METRICS_PATH, MODEL_PATH, train


def _risk_band(score: float) -> str:
    if score >= 0.6:
        return "high"
    if score >= 0.3:
        return "medium"
    return "low"


def _load_pipeline():
    if not MODEL_PATH.exists():
        train()
    return joblib.load(MODEL_PATH)


def predict_records(records: list[dict]) -> dict:
    pipeline = _load_pipeline()
    dataframe = pd.DataFrame(records)
    engineered = engineer_features(dataframe)
    features = engineered[FRAUD_INPUT_COLUMNS]

    scores = pipeline.predict_proba(features)[:, 1]
    labels = (scores >= 0.5).astype(int)

    enriched_results = []
    for index, score in enumerate(scores):
        base_row = engineered.iloc[index]
        reasons = build_reason_flags(base_row)
        enriched_results.append(
            {
                "transactionId": str(dataframe.iloc[index].get("TransactionID", f"uploaded-{index + 1}")),
                "accountId": str(dataframe.iloc[index].get("AccountID", "Unknown")),
                "channel": str(base_row.get("Channel", "Unknown")),
                "location": str(base_row.get("Location", "Unknown")),
                "transactionAmount": float(base_row.get("TransactionAmount", 0.0)),
                "accountBalance": float(base_row.get("AccountBalance", 0.0)),
                "loginAttempts": int(base_row.get("LoginAttempts", 0)),
                "transactionDuration": float(base_row.get("TransactionDuration", 0.0)),
                "amountToBalanceRatio": round(float(base_row.get("AmountToBalanceRatio", 0.0)), 4),
                "riskScore": round(float(score), 4),
                "riskBand": _risk_band(float(score)),
                "predictedFraud": int(labels[index]),
                "reasons": reasons,
            }
        )

    summary = {
        "totalTransactions": len(enriched_results),
        "flaggedTransactions": sum(1 for row in enriched_results if row["predictedFraud"] == 1),
        "highRiskTransactions": sum(1 for row in enriched_results if row["riskBand"] == "high"),
        "averageRiskScore": round(sum(row["riskScore"] for row in enriched_results) / len(enriched_results), 4)
        if enriched_results
        else 0.0,
    }

    metrics = json.loads(METRICS_PATH.read_text()) if METRICS_PATH.exists() else {}
    return {"summary": summary, "results": enriched_results, "modelMetrics": metrics}


def main() -> None:
    payload = json.loads(sys.stdin.read())
    mode = payload.get("mode", "records")

    if mode == "csv":
        csv_path = Path(payload["csvPath"])
        frame = pd.read_csv(csv_path)
        result = predict_records(frame.to_dict(orient="records"))
    else:
        records = payload.get("records", [])
        result = predict_records(records)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
