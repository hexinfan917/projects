import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import './index.scss'

const TABS = ['附近', '城市', '路线规划']
const POI_TYPES = ['全部', '酒店', '餐厅', '公园', '景点', '医院']

export default function MapPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [activeType, setActiveType] = useState('全部')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    // 这里实际应该调起 map 组件，先用占位展示
  }, [])

  return (
    <View className='map-page'>
      <View className='map-search-bar'>
        <Input
          className='map-search-input'
          placeholder='搜索地点、路线'
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
        />
        <Text className='map-filter-btn'>筛选</Text>
      </View>

      <View className='map-container'>
        <Text className='map-placeholder'>地图区域（需接入高德/腾讯地图SDK）</Text>
      </View>

      <View className='map-tabs'>
        {TABS.map((t, idx) => (
          <Text
            key={t}
            className={`map-tab ${activeTab === idx ? 'active' : ''}`}
            onClick={() => setActiveTab(idx)}
          >
            {t}
          </Text>
        ))}
      </View>

      {activeTab === 0 && (
        <ScrollView className='type-scroll' scrollX>
          {POI_TYPES.map(type => (
            <Text
              key={type}
              className={`type-item ${activeType === type ? 'active' : ''}`}
              onClick={() => setActiveType(type)}
            >
              {type}
            </Text>
          ))}
        </ScrollView>
      )}

      <View className='poi-list'>
        <View className='poi-card'>
          <Text className='poi-name'>某某宠物友好酒店</Text>
          <Text className='poi-info'>[酒店] 距离 1.2km · 评分 4.5</Text>
          <Text className='poi-desc'>接受大型犬，提供宠物床和餐具</Text>
        </View>
        <View className='poi-card'>
          <Text className='poi-name'>宠物主题餐厅</Text>
          <Text className='poi-info'>[餐厅] 距离 800m · 评分 4.8</Text>
          <Text className='poi-desc'>有宠物专属菜单，户外露台区域</Text>
        </View>
      </View>
    </View>
  )
}
