"use client";

import { useState } from "react";

type Suggestion = { category: string; title: string; detail: string };

const CATEGORY_STYLE: Record<string, string> = {
  Promote: "bg-blue-100 text-blue-700",
  Restock: "bg-amber-100 text-amber-700",
  Clearance: "bg-purple-100 text-purple-700",
  Pricing: "bg-emerald-100 text-emerald-700",
  "Cost Saving": "bg-teal-100 text-teal-700",
  Collections: "bg-red-100 text-red-700",
  Other: "bg-slate-100 text-slate-600",
};

const EXAMPLE_QUESTIONS = [
  "What are the overstock items?",
  "Which categories are underperforming?",
  "What should I do about slow-moving stock?",
  "How can I reduce commission costs?",
];

export default function AiInsightsTab() {
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate insights.");
      setSuggestions(data.suggestions);
      setAskedQuestion(question.trim() || null);
      setGeneratedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate insights.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div>
          <div className="text-sm font-semibold text-slate-700">AI Sales Insights</div>
          <p className="text-xs text-slate-400 mt-0.5">
            Reads your last 30 days of sales, stock, and expenses. Ask a specific question, or leave it blank
            for general suggestions. Generated on demand — nothing is saved.
          </p>
        </div>

        <div>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What are the overstock items?"
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className="text-xs rounded-full border border-slate-200 px-2.5 py-1 text-slate-500 hover:bg-slate-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          {generatedAt ? (
            <p className="text-xs text-slate-400">
              Last generated {generatedAt.toLocaleString()}
              {askedQuestion && <> — asked: "{askedQuestion}"</>}
            </p>
          ) : (
            <span />
          )}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-lg bg-blue-600 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-60 shrink-0"
          >
            {loading ? "Analyzing…" : suggestions ? "Regenerate" : question.trim() ? "Ask AI" : "Generate Insights"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

      {!suggestions && !loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
          Type a question above (or leave it blank) and click the button to get AI suggestions based on your
          current sales data.
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
          Analyzing your shop's data…
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3">
              <span
                className={`shrink-0 h-fit inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  CATEGORY_STYLE[s.category] ?? CATEGORY_STYLE.Other
                }`}
              >
                {s.category}
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-800">{s.title}</div>
                <div className="text-sm text-slate-600 mt-0.5">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {suggestions && suggestions.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
          Not enough data yet to generate meaningful suggestions.
        </div>
      )}
    </div>
  );
}
