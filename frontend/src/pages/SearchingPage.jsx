import SmartMapView from '../components/map/SmartMapView'
import {
  IDLE_NODES,
  LEVEL_COLOR,
  LOADING_STAGES,
} from '../App'

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

  // searchEdges: Mapbox/Kakao 키가 둘 다 없을 때의 최하위 MapCanvas 폴백에서만 사용됨(Dijkstra 시각화)
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

  // MainPage/ResultPage와 동일하게 SmartMapView 사용 — 화면 전환마다 3D↔2D로
  // 지도 종류가 바뀌는 것을 방지 (Mapbox 토큰 있으면 항상 3D 유지)
  const MapView = (
    <SmartMapView
      theme={theme}
      nodes={nodesSearch}
      congestionBars={nodesSearch}
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
        취소
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
