const handlers = {
  start: require('../lib/exam/start'),
  session: require('../lib/exam/session'),
  answer: require('../lib/exam/answer'),
  mark: require('../lib/exam/mark'),
  submit: require('../lib/exam/submit'),
  pool: require('../lib/exam/pool'),
};

module.exports = async function handler(req, res) {
  const action = String(req.query.action || '').trim().toLowerCase();
  const fn = handlers[action];

  if (!fn) {
    return res.status(404).json({
      error: 'Ação de exame inválida.',
      supported: Object.keys(handlers),
    });
  }

  return fn(req, res);
};
