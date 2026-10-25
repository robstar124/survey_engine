import { findScale, groupLabel, sortAnswerValues, sortDemographicValues } from './survey';

// bases under this are flagged as low
export const MIN_BASE = 50;
function countsByValue(counts) {
  return Object.fromEntries(counts.map(({ value, count }) => [value, count]));
}

// the order to show group columns in: demographics their own way, another question's answers on their scale or biggest first
function groupOrder(results, groups) {
  const named = groups.filter((g) => g.group !== null);
  if (results.group_by) return sortDemographicValues(results.group_by, named.map((g) => g.group));
  return sortAnswerValues([...named].sort((a, b) => b.total - a.total).map((g) => g.group));
}

// turn a /results response into table columns (Total first) and rows of cells
export function buildTable(results, { sortByTotal = false } = {}) {
  const groups = [...(results.groups ?? [])];
  if (groups.length) {
    const order = groupOrder(results, groups);
    groups.sort((a, b) => (a.group === null) - (b.group === null) || order.indexOf(a.group) - order.indexOf(b.group));
  }

  const columns = [{ label: 'Total', base: results.total }, ...groups.map((g) => ({ label: groupLabel(g.group), base: g.total }))];
  const columnCounts = [countsByValue(results.counts), ...groups.map((g) => countsByValue(g.counts))];
  const countsFor = (values) => columnCounts.map((counts) => values.reduce((sum, value) => sum + (counts[value] ?? 0), 0));

  const values = results.counts.map((c) => c.value);
  const scale = findScale(values);
  let ordered;
  if (scale) ordered = sortAnswerValues(values);
  else if (sortByTotal) ordered = values;
  else ordered = [...values].sort((a, b) => a.localeCompare(b));

  const rows = ordered.map((value) => ({ label: value, net: false, counts: countsFor([value]) }));
  (scale?.nets ?? []).forEach((net) => rows.push({ label: net.label, net: true, counts: countsFor(net.of) }));

  return {
    columns,
    scale: scale !== null,
    rows: rows.map((row) => ({
      label: row.label,
      net: row.net,
      cells: row.counts.map((count, i) => {
        const base = columns[i].base;
        return { count, base, share: base ? count / base : null };
      }),
    })),
  };
}

export function formatPercent(share) {
  return Math.round(share * 100) + '%';
}

export function formatNumber(n) {
  return n.toLocaleString('en-GB');
}

// tab-separated text that pastes straight into a spreadsheet
export function toTsv(table, title, mode) {
  const lines = [
    [title, ...table.columns.map((c) => c.label)],
    ['Base (n)', ...table.columns.map((c) => String(c.base))],
    ...table.rows.map((row) => [
      row.label,
      ...row.cells.map((cell) => {
        if (cell.share === null) return '';
        return mode === 'counts' ? String(cell.count) : (cell.share * 100).toFixed(1) + '%';
      }),
    ]),
  ];
  return lines.map((line) => line.join('\t')).join('\n');
}

// the same table as csv, quoting every field so commas in labels are safe
export function toCsv(table, title, mode) {
  return toTsv(table, title, mode)
    .split('\n')
    .map((line) => line.split('\t').map((field) => '"' + field.replaceAll('"', '""') + '"').join(','))
    .join('\n');
}
