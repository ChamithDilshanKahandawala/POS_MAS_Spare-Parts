// Milestone 4's "every 5 minutes in dev" sync job. A plain setInterval
// rather than a cron dependency — this app runs as one process and only
// ever needs one fixed-period job, so a scheduling library would be
// more machinery than the problem needs. Started from server.js's own
// start() (so it never runs during tests, which require server.js as
// `app` without calling start()).
const Seller = require('../models/Seller');
const { runSync } = require('./posIntegration');

const INTERVAL_MS = 5 * 60 * 1000;

let timer = null;
let runningNow = false; // guards against a sync that takes longer than 5 minutes overlapping itself

async function runAllEnabledSellers() {
  if (runningNow) return; // previous tick still in flight — skip, don't stack up
  runningNow = true;
  try {
    const sellers = await Seller.find({ 'posConnection.enabled': true }).select('_id').lean();
    for (const seller of sellers) {
      try {
        await runSync(seller._id, 'scheduled');
      } catch (err) {
        // runSync already records the failure on the seller + a
        // PosSyncRun row — this catch is only so one seller's unexpected
        // throw can't stop the rest of the loop from running.
        console.error(`[posSyncScheduler] sync failed for seller ${seller._id}:`, err.message);
      }
    }
  } finally {
    runningNow = false;
  }
}

function startPosSyncScheduler() {
  if (timer) return; // already started — never double-schedule
  timer = setInterval(runAllEnabledSellers, INTERVAL_MS);
  // unref() so this timer alone never keeps the process alive — a
  // graceful shutdown (SIGTERM) isn't blocked waiting on it.
  timer.unref?.();
}

function stopPosSyncScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startPosSyncScheduler, stopPosSyncScheduler, runAllEnabledSellers };
