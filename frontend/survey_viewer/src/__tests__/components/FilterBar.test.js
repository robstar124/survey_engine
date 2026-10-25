import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterBar from '../../components/FilterBar';

const DEMOGRAPHICS = {
  gender: ['Female', 'Male', 'Prefer not to say'],
  household_income: ['£14,001 to £21,000', 'Up to £7,000', 'Prefer not to answer'],
  region: ['London', 'Scotland', 'Wales', 'North East'],
};

function renderBar(props = {}) {
  const handlers = { onOpen: jest.fn(), onEdit: jest.fn(), onClose: jest.fn(), onChange: jest.fn() };
  render(<FilterBar filters={{}} demographics={DEMOGRAPHICS} panel="" editingField={null} {...handlers} {...props} />);
  return handlers;
}

// chips
// each filter gets a chip; past two values it shows a +N count so chips stay short
test('shows a chip per active filter, shortening long value lists', () => {
  renderBar({ filters: { gender: ['Female'], region: ['London', 'Scotland', 'Wales', 'North East'] } });
  expect(screen.getByRole('button', { name: 'Gender: Female' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Region: London, Scotland +2' })).toBeInTheDocument();
});

// clicking a chip reopens the value picker for that field
test('clicking a chip edits that filter', () => {
  const { onEdit } = renderBar({ filters: { gender: ['Female'] } });
  userEvent.click(screen.getByRole('button', { name: 'Gender: Female' }));
  expect(onEdit).toHaveBeenCalledWith('gender');
});

// the chip's x removes that field and keeps the other filters
test('removing a chip drops only that filter', () => {
  const { onChange } = renderBar({ filters: { gender: ['Female'], region: ['London'] } });
  userEvent.click(screen.getByRole('button', { name: 'Remove Gender filter' }));
  expect(onChange).toHaveBeenCalledWith({ region: ['London'] });
});

// clear all removes every filter at once
test('clear all only shows with filters and empties them', () => {
  const { onChange } = renderBar({ filters: { gender: ['Female'] } });
  userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(onChange).toHaveBeenCalledWith({});
});

// clear all isn't offered when there is nothing to clear
test('clear all is hidden with no filters', () => {
  renderBar();
  expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
});

// add panel
// the add filter button asks the parent to open the field picker
test('add filter opens the field picker', () => {
  const { onOpen } = renderBar();
  userEvent.click(screen.getByRole('button', { name: /Add filter/ }));
  expect(onOpen).toHaveBeenCalled();
});

// the field picker offers every demographic by its friendly label, marks ones already filtered, and opens the chosen field
test('the field picker lists every demographic and marks active ones', () => {
  const { onEdit } = renderBar({ panel: 'add', filters: { region: ['London'] } });
  expect(screen.getByRole('button', { name: 'Region' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Organisation type' })).toHaveAttribute('aria-pressed', 'false');
  userEvent.click(screen.getByRole('button', { name: 'Household income' }));
  expect(onEdit).toHaveBeenCalledWith('household_income');
});

// value panel
// the value picker names the field in its title and lists income bands by amount, not alphabetically
test('the value picker lists values in display order', () => {
  renderBar({ panel: 'values', editingField: 'household_income' });
  expect(screen.getByText(/Only include respondents whose household income is/)).toBeInTheDocument();
  const values = screen.getAllByRole('button', { pressed: false }).map((b) => b.textContent);
  expect(values).toEqual(['Up to £7,000', '£14,001 to £21,000', 'Prefer not to answer']);
});

// picking a value adds it to the field's existing values
test('toggling a value adds it to the filter', () => {
  const { onChange } = renderBar({ panel: 'values', editingField: 'gender', filters: { gender: ['Female'] } });
  userEvent.click(screen.getByRole('button', { name: 'Male' }));
  expect(onChange).toHaveBeenCalledWith({ gender: ['Female', 'Male'] });
});

// unpicking a field's last value removes the field instead of leaving an empty filter that matches nobody
test('toggling off the last value removes the filter', () => {
  const { onChange } = renderBar({ panel: 'values', editingField: 'gender', filters: { gender: ['Female'], region: ['Wales'] } });
  userEvent.click(screen.getByRole('button', { name: 'Female' }));
  expect(onChange).toHaveBeenCalledWith({ region: ['Wales'] });
});

// select all fills in every value for the field, and done closes the picker
test('select all picks every value and done closes', () => {
  const { onChange, onClose } = renderBar({ panel: 'values', editingField: 'gender' });
  userEvent.click(screen.getByRole('button', { name: 'Select all' }));
  expect(onChange).toHaveBeenCalledWith({ gender: ['Female', 'Male', 'Prefer not to say'] });
  userEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalled();
});

// answer filters
const QUESTIONS = [
  { id: 5, code: 'eu', category: 'eu_referendum', text: 'How did you vote in the EU referendum in June 2016' },
  { id: 9, code: 'class', category: 'general_attitudes', text: 'I consider myself working class' },
];

// answer filters get a chip named after a shortened question, and the chip reopens that question's values
test('shows a chip per answer filter that edits by question id', () => {
  const { onEdit } = renderBar({ questions: QUESTIONS, answers: { 5: ['Leave'] } });
  userEvent.click(screen.getByRole('button', { name: 'How did you vote in the EU referendum i…: Leave' }));
  expect(onEdit).toHaveBeenCalledWith(5);
});

// removing an answer chip drops just that question, through the answers callback
test('removing an answer chip drops only that question', () => {
  const onAnswersChange = jest.fn();
  renderBar({ questions: QUESTIONS, answers: { 5: ['Leave'], 9: ['Agree strongly'] }, onAnswersChange });
  userEvent.click(screen.getByRole('button', { name: 'Remove I consider myself working class filter' }));
  expect(onAnswersChange).toHaveBeenCalledWith({ 5: ['Leave'] });
});

// clear all empties both kinds of filter
test('clear all also removes answer filters', () => {
  const onAnswersChange = jest.fn();
  const { onChange } = renderBar({ questions: QUESTIONS, answers: { 5: ['Leave'] }, onAnswersChange });
  userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(onChange).toHaveBeenCalledWith({});
  expect(onAnswersChange).toHaveBeenCalledWith({});
});

// the add panel lists questions too, searchable, and picking one edits it
test('the field picker lists questions to filter by', () => {
  const { onEdit } = renderBar({ panel: 'add', questions: QUESTIONS });
  userEvent.type(screen.getByRole('searchbox', { name: 'Search questions to filter by' }), 'class');
  expect(screen.queryByRole('button', { name: /EU referendum/ })).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'I consider myself working class' }));
  expect(onEdit).toHaveBeenCalledWith(9);
});

// the value picker shows a question's answers once loaded, and toggling one updates the answer filters
test('the value picker toggles answers to a question', () => {
  const onAnswersChange = jest.fn();
  renderBar({ panel: 'values', editingField: 5, questions: QUESTIONS, answerValues: ['Leave', 'Remain'], answers: { 5: ['Leave'] }, onAnswersChange });
  expect(screen.getByText(/Only include respondents who answered “How did you vote/)).toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'Remain' }));
  expect(onAnswersChange).toHaveBeenCalledWith({ 5: ['Leave', 'Remain'] });
});

// while a question's answers are loading the picker says so, and a failure is shown
test('the value picker shows loading and errors for question answers', () => {
  const { rerender } = render(
    <FilterBar filters={{}} demographics={DEMOGRAPHICS} questions={QUESTIONS} panel="values" editingField={5}
      onOpen={jest.fn()} onEdit={jest.fn()} onClose={jest.fn()} onChange={jest.fn()} />,
  );
  expect(screen.getByText('Loading answers…')).toBeInTheDocument();
  rerender(
    <FilterBar filters={{}} demographics={DEMOGRAPHICS} questions={QUESTIONS} panel="values" editingField={5} answerValues={new Error('500')}
      onOpen={jest.fn()} onEdit={jest.fn()} onClose={jest.fn()} onChange={jest.fn()} />,
  );
  expect(screen.getByText('Could not load answers: 500')).toBeInTheDocument();
});
