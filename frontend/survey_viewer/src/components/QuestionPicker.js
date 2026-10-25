import { useState } from 'react';

import { groupBySection } from '../utils/survey';
import Icon from './Icon';

// a searchable, scrolling list of questions grouped into sections, for picking one inside a panel
export default function QuestionPicker({ questions, selected = [], onPick, label }) {
  const [search, setSearch] = useState('');
  const sections = groupBySection(questions, search);

  return (
    <div className="picker">
      <div className="search picker-search">
        <Icon name="search" />
        <input type="search" aria-label={label} placeholder="Search questions"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="picker-list">
        {sections.map((section) => (
          <div key={section.label} className="picker-section">
            <div className="eyebrow picker-heading">{section.label}</div>
            {section.items.map((question) => (
              <button key={question.id} type="button" className="pill picker-item"
                aria-pressed={selected.includes(question.id)} onClick={() => onPick(question.id)}>
                {question.text}
              </button>
            ))}
          </div>
        ))}
        {sections.length === 0 && <p className="muted small">No questions match “{search}”.</p>}
      </div>
    </div>
  );
}
