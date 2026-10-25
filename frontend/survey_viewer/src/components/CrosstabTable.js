import { MIN_BASE, formatNumber, formatPercent } from '../utils/crosstab';

const LABEL_COLUMN_WIDTH = 240;
const NARROW_COLUMN_WIDTH = 92;
const WIDE_COLUMN_WIDTH = 120;
const LONG_LABEL_LENGTH = 24;

// join the truthy class names, e.g. classNames('cell', isTotal && 'total')
function classNames(...names) {
  return names.filter(Boolean).join(' ');
}

function isLowBase(base) {
  return base < MIN_BASE;
}

function gridStyleFor(columns) {
  const hasLongLabel = columns.some((column) => column.label.length > LONG_LABEL_LENGTH);
  const columnWidth = hasLongLabel ? WIDE_COLUMN_WIDTH : NARROW_COLUMN_WIDTH;
  return {
    gridTemplateColumns: `minmax(${LABEL_COLUMN_WIDTH}px, 2.4fr) repeat(${columns.length}, minmax(${columnWidth}px, 1fr))`,
    minWidth: LABEL_COLUMN_WIDTH + columns.length * columnWidth,
  };
}

function SignificanceMark({ significance }) {
  if (significance === 'higher') {
    return <span className="mark up" title="Significantly higher than the rest of the sample">▲</span>;
  }
  if (significance === 'lower') {
    return <span className="mark down" title="Significantly lower than the rest of the sample">▼</span>;
  }
  return null;
}

function Cell({ cell, mode, isTotal, isNet }) {
  const hasValue = cell.share !== null;
  const className = classNames('cell', isTotal && 'total', isNet && 'net', isLowBase(cell.base) && 'low');

  if (!hasValue) {
    return <div role="cell" className={className}>–</div>;
  }

  return (
    <div role="cell" className={className}>
      <div>
        {mode === 'counts' ? formatNumber(cell.count) : formatPercent(cell.share)}
        <SignificanceMark significance={cell.significance} />
      </div>
      {mode === 'both' && <div className="cell-sub">n={formatNumber(cell.count)}</div>}
    </div>
  );
}

// optional row above the column labels naming the variable the columns break down by
function ColumnTitleRow({ columnTitle, gridStyle }) {
  return (
    <div role="row" className="crosstab-row" style={gridStyle}>
      <div role="columnheader" className="corner" />
      <div role="columnheader" />
      <div role="columnheader" className="eyebrow span-heading">{columnTitle}</div>
    </div>
  );
}

// column labels; low-base columns are flagged with an asterisk
function HeaderRow({ columns, gridStyle }) {
  return (
    <div role="row" className="crosstab-row" style={gridStyle}>
      <div role="columnheader" className="corner head" />
      {columns.map((column, i) => {
        const low = isLowBase(column.base);
        return (
          <div key={column.label} role="columnheader" className={classNames('head', i === 0 && 'total', low && 'low')}>
            {column.label}{low && ' *'}
          </div>
        );
      })}
    </div>
  );
}

// the number of respondents in each column
function BaseRow({ columns, gridStyle }) {
  return (
    <div role="row" className="crosstab-row" style={gridStyle}>
      <div role="rowheader" className="row-label base-label eyebrow">Base (n)</div>
      {columns.map((column, i) => {
        const low = isLowBase(column.base);
        return (
          <div key={column.label} role="cell" className={classNames('base', i === 0 && 'strong', low && 'low')}>
            {formatNumber(column.base)}{low && '*'}
          </div>
        );
      })}
    </div>
  );
}

function AnswerRow({ row, columns, mode, gridStyle }) {
  return (
    <div role="row" className="crosstab-row" style={gridStyle}>
      <div role="rowheader" className={classNames('row-label', row.net && 'net')}>{row.label}</div>
      {row.cells.map((cell, i) => (
        <Cell key={columns[i].label} cell={cell} mode={mode} isTotal={i === 0} isNet={row.net} />
      ))}
    </div>
  );
}

// the crosstab grid: a header row, a base row, then one row per answer
export default function CrosstabTable({ table, title, columnTitle, mode }) {
  const { columns, rows } = table;
  const gridStyle = gridStyleFor(columns);
  const label = columnTitle ? `${title} by ${columnTitle}` : title;

  return (
    <div className="table-card">
      <div role="table" aria-label={label} className="crosstab">
        {columnTitle && <ColumnTitleRow columnTitle={columnTitle} gridStyle={gridStyle} />}
        <HeaderRow columns={columns} gridStyle={gridStyle} />
        <BaseRow columns={columns} gridStyle={gridStyle} />
        {rows.map((row) => (
          <AnswerRow key={row.label} row={row} columns={columns} mode={mode} gridStyle={gridStyle} />
        ))}
      </div>
    </div>
  );
}
