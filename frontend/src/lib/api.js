import axios from 'axios'

const client = axios.create({ baseURL: '/api' })

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
  congestion(spotId, category = 'attraction') {
    return client.get(`/congestion/${spotId}`, { params: { category } })
  },
  congestionTimeline(spotId, category = 'attraction', date = '') {
    return client.get(`/congestion/${spotId}/timeline`, { params: { category, date } })
  },
}
