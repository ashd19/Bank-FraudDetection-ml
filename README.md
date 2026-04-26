# Bank Fraud Detection Dashboard

Full-stack fraud detection project built around the bank transaction notebooks and dataset in `ml/`.

## Stack

- `frontend/`: React + Vite + Tailwind with a minimal analyst dashboard UI
- `backend/`: Express API for model training, single-transaction scoring, CSV upload scoring, and run history
- `ml/`: Python training and inference pipeline built from the cleaned fraud dataset
- `MongoDB`: optional persistence through Mongoose; the backend falls back to in-memory mode if `MONGO_URI` is not set

## Features

- Train the fraud model from `ml/bank_transactions_cleaned.csv`
- Score a single manual transaction from the dashboard
- Upload a CSV of transactions and receive batch fraud predictions
- Show risk bands, flagged counts, recent suspicious transactions, and model metrics
- Save prediction runs in MongoDB when configured

## Project Structure

```text
.
├── backend
│   ├── package.json
│   └── src
├── frontend
│   ├── package.json
│   └── src
├── ml
│   ├── bank_transactions_cleaned.csv
│   ├── src
│   └── venv
└── README.md
```

## Setup

### 1. Python model environment

The repo already includes `ml/venv`. If you need to recreate it:

```bash
cd ml
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Optional MongoDB env:

```env
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=fraud_detection_dashboard
PORT=4000
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend env:

```env
VITE_API_URL=http://localhost:4000
```

## API Endpoints

- `GET /api/health`
- `GET /api/overview`
- `GET /api/runs`
- `POST /api/train`
- `POST /api/seed`
- `POST /api/predict`
- `POST /api/upload`
- `PATCH /api/runs/:id/status`

## ML Pipeline

The Python layer:

- engineers temporal and ratio-based fraud features
- trains a `RandomForestClassifier` on `IsFraud`
- saves the trained pipeline to `ml/models/fraud_pipeline.joblib`
- returns risk scores plus human-readable fraud reasons for each transaction

## Notes

- The notebooks remain under `ml/` as the original analysis artifacts.
- `backend/src/services/pythonService.js` bridges the Node API and Python model pipeline.
- If MongoDB is unavailable, the app still runs for demos using in-memory storage.
