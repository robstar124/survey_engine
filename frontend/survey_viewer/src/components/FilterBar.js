import { DEMOGRAPHICS, shorten, sortDemographicValues } from '../utils/survey';
import Icon from './Icon';
import Panel from './Panel';
import QuestionPicker from './QuestionPicker';

// show the first two values of a filter, then how many more
function summarise(values) {
  return values.length > 2 ? `${values.slice(0, 2).join(', ')} +${values.length - 2}` : values.join(', ');
}

function Chip({ label, values, onEdit, onRemove }) {
  return (
    <span className="chip">
      <button type="button" className="chip-label" onClick={onEdit}>
        <strong>{label}:</strong> {summarise(values)}
      </button>
      <button type="button" className="chip-remove" aria-label={`Remove ${label} filter`} onClick={onRemove}>
        <Icon name="close" size={14} />
      </button>
    </span>
  );
}

// active filter chips, plus the panels for choosing a field or question and its values;
// demographic filters are keyed by field name, answer filters by question id, and editingField is one or the other
export default function FilterBar({
  filters, answers = {}, demographics, questions = [], answerValues, panel, editingField,
  onOpen, onEdit, onClose, onChange, onAnswersChange = () => {},
}) {
  const questionText = (id) => questions.find((q) => q.id === Number(id))?.text ?? `Question ${id}`;
  const active = Object.keys(filters);
  const activeAnswers = Object.keys(answers);
  const editingQuestion = typeof editingField === 'number';

  const setValues = (field, values) => {
    const question = typeof field === 'number';
    const next = { ...(question ? answers : filters) };
    if (values.length) next[field] = values;
    else delete next[field];
    (question ? onAnswersChange : onChange)(next);
  };

  const current = (editingQuestion ? answers : filters)[editingField] ?? [];
  const toggleValue = (value) => {
    setValues(editingField, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  let options = [];
  if (editingQuestion) options = Array.isArray(answerValues) ? answerValues : [];
  else if (editingField) options = sortDemographicValues(editingField, demographics[editingField] ?? []);

  return (
    <>
      <div className="filter-bar">
        <Icon name="filter" />
        <span className="muted small">Filters</span>
        {active.map((field) => (
          <Chip key={field} label={DEMOGRAPHICS[field]} values={filters[field]}
            onEdit={() => onEdit(field)} onRemove={() => setValues(field, [])} />
        ))}
        {activeAnswers.map((id) => (
          <Chip key={'q' + id} label={shorten(questionText(id))} values={answers[id]}
            onEdit={() => onEdit(Number(id))} onRemove={() => setValues(Number(id), [])} />
        ))}
        <button type="button" className="add-filter" aria-expanded={panel === 'add'} onClick={onOpen}>
          <Icon name="plus" size={14} /> Add filter
        </button>
        {active.length + activeAnswers.length > 0 && (
          <button type="button" className="link-button" onClick={() => { onChange({}); onAnswersChange({}); }}>Clear all</button>
        )}
      </div>

      {panel === 'add' && (
        <Panel title="Filter respondents by" onClose={onClose}>
          <div className="eyebrow panel-section">Demographics</div>
          <div className="pill-row">
            {Object.entries(DEMOGRAPHICS).map(([field, label]) => (
              <button key={field} type="button" className="pill" aria-pressed={field in filters} onClick={() => onEdit(field)}>
                {label}
              </button>
            ))}
          </div>
          <div className="eyebrow panel-section">Their answer to a question</div>
          <QuestionPicker questions={questions} label="Search questions to filter by"
            selected={activeAnswers.map(Number)} onPick={onEdit} />
        </Panel>
      )}

      {panel === 'values' && editingField != null && (
        <Panel
          title={editingQuestion
            ? `Only include respondents who answered “${shorten(questionText(editingField), 80)}” with…`
            : `Only include respondents whose ${DEMOGRAPHICS[editingField].toLowerCase()} is…`}
          actions={<>
            <button type="button" className="link-button" disabled={!options.length}
              onClick={() => setValues(editingField, options)}>Select all</button>
            <button type="button" className="button primary" onClick={onClose}>Done</button>
          </>}
        >
          {editingQuestion && answerValues === undefined && <p className="muted small">Loading answers…</p>}
          {answerValues instanceof Error && <p className="message error">Could not load answers: {answerValues.message}</p>}
          <div className="pill-row">
            {options.map((value) => {
              const on = current.includes(value);
              return (
                <button key={value} type="button" className="pill" aria-pressed={on} onClick={() => toggleValue(value)}>
                  <span className="checkbox" aria-hidden="true" />{value}
                </button>
              );
            })}
          </div>
        </Panel>
      )}
    </>
  );
}
