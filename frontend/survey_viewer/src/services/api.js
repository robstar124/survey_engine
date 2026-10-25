import { sortAnswerValues } from '../utils/survey';

// empty by default so requests go through the dev server proxy set in package.json
const API_URL = process.env.REACT_APP_API_URL ?? '';

// build a query string, repeating a key once per value when it holds an array
export function toQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    [].concat(value).forEach((item) => {
      if (item !== undefined && item !== null && item !== '') search.append(key, item);
    });
  });
  const text = search.toString();
  return text ? '?' + text : '';
}

// answer filters, held as {question id: [values]}, go to the api as repeated <question id>:<value> params
export function toAnswerParams(answers) {
  return Object.entries(answers).flatMap(([id, values]) => values.map((value) => `${id}:${value}`));
}

// the reverse of toAnswerParams, skipping anything malformed
export function fromAnswerParams(params) {
  const answers = {};
  params.forEach((param) => {
    const [, id, value] = param.match(/^(\d+):(.+)$/s) ?? [];
    if (id) answers[id] = [...(answers[id] ?? []), value];
  });
  return answers;
}

async function get(path, params = {}) {
  const response = await fetch(API_URL + path + toQuery(params));
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${path}`);
  return response.json();
}

export const fetchQuestions = () => get('/questions');

export const fetchDemographics = () => get('/respondents/demographics');

// groupBy is a demographic field name, or a question id to break down by that question's answers
export const fetchResults = (questionId, groupBy, filters) =>
  get(`/questions/${questionId}/results`, {
    ...filters,
    [typeof groupBy === 'number' ? 'group_by_question' : 'group_by']: groupBy,
  });

// every answer anyone gave to a question, in display order, for building answer filter options
export const fetchAnswerValues = (questionId) =>
  fetchResults(questionId, null, {}).then((results) => sortAnswerValues(results.counts.map((c) => c.value)));

// how many respondents match the filters, without fetching them all
export const countRespondents = (filters) => get('/respondents', { ...filters, limit: 1 }).then((page) => page.total);
