import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import { getPOIs, getNearbyPOIs, setActiveTab } from '../../utils/api'
import './index.scss'

const TABS = ['附近', '城市']
const POI_TYPE_MAP: Record<string, number | undefined> = {
  '全部': undefined,
  '酒店': 1,
  '餐厅': 2,
  '公园': 3,
  '景点': 4,
  '医院': 5,
}

export default function MapPage() {
  const [activeTab, setActiveTabState] = useState(0)
  const [activeType, setActiveType] = useState('全部')
  const [keyword, setKeyword] = useState('')
  const [pois, setPois] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useDidShow(() => {
    setActiveTab(1, 'pages/map/index')
  })

  useEffect(() => {
    setPage(1)
    setHasMore(true)
    loadPOIs(1, true)
  }, [activeTab, activeType])

  const loadPOIs = async (targetPage: number = 1, reset: boolean = false) => {
    if (loading) return
    try {
      setLoading(true)
      let res: any
      if (activeTab === 0) {
        // 附近模式：获取定位后搜索附近POI（演示用固定坐标杭州西湖）
        res = await getNearbyPOIs({
          longitude: 120.1551,
          latitude: 30.2741,
          radius: 10,
          poi_type: POI_TYPE_MAP[activeType],
          page: targetPage,
          page_size: 10,
        })
      } else {
        // 城市模式：按类型和关键词搜索
        res = await getPOIs({
          poi_type: POI_TYPE_MAP[activeType],
          keyword: keyword || undefined,
          page: targetPage,
          page_size: 10,
        })
      }

      if (res.code === 200 && res.data?.pois) {
        const list = res.data.pois
        if (reset) {
          setPois(list)
        } else {
          setPois(prev => [...prev, ...list])
        }
        setHasMore(list.length === 10)
      } else {
        if (reset) setPois([])
        setHasMore(false)
      }
    } catch (error) {
      console.error('Load POIs failed:', error)
      if (reset) setPois([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    setHasMore(true)
    loadPOIs(1, true)
  }

  const loadMore = () => {
    if (!hasMore || loading) return
    const nextPage = page + 1
    setPage(nextPage)
    loadPOIs(nextPage, false)
  }

  const goToDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/map/detail/index?id=${id}` })
  }

  const getTypeName = (type: number) => {
    const map: Record<number, string> = { 1: '酒店', 2: '餐厅', 3: '公园', 4: '景点', 5: '医院', 6: '服务区' }
    return map[type] || '其他'
  }

  return (
    <View className='map-page' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      <View className='map-search-bar'>
        <Input
          className='map-search-input'
          placeholder='搜索地点、POI'
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={handleSearch}
        />
        <Text className='map-filter-btn' onClick={handleSearch}>搜索</Text>
      </View>

      <View className='map-container'>
        <Text className='map-placeholder'>
          地图区域（需接入高德/腾讯地图SDK）{'\n'}
          当前展示 {pois.length} 个POI结果
        </Text>
      </View>

      <View className='map-tabs'>
        {TABS.map((t, idx) => (
          <Text
            key={t}
            className={`map-tab ${activeTab === idx ? 'active' : ''}`}
            onClick={() => setActiveTabState(idx)}
          >
            {t}
          </Text>
        ))}
      </View>

      <ScrollView className='type-scroll' scrollX>
        {Object.keys(POI_TYPE_MAP).map(type => (
          <Text
            key={type}
            className={`type-item ${activeType === type ? 'active' : ''}`}
            onClick={() => setActiveType(type)}
          >
            {type}
          </Text>
        ))}
      </ScrollView>

      <ScrollView
        className='poi-list'
        scrollY
        lowerThreshold={100}
        onScrollToLower={loadMore}
      >
        {pois.length === 0 && !loading && (
          <View className='empty-tip'>
            <Text>暂无POI数据，试试其他分类或关键词</Text>
          </View>
        )}
        {pois.map(poi => (
          <View key={poi.id} className='poi-card' onClick={() => goToDetail(poi.id)}>
            <Text className='poi-name'>{poi.name}</Text>
            <Text className='poi-info'>
              [{getTypeName(poi.poi_type)}] 
              {poi.distance ? `距离 ${poi.distance}km · ` : ''}
              评分 {poi.rating}
            </Text>
            <Text className='poi-desc'>
              {poi.address || poi.pet_policy || '宠物友好场所'}
            </Text>
            {poi.pet_level > 1 && (
              <Text className='poi-tag pet-friendly'>宠物{poi.pet_level_name}</Text>
            )}
          </View>
        ))}
        {loading && <Text className='loading-text'>加载中...</Text>}
        {!hasMore && pois.length > 0 && <Text className='loading-text'>没有更多了</Text>}
      </ScrollView>
    </View>
  )
}
