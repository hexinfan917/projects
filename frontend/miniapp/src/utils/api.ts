import Taro, { eventCenter } from '@tarojs/taro'

const BASE_URL = 'http://localhost:8081'

export function setActiveTab(index: number, expectedRoute: string) {
  const pages = Taro.getCurrentPages()
  const currentRoute = (pages[pages.length - 1]?.route || '').replace(/\.html$/, '')
  if (currentRoute === expectedRoute) {
    Taro.setStorageSync('active_tab_index', index)
  }
}

export async function request(path: string, options: any = {}) {
  const token = Taro.getStorageSync('access_token') || ''
  try {
    const res: any = await Taro.request({
      url: `${BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      }
    })

    // 统一状态码拦截
    if (res.statusCode === 401) {
      if (!options.skipAuthModal) {
        Taro.removeStorageSync('access_token')
        Taro.removeStorageSync('user_info')
        Taro.showModal({
          title: '登录已过期',
          content: '请重新登录',
          showCancel: false,
          success: () => {
            Taro.navigateTo({ url: '/pages/login/index' })
          }
        })
      }
      throw new Error('Unauthorized')
    }

    if (!res.statusCode || res.statusCode <= 0) {
      Taro.showToast({ title: '网络异常，请检查连接', icon: 'none' })
      throw new Error('Network error')
    }

    if (res.statusCode >= 400) {
      const msg = res.data?.message || `请求失败 (${res.statusCode})`
      Taro.showToast({ title: msg, icon: 'none' })
      throw new Error(msg)
    }

    return res.data
  } catch (err: any) {
    console.error('Request failed:', err)
    // 网络层错误（timeout / fail）给出通用提示
    if (err.errMsg && !err.message) {
      Taro.showToast({ title: '网络异常，请检查连接', icon: 'none' })
    }
    throw err
  }
}

// 用户
export function login(code: string) {
  return request('/api/v1/auth/wechat/login', { method: 'POST', data: { code } })
}

export function testLogin() {
  return request('/api/v1/auth/test/login', { method: 'POST' })
}

export function getUserProfile() {
  return request('/api/v1/user/profile')
}

export function updateUserProfile(data: any) {
  return request('/api/v1/user/profile', { method: 'PUT', data })
}

// 路线
export function getRoutes(params?: any) {
  return request('/api/v1/routes', { data: params, skipAuthModal: true })
}

export function getRouteTypes() {
  return request('/api/v1/routes/types', { skipAuthModal: true })
}

export function getRouteDetail(id: number) {
  return request(`/api/v1/routes/${id}`, { skipAuthModal: true })
}

export function getRouteSchedules(id: number) {
  return request(`/api/v1/routes/${id}/schedules`, { skipAuthModal: true })
}

export function getRouteEvaluations(id: number, params?: any) {
  return request(`/api/v1/routes/${id}/evaluations`, { data: params, skipAuthModal: true })
}

// 订单
export function getOrders(params?: any) {
  return request('/api/v1/orders', { data: params })
}

export function getOrderDetail(id: number) {
  return request(`/api/v1/orders/${id}`)
}

export function createOrder(data: any) {
  return request('/api/v1/orders', { method: 'POST', data })
}

export function payOrder(id: number) {
  return request(`/api/v1/orders/${id}/pay`, { method: 'POST' })
}

export function cancelOrder(id: number) {
  return request(`/api/v1/orders/${id}/cancel`, { method: 'POST' })
}

export function evaluateOrder(id: number, data: any) {
  return request(`/api/v1/orders/${id}/evaluate`, { method: 'POST', data })
}

// 宠物
export function getPets() {
  return request('/api/v1/pets')
}

export function createPet(data: any) {
  return request('/api/v1/pets', { method: 'POST', data })
}

export function updatePet(id: number, data: any) {
  return request(`/api/v1/pets/${id}`, { method: 'PUT', data })
}

export function getPet(id: number) {
  return request(`/api/v1/pets/${id}`)
}

export function deletePet(id: number) {
  return request(`/api/v1/pets/${id}`, { method: 'DELETE' })
}

// 出行人
export function getTravelers() {
  return request('/api/v1/travelers')
}

export function createTraveler(data: any) {
  return request('/api/v1/travelers', { method: 'POST', data })
}

export function updateTraveler(id: number, data: any) {
  return request(`/api/v1/travelers/${id}`, { method: 'PUT', data })
}

export function deleteTraveler(id: number) {
  return request(`/api/v1/travelers/${id}`, { method: 'DELETE' })
}

// 内容
export function getArticles(params?: any) {
  return request('/api/v1/contents/articles', { data: params, skipAuthModal: true })
}

export function getArticleDetail(id: number) {
  return request(`/api/v1/contents/articles/${id}`, { skipAuthModal: true })
}

export function likeArticle(id: number) {
  return request(`/api/v1/contents/articles/${id}/like`, { method: 'POST' })
}

// 首页轮播图
export function getBanners() {
  return request('/api/v1/contents/banners', { skipAuthModal: true })
}

// 狗狗回顾
export function getReviews(params?: any) {
  return request('/api/v1/contents/articles', { data: { ...params, category: 'review' }, skipAuthModal: true })
}

export function getReviewDetail(id: number) {
  return request(`/api/v1/contents/articles/${id}`, { skipAuthModal: true })
}

// 地图/POI
export function getPOIs(params?: any) {
  return request('/api/v1/map/pois', { data: params, skipAuthModal: true })
}

export function getNearbyPOIs(params?: any) {
  return request('/api/v1/map/pois/nearby', { data: params, skipAuthModal: true })
}

export function getPOIDetail(id: number) {
  return request(`/api/v1/map/pois/${id}`, { skipAuthModal: true })
}

// 通知
export function getNotifications(params?: any) {
  return request('/api/v1/notifications', { data: params })
}

export function markNotificationRead(id: number) {
  return request(`/api/v1/notifications/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsRead() {
  return request('/api/v1/notifications/read-all', { method: 'POST' })
}

// 公益
export function getCharityActivities(params?: any) {
  return request('/api/v1/charities/activities', { data: params, skipAuthModal: true })
}

export function getCharityActivityDetail(id: number) {
  return request(`/api/v1/charities/activities/${id}`, { skipAuthModal: true })
}

// 上传
export function uploadFile(filePath: string) {
  const token = Taro.getStorageSync('access_token') || ''
  return Taro.uploadFile({
    url: `${BASE_URL}/api/v1/files/upload/image`,
    filePath,
    name: 'file',
    header: {
      'Authorization': token ? `Bearer ${token}` : ''
    }
  })
}
