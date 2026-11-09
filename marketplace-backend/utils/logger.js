// One logger for the API. In production (or LOG_FORMAT=json) every line is a
// JSON object a log platform can index; elsewhere it's a readable line.
// Info-level lines are silent under NODE_ENV=test so test output stays clean.
const json = () => process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';

function write(level, msg, fields = {}) {
  if (level === 'info' && process.env.NODE_ENV === 'test') return;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (json()) {
    out(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }));
  } else {
    const extra = Object.entries(fields).filter(([k]) => k !== 'stack').map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ');
    out(`[${level}] ${msg}${extra ? ` ${extra}` : ''}${fields.stack ? `\n${fields.stack}` : ''}`);
  }
}

module.exports = {
  info: (msg, fields) => write('info', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  error: (msg, fields) => write('error', msg, fields),
};
