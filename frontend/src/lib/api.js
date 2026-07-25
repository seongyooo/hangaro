import axios from 'axios'

// timeout 없으면 백엔드가 응답 없이 걸릴 때 SearchingPage가 무한 대기에 빠진다
const client = axios.create({ baseURL: '/api', timeout: 30000 })

export const api = {
  recommend(params) {
    return client.post('/recommend', params)
  },
  nearbySpots(lat, lng, radius = 3000) {
    return client.get('/spots/nearby', { params: { lat, lng, radius } })
  },
  searchSpots(keyword, region = '') {
    return client.get('/spots/search', { params: { keyword, region } })
  },
  spotDetail(contentId) {
    return client.get(`/spots/detail/${contentId}`)
  },
  congestion(spotId, category = 'attraction') {
    return client.get(`/congestion/${spotId}`, { params: { category } })
  },
  congestionTimeline(spotId, category = 'attraction', date = '') {
    return client.get(`/congestion/${spotId}/timeline`, { params: { category, date } })
  },
}
