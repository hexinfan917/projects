import Taro, { eventCenter } from '@tarojs/taro'

// 环境切换：开发走本地网关，生产走线上域名
// 小程序开发工具需勾选「设置 → 项目设置 → 不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书」
// 使用微信的 getAccountInfoSync 获取小程序版本信息来区分环境
let env = 'production'
try {
  const accountInfo = Taro.getAccountInfoSync()
  // envVersion: 'develop' | 'trial' | 'release'
  env = accountInfo.miniProgram.envVersion || 'production'
} catch (e) {
  // 如果获取失败，默认生产环境
}

// 模拟器用 localhost，真机预览用局域网 IP
const systemInfo = Taro.getSystemInfoSync()
const isDevtools = systemInfo.platform === 'devtools'
// develop 走本地（开发者工具 / 真机预览），trial/release 走线上
export const BASE_URL = (env === 'develop')
  ? (isDevtools ? 'http://localhost:8081' : 'http://192.168.5.14:8081')
  : 'https://tailtravel.cn'
// 图片基础 URL：开发环境使用 BASE_URL（本地），生产环境使用线上域名
export const IMAGE_BASE_URL = (env === 'develop') ? BASE_URL : 'https://tailtravel.cn'

/** 补全图片 URL 并添加压缩参数 */
/** 安全返回：页面栈大于1时正常返回，否则跳转首页 */
export function safeNavigateBack(fallbackUrl?: string) {
  const pages = Taro.getCurrentPages()
  if (pages.length > 1) {
    Taro.navigateBack()
  } else {
    Taro.switchTab({ url: fallbackUrl || '/pages/index/index' })
  }
}

export function compressImageUrl(url?: string, width?: number): string {
  if (!url) return ''
  // 开发环境使用 BASE_URL（本地），生产环境使用 IMAGE_BASE_URL（线上）
  const baseUrl = (env === 'develop') ? BASE_URL : IMAGE_BASE_URL
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
  // 如果 URL 已经包含查询参数，不再添加压缩参数
  if (fullUrl.includes('?')) return fullUrl
  const w = width || 800
  return `${fullUrl}?w=${w}&q=75`
}

/** 获取图片完整 URL（自动根据环境选择域名） */
export function getImageUrl(url?: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  // 开发环境使用 BASE_URL（本地），生产环境使用 IMAGE_BASE_URL（线上）
  const baseUrl = (env === 'develop') ? BASE_URL : IMAGE_BASE_URL
  return `${baseUrl}${url}`
}

export async function deleteAccount() {
  return request('/api/v1/user/account', { method: 'DELETE' })
}

const ACTIVE_TAB_EVENT = 'activeTabChange'

