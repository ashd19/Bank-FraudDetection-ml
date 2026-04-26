from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from feature_engineering import FRAUD_INPUT_COLUMNS, engineer_features


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "bank_transactions_cleaned.csv"
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "fraud_pipeline.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"


def train() -> dict:
    dataframe = pd.read_csv(DATA_PATH)
    dataframe = engineer_features(dataframe)

    target = dataframe["IsFraud"].astype(int)
    features = dataframe[FRAUD_INPUT_COLUMNS]

    numeric_features = [
        "TransactionAmount",
        "CustomerAge",
        "TransactionDuration",
        "LoginAttempts",
        "AccountBalance",
        "TxHour",
        "TxDayOfWeek",
        "TxMonth",
        "IsWeekend",
        "IsNightTime",
        "AmountToBalanceRatio",
        "IsHighRatioTx",
        "DaysSincePrevTx",
    ]
    categorical_features = ["TransactionType", "Location", "Channel", "CustomerOccupation"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), numeric_features),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_features,
            ),
        ]
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=300,
                    max_depth=12,
                    min_samples_leaf=2,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=42,
        stratify=target,
    )

    pipeline.fit(x_train, y_train)
    probabilities = pipeline.predict_proba(x_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "precision": round(float(precision_score(y_test, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, predictions, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, predictions, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 4),
        "train_size": int(len(x_train)),
        "test_size": int(len(x_test)),
        "feature_count": len(FRAUD_INPUT_COLUMNS),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2))

    return metrics


if __name__ == "__main__":
    result = train()
    print(json.dumps(result, indent=2))
