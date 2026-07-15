import React from 'react';

export default function UpdateNotesModal({ notes, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>What's new in {notes.version}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body update-notes-body">
          {notes.groups.map(group => (
            <div className="update-notes-group" key={group.version}>
              {notes.groups.length > 1 && <h4>{group.version}</h4>}
              <ul className="update-notes-list">
                {group.notes.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
