import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Input, ScrollView } from '@tarojs/components'
import { IMAGE_BASE_URL, safeNavigateBack } from '../../../utils/api'
import './index.scss'

const emptyIcon = require('../../../assets/icons/profile/footprint.png')
const locationIcon = require('../../../assets/icons/profile/location.svg')

export default function Footprint() {
  const [list, setList] = useState<any[]>([])
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    const footprints = Taro.getStorageSync('footprint_routes') || []
    setList(footprints)
  }, [])

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
    <View className='footprint-page' style={{ paddingTop: 'calc(100rpx + env(safe-area-inset-top))' }}>
      <View className='footprint-navbar' style={{ paddingTop: 'calc(100rpx + env(safe-area-inset-top))' }}>
        <View className='footprint-navbar-back' onClick={() => safeNavigateBack()}>
          <Image className='footprint-navbar-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
        <Text className='footprint-navbar-title'>我的足迹</Text>
      </View>

      <View className='footprint-search-bar'>
        <Image className='footprint-search-icon' src='/assets/icons/profile/search.svg' mode='aspectFit' />
        <Input
          className='footprint-search-input'
          placeholder='搜索足迹活动'
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          placeholderClass='footprint-search-placeholder'
        />
        {keyword && <Text className='footprint-search-clear' onClick={() => setKeyword('')}>✕</Text>}
      </View>

      {filtered.length > 0 && (
        <View className='footprint-section-header'>
          <Text className='footprint-section-title'>最近浏览</Text>
          <Text className='footprint-section-count'>共 {filtered.length} 条记录</Text>
        </View>
      )}

      <ScrollView className='footprint-list' scrollY>
        {filtered.map(item => (
          <View key={item.id} className='footprint-card' onClick={() => goDetail(item.id)}>
            <Image
              className='footprint-image'
              src={item.cover_image ? (item.cover_image.startsWith('http') ? item.cover_image : `${IMAGE_BASE_URL}${item.cover_image}`) + '?w=750&q=75' : ''}
              mode='aspectFill'
            />
            <View className='footprint-info'>
              <Text className='footprint-name'>{item.name}</Text>
              <View className='footprint-location'>
                <Image className='footprint-location-icon' src={locationIcon as string} mode='aspectFit' />
                <Text className='footprint-location-text'>{item.subtitle || '暂无地点信息'}</Text>
              </View>
            </View>
          </View>
        ))}

        {filtered.length === 0 && (
          <View className='empty-state'>
            <View className='empty-icon-wrap'>
              <Image className='empty-icon' src={emptyIcon as string} mode='aspectFit' />
            </View>
            <Text className='empty-title'>这里还没有足迹</Text>
            <Text className='empty-text'>{keyword ? '未找到相关活动' : '暂无浏览足迹，快去发现精彩活动吧~'}</Text>
            {!keyword && (
              <View className='empty-action-btn' onClick={() => Taro.switchTab({ url: '/pages/routes/index' })}>
                <Text className='empty-action-text'>去发现</Text>
                <Text className='empty-action-arrow'>↗</Text>
              </View>
            )}
          </View>
        )}

        {filtered.length > 0 && (
          <View className='footprint-end'>
            <Text className='footprint-end-text'>没有更多足迹了</Text>
            <View className='footprint-clear-btn' onClick={clearAll}>
              <Image className='footprint-clear-icon' src='/assets/icons/profile/clear.svg' mode='aspectFit' />
              <Text className='footprint-clear-text'>清空足迹</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
