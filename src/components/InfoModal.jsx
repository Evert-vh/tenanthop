import React from 'react';

function Kbd({ children }) {
  return <span className="kbd-badge">{children}</span>;
}

function Section({ title, children }) {
  return (
    <section className="info-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

export default function InfoModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal info-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>About TenantHub</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body info-body">
          <p className="info-intro">
            TenantHub is a multi-tenant launcher for Microsoft 365 admin portals. Each client
            gets its own color-coded, fully isolated browser session, so you can stay signed
            in to several tenants at once without constantly switching accounts or getting
            logged out of the last one.
          </p>

          <Section title="Clients">
            <ul>
              <li><strong>+ Add client</strong> creates a color-coded entry with its own private, persistent browser session — signing in once keeps you signed in across restarts.</li>
              <li>Hover a client to <strong>★ pin</strong> them to the top of the list or <strong>✕ delete</strong> them. Deleting also clears that client's saved sign-in.</li>
              <li>The dot on each client's row shows whether they still have a usable session: <span className="status-dot signed-in" /> signed in, <span className="status-dot expired" /> session expired, no dot = never signed in.</li>
              <li><strong>Import / Export</strong> save and load your client list as JSON. Import also accepts PortalsReleases <code>.cfg</code> exports and merges — it shows you what's new vs. what would update before touching anything.</li>
            </ul>
          </Section>

          <Section title="Portals">
            <ul>
              <li>Selecting a client shows a grid of Microsoft admin portals: M365 Admin, Entra ID, Exchange, Teams, Intune, SharePoint, Defender, Compliance, Purview, Azure, Partner Center, and Billing.</li>
              <li>Hover a tile for a ✕ to hide it for that client, or use the dashed <strong>+ Add portal</strong> tile to add a custom link (e.g. a client's PSA, ticketing portal, or line-of-business app).</li>
              <li>While browsing, the ☆ star in a portal window's address bar saves the current page as a custom portal for that client — handy for bookmarking a specific admin blade.</li>
            </ul>
          </Section>

          <Section title="Browsing a client's portals">
            <ul>
              <li>Each client opens in its own window with real tabs, back/forward/reload, and an editable address bar.</li>
              <li>New tabs show a branded landing page rather than a blank screen — just start typing a URL.</li>
              <li>Login popups (Microsoft sign-in) open as real popup windows so the sign-in can hand control back to the page that opened it; everything else opens as a tab.</li>
            </ul>
          </Section>

          <Section title="Quick switcher">
            <ul>
              <li>Press <Kbd>Ctrl K</Kbd> (or click "⇄ Switch client" in a portal window) to jump to another client without going back to the launcher.</li>
              <li>Type a client name to switch to their window. Type a client name <em>and</em> a portal name — e.g. "acme entra" — to jump straight into that specific portal.</li>
            </ul>
          </Section>

          <Section title="Keyboard shortcuts">
            <table className="shortcut-table">
              <tbody>
                <tr><td><Kbd>Ctrl K</Kbd></td><td>Quick switcher (jump to a client or client + portal)</td></tr>
                <tr><td><Kbd>Ctrl 1</Kbd>–<Kbd>9</Kbd></td><td>Open the Nth portal tile for the selected client</td></tr>
                <tr><td><Kbd>Ctrl T</Kbd></td><td>New tab (in a portal window)</td></tr>
                <tr><td><Kbd>Ctrl Shift T</Kbd></td><td>Reopen the last closed tab</td></tr>
                <tr><td><Kbd>Ctrl W</Kbd></td><td>Close current tab</td></tr>
                <tr><td><Kbd>Ctrl R</Kbd> / <Kbd>F5</Kbd></td><td>Reload current tab</td></tr>
                <tr><td><Kbd>Ctrl +</Kbd> / <Kbd>−</Kbd> / <Kbd>0</Kbd></td><td>Zoom in / out / reset</td></tr>
                <tr><td><Kbd>Alt ←</Kbd> / <Kbd>→</Kbd></td><td>Back / forward</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Good to know">
            <ul>
              <li>Portal sessions present as a normal Chrome browser (not Electron), which can reduce how often Microsoft challenges you to sign in again.</li>
              <li>Even so, how often you're asked to re-authenticate is mostly controlled by each tenant's own Entra ID Conditional Access "sign-in frequency" policy — that's outside anything a client app can override.</li>
              <li>This is a personal/internal tool with no auto-updater. When you're running a newer version than last time, a short "what's new" note appears once.</li>
            </ul>
          </Section>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
