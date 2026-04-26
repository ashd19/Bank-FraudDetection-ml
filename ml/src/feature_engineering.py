from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd


FRAUD_INPUT_COLUMNS: list[str] = [
    "TransactionAmount",
    "TransactionType",
    "Location",
    "Channel",
    "CustomerAge",
    "CustomerOccupation",
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


def _safe_datetime(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce")


def _ensure_columns(frame: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    for column in columns:
        if column not in frame.columns:
            frame[column] = np.nan
    return frame


def engineer_features(dataframe: pd.DataFrame) -> pd.DataFrame:
    frame = dataframe.copy()
    frame = _ensure_columns(
        frame,
        [
            "TransactionDate",
            "PreviousTransactionDate",
            "TransactionAmount",
            "AccountBalance",
            "TransactionDuration",
            "LoginAttempts",
            "CustomerAge",
        ],
    )

    frame["TransactionDateParsed"] = _safe_datetime(frame["TransactionDate"])
    frame["PreviousTransactionDateParsed"] = _safe_datetime(frame["PreviousTransactionDate"])

    frame["TransactionAmount"] = pd.to_numeric(frame["TransactionAmount"], errors="coerce").fillna(0.0)
    frame["AccountBalance"] = pd.to_numeric(frame["AccountBalance"], errors="coerce").fillna(0.0)
    frame["TransactionDuration"] = pd.to_numeric(frame["TransactionDuration"], errors="coerce").fillna(0.0)
    frame["LoginAttempts"] = pd.to_numeric(frame["LoginAttempts"], errors="coerce").fillna(0).astype(int)
    customer_age = pd.to_numeric(frame["CustomerAge"], errors="coerce")
    frame["CustomerAge"] = customer_age.fillna(customer_age.median() if customer_age.notna().any() else 35)

    frame["TxHour"] = frame["TransactionDateParsed"].dt.hour.fillna(0).astype(int)
    frame["TxDayOfWeek"] = frame["TransactionDateParsed"].dt.dayofweek.fillna(0).astype(int)
    frame["TxMonth"] = frame["TransactionDateParsed"].dt.month.fillna(1).astype(int)
    frame["IsWeekend"] = frame["TxDayOfWeek"].isin([5, 6]).astype(int)
    frame["IsNightTime"] = frame["TxHour"].isin([0, 1, 2, 3, 4, 5]).astype(int)

    balance_denominator = frame["AccountBalance"].replace(0, np.nan)
    frame["AmountToBalanceRatio"] = (
        frame["TransactionAmount"] / balance_denominator
    ).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    frame["IsHighRatioTx"] = (frame["AmountToBalanceRatio"] > 0.5).astype(int)

    previous_gap = (
        frame["TransactionDateParsed"] - frame["PreviousTransactionDateParsed"]
    ).dt.total_seconds() / 86400
    frame["DaysSincePrevTx"] = previous_gap.abs().fillna(previous_gap.abs().median() if previous_gap.notna().any() else 0).astype(int)

    for column in ["TransactionType", "Location", "Channel", "CustomerOccupation"]:
        if column not in frame.columns:
            frame[column] = "Unknown"
        frame[column] = frame[column].fillna("Unknown").astype(str)

    return frame


def build_reason_flags(row: pd.Series) -> list[str]:
    reasons: list[str] = []

    if row.get("LoginAttempts", 0) >= 3:
        reasons.append("Repeated login attempts")
    if row.get("AmountToBalanceRatio", 0) > 0.5:
        reasons.append("Large amount relative to account balance")
    if row.get("TransactionDuration", 0) < 15:
        reasons.append("Unusually fast transaction duration")
    if row.get("IsNightTime", 0) == 1:
        reasons.append("Night-time transaction")
    if row.get("TransactionAmount", 0) > 2000:
        reasons.append("High transaction amount")

    return reasons
