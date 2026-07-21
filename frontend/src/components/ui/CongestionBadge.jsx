import { LEVEL_COLOR, LEVEL_BADGE_BG, LEVEL_LABEL } from '../../App'

export default function CongestionBadge({ level }) {
  const color = LEVEL_COLOR[level] || '#6b7280'
  const bg = LEVEL_BADGE_BG[level] || '#f3f4f6'
  const label = LEVEL_LABEL[level] || level

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: '4px 9px',
        borderRadius: 20,
        background: bg,
        color: color,
        whiteSpace: 'nowrap',
        letterSpacing: '0.1px',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  )
}
