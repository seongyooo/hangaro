/**
 * SmartMapView — 지도 컴포넌트 자동 선택
 *
 * VITE_MAPBOX_TOKEN 있음 → MapboxView (3D 지도, fill-extrusion 혼잡도 블록)
 * VITE_MAPBOX_TOKEN 없음 → KakaoMapView (2D 지도 + CSS 3D 막대)
 */
import MapboxView from './MapboxView'
import KakaoMapView from './KakaoMapView'

const USE_MAPBOX = !!import.meta.env.VITE_MAPBOX_TOKEN

export default function SmartMapView(props) {
  return USE_MAPBOX ? <MapboxView {...props} /> : <KakaoMapView {...props} />
}
