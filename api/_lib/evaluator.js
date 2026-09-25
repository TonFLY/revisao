function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function naturalMax(questionType, correct) {
  switch (questionType) {
    case 'multi_select': return Math.max(1, asArray(correct?.selected).length);
    case 'yes_no_matrix': return Math.max(1, Object.keys(asObject(correct)).length);
    case 'hotspot_dropdown': return Math.max(1, Object.keys(asObject(correct)).length);
    case 'build_list': return Math.max(1, asArray(correct?.order).length);
    case 'drag_drop': return Math.max(1, Object.keys(asObject(correct)).length);
    case 'image_hotspot': return Math.max(1, asArray(correct?.selected).length);
    default: return 1;
  }
}

function scaledScore(matched, natural, configuredPoints) {
  const max = Math.max(Number(configuredPoints || 0), natural || 1);
  if (!natural) return { earned: 0, max };
  const earned = Math.round((matched / natural) * max * 100) / 100;
  return { earned, max };
}

function setEqual(a, b) {
  const aa = [...new Set(asArray(a).map(String))].sort();
  const bb = [...new Set(asArray(b).map(String))].sort();
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}

function evaluateQuestion(question, rawAnswer) {
  const type = String(question.question_type || 'single_choice');
  const answer = parseJson(rawAnswer, rawAnswer) ?? {};
  let correct = parseJson(question.correct_json, null);

  if (!correct && type === 'single_choice') {
    correct = { selected: String(question.correct || '').toUpperCase() };
  }

  let matched = 0;
  let natural = naturalMax(type, correct);
  let full = false;
  const details = {};

  if (type === 'single_choice') {
    const selected = typeof answer === 'string' ? answer : answer?.selected;
    const expected = correct?.selected || question.correct;
    full = String(selected || '').toUpperCase() === String(expected || '').toUpperCase();
    matched = full ? 1 : 0;
    details.selected = selected || null;
    details.expected = expected || null;
  }

  else if (type === 'multi_select') {
    const selected = asArray(answer?.selected);
    const expected = asArray(correct?.selected);
    full = setEqual(selected, expected);
    const e = new Set(expected.map(String));
    const s = new Set(selected.map(String));
    matched = [...e].filter(x => s.has(x)).length;
    // Wrong extra selections cancel one matched point each, never below zero.
    matched = Math.max(0, matched - [...s].filter(x => !e.has(x)).length);
    details.selected = selected;
    details.expected = expected;
  }

  else if (type === 'yes_no_matrix' || type === 'hotspot_dropdown' || type === 'drag_drop') {
    const selected = asObject(answer);
    const expected = asObject(correct);
    const keys = Object.keys(expected);
    natural = Math.max(1, keys.length);
    matched = keys.filter(k => String(selected[k] ?? '') === String(expected[k] ?? '')).length;
    full = matched === keys.length && keys.length > 0;
    details.selected = selected;
    details.expected = expected;
  }

  else if (type === 'build_list') {
    const selected = asArray(answer?.order);
    const expected = asArray(correct?.order);
    natural = Math.max(1, expected.length);
    matched = expected.reduce((n, v, i) => n + (String(selected[i] ?? '') === String(v) ? 1 : 0), 0);
    full = selected.length === expected.length && matched === expected.length && expected.length > 0;
    details.selected = selected;
    details.expected = expected;
  }

  else if (type === 'image_hotspot') {
    const selected = asArray(answer?.selected);
    const expected = asArray(correct?.selected);
    natural = Math.max(1, expected.length);
    full = setEqual(selected, expected);
    const e = new Set(expected.map(String));
    const s = new Set(selected.map(String));
    matched = [...e].filter(x => s.has(x)).length;
    matched = Math.max(0, matched - [...s].filter(x => !e.has(x)).length);
    details.selected = selected;
    details.expected = expected;
  }

  else {
    throw new Error(`Tipo de questão não suportado: ${type}`);
  }

  const score = scaledScore(matched, natural, question.points);
  return {
    questionType: type,
    isCorrect: !!full,
    pointsEarned: score.earned,
    pointsMax: score.max,
    correctPayload: correct,
    details,
  };
}

function publicQuestion(row, reveal = false) {
  const q = { ...row };
  q.interaction = parseJson(q.interaction_json, null);
  q.case_data = parseJson(q.case_json, null);
  delete q.interaction_json;
  delete q.case_json;

  if (reveal) {
    q.correct_payload = parseJson(q.correct_json, q.question_type === 'single_choice' ? { selected: q.correct } : null);
  } else {
    delete q.correct;
    delete q.correct_json;
    delete q.explanation;
    delete q.why_correct;
    delete q.why_a_wrong;
    delete q.why_b_wrong;
    delete q.why_c_wrong;
    delete q.why_d_wrong;
    delete q.memory_rule;
    delete q.trap;
  }
  return q;
}

module.exports = { parseJson, evaluateQuestion, publicQuestion };
