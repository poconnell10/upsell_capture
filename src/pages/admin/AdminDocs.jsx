import { useState, useEffect, useRef } from 'react';
import { TopBar, PropertyChip } from '../../components/TopBar.jsx';

const SECTIONS = [
  ['getting-started', 'Getting Started'],
  ['hotels', 'Managing Hotels'],
  ['agents', 'Managing Agents'],
  ['webhooks', 'Webhook Integration'],
  ['data', 'Data & Exports'],
  ['faq', 'FAQ'],
];

const PAYLOAD = `{
  "event": "capture.created",
  "captured_at": "2026-06-22T10:30:00Z",
  "hotel": "Hilton Orlando",
  "agent": "Maria Chen",
  "agent_code": "ING-1042",
  "confirmation": "CN-88234",
  "product": "Suite upgrade",
  "type": "Room",
  "qty": 2,
  "unit_price": 160.00,
  "amount": 320.00
}`;

// --- primitives ------------------------------------------------------------
const H2 = ({ children }) => (
  <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 10 }}>{children}</div>
);
const P = ({ children, style }) => (
  <p style={{ fontSize: 13.5, color: 'var(--gray)', lineHeight: 1.65, margin: '0 0 12px', ...style }}>{children}</p>
);
const SubH = ({ children }) => (
  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '18px 0 8px' }}>{children}</div>
);
const UL = ({ items }) => (
  <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
    {items.map((it, i) => (
      <li key={i} style={{ fontSize: 13.5, color: 'var(--gray)', lineHeight: 1.65, marginBottom: 4 }}>{it}</li>
    ))}
  </ul>
);
const Soon = () => (
  <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '2px 8px', borderRadius: 10, marginLeft: 8, verticalAlign: 'middle' }}>Coming soon</span>
);
const Code = ({ children }) => (
  <pre className="mono" style={{ background: '#0F1419', color: '#E6EDF3', fontSize: 12.5, lineHeight: 1.6, padding: '14px 16px', borderRadius: 'var(--r)', overflowX: 'auto', margin: '0 0 14px' }}>
    {children}
  </pre>
);
const Card = ({ children }) => (
  <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '22px 24px', marginBottom: 16 }}>{children}</div>
);
const Step = ({ n, title, children }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
    <span style={{ flex: '0 0 auto', width: 28, height: 28, borderRadius: '50%', background: 'var(--teal-bg)', color: 'var(--teal)', border: '1px solid var(--teal-line)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>{n}</span>
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--gray)', lineHeight: 1.6, marginTop: 2 }}>{children}</div>
    </div>
  </div>
);

function Faq({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: '1px solid var(--line)' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 2px', background: 'none', border: 'none', textAlign: 'left' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{q}</span>
        <span style={{ fontSize: 16, color: 'var(--faint)', transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }}>+</span>
      </button>
      {open && <div style={{ fontSize: 13.5, color: 'var(--gray)', lineHeight: 1.65, padding: '0 2px 14px' }}>{a}</div>}
    </div>
  );
}

export default function AdminDocs() {
  const [active, setActive] = useState('getting-started');
  const refs = useRef({});

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px', threshold: 0 },
    );
    SECTIONS.forEach(([id]) => { const el = refs.current[id]; if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const go = (id) => { refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const sec = (id) => ({ ref: (el) => { refs.current[id] = el; }, id, style: { scrollMarginTop: 74 } });

  return (
    <div>
      <TopBar title="Admin" kicker="Documentation" right={<PropertyChip>All hotels</PropertyChip>} />

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 24px 80px' }}>
        <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 6 }}>Admin</div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 18 }}>Documentation &amp; Help</div>

        <div className="docs-layout">
          {/* SIDEBAR */}
          <nav className="docs-sidebar">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SECTIONS.map(([id, label]) => (
                <button key={id} onClick={() => go(id)}
                  style={{ textAlign: 'left', padding: '7px 11px', borderRadius: 6, border: 'none', fontSize: 12.5, fontWeight: active === id ? 600 : 500, color: active === id ? 'var(--teal)' : 'var(--gray)', background: active === id ? 'var(--teal-bg)' : 'transparent', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </nav>

          {/* CONTENT */}
          <div>
            {/* 1. Getting Started */}
            <section {...sec('getting-started')}>
              <Card>
                <H2>Welcome to Upsell Capture</H2>
                <P>
                  Upsell Capture is a multi-tenant tool for hotels to record room upgrades and ancillary
                  ("other revenue") sales their front-desk agents make at check-in. Each capture is logged
                  against a booking confirmation and attributed to the agent who sold it. Captured data flows
                  to your systems automatically — in near real-time via webhook, or on demand via Excel export.
                </P>
                <SubH>How it works</SubH>
                <Step n="1" title="Admin sets up your hotel and agents">
                  A vendor admin creates your hotel and adds each front-desk agent.
                </Step>
                <Step n="2" title="Agents log in and capture upsells at check-in">
                  Agents record the room upgrade and any extras against the guest's confirmation number.
                </Step>
                <Step n="3" title="Data flows to your systems in real-time">
                  Every capture is pushed to your endpoint via webhook, and is available for Excel export at any time.
                </Step>
                <SubH>Who has access</SubH>
                <UL items={[
                  <><strong>Vendor admins</strong> — full access to all hotels, agents, webhooks and reporting.</>,
                  <><strong>Hotel agents</strong> — capture sales and view their own sales only.</>,
                ]} />
              </Card>
            </section>

            {/* 2. Managing Hotels */}
            <section {...sec('hotels')}>
              <Card>
                <H2>Managing Hotels</H2>
                <P>Hotels are managed from <strong>Admin → Hotels</strong>. Each hotel is an isolated tenant.</P>
                <SubH>Add a new hotel</SubH>
                <P>Use the “Add a hotel” form at the top of the Hotels page:</P>
                <UL items={[
                  <><strong>Hotel name</strong> — the property name as it appears in exports and webhook payloads.</>,
                  <><strong>Timezone</strong> — used for date filtering and reporting.</>,
                  <><strong>Active / Inactive</strong> — inactive hotels are hidden from agents and excluded from webhooks.</>,
                ]} />
                <SubH>Edit a hotel</SubH>
                <P>Click <strong>Edit</strong> on a hotel row to change its name or timezone inline, then <strong>Save</strong>.</P>
                <SubH>Deactivate a hotel</SubH>
                <P>Click <strong>Deactivate</strong> on a hotel row. Its agents lose access and it stops receiving webhooks, but all historical captures are retained. Reactivate at any time.</P>
              </Card>
            </section>

            {/* 3. Managing Agents */}
            <section {...sec('agents')}>
              <Card>
                <H2>Managing Agents</H2>
                <P>Open a hotel and go to its <strong>Agents</strong> list (<span className="mono">/admin/hotels/:id</span>).</P>
                <SubH>Add an agent</SubH>
                <UL items={[
                  <><strong>Name</strong> — the agent's full name.</>,
                  <><strong>Email</strong> — used for login; must be unique.</>,
                  <><strong>Agent code</strong> — your internal identifier (e.g. <span className="mono">ING-1042</span>).</>,
                ]} />
                <P>On save, the agent is created and emailed an invite to set their own password.</P>
                <SubH>Reset an agent's password</SubH>
                <P>Click <strong>Reset password</strong> on the agent row to set a password directly — useful for support or testing, no email round-trip required.</P>
                <SubH>Resend an invite</SubH>
                <P>Click <strong>Resend invite</strong> to send the password-setup email again.</P>
                <SubH>Deactivate an agent</SubH>
                <P>Click <strong>Deactivate</strong>. Deactivated agents cannot log in, but their historical captures are retained.</P>
              </Card>
            </section>

            {/* 4. Webhook Integration */}
            <section {...sec('webhooks')}>
              <Card>
                <H2>Webhook Integration</H2>
                <P>
                  A webhook is an automatic notification sent to your system every time a sale is captured.
                  Instead of checking for new data manually, your system receives it instantly.
                </P>
                <SubH>Two types of webhooks</SubH>
                <UL items={[
                  <><strong>Global (IN-Gauge)</strong> — receives every capture across all hotels.</>,
                  <><strong>Hotel webhook</strong> — each hotel receives only its own captures.</>,
                ]} />
                <SubH>Configure a webhook</SubH>
                <Step n="1" title="Get your endpoint URL">From your integration team.</Step>
                <Step n="2" title="Go to Admin → Webhooks">Open the Webhooks page in the admin panel.</Step>
                <Step n="3" title="Add the URL and secret key">Use the global or hotel “Add webhook” form.</Step>
                <Step n="4" title="Toggle active to enable">Deliveries begin immediately for new captures.</Step>
                <SubH>Payload example</SubH>
                <Code>{PAYLOAD}</Code>
                <SubH>Authentication</SubH>
                <P>All webhooks send the configured secret as a Bearer token: <span className="mono">Authorization: Bearer &lt;secret&gt;</span>, alongside <span className="mono">X-Upsell-Capture-Event: capture.created</span>.</P>
                <SubH>Retries</SubH>
                <P>Failed deliveries are retried up to 3 times (500ms apart). The final outcome of each attempt is recorded.</P>
                <SubH>Webhook logs</SubH>
                <P>The Webhook Logs table (bottom of the Webhooks page) shows the last 50 attempts: time, webhook, capture confirmation, status, HTTP response code, and attempt count. Green is a success, red is a failure.</P>
                <SubH>Hotel self-service</SubH>
                <P>When logged in as an agent, the <strong>Integrations</strong> section shows the hotel's webhook status (secret masked to the last 8 characters) and a <strong>Test webhook</strong> button. Agents can view and test, but not edit — changes go through support.</P>
              </Card>
            </section>

            {/* 5. Data & Exports */}
            <section {...sec('data')}>
              <Card>
                <H2>Data &amp; Exports</H2>
                <SubH>Excel export</SubH>
                <P>On the <strong>Agent Sales</strong> page, click <strong>Export Excel</strong> to download the captures currently in view as an <span className="mono">.xlsx</span> file with auto-fit column widths.</P>
                <SubH>Columns included</SubH>
                <UL items={['Date', 'Confirmation', 'Product', 'Type', 'Qty', 'Unit Price', 'Amount']} />
                <SubH>Date filters</SubH>
                <P>Switch the range between <strong>Today</strong>, <strong>MTD</strong> (month to date) and <strong>All</strong>. The export reflects the selected range.</P>
                <SubH>Filtering by agent</SubH>
                <P>Use the agent dropdown to narrow to a single agent before exporting; the export matches the on-screen filter.</P>
                <SubH>File naming</SubH>
                <P><span className="mono">upsell-capture-[today|mtd|all]-YYYY-MM-DD.xlsx</span></P>
                <SubH>Planned</SubH>
                <UL items={[
                  <>Automated daily export via email <Soon /></>,
                  <>REST API for custom integrations <Soon /></>,
                ]} />
              </Card>
            </section>

            {/* 6. FAQ */}
            <section {...sec('faq')}>
              <Card>
                <H2>Frequently Asked Questions</H2>
                <Faq q="Can an agent see another agent's sales?" a="No. Agents only see their own captures. Hotel admins and vendor admins can see all sales." />
                <Faq q="What happens if a webhook fails?" a="The system retries up to 3 times. You can see all attempts in the Webhook Logs section. If it continues to fail, check that the URL and secret are correct." />
                <Faq q="Can I change an agent's email address?" a="Not yet via the admin panel. Contact support to change an agent's email address." />
                <Faq q="What happens to data if I deactivate a hotel?" a="All historical captures are retained. The hotel and its agents are simply hidden from active views." />
                <Faq q="How quickly does data appear after a sale is captured?" a="Webhooks fire within seconds of a capture being saved. Excel exports reflect data in real time." />
                <Faq q="Can a hotel configure their own webhook?" a={<>Hotels can view their webhook status and test it from the Integrations section when logged in as an agent. To change the webhook URL or secret, contact <a href="mailto:support@upsellcapture.com" style={{ color: 'var(--teal)' }}>support@upsellcapture.com</a>.</>} />
                <Faq q="Is the data secure?" a="Yes. Each hotel can only see their own data. Row Level Security enforced at the database level ensures complete data isolation between properties." />
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
