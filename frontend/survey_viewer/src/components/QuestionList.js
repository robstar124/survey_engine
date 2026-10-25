import { groupBySection } from '../utils/survey';
import Icon from './Icon';

// searchable sidebar of questions, grouped into sections
export default function QuestionList({ questions, selectedId, onSelect, search, onSearch }) {
  const sections = groupBySection(questions, search);

  return (
    <aside className="sidebar" aria-label="Questions">
      <label htmlFor="question-search" className="eyebrow sidebar-label">Find a question</label>
      <div className="search">
        <Icon name="search" />
        <input id="question-search" type="search" placeholder="e.g. immigration, Brexit"
          value={search} onChange={(e) => onSearch(e.target.value)} />
      </div>
      {sections.map((section) => (
        <div key={section.label} className="sidebar-section">
          <div className="eyebrow sidebar-heading">
            <span>{section.label}</span><span className="sidebar-count">{section.items.length}</span>
          </div>
          {section.items.map((question) => (
            <button key={question.id} type="button" className="sidebar-item"
              aria-pressed={question.id === selectedId} onClick={() => onSelect(question.id)}>
              {question.text}
            </button>
          ))}
        </div>
      ))}
      {sections.length === 0 && <p className="muted sidebar-empty">No questions match “{search}”.</p>}
    </aside>
  );
}
