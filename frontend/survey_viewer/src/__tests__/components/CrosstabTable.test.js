import { render, screen, within } from '@testing-library/react';
import CrosstabTable from '../../components/CrosstabTable';

// a table with a total column, one big group and one low-base group
const TABLE = {
  scale: false,
  columns: [{ label: 'Total', base: 200 }, { label: 'Female', base: 160 }, { label: 'Other', base: 40 }],
  rows: [
    {
      label: 'Labour',
      net: false,
      cells: [
        { count: 100, base: 200, share: 0.5, significance: null },
        { count: 96, base: 160, share: 0.6, significance: 'higher' },
        { count: 4, base: 40, share: 0.1, significance: 'lower' },
      ],
    },
    {
      label: 'Agree (net)',
      net: true,
      cells: [
        { count: 0, base: 200, share: 0, significance: null },
        { count: 0, base: 160, share: 0, significance: null },
        { count: 0, base: 0, share: null, significance: null },
      ],
    },
  ],
};

function renderTable(props = {}) {
  render(<CrosstabTable table={TABLE} title="Which party" columnTitle="Gender" mode="percent" {...props} />);
  return screen.getByRole('table');
}

function cellsOf(table, label) {
  const row = within(table).getByRole('rowheader', { name: label }).parentElement;
  return within(row).getAllByRole('cell');
}

// screen readers announce what the table shows, and the breakdown name sits above its columns
test('labels the table with the question and breakdown', () => {
  renderTable();
  expect(screen.getByRole('table', { name: 'Which party by Gender' })).toBeInTheDocument();
  expect(screen.getByText('Gender')).toBeInTheDocument();
});

// without a breakdown there is no spanning heading and the label is just the question
test('a total-only table has no breakdown heading', () => {
  renderTable({ columnTitle: null });
  expect(screen.getByRole('table', { name: 'Which party' })).toBeInTheDocument();
});

// columns under 50 respondents get a * and the low style in both the header and base row, and bigger ones don't
test('flags low bases in the header and base row', () => {
  const table = renderTable();
  expect(within(table).getByRole('columnheader', { name: 'Other *' })).toHaveClass('low');
  expect(within(table).getByRole('columnheader', { name: 'Female' })).not.toHaveClass('low');
  expect(cellsOf(table, 'Base (n)').map((c) => c.textContent)).toEqual(['200', '160', '40*']);
});

// percent mode rounds shares to whole percentages and puts ▲/▼ after significant cells, with a tooltip saying what they mean
test('shows percentages with significance marks', () => {
  const table = renderTable();
  const cells = cellsOf(table, 'Labour');
  expect(cells.map((c) => c.textContent)).toEqual(['50%', '60%▲', '10%▼']);
  expect(within(cells[1]).getByTitle('Significantly higher than the rest of the sample')).toBeInTheDocument();
  expect(cells[2]).toHaveClass('low');
});

// counts mode shows raw counts while keeping the significance marks
test('shows counts in counts mode', () => {
  const table = renderTable({ mode: 'counts' });
  expect(cellsOf(table, 'Labour').map((c) => c.textContent)).toEqual(['100', '96▲', '4▼']);
});

// both mode puts the count under the percentage
test('shows both percentage and count in both mode', () => {
  const table = renderTable({ mode: 'both' });
  expect(cellsOf(table, 'Labour')[0].textContent).toBe('50%n=100');
});

// an empty column shows – instead of 0% or NaN%
test('shows a dash where a column has no respondents', () => {
  const table = renderTable();
  expect(cellsOf(table, 'Agree (net)')[2].textContent).toBe('–');
});

// net rows get their own style so they read as subtotals, not answers
test('styles net rows', () => {
  const table = renderTable();
  expect(within(table).getByRole('rowheader', { name: 'Agree (net)' })).toHaveClass('net');
});

