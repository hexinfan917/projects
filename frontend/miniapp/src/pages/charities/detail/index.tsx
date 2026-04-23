import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView, RichText, Button } from '@tarojs/components'
import { getCharityActivityDetail } from '../../../utils/api'
import './index.scss'

export default function CharityDetail() {
  const [detail, setDetail] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      loadDetail(Number(id))
    }
    // Check login status
    const token = Taro.getStorageSync('access_token')
    setIsLoggedIn(!!token)
  }, [])

  const loadDetail = async (id: number) => {
    try {
      Taro.showLoading({ title: '加载中' })
      const res = await getCharityActivityDetail(id)
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

  const handleJoin = () => {
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
    Taro.showToast({ title: '报名功能开发中', icon: 'none' })
  }

  if (!detail) return null

  const coverImage = detail.cover_image ? (detail.cover_image.startsWith('http') ? detail.cover_image : `http://localhost:8081${detail.cover_image}`) : ''
  const statusMap: Record<string, string> = {
    '1': '报名中',
    '2': '进行中',
    '3': '已结束',
  }
  const statusText = detail.status_name || statusMap[String(detail.status)] || '报名中'
  const statusClass = statusText === '报名中' ? 'open' : statusText === '进行中' ? 'progress' : 'closed'
  
  // 解析图集
  let galleryImages: string[] = []
  if (detail.images) {
    try {
      galleryImages = typeof detail.images === 'string' ? JSON.parse(detail.images) : detail.images
    } catch (e) {
      console.error('Failed to parse gallery images:', e)
    }
  }
  galleryImages = galleryImages.filter((url: string) => url !== detail.cover_image)
  
  const getFullImageUrl = (url: string) => url.startsWith('http') ? url : `http://localhost:8081${url}`

  // 处理 RichText 内容中的图片，使其自适应宽度
  const processedContent = detail.content
    ? detail.content.replace(/<img([^>]*?)>/gi, (match: string, attrs: string) => {
        // 1. 移除 width/height 属性（支持单双引号和无引号）
        let newAttrs = attrs
          .replace(/\s+width\s*=\s*["']?[^"'>\s]*["']?/gi, '')
          .replace(/\s+height\s*=\s*["']?[^"'>\s]*["']?/gi, '')
        
        // 2. 处理 style 属性：移除其中的 width/height 定义
        const styleMatch = newAttrs.match(/style\s*=\s*"([^"]*)"/i)
        if (styleMatch) {
          let styleValue = styleMatch[1]
            .replace(/\bwidth\s*:\s*[^;]+;?/gi, '')
            .replace(/\bheight\s*:\s*[^;]+;?/gi, '')
            .replace(/;+/g, ';')
            .replace(/^;|;$/g, '')
          newAttrs = newAttrs.replace(/style\s*=\s*"[^"]*"/i, `style="${styleValue};max-width:100%;height:auto;display:block;"`)
        } else {
          newAttrs += ' style="max-width:100%;height:auto;display:block;"'
        }
        return `<img${newAttrs}>`
      })
    : ''

  return (
    <View className='charity-detail-page'>
      <ScrollView className='scroll-container' scrollY>
        {/* 状态栏占位，避免刘海遮挡内容 */}
        <View className='status-bar-placeholder' />
        {/* Cover 图片 */}
        <View className='cover-wrap'>
          <View className='detail-back' onClick={() => Taro.navigateBack()}>
            <Text className='detail-back-icon'>←</Text>
          </View>
          {coverImage && (
            <Image className='detail-cover' src={coverImage} mode='aspectFill' />
          )}
        </View>
        <View className='detail-content'>
          <View className='detail-header'>
            <Text className='detail-title'>{detail.title}</Text>
            <Text className={`status-badge status-${statusClass}`}>{statusText}</Text>
          </View>
          {detail.subtitle && <Text className='detail-subtitle'>{detail.subtitle}</Text>}
          <View className='detail-meta'>
            {detail.location && <Text className='meta-item'>📍 {detail.location}</Text>}
            {detail.start_date && <Text className='meta-item'>📅 开始: {detail.start_date}</Text>}
            {detail.end_date && <Text className='meta-item'>🏁 结束: {detail.end_date}</Text>}
            {detail.current_participants > 0 && (
              <Text className='meta-item'>✅ 已报名: {detail.current_participants}人</Text>
            )}
          </View>
          
          {/* 图集展示 */}
          {galleryImages.length > 0 && (
            <View className='gallery-section'>
              <Text className='gallery-title'>📷 活动图集 ({galleryImages.length}张)</Text>
              <View className='gallery-grid'>
                {galleryImages.map((url: string, index: number) => (
                  <Image
                    key={index}
                    className='gallery-image'
                    src={getFullImageUrl(url)}
                    mode='aspectFill'
                    onClick={() => {
                      Taro.previewImage({
                        current: getFullImageUrl(url),
                        urls: galleryImages.map(getFullImageUrl)
                      })
                    }}
                  />
                ))}
              </View>
            </View>
          )}
          
          <View className='detail-body'>
            {/* 使用原生 rich-text 组件，通过 tagStyle 控制图片自适应 */}
            <rich-text
              nodes={processedContent}
              tagStyle={{ img: 'max-width:100%;height:auto;display:block;' }}
            />
          </View>
        </View>
      </ScrollView>
      <View className='bottom-bar'>
        <Button
          className={`join-btn ${statusClass !== 'open' ? 'disabled' : ''}`}
          disabled={statusClass !== 'open'}
          onClick={handleJoin}
        >
          {statusClass === 'open' ? '立即报名' : statusText}
        </Button>
      </View>
    </View>
  )
}