export function setActiveTab(index: number, expectedRoute: string) {
  const pages = Taro.getCurrentPages()
  const currentRoute = (pages[pages.length - 1]?.route || '').replace(/\.html$/, '')
  if (currentRoute === expectedRoute) {
    Taro.setStorageSync('active_tab_index', index)
    // 通过事件中心强制同步，避免 setData 在自定义 TabBar 函数组件中不生效
    eventCenter.trigger(ACTIVE_TAB_EVENT, index)
    // 同步更新自定义 TabBar 高亮状态
    try {
      const page = Taro.getCurrentInstance().page as any
      if (page && typeof page.getTabBar === 'function') {
        const tabBar = page.getTabBar()
        if (tabBar) {
          tabBar.setData({ selected: index })
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

export async function request(path: string, options: any = {}) {
  const token = Taro.getStorageSync('access_token') || ''
  const headers: any = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    ...options.header
  }
  console.log(`[Request] ${options.method || 'GET'} ${path} token=${token ? 'yes(' + token.substring(0, 10) + '...)' : 'no'} authHeader=${headers.Authorization || 'empty'}`)
  try {
    const res: any = await Taro.request({
      url: `${BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: headers,
        timeout: 30000
    })

    console.log(`[Request] ${path} response status=${res.statusCode}`, res.data)

    // 统一状态码拦截：401 静默清除 token，不弹窗，由各页面按需处理
    if (res.statusCode === 401) {
      const pages = Taro.getCurrentPages()
      const currentRoute = pages[pages.length - 1]?.route || ''
      const isLoginPage = currentRoute.includes('login')
      console.warn(`[Request] 401 on ${path}, currentRoute=${currentRoute}, isLoginPage=${isLoginPage}, willClearToken=${!isLoginPage}`)
      if (!isLoginPage) {
        Taro.removeStorageSync('access_token')
        Taro.removeStorageSync('user_info')
      }
      const err: any = new Error('Unauthorized')
      err.statusCode = 401
      throw err
    }

    if (!res.statusCode || res.statusCode <= 0) {
      Taro.showToast({ title: '网络异常，请检查连接', icon: 'none' })
      throw new Error('Network error')
    }

    if (res.statusCode >= 400) {
      let msg = res.data?.message
      if (!msg && res.data?.detail) {
        const detail = res.data.detail
        if (Array.isArray(detail)) {
          msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
        } else if (typeof detail === 'object') {
          msg = JSON.stringify(detail)
        } else {
          msg = String(detail)
        }
      }
      msg = msg || `请求失败 (${res.statusCode})`
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
export function login(code: string, phoneCode?: string) {
  return request('/api/v1/auth/wechat/login', { method: 'POST', data: { code, phone_code: phoneCode } })
}

export function testLogin(testId?: string) {
  return request('/api/v1/auth/test/login', { method: 'POST', data: { test_id: testId || '' } })
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

export function refundOrder(id: number, data: any) {
  return request(`/api/v1/orders/${id}/refund`, { method: 'POST', data })
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

export function getSimplePetList() {
  return request('/api/v1/pets/simple/list')
}

// 犬格检测
export function getDogPersonalityStats() {
  return request('/api/v1/dog-personality/stats')
}

export function getDogPersonalityQuestions() {
  return request('/api/v1/dog-personality/questions')
}

export function getDogPersonalityLevels() {
  return request('/api/v1/dog-personality/levels')
}

export function submitDogPersonalityResult(data: any) {
  return request('/api/v1/dog-personality/results', { method: 'POST', data })
}

export function getDogPersonalityResult(id: number) {
  return request(`/api/v1/dog-personality/results/${id}`)
}

export function getDogPersonalityResultPublic(id: number) {
  return request(`/api/v1/dog-personality/results/${id}/public`)
}

export function getRecentDogPersonalityResults(limit?: number) {
  return request('/api/v1/dog-personality/results/recent/list', { data: { limit } })
}

export function getDogPersonalityResultList(page?: number, pageSize?: number) {
  const queryParts: string[] = []
  if (page !== undefined && page !== null) queryParts.push(`page=${page}`)
  if (pageSize !== undefined && pageSize !== null) queryParts.push(`page_size=${pageSize}`)
  const query = queryParts.join('&')
  return request(`/api/v1/dog-personality/results/list${query ? '?' + query : ''}`)
}

export function createDogPersonalityPkRecord(aResultId: number, bResultId: number) {
  return request('/api/v1/dog-personality/pk/records', {
    method: 'POST',
    data: { a_result_id: aResultId, b_result_id: bResultId },
  })
}

export function getDogPersonalityPkRecordList(page?: number, pageSize?: number) {
  const queryParts: string[] = []
  if (page !== undefined && page !== null) queryParts.push(`page=${page}`)
  if (pageSize !== undefined && pageSize !== null) queryParts.push(`page_size=${pageSize}`)
  const query = queryParts.join('&')
  return request(`/api/v1/dog-personality/pk/records/list${query ? '?' + query : ''}`)
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

export function registerCharityActivity(activityId: number, data: any) {
  return request(`/api/v1/charities/activities/${activityId}/register`, { method: 'POST', data })
}

export function getCharityRegisterStatus(activityId: number) {
  return request(`/api/v1/charities/activities/${activityId}/register/status`)
}

// 领养
export function getAdoptionDogs(params?: any) {
  return request('/api/v1/adoption/dogs', { data: params, skipAuthModal: true })
}

export function getAdoptionDogDetail(id: number, options?: any) {
  return request(`/api/v1/adoption/dogs/${id}`, { skipAuthModal: true, ...options })
}

export function submitAdoptionApplication(id: number, data: any) {
  return request(`/api/v1/adoption/dogs/${id}/apply`, { method: 'POST', data })
}

export function getMyAdoptionApplications(params?: any) {
  return request('/api/v1/adoption/my-applications', { data: params })
}

// 行程选配
export function getRouteAddons(routeId: number, category?: string) {
  return request(`/api/v1/routes/${routeId}/addons`, { data: category ? { category } : {}, skipAuthModal: true })
}

export function getAddonCategories() {
  return request('/api/v1/addon-categories', { skipAuthModal: true })
}

// 优惠券
export function getUserCoupons(params?: any) {
  return request('/api/v1/coupons', { data: params })
}

export function getClaimCenter(params?: any) {
  return request('/api/v1/coupons/claim-center', { data: params })
}

export function claimCoupon(templateId: number) {
  return request('/api/v1/coupons/claim', { method: 'POST', data: { template_id: templateId } })
}

export function getAvailableCoupons(params?: any) {
  return request('/api/v1/coupons/available-for-order', { data: params })
}

export function calculateCoupon(data: any) {
  return request('/api/v1/coupons/calculate', { method: 'POST', data })
}

export function useCoupon(couponId: number) {
  return request(`/api/v1/coupons/${couponId}/use`, { method: 'POST' })
}

// 协议/文档
export function getAgreements(params?: any) {
  return request('/api/v1/agreements', { data: params, skipAuthModal: true })
}

// 公开系统设置
export function getPublicSettings() {
  return request('/api/v1/settings/public', { skipAuthModal: true })
}

export function getAgreementDetail(id: number) {
  return request(`/api/v1/agreements/${id}`, { skipAuthModal: true })
}

// 会员中心
export function getMemberCenter() {
  return request('/api/v1/member/center')
}

export function getMemberPlans() {
  return request('/api/v1/member/plans')
}

export function getMemberCoupons(params?: any) {
  return request('/api/v1/member/coupons', { data: params })
}

export function createMemberOrder(planId: number, platform?: string) {
  return request('/api/v1/member/orders', { method: 'POST', data: { plan_id: planId, platform } })
}

export function getMemberOrder(orderId: number) {
  return request(`/api/v1/member/orders/${orderId}`)
}

export function payMemberOrder(orderId: number) {
  return request(`/api/v1/member/orders/${orderId}/pay`, { method: 'POST' })
}

// 弹窗
export function getMemberPopup() {
  return request('/api/v1/popups/member-activity')
}

export function logPopupAction(popupId: number, action: number) {
  return request(`/api/v1/popups/${popupId}/log`, { method: 'POST', data: { action } })
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
