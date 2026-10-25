import Icon from './Icon';

// a popover-style card with a title and a close button
export default function Panel({ title, onClose, actions, children }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">{title}</span>
        <div className="spacer" />
        {actions}
        {onClose && (
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
