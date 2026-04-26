import "dotenv/config";

import cors from "cors";
import csvParser from "csv-parser";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { fileURLToPath } from "node:url";

import { connectDatabase } from "./db.js";
import { listRuns, saveRun, updateRunStatus } from "./store.js";
import { scoreCsv, scoreRecords, trainModel } from "./services/pythonService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const uploadsDir = path.join(backendRoot, "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

function buildOverview(runs) {
  const latestRun = runs[0];
  const predictions = runs.flatMap((run) => run.predictions || []);
  const flagged = predictions.filter((prediction) => prediction.predictedFraud === 1);
  const highRisk = predictions.filter((prediction) => prediction.riskBand === "high");
  const averageRiskScore = predictions.length
    ? Number(
        (
          predictions.reduce((sum, prediction) => sum + Number(prediction.riskScore || 0), 0) /
          predictions.length
        ).toFixed(4)
      )
    : 0;

  const channelMap = predictions.reduce((accumulator, prediction) => {
    const key = prediction.channel || "Unknown";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return {
    totalRuns: runs.length,
    totalTransactions: predictions.length,
    flaggedTransactions: flagged.length,
    highRiskTransactions: highRisk.length,
    averageRiskScore,
    modelMetrics: latestRun?.modelMetrics || {},
    channelDistribution: Object.entries(channelMap).map(([name, value]) => ({ name, value })),
    recentFlags: flagged.slice(0, 8),
    latestRun,
  };
}

app.get("/api/health", async (_request, response) => {
  const runs = await listRuns(1);
  response.json({
    status: "ok",
    hasRuns: runs.length > 0,
  });
});

app.get("/api/overview", async (_request, response) => {
  const runs = await listRuns(10);
  response.json(buildOverview(runs));
});

app.get("/api/runs", async (_request, response) => {
  const runs = await listRuns(10);
  response.json(runs);
});

app.post("/api/train", async (_request, response) => {
  try {
    const metrics = await trainModel();
    response.json({ metrics });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.post("/api/predict", async (request, response) => {
  try {
    const records = Array.isArray(request.body.records) ? request.body.records : [request.body];
    const result = await scoreRecords(records);
    const savedRun = await saveRun({
      source: "manual",
      summary: result.summary,
      modelMetrics: result.modelMetrics,
      predictions: result.results,
    });

    response.json({
      ...result,
      runId: savedRun.id,
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.post("/api/upload", upload.single("file"), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: "CSV file is required." });
    return;
  }

  try {
    const result = await scoreCsv(request.file.path);
    const savedRun = await saveRun({
      source: "upload",
      fileName: request.file.originalname,
      summary: result.summary,
      modelMetrics: result.modelMetrics,
      predictions: result.results,
    });

    response.json({
      ...result,
      runId: savedRun.id,
      fileName: request.file.originalname,
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.patch("/api/runs/:id/status", async (request, response) => {
  const { analystStatus } = request.body;

  if (!["new", "reviewed", "escalated"].includes(analystStatus)) {
    response.status(400).json({ error: "Invalid analyst status." });
    return;
  }

  const updatedRun = await updateRunStatus(request.params.id, analystStatus);

  if (!updatedRun) {
    response.status(404).json({ error: "Run not found." });
    return;
  }

  response.json(updatedRun);
});

app.post("/api/seed", async (_request, response) => {
  try {
    const repoMlCsv = path.resolve(backendRoot, "..", "ml", "bank_transactions_cleaned.csv");

    const sampleRecords = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(repoMlCsv)
        .pipe(csvParser())
        .on("data", (row) => {
          if (sampleRecords.length < 40) {
            sampleRecords.push(row);
          }
        })
        .on("end", resolve)
        .on("error", reject);
    });

    const result = await scoreRecords(sampleRecords);
    const savedRun = await saveRun({
      source: "seed",
      fileName: "bank_transactions_cleaned.csv",
      summary: result.summary,
      modelMetrics: result.modelMetrics,
      predictions: result.results,
    });

    response.json({ seeded: true, runId: savedRun.id, summary: result.summary });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

connectDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Fraud dashboard API listening on http://localhost:${port}`);
  });
});
