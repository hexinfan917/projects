import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import { getTravelers, deleteTraveler } from '../../../utils/api'
import './index.scss'

export default function Travelers() {
  const [list, setList] = useState<any[]>([])

  useEffect(() => {
    loadTravelers()
  }, [])

  useDidShow(() => {
    loadTravelers()
  })

  const loadTravelers = () => {
    getTravelers().then(res => setList(res.data || []))
  }

  const maskIdCard = (idCard: string) => {
    if (!idCard || idCard.length < 8) return idCard
    return idCard.slice(0, 4) + '********' + idCard.slice(-4)
  }

  const handleDelete = (id: number) => {
    Taro.showModal({
      title: '提示',
      content: '确定删除该出行人吗？',
      success: async (res) => {
        if (res.confirm) {
          await deleteTraveler(id)
          Taro.showToast({ title: '删除成功', icon: 'success' })
          loadTravelers()
        }
      }
    })
  }

  return (
    <View className='travelers-page' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      {list.map(item => (
        <View key={item.id} className='traveler-card'>
          <View className='traveler-header'>
            <Text className='traveler-name'>{item.name}</Text>
            <Text className='traveler-phone'>{item.phone}</Text>
          </View>
          <Text className='traveler-idcard'>身份证: {maskIdCard(item.id_card)}</Text>
          <View className='traveler-actions'>
            <Text
              className='action-text'
              onClick={() => Taro.navigateTo({ url: `/pages/profile/traveler-edit/index?id=${item.id}` })}
            >编辑</Text>
            <Text className='action-text delete' onClick={() => handleDelete(item.id)}>删除</Text>
          </View>
        </View>
      ))}

      {list.length === 0 && <Text className='empty-tip'>暂无出行人</Text>}

      <View
        className='travelers-add-btn'
        onClick={() => Taro.navigateTo({ url: '/pages/profile/traveler-edit/index' })}
      >
        + 添加出行人
      </View>
    </View>
  )
}
