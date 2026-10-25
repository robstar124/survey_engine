import { buildTable, toCsv, toTsv } from '../../utils/crosstab';
import { sortDemographicValues } from '../../utils/survey';

const VOTE = {
  question: { id: 1, code: 'vote', category: 'voting_intention', text: 'Which party' },
  total: 6,
  counts: [{ value: 'Labour', count: 3 }, { value: 'Conservative', count: 2 }, { value: 'SNP', count: 1 }],
};

const ATTITUDE = {
  question: { id: 2, code: 'attitude', category: 'general_attitudes', text: 'Britain is great' },
  total: 10,
  counts: [
    { value: "Don't know", count: 4 },
    { value: 'Agree slightly', count: 3 },
    { value: 'Agree strongly', count: 2 },
    { value: 'Disagree strongly', count: 1 },
  ],
};

// buildTable
// sorting by total keeps the api's most-common-first order, and the total column gets each answer's share
test('buildTable keeps the api order when sorting by total', () => {
  const table = buildTable(VOTE, { sortByTotal: true });
  expect(table.columns).toEqual([{ label: 'Total', base: 6 }]);
  expect(table.rows.map((r) => r.label)).toEqual(['Labour', 'Conservative', 'SNP']);
  expect(table.rows[0].cells[0]).toMatchObject({ count: 3, base: 6, share: 0.5 });
});

// with sorting off, answers are listed alphabetically
test('buildTable sorts alphabetically when not sorting by total', () => {
  const table = buildTable(VOTE);
  expect(table.rows.map((r) => r.label)).toEqual(['Conservative', 'Labour', 'SNP']);
});

// scale answers ignore the sort and follow the scale (strongly agree to strongly disagree), with net rows adding up each end
test('buildTable puts scales in their natural order and adds nets', () => {
  const table = buildTable(ATTITUDE, { sortByTotal: true });
  expect(table.scale).toBe(true);
  expect(table.rows.map((r) => r.label)).toEqual([
    'Agree strongly', 'Agree slightly', 'Disagree strongly', "Don't know", 'Agree (net)', 'Disagree (net)',
  ]);
  expect(table.rows[4]).toMatchObject({ net: true, cells: [{ count: 5, share: 0.5 }] });
});

// each group becomes a column, income columns run in order of amount, Not asked comes last, and answers a group never gave count as 0
test('buildTable adds a column per group, ordering income bands and putting not asked last', () => {
  const results = {
    ...VOTE,
    group_by: 'household_income',
    groups: [
      { group: '£7,001 to £14,000', total: 2, counts: [{ value: 'Labour', count: 2 }] },
      { group: 'Up to £7,000', total: 3, counts: [{ value: 'Labour', count: 1 }, { value: 'SNP', count: 1 }, { value: 'Conservative', count: 1 }] },
      { group: null, total: 1, counts: [{ value: 'Conservative', count: 1 }] },
    ],
  };
  const table = buildTable(results, { sortByTotal: true });
  expect(table.columns.map((c) => c.label)).toEqual(['Total', 'Up to £7,000', '£7,001 to £14,000', 'Not asked']);
  expect(table.rows[0].cells.map((c) => c.count)).toEqual([3, 1, 2, 0]);
});

// columns from another question's answers follow that question's scale, whatever order the api sent them in
test('buildTable orders question columns by scale', () => {
  const results = {
    ...VOTE,
    group_by_question: 2,
    groups: [
      { group: 'Disagree slightly', total: 4, counts: [{ value: 'Labour', count: 4 }] },
      { group: 'Agree strongly', total: 1, counts: [{ value: 'SNP', count: 1 }] },
      { group: null, total: 1, counts: [{ value: 'Conservative', count: 1 }] },
    ],
  };
  expect(buildTable(results).columns.map((c) => c.label)).toEqual(['Total', 'Agree strongly', 'Disagree slightly', 'Not asked']);
});

// answers that aren't on a scale, like parties, put the biggest column first
test('buildTable puts the biggest question columns first when there is no scale', () => {
  const results = {
    ...ATTITUDE,
    group_by_question: 1,
    groups: [
      { group: 'Conservative', total: 3, counts: [{ value: "Don't know", count: 3 }] },
      { group: 'Labour', total: 7, counts: [{ value: "Don't know", count: 1 }] },
    ],
  };
  expect(buildTable(results).columns.map((c) => c.label)).toEqual(['Total', 'Labour', 'Conservative']);
});

// a column with no respondents has a null share instead of dividing by zero
test('buildTable gives an empty column no share', () => {
  const results = { ...VOTE, group_by: 'gender', groups: [{ group: 'Male', total: 0, counts: [] }] };
  expect(buildTable(results).rows[0].cells[1].share).toBeNull();
});

// sortDemographicValues
// Up to £7,000 comes first and answers with no amount, like Prefer not to answer, come last
test('sortDemographicValues orders income by amount with refusals last', () => {
  expect(sortDemographicValues('household_income', ['£83,001 or more', 'Prefer not to answer', '£14,001 to £21,000', 'Up to £7,000']))
    .toEqual(['Up to £7,000', '£14,001 to £21,000', '£83,001 or more', 'Prefer not to answer']);
});

// export
// copied tables have the headers and base row, then each answer as a one-decimal percentage or a count
test('toTsv writes the base row and percentages or counts', () => {
  const table = buildTable(VOTE, { sortByTotal: true });
  expect(toTsv(table, 'Which party', 'percent').split('\n')).toEqual([
    'Which party\tTotal', 'Base (n)\t6', 'Labour\t50.0%', 'Conservative\t33.3%', 'SNP\t16.7%',
  ]);
  expect(toTsv(table, 'Which party', 'counts').split('\n')[2]).toBe('Labour\t3');
});

// csv export quotes every field so labels with commas don't split into extra columns
test('toCsv quotes fields', () => {
  const table = buildTable(VOTE, { sortByTotal: true });
  expect(toCsv(table, 'Industry, innovation', 'counts').split('\n')[0]).toBe('"Industry, innovation","Total"');
});
