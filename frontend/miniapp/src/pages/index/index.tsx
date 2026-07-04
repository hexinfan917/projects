import { useEffect, useState } from 'react'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { setActiveTab, getRoutes, getReviews, getBanners, getMemberPopup, logPopupAction, getMemberCenter, getAdoptionDogs, IMAGE_BASE_URL } from '../../utils/api'
import { View, Text, Swiper, SwiperItem, Image, ScrollView } from '@tarojs/components'
const logoIcon = '/assets/toplogo.png'

import './index.scss'

definePageConfig({
  enableShareAppMessage: true,
  enableShareTimeline: true,
})

// 快捷入口模块
const QUICK_MODULES = [
  { key: 'featured', label: '精选路线', icon: '/assets/icons/featured.svg', path: '/pages/routes/index' },
  { key: 'personality', label: '犬格检测', icon: '/assets/icons/personality.svg', path: '/pages/routes/index' },
  { key: 'adoption', label: '狗狗领养', icon: '/assets/icons/adoption.svg', path: '/pages/adoption/index/index' },
  { key: 'wiki', label: '狗狗回顾', icon: '/assets/icons/wiki.svg', path: '/pages/reviews/list/index' },
]

// 首页（发现页）- V2 沉浸式设计
export default function Index() {
  const [banners, setBanners] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [adoptionDogs, setAdoptionDogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [popupVisible, setPopupVisible] = useState(false)
  const [popupData, setPopupData] = useState<any>(null)
  const [heroCurrent, setHeroCurrent] = useState(0)
  const [isMember, setIsMember] = useState(false)

  // 分享给好友
  useShareAppMessage(() => {
    return {
      title: '尾巴PetWay - 带宠出行首选',
      path: '/pages/index/index',
      imageUrl: routes[0]?.cover_image || logoIcon,
    }
  })

  // 分享到朋友圈
  useShareTimeline(() => {
    return {
      title: '尾巴PetWay - 带宠出行首选',
      query: '',
      imageUrl: routes[0]?.cover_image || logoIcon,
    }
  })

  useDidShow(() => {
    loadHomeData()
    setActiveTab(0, 'pages/index/index')
    loadPopup()
    getMemberCenter().then(res => setIsMember(!!res.data?.is_member)).catch(() => setIsMember(false))
  })

  useEffect(() => {
    loadHomeData()
  }, [])

  const loadPopup = async () => {
    const dismissed = Taro.getStorageSync('home_popup_dismissed')
    if (dismissed) return
    try {
      const res = await getMemberPopup()
      if (res.code === 200 && res.data?.should_show) {
        const popup = res.data.popup
        setPopupData(popup)
        setPopupVisible(true)
        if (popup?.id) {
          logPopupAction(popup.id, 1)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handlePopupClose = () => {
    setPopupVisible(false)
    Taro.setStorageSync('home_popup_dismissed', true)
    if (popupData?.id) {
      logPopupAction(popupData.id, 3)
    }
  }

  const handlePopupOpen = () => {
    setPopupVisible(false)
    Taro.setStorageSync('home_popup_dismissed', true)
    if (popupData?.id) {
      logPopupAction(popupData.id, 2)
    }
    const token = Taro.getStorageSync('access_token')
    const targetUrl = popupData?.target_page || '/pages/member/center/index'
    if (!token) {
      Taro.navigateTo({ url: `/pages/login/index?redirect=${targetUrl}` })
      return
    }
    Taro.navigateTo({ url: targetUrl })
  }

  const loadHomeData = async () => {
    try {
      setLoading(true)
      
      // 顺序加载所有数据，避免 Promise.allSettled 兼容性问题
      const bannerRes = await getBanners()
      if (bannerRes.code === 200 && bannerRes.data?.banners) {
        setBanners(bannerRes.data.banners.map((b: any) => ({
          id: b.id,
          image: b.image_url ? (b.image_url.startsWith('http') ? b.image_url : `${IMAGE_BASE_URL}${b.image_url}`) + '?w=750&q=75' : '',
          link_url: b.link_url || '',
          title: b.title || '',
          subtitle: b.subtitle || '',
          tag: b.tag || '',
        })))
      } else {
        setBanners([])
      }

      const routeRes = await getRoutes({ page_size: 4, sort_by: 'recommend', is_hot: 1 })
      if (routeRes.code === 200 && routeRes.data?.routes) {
        setRoutes(routeRes.data.routes.map((r: any) => ({
          id: r.id,
          name: r.name,
          type: r.route_type_name || r.type_name || '精选',
          price: isMember && r.schedule_member_price != null
            ? r.schedule_member_price
            : ((r.schedule_price !== undefined && r.schedule_price !== null) ? r.schedule_price : (r.price || 0)),
          cover_image: r.cover_image ? (r.cover_image.startsWith('http') ? r.cover_image : `${IMAGE_BASE_URL}${r.cover_image}`) + '?w=750&q=85' : 'https://via.placeholder.com/750x480/CCCCCC/FFFFFF?text=No+Image',
          subtitle: r.subtitle || '',
          location: r.location || '',
        })))
      }

      const reviewRes = await getReviews({ page_size: 4 })
      if (reviewRes.code === 200 && reviewRes.data?.articles) {
        setReviews(reviewRes.data.articles.map((a: any) => ({
          id: a.id,
          title: a.title,
          date: a.event_date || '',
          location: a.location || '',
          participants: a.participants || 0,
          image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `${IMAGE_BASE_URL}${a.cover_image}`) + '?w=750&q=75' : 'https://via.placeholder.com/700x380/CCCCCC/FFFFFF?text=No+Image',
        })))
      }

      const adoptionRes = await getAdoptionDogs({ page_size: 3, status: 1 })
      if (adoptionRes.code === 200 && adoptionRes.data?.dogs) {
        setAdoptionDogs(adoptionRes.data.dogs.map((d: any) => ({
          id: d.id,
          name: d.name,
          breed: d.breed || '',
          age: d.age || '',
          location: d.location || '',
          image: d.cover_image ? (d.cover_image.startsWith('http') ? d.cover_image : `${IMAGE_BASE_URL}${d.cover_image}`) + '?w=750&q=75' : 'https://via.placeholder.com/700x380/22C55E/FFFFFF?text=Adoption',
        })))
      }
    } catch (error) {
      console.error('Load home data failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = () => {
    loadHomeData()
  }

  const goToRouteDetail = (route: any) => {
    const footprints = Taro.getStorageSync('footprint_routes') || []
    const filtered = footprints.filter((f: any) => f.id !== route.id)
    const record = { id: route.id, name: route.name, cover_image: route.cover_image, type_name: route.type || '', subtitle: route.subtitle || '', price: route.price, has_schedule: route.price !== undefined && route.price !== null, timestamp: Date.now() }
    Taro.setStorageSync('footprint_routes', [record, ...filtered].slice(0, 100))
    Taro.navigateTo({ url: `/pages/routes/detail/index?id=${route.id}` })
  }

  const goToReviewDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/reviews/detail/index?id=${id}` })
  }

  const goToAdoptionDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/adoption/detail/index?id=${id}` })
  }

  const goToAdoptionList = () => {
    Taro.navigateTo({ url: '/pages/adoption/index/index' })
  }

  const handleQuickModule = (module: typeof QUICK_MODULES[0]) => {
    if (module.key === 'personality') {
      Taro.showToast({ title: '功能正在开发中，敬请期待', icon: 'none' })
      return
    }
    if (module.path === '/pages/adoption/index/index') {
      goToAdoptionList()
      return
    }
    if (module.path.startsWith('/pages/')) {
      if (module.path === '/pages/routes/index') {
        Taro.switchTab({ url: module.path })
      } else {
        Taro.navigateTo({ url: module.path })
      }
    }
  }

  // 轮播图兜底 - 无数据时显示默认占位
  const displayBanners = banners.length > 0 ? banners : [
    { id: 0, image: '', link_url: '', title: '', subtitle: '', tag: '' },
  ]

  return (
    <View className='index-page'>
      {/* 顶部导航栏 */}
      <View className='top-app-bar'>
        <View className='top-app-bar-bg' />
        <View className='top-app-bar-content'>
          <View className='top-app-bar-left'>
            <Image className='top-app-bar-icon' src={logoIcon} mode='aspectFit' />
            <Text className='top-app-bar-title'>PetWay</Text>
          </View>
          <View className='top-app-bar-right'>
            <Text className='top-app-bar-dot'>●</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className='scroll-container'
        scrollY
        refresherEnabled
        refresherTriggered={loading}
        onRefresherRefresh={onRefresh}
      >
        {/* 1. 沉浸式竖版轮播图 */}
        <View className='hero-section'>
          <Swiper
            className='hero-swiper'
            vertical
            autoplay
            interval={5000}
            duration={800}
            circular
            current={heroCurrent}
            onChange={(e) => setHeroCurrent(e.detail.current)}
          >
            {displayBanners.map((banner, idx) => (
              <SwiperItem key={String(banner.id || idx)}>
                <View className='hero-slide' onClick={() => {
                  if (banner.link_url) {
                    // 统一处理跳转链接：补全前导斜杠，确保 ? 参数正确
                    let url = banner.link_url.trim()
                    if (!url.startsWith('/')) {
                      url = '/' + url
                    }
                    Taro.navigateTo({ url })
                  } else {
                    // 没有链接时，切换到下一张
                    const nextIndex = (heroCurrent + 1) % displayBanners.length
                    setHeroCurrent(nextIndex)
                  }
                }}>
                  {banner.image ? (
                    <Image className='hero-image' src={banner.image} mode='aspectFill' lazyLoad />
                  ) : (
                    <View className='hero-image hero-image-placeholder' />
                  )}
                  <View className='hero-gradient' />
                  <View className='hero-content'>
                    {banner.tag && <Text className='hero-tag'>{banner.tag}</Text>}
                    {banner.title && <Text className='hero-title'>{banner.title}</Text>}
                    {banner.subtitle && <Text className='hero-subtitle'>{banner.subtitle}</Text>}
                  </View>
                </View>
              </SwiperItem>
            ))}
          </Swiper>
          {/* 向下滚动提示 */}
          <View className='scroll-hint' onClick={(e) => {
            e.stopPropagation()
            const nextIndex = (heroCurrent + 1) % displayBanners.length
            setHeroCurrent(nextIndex)
          }}>
            <View className='scroll-hint-arrow'>
              <View className='scroll-hint-line scroll-hint-left' />
              <View className='scroll-hint-line scroll-hint-right' />
            </View>
            <View className='scroll-hint-arrow'>
              <View className='scroll-hint-line scroll-hint-left' />
              <View className='scroll-hint-line scroll-hint-right' />
            </View>
          </View>
        </View>

        {/* 2. 四大功能模块 */}
        <View className='quick-modules-wrap'>
          <View className='quick-modules-shadow' />
          <View className='quick-modules-card'>
            <View className='quick-modules-card-top-shade' />
            {QUICK_MODULES.map(module => (
              <View key={module.key} className='quick-module-item' onClick={() => handleQuickModule(module)}>
                <View className='quick-module-icon'>
                  <Image className='quick-module-icon-img' src={module.icon} mode='aspectFit' />
                </View>
                <Text className='quick-module-label'>{module.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 3. 热门活动 - 横向滚动卡片 */}
        {routes.length > 0 && (
          <View className='section-block activity-section'>
            <View className='section-header-row'>
              <View>
                <Text className='section-title-main'>热门活动</Text>
                <Text className='section-title-sub'>精选最受欢迎的宠物友好目的地</Text>
              </View>
              <Text className='section-more' onClick={() => Taro.switchTab({ url: '/pages/routes/index' })}>更多 {'>'}</Text>
            </View>

            <ScrollView className='trip-scroll' scrollX showScrollbar={false}>
              {routes.map((route) => (
                <View key={route.id} className='trip-card' onClick={() => goToRouteDetail(route)}>
                  <Image className='trip-image' src={route.cover_image} mode='aspectFill' lazyLoad />
                  <View className='trip-tag'>{route.type}</View>
                  <View className='trip-overlay'>
                    <Text className='trip-name'>{route.name}</Text>
                    <Text className='trip-subtitle'>{route.subtitle || route.location}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 4. 狗狗领养 - 轮播图 */}
        {adoptionDogs.length > 0 && (
          <View className='section-block adoption-section'>
            <View className='section-header-row'>
              <View>
                <Text className='section-title-main'>狗狗领养</Text>
                <Text className='section-title-sub'>给流浪的它一个温暖的家</Text>
              </View>
              <Text className='section-more' onClick={goToAdoptionList}>更多 {'>'}</Text>
            </View>
            <View className='adoption-carousel'>
              <Swiper
                className='adoption-swiper'
                autoplay
                interval={4000}
                duration={500}
                circular
              >
                {adoptionDogs.map((dog) => (
                  <SwiperItem key={dog.id}>
                    <View className='adoption-slide' onClick={() => goToAdoptionDetail(dog.id)}>
                      <Image className='adoption-image' src={dog.image} mode='aspectFill' lazyLoad />
                      <View className='adoption-gradient' />
                      <View className='adoption-content'>
                        <Text className='adotion-quote'>{dog.name}</Text>
                        <Text className='adoption-desc'>{dog.breed} · {dog.age} · {dog.location}</Text>
                        <View className='adoption-btn'>
                          <Text className='adoption-btn-text'>了解详情</Text>
                        </View>
                      </View>
                    </View>
                  </SwiperItem>
                ))}
              </Swiper>
            </View>
          </View>
        )}

        {/* 5. 狗狗回顾 - 横向滚动卡片（复用 trip-card 样式） */}
        {reviews.length > 0 && (
          <View className='section-block review-section'>
            <View className='section-header-row'>
              <View>
                <Text className='section-title-main'>狗狗回顾</Text>
                <Text className='section-title-sub'>记录每一次与毛孩子的美好瞬间</Text>
              </View>
              <Text className='section-more' onClick={() => Taro.navigateTo({ url: '/pages/reviews/list/index' })}>更多 {'>'}</Text>
            </View>
            <ScrollView className='trip-scroll' scrollX showScrollbar={false}>
              {reviews.map((review) => (
                <View key={review.id} className='trip-card' onClick={() => goToReviewDetail(review.id)}>
                  <Image className='trip-image' src={review.image} mode='aspectFill' lazyLoad />
                  <View className='trip-overlay'>
                    <Text className='trip-name'>{review.title}</Text>
                    <Text className='trip-subtitle'>{review.date || review.location}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 安全区占位 */}
        <View className='safe-bottom-placeholder' />
      </ScrollView>

      {/* 弹窗 */}
      {popupVisible && popupData && (
        <View className='member-popup-wrap'>
          <View className='member-popup-mask' onClick={handlePopupClose} />
          <View className='member-popup-content'>
            <Text className='member-popup-close' onClick={handlePopupClose}>✕</Text>
            <Image className='member-popup-poster' src={popupData.image ? (popupData.image.startsWith('http') ? popupData.image : `${IMAGE_BASE_URL}${popupData.image}`) + '?w=600&q=75' : '/assets/images/member.jpg'} mode='widthFix' />
            {popupData.title && <Text className='member-popup-title'>{popupData.title}</Text>}
            {popupData.subtitle && <Text className='member-popup-subtitle'>{popupData.subtitle}</Text>}
            {popupData.content?.benefits?.length > 0 && (
              <View className='member-popup-benefits'>
                {popupData.content.benefits.map((b: string, i: number) => (
                  <Text key={i} className='member-popup-benefit'>• {b}</Text>
                ))}
              </View>
            )}
            {popupData.content?.price_display && (
              <View className='member-popup-price-row'>
                <Text className='member-popup-price'>{popupData.content.price_display}</Text>
                {popupData.content.original_price && <Text className='member-popup-original'>{popupData.content.original_price}</Text>}
              </View>
            )}
            <View className='member-popup-footer'>
              <View 
                className='member-popup-btn' 
                style={{ backgroundColor: popupData.primary_btn_color || '#FF6B35' }}
                onClick={handlePopupOpen}
              >
                <Text className='member-popup-btn-text'>{popupData.primary_btn_text || '立即开通'}</Text>
              </View>
              {popupData.close_btn_text && (
                <Text className='member-popup-close-text' onClick={handlePopupClose}>{popupData.close_btn_text}</Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
