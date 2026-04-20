import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import './index.scss'

const HOT_WORDS = ['海滨线', '山居线', '露营', '杭州', '厦门', '带狗去海边']
const HISTORY = ['森林徒步', '莫干山']

export default function Search() {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<any[]>([])

  const handleSearch = () => {
    if (!keyword) return
    setResults([
      { id: 1, name: `${keyword} 相关路线1`, price: 199 },
      { id: 2, name: `${keyword} 相关路线2`, price: 299 },
    ])
  }

  const goDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/routes/detail/index?id=${id}` })
  }

  return (
    <View className='search-page'>
      <View className='search-header'>
        <Input
          className='search-input'
          placeholder='搜索路线、地点'
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={handleSearch}
        />
        <Text className='search-btn' onClick={handleSearch}>搜索</Text>
      </View>

      {!results.length && (
        <View className='search-tips'>
          <View className='tip-section'>
            <Text className='tip-title'>历史搜索</Text>
            <View className='tip-tags'>
              {HISTORY.map(h => (
                <Text key={h} className='tip-tag' onClick={() => { setKeyword(h); handleSearch() }}>{h}</Text>
              ))}
            </View>
          </View>
          <View className='tip-section'>
            <Text className='tip-title'>热门搜索</Text>
            <View className='tip-tags'>
              {HOT_WORDS.map(w => (
                <Text key={w} className='tip-tag hot' onClick={() => { setKeyword(w); handleSearch() }}>{w}</Text>
              ))}
            </View>
          </View>
        </View>
      )}

      {results.length > 0 && (
        <ScrollView className='result-list' scrollY>
          {results.map(r => (
            <View key={r.id} className='result-card' onClick={() => goDetail(r.id)}>
              <Text className='result-name'>{r.name}</Text>
              <Text className='result-price'>￥{r.price}起</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
