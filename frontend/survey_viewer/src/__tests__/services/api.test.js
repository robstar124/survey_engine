import { countRespondents, fetchAnswerValues, fetchResults, fromAnswerParams, toAnswerParams, toQuery } from '../../services/api';

function respondWith(body, { ok = true, status = 200, statusText = 'OK' } = {}) {
  global.fetch = jest.fn(() => Promise.resolve({ ok, status, statusText, json: () => Promise.resolve(body) }));
}

// toQuery
// no params means no ? on the url
test('toQuery returns an empty string with no params', () => {
  expect(toQuery({})).toBe('');
});

// array values repeat the key, which is how the api reads multi-value filters
test('toQuery repeats a key for each array value', () => {
  expect(toQuery({ region: ['London', 'Wales'], limit: 1 })).toBe('?region=London&region=Wales&limit=1');
});

// empty values are dropped so they don't become filters, but 0 is kept
test('toQuery skips empty, null and undefined values', () => {
  expect(toQuery({ a: null, b: undefined, c: '', d: [], e: 0 })).toBe('?e=0');
});

// £, commas and spaces in values like income bands are encoded safely
test('toQuery encodes special characters', () => {
  expect(toQuery({ household_income: '£7,001 to £14,000' })).toBe('?household_income=%C2%A37%2C001+to+%C2%A314%2C000');
});

// answer params
// each answer filter value becomes its own <question id>:<value> param
test('toAnswerParams flattens answer filters', () => {
  expect(toAnswerParams({ 5: ['Leave'], 31: ['Agree strongly', 'Agree slightly'] })).toEqual(['5:Leave', '31:Agree strongly', '31:Agree slightly']);
});

// reading them back splits on the first colon only, and drops anything malformed
test('fromAnswerParams reads answer params back, skipping bad ones', () => {
  expect(fromAnswerParams(['5:Leave', '5:Ratio: 1:2', 'Leave', 'x:Yes', '7:'])).toEqual({ 5: ['Leave', 'Ratio: 1:2'] });
});

// requests
// results requests carry the filters and the breakdown
test('fetchResults sends filters and group_by', async () => {
  respondWith({ total: 0 });
  await fetchResults(3, 'gender', { region: ['London'] });
  expect(global.fetch).toHaveBeenCalledWith('/questions/3/results?region=London&group_by=gender');
});

// a numeric breakdown is a question id, sent as group_by_question
test('fetchResults sends a question breakdown as group_by_question', async () => {
  respondWith({ total: 0 });
  await fetchResults(3, 7, { answer: ['5:Leave'] });
  expect(global.fetch).toHaveBeenCalledWith('/questions/3/results?answer=5%3ALeave&group_by_question=7');
});

// answer options come from the unfiltered results, in scale order
test('fetchAnswerValues lists every answer in display order', async () => {
  respondWith({ total: 3, counts: [{ value: 'No', count: 2 }, { value: 'Yes', count: 1 }] });
  expect(await fetchAnswerValues(4)).toEqual(['Yes', 'No']);
  expect(global.fetch).toHaveBeenCalledWith('/questions/4/results');
});

// total only sends no group_by at all, rather than group_by=null
test('fetchResults leaves out group_by for total only', async () => {
  respondWith({ total: 0 });
  await fetchResults(3, null, {});
  expect(global.fetch).toHaveBeenCalledWith('/questions/3/results');
});

// counting respondents fetches a single row and reads the total, instead of downloading every respondent
test('countRespondents asks for one row and returns the total', async () => {
  respondWith({ total: 783, limit: 1, offset: 0, items: [] });
  await expect(countRespondents({ gender: ['Female'] })).resolves.toBe(783);
  expect(global.fetch).toHaveBeenCalledWith('/respondents?gender=Female&limit=1');
});

// a non-2xx response throws with the status and path, so the error message on screen says what failed
test('a failed response rejects with the status and path', async () => {
  respondWith({ detail: 'not found' }, { ok: false, status: 404, statusText: 'Not Found' });
  await expect(fetchResults(999, null, {})).rejects.toThrow('404 Not Found from /questions/999/results');
});
