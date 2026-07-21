/**
 * MapCanvas – abstract map placeholder with CSS grid, colored blocks,
 * congestion pulse nodes, current-location dot, and optional route polyline.
 *
 * Props:
 *   theme        – theme object (LIGHT or DARK)
 *   nodes        – array of node descriptors
 *   mapBlocks    – array of { x, y, w, h } building blocks
 *   showLocation – boolean: show blue "my location" dot
 *   routePoints  – SVG polyline points string (optional)
 *   planColor    – stroke color for route (optional)
 *   searchEdges  – array of edge descriptors for searching screen (optional)
 *   children     – overlaid content
 *   style        – extra style for the root div
 */
export default function MapCanvas({
  theme,
  nodes = [],
  mapBlocks = [],
  showLocation = false,
  routePoints,
  planColor,
  searchEdges,
  children,
  style,
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: theme.mapBg,
        ...style,
      }}
    >
      {/* Grid lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            repeating-linear-gradient(${theme.mapGrid} 0 1px, transparent 1px 64px),
            repeating-linear-gradient(90deg, ${theme.mapGrid} 0 1px, transparent 1px 64px)
          `,
          pointerEvents: 'none',
        }}
      />

      {/* Building blocks */}
      {mapBlocks.map((blk, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${blk.x}%`,
            top: `${blk.y}%`,
            width: blk.w,
            height: blk.h,
            background: theme.mapBlock,
            borderRadius: 4,
          }}
        />
      ))}

      {/* Search edges (Dijkstra visualization) */}
      {searchEdges && searchEdges.length > 0 && (
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {searchEdges.map((edge, i) => (
            <line
              key={i}
              x1={`${edge.x1}%`}
              y1={`${edge.y1}%`}
              x2={`${edge.x2}%`}
              y2={`${edge.y2}%`}
              stroke={edge.color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="7 7"
              strokeDashoffset={edge.dashOffset}
            />
          ))}
        </svg>
      )}

      {/* Route polyline */}
      {routePoints && (
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <polyline
            points={routePoints}
            fill="none"
            stroke={planColor || '#22c55e'}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* Current location blue dot */}
      {showLocation && (
        <div
          style={{
            position: 'absolute',
            left: '44%',
            top: '62%',
            transform: 'translate(-50%, -50%)',
            width: 14,
            height: 14,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: -14,
              borderRadius: '50%',
              border: '2px solid #3b82f6',
              animation: 'rippleWave 2s ease-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: '#3b82f6',
              border: '2px solid white',
            }}
          />
        </div>
      )}

      {/* Congestion nodes */}
      {nodes.map((node) => (
        <div
          key={node.id}
          style={{
            position: 'absolute',
            left: `${node.x}%`,
            top: `${node.y}%`,
            transform: 'translate(-50%, -50%)',
            cursor: node.onClick ? 'pointer' : 'default',
            zIndex: node.showTip ? 10 : 1,
          }}
          onClick={node.onClick}
        >
          {/* Pulse ring */}
          {node.pulse !== false && (
            <div
              style={{
                position: 'absolute',
                inset: -16,
                borderRadius: '50%',
                border: `2px solid ${node.color}`,
                animation: `pulseRing ${node.pulseDur || '1.5s'} ease-out infinite`,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Dot */}
          <div
            style={{
              width: node.size || 14,
              height: node.size || 14,
              borderRadius: '50%',
              background: node.color,
              border: `2px solid ${theme.bg}`,
              boxShadow: '0 1px 4px rgba(0,0,0,.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 800,
              color: 'white',
              transition: 'background 0.4s',
            }}
          >
            {node.order != null ? node.order : null}
          </div>

          {/* Tooltip */}
          {node.showTip && (
            <div
              style={{
                position: 'absolute',
                bottom: 22,
                left: '50%',
                transform: 'translateX(-50%)',
                background: theme.surface,
                color: theme.text,
                padding: '6px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(0,0,0,.18)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              <div>{node.name}</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: node.color }}>
                {node.levelLabel}
              </div>
            </div>
          )}
        </div>
      ))}

      {children}
    </div>
  )
}
