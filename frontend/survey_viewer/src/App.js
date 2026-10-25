import { useEffect, useMemo, useRef, useState } from 'react';

import {
  countRespondents, fetchAnswerValues, fetchDemographics, fetchQuestions, fetchResults, fromAnswerParams, toAnswerParams, toQuery,
} from './services/api';
import { buildTable, formatNumber, toCsv, toTsv } from './utils/crosstab';
import { DEMOGRAPHICS, sectionOf, shorten } from './utils/survey';
import CrosstabTable from './components/CrosstabTable';
import FilterBar from './components/FilterBar';
import Icon from './components/Icon';
import Panel from './components/Panel';
import QuestionPicker from './components/QuestionPicker';
import QuestionList from './components/QuestionList';
import './styles/App.css';

const MODES = [['percent', 'Column %'], ['counts', 'Counts'], ['both', 'Both']];

const DEFAULT_GROUP_BY = 'age_band';

// the breakdown is a demographic field name, a question id (by=q<id> in the url), or null for total only
function readGroupBy(by) {
  if (by === 'none') return null;
  if (by in DEMOGRAPHICS) return by;
  const questionId = by?.match(/^q(\d+)$/)?.[1];
  return questionId ? Number(questionId) : DEFAULT_GROUP_BY;
}

// read the question, breakdown and filters from the page url so shared links reopen the same table
function readUrl() {
  const params = new URLSearchParams(window.location.search);
  const filters = {};
  Object.keys(DEMOGRAPHICS).forEach((field) => {
    const values = params.getAll(field);
    if (values.length) filters[field] = values;
  });
  return {
    questionId: Number(params.get('q')) || null,
    groupBy: readGroupBy(params.get('by')),
    filters,
    answers: fromAnswerParams(params.getAll('answer')),
  };
}

function writeUrl(questionId, groupBy, filters, answers) {
  const by = typeof groupBy === 'number' ? 'q' + groupBy : groupBy ?? 'none';
  const query = toQuery({ q: questionId, by, ...filters, answer: toAnswerParams(answers) });
  window.history.replaceState(null, '', window.location.pathname + query);
}

// keep only answer filters on questions that exist, so an old link can't silently match nobody
function knownAnswers(answers, questions) {
  return Object.fromEntries(Object.entries(answers).filter(([id]) => questions.some((q) => q.id === Number(id))));
}

// start a file download of some text
function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
}

