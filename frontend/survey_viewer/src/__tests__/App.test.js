import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const QUESTIONS = [
  { id: 1, code: 'vote', category: 'voting_intention', text: 'Which party would you vote for' },
  { id: 2, code: 'class', category: 'general_attitudes', text: 'I consider myself working class' },
];

const DEMOGRAPHICS = { gender: ['Female', 'Male'], age_band: ['18-24', '65+'], region: ['London'] };

const VOTE_RESULTS = {
  question: QUESTIONS[0],
  total: 3,
  counts: [{ value: 'Labour', count: 2 }, { value: 'Conservative', count: 1 }],
  group_by: 'age_band',
  groups: [
    { group: '18-24', total: 2, counts: [{ value: 'Labour', count: 2 }] },
    { group: '65+', total: 1, counts: [{ value: 'Conservative', count: 1 }] },
  ],
};

const CLASS_RESULTS = {
  question: QUESTIONS[1],
  total: 2,
  counts: [{ value: 'Agree strongly', count: 1 }, { value: 'Disagree slightly', count: 1 }],
};

const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

// answer each api path with canned json; results can be overridden per question id
function mockApi({ results = {}, matching = 3 } = {}) {
  global.fetch = jest.fn((url) => {
    const path = url.split('?')[0];
    if (path === '/questions') return ok(QUESTIONS);
    if (path === '/respondents/demographics') return ok(DEMOGRAPHICS);
    if (path === '/respondents') return ok({ total: url.includes('gender') ? matching : 3, limit: 1, offset: 0, items: [] });
    const id = Number(path.match(/\/questions\/(\d+)\/results/)[1]);
    if (id in results) return results[id];
    return ok(id === 2 ? CLASS_RESULTS : VOTE_RESULTS);
  });
}

function requestedResults() {
  return global.fetch.mock.calls.map(([url]) => url).filter((url) => url.includes('/results'));
}

function rowValues(table, label) {
  const row = within(table).getByRole('rowheader', { name: label }).parentElement;
  return within(row).getAllByRole('cell').map((cell) => cell.textContent);
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  mockApi();
});

// loading
// with nothing in the url the app opens on voting intention by age band, and saves that view in the url
test('opens on voting intention broken down by age band', async () => {
  render(<App />);
  const table = await screen.findByRole('table', { name: 'Which party would you vote for by Age band' });
  expect(within(table).getByRole('columnheader', { name: '18-24 *' })).toBeInTheDocument();
  expect(rowValues(table, 'Labour')).toEqual(['67%', '100%', '0%']);
  expect(requestedResults()[0]).toBe('/questions/1/results?group_by=age_band');
  expect(window.location.search).toBe('?q=1&by=age_band');
});

// the header shows how many respondents there are, and the base line says how many answered
test('shows the respondent total and base line', async () => {
  render(<App />);
  await screen.findByRole('table');
  expect(screen.getByText('3 respondents')).toBeInTheDocument();
  expect(screen.getByText(/all 3 respondents; 3 answered this question/)).toBeInTheDocument();
});

// something is shown while the first requests are still pending
test('shows a loading message before the survey arrives', () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  render(<App />);
  expect(screen.getByText('Loading survey…')).toBeInTheDocument();
});

// if the api can't be reached the app says so instead of staying on loading
test('shows an error when the api is down', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('Failed to fetch')));
  render(<App />);
  expect(await screen.findByText(/Could not reach the survey API: Failed to fetch/)).toBeInTheDocument();
});

