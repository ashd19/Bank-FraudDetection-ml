import mongoose from "mongoose";

import { PredictionRun } from "./models/PredictionRun.js";

const inMemoryRuns = [];

function normalizeRun(run) {
  if (!run) {
    return null;
  }

  const object = typeof run.toObject === "function" ? run.toObject() : run;
  return {
    id: String(object._id || object.id || `memory-${Date.now()}`),
    source: object.source,
    fileName: object.fileName || "",
    summary: object.summary,
    modelMetrics: object.modelMetrics || {},
    predictions: object.predictions || [],
    analystStatus: object.analystStatus || "new",
    createdAt: object.createdAt || new Date().toISOString(),
    updatedAt: object.updatedAt || new Date().toISOString(),
  };
}

export async function saveRun(payload) {
  if (mongoose.connection.readyState === 1) {
    const run = await PredictionRun.create(payload);
    return normalizeRun(run);
  }

  const memoryRun = normalizeRun({
    ...payload,
    _id: `memory-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  inMemoryRuns.unshift(memoryRun);
  return memoryRun;
}

export async function listRuns(limit = 10) {
  if (mongoose.connection.readyState === 1) {
    const runs = await PredictionRun.find().sort({ createdAt: -1 }).limit(limit);
    return runs.map(normalizeRun);
  }

  return inMemoryRuns.slice(0, limit).map(normalizeRun);
}

export async function updateRunStatus(id, analystStatus) {
  if (mongoose.connection.readyState === 1) {
    const run = await PredictionRun.findByIdAndUpdate(id, { analystStatus }, { new: true });
    return normalizeRun(run);
  }

  const run = inMemoryRuns.find((item) => item.id === id);
  if (!run) {
    return null;
  }

  run.analystStatus = analystStatus;
  run.updatedAt = new Date().toISOString();
  return run;
}
