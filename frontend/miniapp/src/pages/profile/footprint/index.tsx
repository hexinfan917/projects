import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Input, ScrollView } from '@tarojs/components'
import { IMAGE_BASE_URL, safeNavigateBack } from '../../../utils/api'
import './index.scss'

function formatDate(timestamp?: number) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function Footprint() {
  const [list, setList] = useState<any[]>([])
  const [keyword, setKeyword] = useState('')
  const [statusBarHeight, setStatusBarHeight] = useState(40)

  useEffect(() => {
    const sysInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(sysInfo.statusBarHeight || 40)
    const footprints = Taro.getStorageSync('footprint_routes') || []
    setList(footprints)
  }, [])

  const navHeight = (statusBarHeight + 44 + 4) * 2

  const filtered = list.filter((item: any) =>
    item.name?.includes(keyword) || item.subtitle?.includes(keyword)
  )

  const goDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/routes/detail/index?id=${id}` })
  }

  const clearAll = () => {
    Taro.showModal({
      title: '提示',
      content: '确定清空所有足迹吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.removeStorageSync('footprint_routes')
          setList([])
        }
      }
    })
  }

  return (
    <View className='footprint-page' style={{ paddingTop: `${navHeight}rpx` }}>
      <View
        className='footprint-header'
        style={{
          paddingTop: `${statusBarHeight}px`,
          height: `${navHeight}rpx`,
          boxSizing: 'border-box'
        }}
      >
        <View className='page-back' onClick={() => safeNavigateBack()}>
          <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
        <Text className='footprint-title'>我的足迹</Text>
        <View className='navbar-capsule'>
          <Image className='capsule-icon' src='/assets/icons/icon-more.svg' mode='aspectFit' />
          <View className='capsule-divider' />
          <Image className='capsule-icon' src='/assets/icons/icon-dot.svg' mode='aspectFit' />
        </View>
      </View>

      <View className='search-bar'>
        <Text className='search-icon'>🔍</Text>
        <Input
          className='search-input'
          placeholder='搜索足迹活动'
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
        />
        {keyword && <Text className='search-clear' onClick={() => setKeyword('')}>✕</Text>}
      </View>

      <View className='section-header'>
        <Text className='section-title'>最近浏览</Text>
        <Text className='section-count'>共 {filtered.length} 条记录</Text>
      </View>

      <ScrollView className='footprint-list' scrollY>
        {filtered.map(item => (
          <View key={item.id} className='footprint-card' onClick={() => goDetail(item.id)}>
            <Image
              className='footprint-image'
              src={item.cover_image ? (item.cover_image.startsWith('http') ? item.cover_image : `${IMAGE_BASE_URL}${item.cover_image}`) + '?w=200&q=75' : ''}
              mode='aspectFill'
            />
            <View className='footprint-info'>
              <Text className='footprint-name'>{item.name}</Text>
              {item.subtitle ? (
                <View className='footprint-location'>
                  <View className='location-icon' />
                  <Text className='location-text'>{item.subtitle}</Text>
                </View>
              ) : null}
              <Text className='footprint-time'>访问于 {formatDate(item.timestamp)}</Text>
            </View>
            <Text className='footprint-arrow'>›</Text>
          </View>
        ))}

        {filtered.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-text'>{keyword ? '未找到相关活动' : '暂无浏览足迹，快去发现精彩活动吧～'}</Text>
          </View>
        )}

        {filtered.length > 0 && (
          <View className='list-footer'>
            <Text className='no-more-text'>没有更多足迹了</Text>
            <View className='clear-btn' onClick={clearAll}>
              <Image className='clear-icon' src='/assets/icons/icon-trash.svg' mode='aspectFit' />
              <Text className='clear-text'>清空足迹</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
