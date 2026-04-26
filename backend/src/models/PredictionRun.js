import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    transactionId: String,
    accountId: String,
    channel: String,
    location: String,
    transactionAmount: Number,
    accountBalance: Number,
    loginAttempts: Number,
    transactionDuration: Number,
    amountToBalanceRatio: Number,
    riskScore: Number,
    riskBand: String,
    predictedFraud: Number,
    reasons: [String],
  },
  { _id: false }
);

const runSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ["manual", "upload", "seed"],
      required: true,
    },
    fileName: String,
    summary: {
      totalTransactions: Number,
      flaggedTransactions: Number,
      highRiskTransactions: Number,
      averageRiskScore: Number,
    },
    modelMetrics: mongoose.Schema.Types.Mixed,
    predictions: [predictionSchema],
    analystStatus: {
      type: String,
      enum: ["new", "reviewed", "escalated"],
      default: "new",
    },
  },
  { timestamps: true }
);

export const PredictionRun =
  mongoose.models.PredictionRun || mongoose.model("PredictionRun", runSchema);
