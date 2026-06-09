import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Input, ScrollView } from '@tarojs/components'
import { IMAGE_BASE_URL, safeNavigateBack } from '../../../utils/api'
import './index.scss'

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
    <View className='footprint-page' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => safeNavigateBack()}>
          <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
      <View className='search-bar'>
        <Text className='search-icon'>🔍</Text>
        <Input
          className='search-input'
          placeholder='搜索足迹线路'
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
        />
        {keyword && <Text className='search-clear' onClick={() => setKeyword('')}>✕</Text>}
      </View>

      <ScrollView className='footprint-list' scrollY>
        {filtered.map(item => (
          <View key={item.id} className='footprint-card' onClick={() => goDetail(item.id)}>
            <Image className='footprint-image' src={item.cover_image ? (item.cover_image.startsWith('http') ? item.cover_image : `${IMAGE_BASE_URL}${item.cover_image}`) + '?w=750&q=75' : ''} mode='aspectFill' />
            <View className='footprint-info'>
              <Text className='footprint-name'>{item.name}</Text>
              {item.subtitle ? <Text className='footprint-subtitle'>{item.subtitle}</Text> : null}
              <Text className='footprint-meta'>
                {item.type_name || '线路'} · {item.has_schedule ? (item.price === 0 ? '免费' : `￥${item.price}起`) : '暂无营期'}
              </Text>
            </View>
          </View>
        ))}

        {filtered.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-text'>{keyword ? '未找到相关线路' : '暂无浏览足迹，快去发现精彩线路吧～'}</Text>
          </View>
        )}
      </ScrollView>

      {list.length > 0 && (
        <View className='footprint-footer'>
          <Text className='clear-btn' onClick={clearAll}>清空足迹</Text>
        </View>
      )}
    </View>
  )
}
