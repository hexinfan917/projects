import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import { useState } from 'react'
import { getDogPersonalityStats, getRecentDogPersonalityResults } from '@/utils/api'
import CustomNavBar from '@/components/CustomNavBar'
import './index.scss'

const defaultIntroItems = [
  { num: '0', label: '道题目' },
  { num: '0', label: '个维度' },
  { num: '3', label: '分钟完成' },
]

interface RecentRecord {
  id: number
  pet_id: number
  pet_name?: string
  type_code: string
  title?: string
  created_at?: string
}

export default function DogPersonalityIndex() {
  const [introItems, setIntroItems] = useState(defaultIntroItems)
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])

  useDidShow(() => {
    loadStats()
    loadRecentRecords()
  })

  const loadStats = async () => {
    try {
      const res = await getDogPersonalityStats()
      const data = res.data || {}
      setIntroItems([
        { num: String(data.question_count || 0), label: '道题目' },
        { num: String(data.module_count || 0), label: '个维度' },
        { num: '3', label: '分钟完成' },
      ])
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  }

  const loadRecentRecords = async () => {
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      setRecentRecords([])
      return
    }
    try {
      const res = await getRecentDogPersonalityResults(3)
      setRecentRecords(res.data?.list || [])
    } catch (err) {
      console.error('加载最近测评记录失败:', err)
      setRecentRecords([])
    }
  }

  const handleStart = () => {
    Taro.removeStorageSync('dp_test_draft')
    Taro.removeStorageSync('dp_temp_pet_info')
    Taro.removeStorageSync('dp_result_pending')
    Taro.navigateTo({ url: '/subpackage/dog-personality/test/index' })
  }

  const handleOpenRecord = (record: RecentRecord) => {
    Taro.navigateTo({ url: `/subpackage/dog-personality/result/index?id=${record.id}` })
  }

  const handleViewAll = () => {
    Taro.navigateTo({ url: '/pages/profile/dog-personality-records/index' })
  }

  return (
    <View className='dp-index-page'>
      <CustomNavBar title='' backgroundColor='#fcf9f8' color='#1a4d2e' />

      <View className='dp-index-header'>
        <Text className='dp-index-title'>犬格检测</Text>
        <Text className='dp-index-subtitle'>约3分钟测出狗狗性格</Text>
      </View>

      <View className='dp-index-intro'>
        {introItems.map((item) => (
          <View key={item.label} className='dp-intro-card'>
            <Text className='dp-intro-num'>{item.num}</Text>
            <Text className='dp-intro-label'>{item.label}</Text>
          </View>
        ))}
      </View>

      <View className='dp-index-tips'>
        <View className='dp-tips-line' />
        <Text className='dp-tips-text'>
          请根据狗狗日常真实表现作答，不是单次偶然表现。真实的选择能帮助我们提供更精准的个性化建议。
        </Text>
      </View>

      <Button className='dp-start-btn' onClick={handleStart}>开始测评</Button>

      {recentRecords.length > 0 && (
        <View className='dp-recent-section'>
          <View className='dp-recent-header'>
            <Text className='dp-recent-title'>最近记录</Text>
            <Text className='dp-recent-more' onClick={handleViewAll}>查看全部 ›</Text>
          </View>
          {recentRecords.map((record) => (
            <View
              key={record.id}
              className='dp-recent-item'
              onClick={() => handleOpenRecord(record)}
            >
              <View className='dp-recent-item-main'>
                <Text className='dp-recent-pet-name'>{record.pet_name || '未命名'}</Text>
                <Text className='dp-recent-item-date'>{(record.created_at || '').slice(0, 10)}</Text>
              </View>
              <View className='dp-recent-item-type'>
                <Text className='dp-recent-type-code'>{record.type_code}</Text>
                {record.title && <Text className='dp-recent-type-title'>{record.title}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