// a failed results request shows the error and no stale table
test('shows an error when results fail to load', async () => {
  mockApi({ results: { 1: Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' }) } });
  render(<App />);
  expect(await screen.findByText(/Could not load results: 500 Internal Server Error/)).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

// url state
// a shared link restores the question, breakdown (none here) and filters it was copied with
test('reopens the view saved in the url', async () => {
  window.history.replaceState(null, '', '/?q=2&by=none&region=London');
  render(<App />);
  await screen.findByRole('table', { name: 'I consider myself working class' });
  expect(requestedResults()[0]).toBe('/questions/2/results?region=London');
  expect(screen.getByRole('button', { name: 'Region: London' })).toBeInTheDocument();
});

// an old or edited link with a bad question id or breakdown falls back to the defaults without requesting the bad id
test('ignores an unknown question or breakdown in the url', async () => {
  window.history.replaceState(null, '', '/?q=999&by=shoe_size');
  render(<App />);
  await screen.findByRole('table');
  expect(requestedResults()).toEqual(['/questions/1/results?group_by=age_band']);
});

// changing the table
// changing the question and adding a filter request new results, show a chip and update the url
test('picking a question and a filter refetches with the filter', async () => {
  render(<App />);
  await screen.findByRole('table');

  userEvent.click(screen.getByRole('button', { name: 'I consider myself working class' }));
  userEvent.click(screen.getByRole('button', { name: /Add filter/ }));
  userEvent.click(screen.getByRole('button', { name: 'Gender' }));
  userEvent.click(screen.getByRole('button', { name: 'Female' }));

  await waitFor(() => expect(requestedResults()).toContain('/questions/2/results?gender=Female&group_by=age_band'));
  expect(screen.getByRole('button', { name: 'Remove Gender filter' })).toBeInTheDocument();
  expect(window.location.search).toBe('?q=2&by=age_band&gender=Female');
});

// filtering by an answer: pick a question in the add panel, load its answers, pick one, and it's sent and saved in the url
test('filtering by an answer to another question', async () => {
  render(<App />);
  await screen.findByRole('table');

  userEvent.click(screen.getByRole('button', { name: /Add filter/ }));
  userEvent.click(within(screen.getByText('Filter respondents by').closest('.panel')).getByRole('button', { name: 'I consider myself working class' }));
  userEvent.click(await screen.findByRole('button', { name: 'Agree strongly' }));

  await waitFor(() => expect(requestedResults()).toContain('/questions/1/results?answer=2%3AAgree+strongly&group_by=age_band'));
  expect(requestedResults()).toContain('/questions/2/results');
  expect(screen.getByRole('button', { name: 'Remove I consider myself working class filter' })).toBeInTheDocument();
  expect(window.location.search).toBe('?q=1&by=age_band&answer=2%3AAgree+strongly');
});

// a shared link with answer filters and a question breakdown reopens them, dropping filters on questions that don't exist
test('reopens answer filters and a question breakdown from the url', async () => {
  window.history.replaceState(null, '', '/?q=1&by=q2&answer=2:Agree+strongly&answer=999:Yes');
  render(<App />);
  await screen.findByRole('table', { name: 'Which party would you vote for by I consider myself working class' });
  expect(requestedResults()).toEqual(['/questions/1/results?answer=2%3AAgree+strongly&group_by_question=2']);
  expect(screen.getByRole('button', { name: 'I consider myself working class: Agree strongly' })).toBeInTheDocument();
});

// a breakdown by a question that no longer exists falls back to the default
test('ignores an unknown question breakdown in the url', async () => {
  window.history.replaceState(null, '', '/?q=1&by=q999');
  render(<App />);
  await screen.findByRole('table');
  expect(requestedResults()).toEqual(['/questions/1/results?group_by=age_band']);
});

// with filters on, the base line says how many of all respondents match them
test('the base line counts respondents matching the filters', async () => {
  mockApi({ matching: 2 });
  window.history.replaceState(null, '', '/?q=1&gender=Female');
  render(<App />);
  expect(await screen.findByText(/2 of 3 respondents match the filters; 3 answered this question/)).toBeInTheDocument();
});

// choosing total only refetches without a breakdown, closes the picker and saves by=none in the url
test('switching columns to total only drops group_by', async () => {
  render(<App />);
  await screen.findByRole('table');

  userEvent.click(screen.getByRole('button', { name: /Age band/ }));
  userEvent.click(screen.getByRole('button', { name: 'Total only' }));

  await waitFor(() => expect(requestedResults()).toContain('/questions/1/results'));
  expect(screen.queryByRole('button', { name: 'Break the table down by' })).not.toBeInTheDocument();
  expect(window.location.search).toBe('?q=1&by=none');
});

// choosing another breakdown refetches results grouped by it
test('switching columns to another demographic refetches', async () => {
  render(<App />);
  await screen.findByRole('table');
  userEvent.click(screen.getByRole('button', { name: /Age band/ }));
  userEvent.click(screen.getByRole('button', { name: 'Region' }));
  await waitFor(() => expect(requestedResults()).toContain('/questions/1/results?group_by=region'));
});

// the columns panel offers other questions (not the one being viewed) and picking one breaks the table down by its answers
test('switching columns to another question refetches with group_by_question', async () => {
  render(<App />);
  await screen.findByRole('table');
  userEvent.click(screen.getByRole('button', { name: /Age band/ }));
  const panel = screen.getByText('Break the table down by').closest('.panel');
  expect(within(panel).queryByRole('button', { name: 'Which party would you vote for' })).not.toBeInTheDocument();
  userEvent.click(within(panel).getByRole('button', { name: 'I consider myself working class' }));
  await waitFor(() => expect(requestedResults()).toContain('/questions/1/results?group_by_question=2'));
  expect(window.location.search).toBe('?q=1&by=q2');
});

// if the user switches question before the old results arrive, the late response is thrown away
test('a slow response for an old question does not replace a newer one', async () => {
  let resolveOld;
  mockApi({ results: { 1: new Promise((resolve) => { resolveOld = resolve; }) } });
  render(<App />);
  await screen.findByRole('button', { name: 'I consider myself working class' });

  userEvent.click(screen.getByRole('button', { name: 'I consider myself working class' }));
  const table = await screen.findByRole('table');
  expect(within(table).getByRole('rowheader', { name: 'Agree strongly' })).toBeInTheDocument();

  await act(async () => resolveOld({ ok: true, json: () => Promise.resolve(VOTE_RESULTS) }));
  expect(within(screen.getByRole('table')).queryByRole('rowheader', { name: 'Labour' })).not.toBeInTheDocument();
});

// when nobody matches, the app explains why instead of drawing an empty table
test('shows a message when no respondents answered', async () => {
  mockApi({ results: { 1: ok({ ...VOTE_RESULTS, total: 0, counts: [], groups: [] }) } });
  render(<App />);
  expect(await screen.findByText('No respondents match these filters. Remove a filter to see results.')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

// view options
// the counts toggle switches the table to counts and marks itself as pressed
test('counts mode shows raw counts', async () => {
  render(<App />);
  const table = await screen.findByRole('table');
  userEvent.click(screen.getByRole('button', { name: 'Counts' }));
  expect(rowValues(table, 'Labour')).toEqual(['2', '2', '0']);
  expect(screen.getByRole('button', { name: 'Counts' })).toHaveAttribute('aria-pressed', 'true');
});

// the sort toggle flips answers between most-common-first and alphabetical
test('sort by total switches between count and alphabetical order', async () => {
  render(<App />);
  await screen.findByRole('table');
  const labels = () => within(screen.getByRole('table')).getAllByRole('rowheader').slice(1).map((r) => r.textContent);
  expect(labels()).toEqual(['Labour', 'Conservative']);
  userEvent.click(screen.getByRole('button', { name: 'Sort by total' }));
  expect(labels()).toEqual(['Conservative', 'Labour']);
});

// scale questions can't be re-sorted, and show net rows plus a note explaining them
test('scale questions hide sort by total and show nets', async () => {
  window.history.replaceState(null, '', '/?q=2&by=none');
  render(<App />);
  const table = await screen.findByRole('table');
  expect(screen.queryByRole('button', { name: 'Sort by total' })).not.toBeInTheDocument();
  expect(rowValues(table, 'Agree (net)')).toEqual(['50%']);
  expect(screen.getByText(/nets add up the options they name/)).toBeInTheDocument();
});


// sharing
describe('sharing', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn(() => Promise.resolve()) } });
  });

  // copy table puts the table on the clipboard in a form Excel pastes into columns, and shows a confirmation
  test('copy table puts tab-separated text on the clipboard and confirms', async () => {
    render(<App />);
    await screen.findByRole('table');
    userEvent.click(screen.getByRole('button', { name: 'Copy table' }));
    expect(navigator.clipboard.writeText.mock.calls[0][0].split('\n')[0]).toBe('Which party would you vote for\tTotal\t18-24\t65+');
    expect(await screen.findByRole('status')).toHaveTextContent('Table copied');
  });

  // copy link copies the url that reopens this exact table, and confirms
  test('copy link copies the current url', async () => {
    render(<App />);
    await screen.findByRole('table');
    userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost/?q=1&by=age_band');
    expect(await screen.findByRole('status')).toHaveTextContent('Link copied');
  });

  // if the browser refuses clipboard access the user is told, rather than seeing a false success
  test('a blocked clipboard says so', async () => {
    navigator.clipboard.writeText = jest.fn(() => Promise.reject(new Error('denied')));
    render(<App />);
    await screen.findByRole('table');
    userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your browser blocked the clipboard.');
  });

  // export downloads a csv file named after the question and breakdown, and frees the blob url afterwards
  test('export downloads a csv named after the question and breakdown', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:csv');
    URL.revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('crosstab_which_party_would_you_vote_for_by_age_band.csv');
      expect(this.href).toBe('blob:csv');
    });
    render(<App />);
    await screen.findByRole('table');
    userEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    expect(click).toHaveBeenCalled();
    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('text/csv');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:csv');
    click.mockRestore();
  });
});
