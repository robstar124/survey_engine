import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestionList from '../../components/QuestionList';

const QUESTIONS = [
  { id: 1, category: 'voting_intention', text: 'Which party would you vote for' },
  { id: 2, category: 'general_attitudes', text: 'Big business takes advantage of ordinary people' },
  { id: 3, category: 'statements', text: 'I own more than one property' },
];

function renderList(props = {}) {
  const handlers = { onSelect: jest.fn(), onSearch: jest.fn() };
  render(<QuestionList questions={QUESTIONS} selectedId={1} search="" {...handlers} {...props} />);
  return handlers;
}

// categories are grouped into the sidebar sections, each showing how many questions it holds
test('groups questions into sections with counts', () => {
  renderList();
  expect(screen.getByText('Politics')).toBeInTheDocument();
  expect(screen.getByText('Attitudes')).toBeInTheDocument();
  expect(screen.getByText('Statements')).toBeInTheDocument();
  expect(screen.getAllByText('1')).toHaveLength(3);
});

// only the current question is marked pressed, which is what styles it and tells screen readers it's selected
test('marks the selected question as pressed', () => {
  renderList();
  expect(screen.getByRole('button', { name: 'Which party would you vote for' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'I own more than one property' })).toHaveAttribute('aria-pressed', 'false');
});

// clicking a question reports its id, not its text or position
test('calls onSelect with the question id', () => {
  const { onSelect } = renderList();
  userEvent.click(screen.getByRole('button', { name: 'I own more than one property' }));
  expect(onSelect).toHaveBeenCalledWith(3);
});

// the search box is controlled: typing reports each change up to the parent
test('reports typing in the search box', () => {
  const { onSearch } = renderList();
  userEvent.type(screen.getByLabelText('Find a question'), 'b');
  expect(onSearch).toHaveBeenCalledWith('b');
});

// search ignores case and surrounding spaces, and sections with no matches disappear
test('filters questions case-insensitively and hides empty sections', () => {
  renderList({ search: '  BUSINESS ' });
  expect(screen.getByRole('button', { name: /Big business/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Which party/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Politics')).not.toBeInTheDocument();
});

// a search with no results says so, quoting the search, rather than showing an empty sidebar
test('says when nothing matches', () => {
  renderList({ search: 'zebra' });
  expect(screen.getByText('No questions match “zebra”.')).toBeInTheDocument();
});
