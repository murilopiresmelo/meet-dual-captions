"use strict";

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function summarizeLatencies(values, budget = 500) {
  if (!values.length) return { samples: 0, p50: null, p95: null, max: null, passes: false };
  const rounded = values.map(Math.round);
  const p95 = percentile(rounded, 0.95);
  return {
    samples: rounded.length,
    p50: percentile(rounded, 0.5),
    p95,
    max: Math.max(...rounded),
    passes: p95 < budget,
  };
}

const meetDualMetrics = { summarizeLatencies };

if (typeof module === "object" && module.exports) module.exports = meetDualMetrics;
else globalThis.meetDualMetrics = meetDualMetrics;
