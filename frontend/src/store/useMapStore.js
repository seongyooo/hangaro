import { create } from 'zustand'

/**
 * 지도 + 네트워크 시각화 공유 상태
 * Canvas 2D, Three.js, Kakao Maps 세 레이어가 공통으로 구독
 */
const useMapStore = create((set) => ({
  // 노드 목록 (관광지)
  nodes: [],          // [{ id, name, lat, lng, congestion, hidden_gem_score, x, y }]
  // 엣지 목록 (경로)
  edges: [],          // [{ from, to, link_cost, isRecommended }]
  // 추천 코스 ID 순서
  courseIds: [],
  // 목적지 고정
  destinationId: null,
  // 줌 레벨 (Kakao Maps 기준)
  zoomLevel: 12,
  // Three.js 활성화 여부 (줌 >= 14)
  is3DEnabled: false,
  // Dijkstra 탐색 애니메이션 상태
  searchingNodeId: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setCourse: (courseIds) => set({ courseIds }),
  setDestination: (id) => set({ destinationId: id }),
  setZoomLevel: (level) => set({ zoomLevel: level, is3DEnabled: level >= 14 }),
  setSearchingNode: (id) => set({ searchingNodeId: id }),

  // 노드의 화면 좌표 업데이트 (Kakao Maps → 픽셀 변환 후 저장)
  updateNodeScreenPos: (id, x, y) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    })),
}))

export default useMapStore
