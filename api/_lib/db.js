const sql = require('mssql');

const config = {
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeout: 10000,
  requestTimeout: 20000,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

async function openPool() {
  if (!process.env.DB_HOST) {
    throw new Error('Variáveis de ambiente DB_* não configuradas.');
  }
  return sql.connect(config);
}

function cleanUid(value) {
  return String(value || 'default').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 100) || 'default';
}

function cleanExam(value) {
  const v = String(value || 'DP-300').trim().toUpperCase();
  return /^DP-\d{3}$/.test(v) ? v : 'DP-300';
}

module.exports = { sql, config, openPool, cleanUid, cleanExam };
