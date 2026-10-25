// labels and ordering for the survey's questions and demographic fields

export const DEMOGRAPHICS = {
  gender: 'Gender',
  age_band: 'Age band',
  working_status: 'Working status',
  region: 'Region',
  household_income: 'Household income',
  work_organisation: 'Organisation type',
  work_sector: 'Public sector area',
};

// sidebar sections, each made of one or more question categories from the api
export const SECTIONS = [
  { label: 'Politics', categories: ['voting_intention', 'eu_referendum', 'political_interest'] },
  { label: 'Attitudes', categories: ['general_attitudes', 'goal_importance'] },
  { label: 'Statements', categories: ['statements'] },
];

export function sectionOf(category) {
  return SECTIONS.find((section) => section.categories.includes(category))?.label ?? 'Other';
}

// questions whose text contains the search, split into their sections, leaving out empty sections
export function groupBySection(questions, search = '') {
  const query = search.trim().toLowerCase();
  const matching = questions.filter((q) => !query || q.text.toLowerCase().includes(query));
  return [...SECTIONS.map((s) => s.label), 'Other']
    .map((label) => ({ label, items: matching.filter((q) => sectionOf(q.category) === label) }))
    .filter((section) => section.items.length);
}

// cut long question text down for chips and buttons
export function shorten(text, length = 40) {
  return text.length > length ? text.slice(0, length - 1).trimEnd() + '…' : text;
}

// answer scales in their natural order, with nets that add up their ends
export const SCALES = [
  {
    values: ['Agree strongly', 'Agree slightly', 'Neither agree nor disagree', 'Disagree slightly', 'Disagree strongly', "Don't know"],
    nets: [
      { label: 'Agree (net)', of: ['Agree strongly', 'Agree slightly'] },
      { label: 'Disagree (net)', of: ['Disagree slightly', 'Disagree strongly'] },
    ],
  },
  {
    values: ['A great deal', 'Quite a lot', 'Some', 'Not very much', 'None at all'],
    nets: [
      { label: 'Interested (net)', of: ['A great deal', 'Quite a lot'] },
      { label: 'Not interested (net)', of: ['Not very much', 'None at all'] },
    ],
  },
  { values: ['Yes', 'No'], nets: [] },
];

// the scale every one of these answers belongs to, or null
export function findScale(values) {
  return SCALES.find((scale) => values.every((value) => scale.values.includes(value))) ?? null;
}

// answers in their scale's order, or left as given when they aren't on a scale
export function sortAnswerValues(values) {
  const scale = findScale(values);
  return scale ? scale.values.filter((value) => values.includes(value)) : values;
}

// a missing group is someone who wasn't asked: work_sector is only asked of public sector workers,
// and when columns are another question's answers it's anyone who wasn't asked it or left it blank
export function groupLabel(group) {
  return group ?? 'Not asked';
}

// income bands sort by their lower bound, with "Up to" first and refusals last
function incomeRank(value) {
  if (value.startsWith('Up to')) return 0;
  const amount = value.match(/£([\d,]+)/);
  return amount ? Number(amount[1].replaceAll(',', '')) : Infinity;
}

// order demographic values for display; alphabetical works for everything but income
export function sortDemographicValues(field, values) {
  const sorted = [...values];
  if (field === 'household_income') sorted.sort((a, b) => incomeRank(a) - incomeRank(b));
  return sorted;
}
