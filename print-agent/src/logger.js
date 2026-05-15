import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogPath() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `print-agent-${date}.log`);
}

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

function write(level, message, meta) {
  const line = formatMessage(level, message, meta);
  console.log(line);
  try {
    fs.appendFileSync(getLogPath(), line + '\n');
  } catch {
    // Never crash the agent because of a log write failure
  }
}

export const logger = {
  info:  (msg, meta) => write('INFO ', msg, meta),
  warn:  (msg, meta) => write('WARN ', msg, meta),
  error: (msg, meta) => write('ERROR', msg, meta),
  print: (saleId, result, error) => {
    const meta = { saleId, result };
    if (error) meta.error = error;
    write(result === 'success' ? 'PRINT' : 'PFAIL', `Print attempt`, meta);
  },
};
