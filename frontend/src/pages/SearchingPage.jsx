import KakaoMapView from '../components/map/KakaoMapView'
import MapCanvas from '../components/map/MapCanvas'
import {
  IDLE_NODES,
  MAP_BLOCKS,
  LEVEL_COLOR,
  LOADING_STAGES,
} from '../App'

const HAS_KEY = !!import.meta.env.VITE_KAKAO_MAP_KEY

export default function SearchingPage({
  theme,
  loadingProgress,
  loadingStage,
  cancelSearch,
}) {
  const totalNodes = IDLE_NODES.length
  const activeCount = Math.round((loadingProgress / 100) * totalNodes)

  const nodesSearch = IDLE_NODES.map((n, i) => ({
    ...n,
    color: i < activeCount ? '#22c55e' : LEVEL_COLOR[n.level],
    pulse: i < activeCount,
    pulseDur: '1.1s',
    showTip: false,
  }))

  // searchEdges: 플레이스홀더 MapCanvas 전용 (Dijkstra 시각화)
  const searchEdges = IDLE_NODES.slice(0, -1).map((n, i) => {
    const next = IDLE_NODES[i + 1]
    return {
      x1: n.x, y1: n.y,
      x2: next.x, y2: next.y,
      color: i < activeCount - 1 ? '#22c55e' : theme.mapGrid,
      dashOffset: -((loadingProgress * 2) % 40),
    }
  })

  const stageText = LOADING_STAGES[loadingStage] || LOADING_STAGES[0]

  const MapView = HAS_KEY
    ? (
      <KakaoMapView
        theme={theme}
        nodes={nodesSearch}
        showLocation={false}
        style={{ flex: 1 }}
      />
    )
    : (
      <MapCanvas
        theme={theme}
        nodes={nodesSearch}
        mapBlocks={MAP_BLOCKS}
        showLocation={false}
        searchEdges={searchEdges}
        style={{ flex: 1 }}
      />
    )

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        position: 'relative', background: theme.bg,
      }}
    >
      {MapView}

      {/* Cancel */}
      <button
        onClick={cancelSearch}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: theme.headerGlass,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: theme.text,
          fontSize: 12, fontWeight: 700,
          padding: '8px 16px', borderRadius: 20,
          cursor: 'pointer', border: 'none', zIndex: 30,
        }}
      >
        Cancel
      </button>

      {/* Loading panel */}
      <div
        style={{
          background: theme.surface,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -12px 32px rgba(0,0,0,.2)',
          padding: '20px 20px 28px',
          display: 'flex', flexDirection: 'column', gap: 14,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 16, height: 16, flexShrink: 0,
              border: `2px solid ${theme.border}`,
              borderTopColor: theme.primary,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
            {stageText}
          </span>
        </div>

        <div style={{ height: 8, borderRadius: 6, background: theme.border, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', borderRadius: 6,
              background: theme.primary,
              width: `${loadingProgress}%`,
              transition: 'width 0.15s linear',
            }}
          />
        </div>

        <div style={{ fontSize: 12, color: theme.subtext, textAlign: 'right' }}>
          {loadingProgress}%
        </div>
      </div>
    </div>
  )
}
