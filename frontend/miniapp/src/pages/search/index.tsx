import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { getRoutes } from '../../utils/api'
import './index.scss'

export default function Search() {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<any[]>([])

  const handleSearch = async (searchWord: string) => {
    const word = searchWord.trim()
    if (!word) return
    setResults([])
    Taro.showLoading({ title: '搜索中...' })
    try {
      const res = await getRoutes({ keyword: word, page_size: 20 })
      if (res.code === 200 && res.data?.routes) {
        setResults(res.data.routes.map((r: any) => ({
          id: r.id,
          name: r.name,
          price: r.base_price || r.price || 0,
          cover_image: r.cover_image || '',
          type_name: r.route_type_name || r.type_name || '',
        })))
        if (!res.data.routes.length) {
          Taro.showToast({ title: '未找到相关路线', icon: 'none' })
        }
      } else {
        Taro.showToast({ title: res.message || '搜索失败', icon: 'none' })
      }
    } catch (error) {
      console.error('Search failed:', error)
      Taro.showToast({ title: '搜索失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const goDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/routes/detail/index?id=${id}` })
  }

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const kw = instance.router?.params?.keyword
    if (kw) {
      const decoded = decodeURIComponent(kw)
      setKeyword(decoded)
      handleSearch(decoded)
    }
  }, [])

  return (
    <View className='search-page' style={{ paddingTop: '140rpx' }}>
      <View className='page-back' onClick={() => Taro.navigateBack()}>
        <Text className='page-back-icon'>←</Text>
      </View>

      {keyword && (
        <View className='search-keyword-bar'>
          <Text className='search-keyword-text'>「{keyword}」的搜索结果</Text>
        </View>
      )}

      <ScrollView className='result-list' scrollY>
        {results.map(r => (
          <View key={r.id} className='result-card' onClick={() => goDetail(r.id)}>
            {r.cover_image ? (
              <Image className='result-image' src={r.cover_image} mode='aspectFill' />
            ) : null}
            <View className='result-info'>
              <Text className='result-name'>{r.name}</Text>
              <Text className='result-type'>{r.type_name}</Text>
              <Text className='result-price'>￥{r.price}起</Text>
            </View>
          </View>
        ))}
        {results.length === 0 && keyword && (
          <View className='empty-result'>
            <Text className='empty-text'>未找到相关路线</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
