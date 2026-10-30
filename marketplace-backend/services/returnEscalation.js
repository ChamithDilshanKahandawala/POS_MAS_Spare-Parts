// Milestone 8 — same setInterval pattern as services/orderAutoCancel.js: one
// process, one fixed-period sweep that moves overdue seller responses to
// platform review.
const { escalateOverdueRequests } = require('./returns');

const INTERVAL_MS = 15 * 60 * 1000;

let timer = null;
let runningNow = false;

async function runSweep() {
  if (runningNow) return;
  runningNow = true;
  try {
    await escalateOverdueRequests();
  } catch (err) {
    console.error('[returnEscalation] sweep failed:', err.message);
  } finally {
    runningNow = false;
  }
}

function startReturnEscalationJob() {
  if (timer) return;
  timer = setInterval(runSweep, INTERVAL_MS);
  timer.unref?.();
}

function stopReturnEscalationJob() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startReturnEscalationJob, stopReturnEscalationJob, runSweep };
