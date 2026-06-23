import { useEffect, useState } from 'react'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { View, Text, Image, ScrollView, Button, Swiper, SwiperItem, RichText } from '@tarojs/components'
import { getAdoptionDogDetail, IMAGE_BASE_URL, safeNavigateBack } from '../../../utils/api'
import './index.scss'

export default function AdoptionDetail() {
  const [detail, setDetail] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showServiceModal, setShowServiceModal] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      loadDetail(Number(id))
    }
  }, [])

  useDidShow(() => {
    const token = Taro.getStorageSync('access_token')
    setIsLoggedIn(!!token)
  })

  useShareAppMessage(() => {
    return {
      title: `给它一个家 · ${detail?.name || ''}`,
      path: `/pages/adoption/detail/index?id=${detail?.id}`,
      imageUrl: detail?.cover_image ? (detail.cover_image.startsWith('http') ? detail.cover_image : `${IMAGE_BASE_URL}${detail.cover_image}`) : '',
    }
  })

  const loadDetail = async (id: number) => {
    try {
      Taro.showLoading({ title: '加载中' })
      const res = await getAdoptionDogDetail(id)
      if (res.code === 200 && res.data) {
        setDetail(res.data)
      } else {
        Taro.showToast({ title: res.message || '加载失败', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const handleApply = () => {
    if (!isLoggedIn) {
      Taro.showModal({
        title: '提示',
        content: '请先登录',
        success: (res) => {
          if (res.confirm) {
            Taro.navigateTo({ url: '/pages/login/index' })
          }
        }
      })
      return
    }
    if (detail.application_status) {
      Taro.showToast({ title: `您已申请：${detail.application_status.status_name}`, icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/adoption/apply/index?id=${detail.id}` })
  }

  const handleConsult = () => {
    setShowServiceModal(true)
  }

  if (!detail) return null

  // 详情页优先展示封面图，再把图集追加到后面
  let images: string[] = []
  if (detail.cover_image) {
    images.push(detail.cover_image)
  }
  if (detail.images && Array.isArray(detail.images)) {
    detail.images.forEach((url: string) => {
      if (url && !images.includes(url)) images.push(url)
    })
  }
  const fullImages = images.map((url: string) =>
    url.startsWith('http') ? url + '?w=750&q=75' : `${IMAGE_BASE_URL}${url}?w=750&q=75`
  )

  const previewImage = (url: string) => {
    Taro.previewImage({ current: url, urls: fullImages })
  }

  const statusMap: Record<number, { text: string; color: string }> = {
    0: { text: '未开放', color: 'default' },
    1: { text: '可申请', color: 'success' },
    2: { text: '已领养', color: 'processing' },
    3: { text: '已下架', color: 'error' },
  }
  const statusConfig = statusMap[detail.status] || { text: '未知', color: 'default' }

  let btnText = statusConfig.text
  let btnDisabled = detail.status !== 1
  if (detail.status === 1) {
    if (detail.application_status) {
      btnText = detail.application_status.status_name
      btnDisabled = true
    } else {
      btnText = '申请领养'
      btnDisabled = false
    }
  }

  return (
    <View className='adoption-detail-page'>
      <ScrollView className='scroll-container' scrollY>
        {/* 大图轮播 */}
        <View className='cover-wrap'>
          <View className='page-back' onClick={() => safeNavigateBack()}>
            <Text className='page-back-icon'>＜</Text>
          </View>
          {fullImages.length > 0 ? (
            <>
              <Swiper
                className='image-swiper'
                indicatorColor='rgba(255,255,255,0.5)'
                indicatorActiveColor='#22C55E'
                circular
                indicatorDots
                onChange={(e) => setCurrentIndex(e.detail.current)}
              >
                {fullImages.map((url: string, index: number) => (
                  <SwiperItem key={index}>
                    <Image className='detail-cover' src={url} mode='aspectFill' onClick={() => previewImage(url)} />
                  </SwiperItem>
                ))}
              </Swiper>
              <View className='image-counter'>
                <Text className='image-counter-text'>{currentIndex + 1} / {fullImages.length}</Text>
              </View>
            </>
          ) : (
            <View className='cover-empty'>暂无图片</View>
          )}
          <View className='adopt-me-badge'>
            <Text className='adopt-me-text'>Adopt{'\n'}Me</Text>
          </View>
        </View>

        <View className='detail-content'>
          {/* 标题卡片 */}
          <View className='headline-card'>
            <View className='headline-top'>
              <View className='headline-left'>
                <Text className='status-tag'>{statusConfig.text}</Text>
                <Text className='detail-name'>{detail.name}</Text>
              </View>
              <View className='location-row'>
                <Text className='location-icon'>📍</Text>
                <Text className='location-text'>{detail.location || '待补充'}</Text>
              </View>
            </View>
            <Text className='headline-sub'>{[detail.breed, detail.age, detail.gender].filter(Boolean).join(' · ')} · 正在等待温暖怀抱</Text>
          </View>

          {/* 属性网格 */}
          <View className='attr-grid'>
            <View className='attr-item'>
              <View className='attr-icon'>♀</View>
              <View>
                <Text className='attr-label'>性别</Text>
                <Text className='attr-value'>{detail.gender || '不详'}</Text>
              </View>
            </View>
            <View className='attr-item'>
              <View className='attr-icon'>📅</View>
              <View>
                <Text className='attr-label'>年龄</Text>
                <Text className='attr-value'>{detail.age || '不详'}</Text>
              </View>
            </View>
            <View className='attr-item'>
              <View className='attr-icon'>⚖</View>
              <View>
                <Text className='attr-label'>体重</Text>
                <Text className='attr-value'>{detail.weight || '不详'}</Text>
              </View>
            </View>
            <View className='attr-item'>
              <View className='attr-icon'>🐾</View>
              <View>
                <Text className='attr-label'>品种</Text>
                <Text className='attr-value'>{detail.breed || '串串'}</Text>
              </View>
            </View>
          </View>

          {/* 健康状况 */}
          {detail.health_tags && detail.health_tags.length > 0 && (
            <View className='health-card'>
              <View className='card-title-with-icon'>
                <Text className='card-title-icon'>🛡</Text>
                <Text className='card-title'>健康状况</Text>
              </View>
              <View className='health-list'>
                {detail.health_tags.map((tag: string, idx: number) => (
                  <View key={idx} className='health-row'>
                    <Text className='health-dot'>✓</Text>
                    <Text className='health-text'>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 关于 TA */}
          {detail.story && (
            <View className='story-card'>
              <View className='card-title-with-icon'>
                <Text className='card-title-icon'>📖</Text>
                <Text className='card-title'>关于{detail.name}</Text>
              </View>
              <Text className='story-text'>{detail.story}</Text>
            </View>
          )}

          {/* 领养要求 */}
          {detail.adoption_requirements && (
            <View className='requirement-card'>
              <View className='card-title-with-icon'>
                <Text className='card-title-icon'>📝</Text>
                <Text className='card-title'>领养要求</Text>
              </View>
              <RichText className='requirement-text' nodes={detail.adoption_requirements} />
            </View>
          )}

        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View className='bottom-actions'>
        <View className='action-group'>
          <Button className='action-icon' openType='share'>
            <Text className='action-icon-text'>⇧</Text>
            <Text className='action-icon-label'>分享</Text>
          </Button>
          <View className='action-icon' onClick={handleConsult}>
            <Text className='action-icon-text'>💬</Text>
            <Text className='action-icon-label'>咨询</Text>
          </View>
        </View>
        <Button
          className={`apply-btn ${btnDisabled ? 'disabled' : ''}`}
          disabled={btnDisabled}
          onClick={handleApply}
        >
          {btnText}
        </Button>
      </View>

      {/* 联系客服弹窗 */}
      {showServiceModal && (
        <View className='service-modal-overlay' onClick={() => setShowServiceModal(false)}>
          <View className='service-modal' onClick={(e) => e.stopPropagation()}>
            <Text className='service-modal-title'>联系客服</Text>
            <Image
              className='service-modal-qr'
              src='/assets/images/customer-service.jpg'
              mode='aspectFit'
              showMenuByLongpress
            />
            <Text className='service-modal-tip'>长按二维码识别，添加客服</Text>
            <View className='service-modal-btn' onClick={() => setShowServiceModal(false)}>
              <Text className='service-modal-btn-text'>关闭</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
