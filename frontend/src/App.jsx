import { useEffect, useState } from "react";

import { Badge, Button, Card, Input, Select } from "./components/ui";
import { formatCurrency, formatNumber, formatPercent } from "./lib/utils";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const initialForm = {
  TransactionID: "MANUAL-001",
  AccountID: "AC90001",
  TransactionAmount: 4800,
  TransactionDate: "2024-11-04 01:12:00",
  TransactionType: "Transfer",
  Location: "Houston",
  Channel: "Online",
  CustomerAge: 42,
  CustomerOccupation: "Engineer",
  TransactionDuration: 12,
  LoginAttempts: 3,
  AccountBalance: 6200,
  PreviousTransactionDate: "2024-11-03 18:00:00",
};

function App() {
  const [overview, setOverview] = useState(null);
  const [runs, setRuns] = useState([]);
  const [latestPrediction, setLatestPrediction] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchOverview() {
    const [overviewResponse, runsResponse] = await Promise.all([
      fetch(`${API_URL}/api/overview`),
      fetch(`${API_URL}/api/runs`),
    ]);

    const overviewData = await overviewResponse.json();
    const runsData = await runsResponse.json();

    setOverview(overviewData);
    setRuns(runsData);
    if (!latestPrediction && runsData[0]) {
      setLatestPrediction(runsData[0]);
    }
  }

  useEffect(() => {
    fetchOverview().catch((error) => setMessage(error.message));
  }, []);

  async function seedDashboard() {
    setIsLoading(true);
    setMessage("");

    try {
      await fetch(`${API_URL}/api/seed`, { method: "POST" });
      await fetchOverview();
      setMessage("Dashboard seeded from the cleaned fraud dataset.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function trainModel() {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/train`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Training failed");
      }
      await fetchOverview();
      setMessage(`Model retrained. ROC-AUC ${formatPercent(data.metrics.roc_auc)}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitManualPrediction(event) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Prediction failed");
      }
      await fetchOverview();
      setLatestPrediction({
        id: data.runId,
        summary: data.summary,
        predictions: data.results,
        modelMetrics: data.modelMetrics,
        source: "manual",
      });
      setMessage("Manual transaction scored successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      await fetchOverview();
      setLatestPrediction({
        id: data.runId,
        summary: data.summary,
        predictions: data.results,
        modelMetrics: data.modelMetrics,
        source: "upload",
        fileName: data.fileName,
      });
      setMessage(`${data.fileName} scored successfully.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      event.target.value = "";
      setIsLoading(false);
    }
  }

  const metrics = overview?.modelMetrics || {};
  const activeResults = latestPrediction?.predictions || overview?.recentFlags || [];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_35%),linear-gradient(135deg,_#ffffff,_#f8fafc)] p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Bank Fraud Detection Console
              </p>
              <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight">
                Turn your fraud notebooks into an analyst-ready monitoring workflow.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                Upload transaction batches, score individual events, review flagged activity, and
                retrain the model from your cleaned fraud dataset.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={seedDashboard} disabled={isLoading}>
                  Seed with dataset sample
                </Button>
                <Button variant="secondary" onClick={trainModel} disabled={isLoading}>
                  Retrain model
                </Button>
              </div>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-4">
              <MetricCard label="Transactions scored" value={formatNumber(overview?.totalTransactions)} />
              <MetricCard label="Flagged cases" value={formatNumber(overview?.flaggedTransactions)} />
              <MetricCard label="High risk" value={formatNumber(overview?.highRiskTransactions)} />
              <MetricCard label="Average risk" value={formatPercent(overview?.averageRiskScore)} />
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Model quality
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <MetricCard label="ROC-AUC" value={formatPercent(metrics.roc_auc)} />
              <MetricCard label="Recall" value={formatPercent(metrics.recall)} />
              <MetricCard label="Precision" value={formatPercent(metrics.precision)} />
              <MetricCard label="F1 score" value={formatPercent(metrics.f1)} />
            </div>
            <div className="mt-6 rounded-3xl border border-border bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Bulk scoring
              </p>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-4 py-10 text-center">
                <span className="text-sm font-medium">Upload a transaction CSV</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Use the cleaned dataset or similarly structured incoming transactions.
                </span>
                <input className="hidden" type="file" accept=".csv" onChange={submitFile} />
              </label>
            </div>
            {message ? (
              <div className="mt-4 rounded-2xl border border-border bg-white px-4 py-3 text-sm">
                {message}
              </div>
            ) : null}
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Manual scoring
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Score a suspicious transaction</h2>
              </div>
              <Badge tone="default">API backed</Badge>
            </div>

            <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={submitManualPrediction}>
              <Field label="Transaction ID">
                <Input
                  value={form.TransactionID}
                  onChange={(event) => setForm({ ...form, TransactionID: event.target.value })}
                />
              </Field>
              <Field label="Account ID">
                <Input
                  value={form.AccountID}
                  onChange={(event) => setForm({ ...form, AccountID: event.target.value })}
                />
              </Field>
              <Field label="Transaction amount">
                <Input
                  type="number"
                  value={form.TransactionAmount}
                  onChange={(event) => setForm({ ...form, TransactionAmount: Number(event.target.value) })}
                />
              </Field>
              <Field label="Account balance">
                <Input
                  type="number"
                  value={form.AccountBalance}
                  onChange={(event) => setForm({ ...form, AccountBalance: Number(event.target.value) })}
                />
              </Field>
              <Field label="Transaction date">
                <Input
                  value={form.TransactionDate}
                  onChange={(event) => setForm({ ...form, TransactionDate: event.target.value })}
                />
              </Field>
              <Field label="Previous transaction date">
                <Input
                  value={form.PreviousTransactionDate}
                  onChange={(event) =>
                    setForm({ ...form, PreviousTransactionDate: event.target.value })
                  }
                />
              </Field>
              <Field label="Channel">
                <Select
                  value={form.Channel}
                  onChange={(event) => setForm({ ...form, Channel: event.target.value })}
                >
                  <option>Online</option>
                  <option>ATM</option>
                  <option>Branch</option>
                </Select>
              </Field>
              <Field label="Transaction type">
                <Select
                  value={form.TransactionType}
                  onChange={(event) => setForm({ ...form, TransactionType: event.target.value })}
                >
                  <option>Transfer</option>
                  <option>Debit</option>
                  <option>Credit</option>
                </Select>
              </Field>
              <Field label="Location">
                <Input
                  value={form.Location}
                  onChange={(event) => setForm({ ...form, Location: event.target.value })}
                />
              </Field>
              <Field label="Occupation">
                <Input
                  value={form.CustomerOccupation}
                  onChange={(event) =>
                    setForm({ ...form, CustomerOccupation: event.target.value })
                  }
                />
              </Field>
              <Field label="Transaction duration">
                <Input
                  type="number"
                  value={form.TransactionDuration}
                  onChange={(event) =>
                    setForm({ ...form, TransactionDuration: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Login attempts">
                <Input
                  type="number"
                  value={form.LoginAttempts}
                  onChange={(event) => setForm({ ...form, LoginAttempts: Number(event.target.value) })}
                />
              </Field>
              <Field label="Customer age">
                <Input
                  type="number"
                  value={form.CustomerAge}
                  onChange={(event) => setForm({ ...form, CustomerAge: Number(event.target.value) })}
                />
              </Field>
              <div className="md:col-span-2">
                <Button className="w-full" disabled={isLoading} type="submit">
                  Score transaction
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Analyst review
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Flagged transaction breakdown</h2>
              </div>
              <Badge tone="high">{activeResults.length} visible</Badge>
            </div>

            <div className="mt-6 grid gap-4">
              {activeResults.length ? (
                activeResults.map((result) => (
                  <div
                    key={`${result.transactionId}-${result.accountId}`}
                    className="rounded-3xl border border-border bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{result.transactionId}</p>
                        <p className="text-sm text-muted-foreground">
                          {result.channel} in {result.location}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={result.riskBand}>{result.riskBand}</Badge>
                        <span className="text-sm font-semibold">{formatPercent(result.riskScore)}</span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <MiniStat label="Amount" value={formatCurrency(result.transactionAmount)} />
                      <MiniStat label="Balance" value={formatCurrency(result.accountBalance)} />
                      <MiniStat label="Logins" value={String(result.loginAttempts)} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(result.reasons || []).length ? (
                        result.reasons.map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            {reason}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No strong anomaly reasons triggered.
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-slate-50 px-6 py-16 text-center text-sm text-muted-foreground">
                  Seed the dashboard or score a transaction to populate the analyst queue.
                </div>
              )}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Channel mix
            </p>
            <div className="mt-6 grid gap-3">
              {(overview?.channelDistribution || []).map((item) => (
                <div key={item.name}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">{item.value}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-slate-900"
                      style={{
                        width: `${Math.max(
                          8,
                          ((item.value || 0) / Math.max(overview?.totalTransactions || 1, 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Run history
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Recent scoring activity</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-medium">Source</th>
                    <th className="px-6 py-4 font-medium">File</th>
                    <th className="px-6 py-4 font-medium">Transactions</th>
                    <th className="px-6 py-4 font-medium">Flagged</th>
                    <th className="px-6 py-4 font-medium">Average risk</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length ? (
                    runs.map((run) => (
                      <tr key={run.id} className="border-t border-border">
                        <td className="px-6 py-4 capitalize">{run.source}</td>
                        <td className="px-6 py-4 text-muted-foreground">{run.fileName || "--"}</td>
                        <td className="px-6 py-4">{formatNumber(run.summary?.totalTransactions)}</td>
                        <td className="px-6 py-4">{formatNumber(run.summary?.flaggedTransactions)}</td>
                        <td className="px-6 py-4">{formatPercent(run.summary?.averageRiskScore)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-6 py-10 text-muted-foreground" colSpan="5">
                        No runs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-border bg-white p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

export default App;
