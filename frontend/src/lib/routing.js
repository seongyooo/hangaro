/**
 * 실도로 경로 조회 (OSRM 공개 서버 사용 — API 키 불필요)
 *
 * 이동수단별 OSRM 프로파일:
 *   - 도보(walk)    → foot    : 보행로, 골목길, 산책로
 *   - 자동차(car)   → driving : 실제 도로망, 교통 방향 준수
 *   - 대중교통(transit) → driving 근사치
 *     (실제 대중교통 경로는 Tmap 또는 Kakao Mobility Transit API 키 필요)
 */

const OSRM_BASE = 'https://router.project-osrm.org/route/v1'

const OSRM_프로파일 = {
  walk: 'foot',
  car: 'driving',
  transit: 'driving',  // 대중교통 근사치 — UI에서 점선으로 구분
}

/**
 * 여러 경유지를 순서대로 통과하는 실도로 경로 좌표 반환
 *
 * @param {Array<{lat: number, lng: number}>} nodes  - 통과 순서대로 정렬된 노드 목록 (2개 이상)
 * @param {'walk'|'car'|'transit'} transport         - 이동수단
 * @returns {Promise<Array<{lat: number, lng: number}>|null>}
 *   실제 경로 좌표 배열. 실패 시 null 반환 → 호출부에서 직선 폴백 처리
 */
export async function fetchRouteGeometry(nodes, transport = 'walk') {
  const valid = nodes.filter((n) => n.lat != null && n.lng != null)
  if (valid.length < 2) return null

  const profile = OSRM_프로파일[transport] || 'foot'
  // OSRM 좌표 형식: 경도,위도 순서 (GeoJSON 표준)
  const coords = valid.map((n) => `${n.lng},${n.lat}`).join(';')
  const url = `${OSRM_BASE}/${profile}/${coords}?overview=full&geometries=geojson`

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null

    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.[0]) return null

    // GeoJSON 좌표 배열은 [경도, 위도] 순서 → { lat, lng } 객체로 변환
    return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
  } catch (e) {
    console.warn('[경로] OSRM 요청 실패, 직선 경로로 폴백:', e.message)
    return null
  }
}
