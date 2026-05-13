import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView, RichText } from '@tarojs/components'
import { getReviewDetail, likeArticle } from '../../../utils/api'
import './index.scss'

export default function ReviewDetail() {
  const [detail, setDetail] = useState<any>(null)
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      loadDetail(Number(id))
    }
  }, [])

  const loadDetail = async (id: number) => {
    try {
      Taro.showLoading({ title: '加载中' })
      const res = await getReviewDetail(id)
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

  const handleLike = async () => {
    if (!detail || liked) return
    try {
      const res = await likeArticle(detail.id)
      if (res.code === 200) {
        setLiked(true)
        setDetail({ ...detail, like_count: (detail.like_count || 0) + 1 })
        Taro.showToast({ title: '点赞成功', icon: 'none' })
      }
    } catch (error) {
      console.error('Like failed:', error)
    }
  }

  if (!detail) return null

  const coverImage = detail.cover_image ? (detail.cover_image.startsWith('http') ? detail.cover_image : `https://tailtravel.westilt.com${detail.cover_image}`) : ''
  
  // 解析图集
  let galleryImages: string[] = []
  if (detail.images) {
    try {
      galleryImages = typeof detail.images === 'string' ? JSON.parse(detail.images) : detail.images
    } catch (e) {
      console.error('Failed to parse gallery images:', e)
    }
  }
  // 过滤掉封面图（避免重复显示）
  galleryImages = galleryImages.filter((url: string) => url !== detail.cover_image)
  
  const getFullImageUrl = (url: string) => url.startsWith('http') ? url : `https://tailtravel.westilt.com${url}`

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
    <View className='review-detail-page'>
      <View className='page-back' onClick={() => Taro.navigateBack()}>
        <Text className='page-back-icon'>←</Text>
      </View>
      <ScrollView className='scroll-container' scrollY>
        {coverImage && (
          <Image className='detail-cover' src={coverImage} mode='aspectFill' />
        )}
        <View className='detail-content'>
          <Text className='detail-title'>{detail.title}</Text>
          {detail.subtitle && <Text className='detail-subtitle'>{detail.subtitle}</Text>}
          <View className='detail-meta'>
            {detail.location && <Text className='meta-item'>📍 {detail.location}</Text>}
            {detail.event_date && <Text className='meta-item'>📅 {detail.event_date}</Text>}
            {detail.participants > 0 && <Text className='meta-item'>🐕 {detail.participants}只狗狗参与</Text>}
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
          <View className='detail-footer'>
            <View className='footer-item' onClick={handleLike}>
              <Text className={liked ? 'liked' : ''}>❤️ {detail.like_count || 0}</Text>
            </View>
            <View className='footer-item'>
              <Text>👁 {detail.view_count || 0}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
