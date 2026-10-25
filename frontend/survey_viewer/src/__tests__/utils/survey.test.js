import { findScale, groupBySection, groupLabel, sectionOf, shorten, sortAnswerValues, sortDemographicValues } from '../../utils/survey';

// sectionOf
// api categories map to the sidebar's sections, several categories per section
test('sectionOf maps categories to sidebar sections', () => {
  expect(sectionOf('voting_intention')).toBe('Politics');
  expect(sectionOf('goal_importance')).toBe('Attitudes');
  expect(sectionOf('statements')).toBe('Statements');
});

// a category the frontend doesn't know about still appears, under Other, instead of vanishing
test('sectionOf puts unknown categories under Other', () => {
  expect(sectionOf('favourite_colour')).toBe('Other');
});

// findScale
// a question matches a scale even if nobody picked some of its answers
test('findScale matches a partial set of scale answers', () => {
  expect(findScale(['Agree slightly', "Don't know"]).values[0]).toBe('Agree strongly');
  expect(findScale(['Some', 'None at all']).values[0]).toBe('A great deal');
});

// one answer that isn't on a scale means the question isn't treated as that scale
test('findScale returns null when any answer is off the scale', () => {
  expect(findScale(['Agree slightly', 'Labour'])).toBeNull();
});

// Yes/No keeps Yes first but gets no net rows
test('findScale treats yes/no as a scale with no nets', () => {
  expect(findScale(['No', 'Yes']).nets).toEqual([]);
});

// groupLabel
// a null group (work_sector for non public sector workers) is labelled Not asked, other groups keep their value
test('groupLabel names missing groups', () => {
  expect(groupLabel(null)).toBe('Not asked');
  expect(groupLabel('Male')).toBe('Male');
});

// sortDemographicValues
// only income gets special ordering, and sorting returns a copy instead of changing the caller's array
test('sortDemographicValues leaves non-income fields in the given order without mutating', () => {
  const values = ['Wales', 'London'];
  expect(sortDemographicValues('region', values)).toEqual(['Wales', 'London']);
  sortDemographicValues('household_income', values);
  expect(values).toEqual(['Wales', 'London']);
});

// income bands sort by amount, so £7,001 comes before £14,001, which alphabetical order gets wrong
test('sortDemographicValues orders every income band numerically', () => {
  const bands = ['£83,001 or more', '£7,001 to £14,000', 'Up to £7,000', '£76,001 to £83,000', '£14,001 to £21,000'];
  expect(sortDemographicValues('household_income', bands)).toEqual([
    'Up to £7,000', '£7,001 to £14,000', '£14,001 to £21,000', '£76,001 to £83,000', '£83,001 or more',
  ]);
});

// sortAnswerValues
// answers on a scale come out in scale order, others are left alone
test('sortAnswerValues uses the scale order when there is one', () => {
  expect(sortAnswerValues(['No', 'Yes'])).toEqual(['Yes', 'No']);
  expect(sortAnswerValues(['Labour', 'Conservative'])).toEqual(['Labour', 'Conservative']);
});

// groupBySection
// questions are searched by text and grouped into their sections, dropping empty ones
test('groupBySection filters by search and drops empty sections', () => {
  const questions = [
    { id: 1, category: 'voting_intention', text: 'Which party' },
    { id: 2, category: 'statements', text: 'I own more than one property' },
  ];
  expect(groupBySection(questions).map((s) => s.label)).toEqual(['Politics', 'Statements']);
  expect(groupBySection(questions, ' PROPERTY ')).toEqual([{ label: 'Statements', items: [questions[1]] }]);
});

// shorten
// long text is cut to the length with an ellipsis, short text is untouched
test('shorten cuts long text', () => {
  expect(shorten('abcdef', 4)).toBe('abc…');
  expect(shorten('abc', 4)).toBe('abc');
});
