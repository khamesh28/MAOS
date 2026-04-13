/**
 * AgentSkeleton — shown while an agent result is loading.
 * accentColor: the agent's primary hex color for the left border tint.
 */
export default function AgentSkeleton({ accentColor = '#388bff' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header bar */}
      <div className="skeleton-card" style={{ borderColor: `${accentColor}20` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton-line skeleton-line-lg" style={{ width: '40%' }} />
            <div className="skeleton-line" style={{ width: '70%', opacity: 0.6 }} />
          </div>
        </div>
      </div>

      {/* Two-column content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="skeleton-card" style={{ gap: 10 }}>
          <div className="skeleton-line skeleton-line-lg" style={{ width: '50%' }} />
          <div className="skeleton" style={{ height: 100, borderRadius: 8 }} />
          <div className="skeleton-line" style={{ width: '80%' }} />
          <div className="skeleton-line" style={{ width: '60%', opacity: 0.6 }} />
        </div>
        <div className="skeleton-card" style={{ gap: 10 }}>
          <div className="skeleton-line skeleton-line-lg" style={{ width: '45%' }} />
          <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />
          <div className="skeleton-line" style={{ width: '90%' }} />
          <div className="skeleton-line" style={{ width: '75%', opacity: 0.6 }} />
          <div className="skeleton-line" style={{ width: '55%', opacity: 0.5 }} />
        </div>
      </div>

      {/* Wide bar */}
      <div className="skeleton-card" style={{ borderColor: `${accentColor}20` }}>
        <div className="skeleton-line skeleton-line-lg" style={{ width: '30%' }} />
        <div className="skeleton" style={{ height: 140, borderRadius: 8 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton-line" style={{ width: '25%' }} />
          <div className="skeleton-line" style={{ width: '25%', opacity: 0.7 }} />
          <div className="skeleton-line" style={{ width: '20%', opacity: 0.5 }} />
        </div>
      </div>
    </div>
  )
}
