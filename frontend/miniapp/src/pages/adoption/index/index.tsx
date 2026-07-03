import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView, Input } from '@tarojs/components'
import { getAdoptionDogs, IMAGE_BASE_URL, safeNavigateBack } from '../../../utils/api'
import './index.scss'

export default function AdoptionList() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    loadList(1)
  }, [])

  const loadList = async (p: number, searchKeyword?: string) => {
    if (loading) return
    try {
      setLoading(true)
      const params: any = { page: p, page_size: 10, status: 1 }
      if (searchKeyword !== undefined) {
        params.keyword = searchKeyword
      } else if (keyword) {
        params.keyword = keyword
      }
      const res = await getAdoptionDogs(params)
      if (res.code === 200 && res.data?.dogs) {
        const items = res.data.dogs.map((d: any) => ({
          id: d.id,
          name: d.name,
          breed: d.breed || '',
          age: d.age || '',
          gender: d.gender || '',
          weight: d.weight || '',
          location: d.location || '',
          story: d.story || '',
          healthTags: d.health_tags || [],
          image: d.cover_image ? (d.cover_image.startsWith('http') ? d.cover_image : `${IMAGE_BASE_URL}${d.cover_image}`) + '?w=400&q=75' : '',
        }))
        if (p === 1) {
          setList(items)
        } else {
          setList(prev => [...prev, ...items])
        }
        setHasMore(items.length === 10)
        setPage(p)
      }
    } catch (error) {
      console.error('Load adoption list failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const goToDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/adoption/detail/index?id=${id}` })
  }

  const onScrollToLower = () => {
    if (hasMore && !loading) {
      loadList(page + 1)
    }
  }

  const handleSearchInput = (e: any) => {
    setKeyword(e.detail.value)
  }

  const handleSearchConfirm = (e: any) => {
    const value = e.detail.value
    setKeyword(value)
    loadList(1, value)
  }

  const renderDesc = (item: any) => {
    if (item.story) return item.story
    return [item.breed, item.age, item.location].filter(Boolean).join(' · ')
  }

  const renderWeight = (item: any) => {
    if (item.weight) return item.weight
    if (item.age) return item.age
    return ''
  }

  const renderHealthTag = (item: any) => {
    if (item.healthTags && item.healthTags.length > 0) return item.healthTags[0]
    return '待领养'
  }

  return (
    <View className='adoption-list-page'>
      <View className='search-header'>
        <View className='search-row'>
          <View className='page-back' onClick={() => safeNavigateBack()}>
            <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
          </View>
          <View className='search-input-wrap'>
            <Text className='search-icon'>🔍</Text>
            <Input
              className='search-input'
              placeholder='搜索狗狗姓名或品种...'
              type='text'
              confirmType='search'
              value={keyword}
              onInput={handleSearchInput}
              onConfirm={handleSearchConfirm}
            />
          </View>
          <View className='my-records-btn' onClick={() => {
            const token = Taro.getStorageSync('access_token')
            if (!token) {
              Taro.navigateTo({ url: '/pages/login/index' })
              return
            }
            Taro.navigateTo({ url: '/pages/adoption/records/index' })
          }}>
            <Text className='my-records-text'>我的申请</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className='scroll-container'
        scrollY
        style={{ height: '100%' }}
        onScrollToLower={onScrollToLower}
      >
        <View className='adoption-list'>
          <Text className='section-title'>待领养伙伴</Text>
          {list.map(item => (
            <View key={item.id} className='dog-card' onClick={() => goToDetail(item.id)}>
              <Image className='dog-image' src={item.image} mode='aspectFill' lazyLoad />
              <View className='dog-info'>
                <View className='dog-name-row'>
                  <Text className='dog-name'>{item.name}</Text>
                </View>
                <View className='dog-tags'>
                  {item.gender && <Text className='dog-tag gender'>{item.gender}</Text>}
                  {renderWeight(item) && <Text className='dog-tag weight'>{renderWeight(item)}</Text>}
                  <Text className='dog-tag health'>{renderHealthTag(item)}</Text>
                </View>
                <Text className='dog-desc'>{renderDesc(item)}</Text>
              </View>
            </View>
          ))}
          {loading && <Text className='loading-text'>加载中...</Text>}
          {!hasMore && list.length > 0 && (
            <View className='list-end'>
              <View className='list-end-line' />
              <Text className='list-end-text'>没有更多小伙伴了</Text>
              <Text className='list-end-paw'>🐾</Text>
            </View>
          )}
          {!loading && list.length === 0 && <Text className='empty-text'>暂无待领养狗狗</Text>}
        </View>
      </ScrollView>
    </View>
  )
}