export default function App() {
  const initial = useMemo(readUrl, []);
  const [survey, setSurvey] = useState({ questions: null, demographics: null, total: null, error: null });
  const [questionId, setQuestionId] = useState(initial.questionId);
  const [groupBy, setGroupBy] = useState(initial.groupBy);
  const [filters, setFilters] = useState(initial.filters);
  const [answers, setAnswers] = useState(initial.answers);
  // options for answer filters by question id: undefined while loading, then an array, or an Error
  const [answerValues, setAnswerValues] = useState({});
  const [view, setView] = useState({ mode: 'percent', sortByTotal: true });
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState('');
  const [editingField, setEditingField] = useState(null);
  const [results, setResults] = useState({ data: null, matching: null, error: null, loading: false });
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  // load the question list and filter options once
  useEffect(() => {
    Promise.all([fetchQuestions(), fetchDemographics(), countRespondents({})])
      .then(([questions, demographics, total]) => {
        setSurvey({ questions, demographics, total, error: null });
        setQuestionId((current) => {
          if (questions.some((q) => q.id === current)) return current;
          return (questions.find((q) => q.category === 'voting_intention') ?? questions[0])?.id ?? null;
        });
        setGroupBy((current) => (typeof current !== 'number' || questions.some((q) => q.id === current) ? current : DEFAULT_GROUP_BY));
        setAnswers((current) => knownAnswers(current, questions));
      })
      .catch((error) => setSurvey((s) => ({ ...s, error })));
  }, []);

  // refetch results whenever the table definition changes, ignoring responses that arrive after a newer request;
  // waits for the question list so a stale id from the url is replaced before anything is fetched
  const loaded = survey.questions !== null;
  useEffect(() => {
    if (!loaded || questionId === null) return undefined;
    writeUrl(questionId, groupBy, filters, answers);
    const params = { ...filters, answer: toAnswerParams(answers) };
    let current = true;
    setResults((r) => ({ ...r, loading: true, error: null }));
    Promise.all([fetchResults(questionId, groupBy, params), countRespondents(params)])
      .then(([data, matching]) => current && setResults({ data, matching, error: null, loading: false }))
      .catch((error) => current && setResults({ data: null, matching: null, error, loading: false }));
    return () => { current = false; };
  }, [loaded, questionId, groupBy, filters, answers]);

  // fetch a question's answers the first time someone opens it as a filter
  useEffect(() => {
    if (typeof editingField !== 'number' || editingField in answerValues) return;
    setAnswerValues((v) => ({ ...v, [editingField]: undefined }));
    fetchAnswerValues(editingField)
      .then((values) => setAnswerValues((v) => ({ ...v, [editingField]: values })))
      .catch((error) => setAnswerValues((v) => ({ ...v, [editingField]: error })));
  }, [editingField, answerValues]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const flash = (message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  };

  const copy = (text, message) => {
    navigator.clipboard.writeText(text).then(() => flash(message), () => flash('Your browser blocked the clipboard.'));
  };

  const table = useMemo(
    () => (results.data ? buildTable(results.data, { sortByTotal: view.sortByTotal }) : null),
    [results.data, view.sortByTotal],
  );

  if (survey.error) {
    return <Shell><div className="message">Could not reach the survey API: {survey.error.message}</div></Shell>;
  }
  if (!survey.questions) {
    return <Shell><div className="message">Loading survey…</div></Shell>;
  }

  const question = survey.questions.find((q) => q.id === questionId);
  const columnTitle = typeof groupBy === 'number'
    ? survey.questions.find((q) => q.id === groupBy)?.text ?? null
    : DEMOGRAPHICS[groupBy] ?? null;
  const filtered = Object.keys(filters).length + Object.keys(answers).length > 0;
  const answered = results.data?.total ?? 0;
  const matching = results.matching ?? survey.total;
  const fileName = `crosstab_${slug(question?.text ?? 'question')}${groupBy ? '_by_' + slug(columnTitle ?? String(groupBy)) : ''}.csv`;

  const closePanel = () => { setPanel(''); setEditingField(null); };
  const togglePanel = (name) => { setPanel(panel === name ? '' : name); setEditingField(null); };
  const toggleView = (key) => setView((v) => ({ ...v, [key]: !v[key] }));
  const pickGroupBy = (field) => { setGroupBy(field); closePanel(); };

  return (
    <Shell total={survey.total}>
      <div className="layout">
        <QuestionList questions={survey.questions} selectedId={questionId}
          onSelect={setQuestionId} search={search} onSearch={setSearch} />

        <main className="content">
          {question && <>
            <div className="eyebrow">{sectionOf(question.category)}</div>
            <h1>{question.text}</h1>
          </>}

          <div className="toolbar">
            <div className="toolbar-group">
              <span className="muted small">Columns</span>
              <button type="button" className="button" aria-expanded={panel === 'columns'} onClick={() => togglePanel('columns')}>
                {columnTitle ? shorten(columnTitle) : 'Total only'} <Icon name="chevron" size={14} />
              </button>
            </div>

            <div role="group" aria-label="Values shown" className="segmented">
              {MODES.map(([mode, label]) => (
                <button key={mode} type="button" aria-pressed={view.mode === mode}
                  onClick={() => setView((v) => ({ ...v, mode }))}>{label}</button>
              ))}
            </div>

            {table && !table.scale && (
              <button type="button" className="button toggle" aria-pressed={view.sortByTotal} onClick={() => toggleView('sortByTotal')}>
                <span className="checkbox" aria-hidden="true" />Sort by total
              </button>
            )}

            <div className="spacer" />

            <div className="toolbar-group">
              <button type="button" className="button" disabled={!table}
                onClick={() => copy(toTsv(table, question.text, view.mode), 'Table copied. Paste it straight into Excel or PowerPoint.')}>
                <Icon name="copy" size={15} /> Copy table
              </button>
              <button type="button" className="button"
                onClick={() => copy(window.location.href, 'Link copied: anyone opening it sees this exact table.')}>
                <Icon name="link" size={15} /> Copy link
              </button>
              <button type="button" className="button primary" disabled={!table}
                onClick={() => download(toCsv(table, question.text, view.mode), fileName, 'text/csv')}>
                <Icon name="download" size={15} /> Export CSV
              </button>
            </div>
          </div>

          {panel === 'columns' && (
            <Panel title="Break the table down by" onClose={closePanel}>
              <div className="eyebrow panel-section">Demographics</div>
              <div className="pill-row">
                <button type="button" className="pill" aria-pressed={groupBy === null} onClick={() => pickGroupBy(null)}>Total only</button>
                {Object.entries(DEMOGRAPHICS).map(([field, label]) => (
                  <button key={field} type="button" className="pill" aria-pressed={groupBy === field} onClick={() => pickGroupBy(field)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="eyebrow panel-section">Answers to another question</div>
              <QuestionPicker questions={survey.questions.filter((q) => q.id !== questionId)} label="Search questions to break down by"
                selected={[groupBy]} onPick={pickGroupBy} />
            </Panel>
          )}

          <FilterBar
            filters={filters}
            answers={answers}
            demographics={survey.demographics}
            questions={survey.questions}
            answerValues={answerValues[editingField]}
            panel={panel}
            editingField={editingField}
            onOpen={() => togglePanel('add')}
            onEdit={(field) => { setPanel('values'); setEditingField(field); }}
            onClose={closePanel}
            onChange={setFilters}
            onAnswersChange={setAnswers}
          />

          {results.error && <div className="message error">Could not load results: {results.error.message}</div>}

          {results.data && <>
            <p className="base-text">
              <strong>Base:</strong>{' '}
              {filtered
                ? `${formatNumber(matching)} of ${formatNumber(survey.total)} respondents match the filters; `
                : `all ${formatNumber(survey.total)} respondents; `}
              {formatNumber(answered)} answered this question
              {answered < matching && ` (${formatNumber(matching - answered)} not asked or left blank, excluded)`}.
              {questionId in answers && ' This question is also a filter, so only the answers picked there can appear.'}
              {results.loading && <span className="muted"> Updating…</span>}
            </p>

            {answered === 0
              ? <div className="message">No respondents match these filters. Remove a filter to see results.</div>
              : <CrosstabTable table={table} title={question?.text ?? ''} columnTitle={columnTitle} mode={view.mode} />}

            <div className="legend">
              <span><span className="mark up">▲</span> <span className="mark down">▼</span> Significantly higher / lower than the rest of the sample at 95% (two-proportion z-test; both groups n ≥ 30)</span>
              <span>* Low base, n &lt; 50: treat with caution</span>
              <span>Column percentages{table?.scale && '; nets add up the options they name'}</span>
            </div>
          </>}
        </main>
      </div>

      {toast && <div role="status" className="toast">{toast}</div>}
    </Shell>
  );
}

// the page frame: header bar above the content
function Shell({ total, children }) {
  return (
    <div className="app">
      <header className="header">
        <div className="brand"><span className="brand-icon"><Icon name="grid" size={22} /></span>Survey Engine</div>
        <div className="spacer" />
        {total != null && <div className="muted small">{formatNumber(total)} respondents</div>}
      </header>
      {children}
    </div>
  );
}
