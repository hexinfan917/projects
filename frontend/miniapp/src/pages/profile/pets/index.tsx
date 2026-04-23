import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, Button } from '@tarojs/components'
const logoIcon = '/assets/toplogo.png'
import { getPets, deletePet, setActiveTab } from '../../../utils/api'
import './index.scss'

const GENDER_MAP: any = { 0: '母', 1: '公' }

function calcAge(birthDate?: string) {
  if (!birthDate) return ''
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age > 0 ? String(age) : ''
}

export default function Pets() {
  const [pets, setPets] = useState<any[]>([])

  useDidShow(() => {
    loadPets()
    setActiveTab(2, 'pages/profile/pets/index')
  })

  useEffect(() => {
    loadPets()
  }, [])

  const loadPets = async () => {
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      setPets([])
      return
    }
    try {
      const res = await getPets()
      setPets(res.data || [])
    } catch (err: any) {
      if (err?.statusCode === 401) {
        Taro.showModal({
          title: '提示',
          content: '请先登录',
          showCancel: false,
          success: () => Taro.navigateTo({ url: '/pages/login/index' })
        })
      }
      setPets([])
    }
  }

  const handleDelete = (id: number) => {
    Taro.showModal({
      title: '提示',
      content: '确定删除该宠物档案吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await deletePet(id)
            Taro.showToast({ title: '删除成功', icon: 'success' })
            loadPets()
          } catch (err) {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  const handleAddPet = () => {
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    Taro.navigateTo({ url: '/pages/profile/pet-edit/index' })
  }

  return (
    <View className='pets-page'>
      <View className='custom-navbar'>
        <View className='navbar-bg' />
        <View className='navbar-content'>
          <View className='navbar-left'>
            <Image className='navbar-icon' src={logoIcon} mode='aspectFit' />
            <Text className='navbar-title'>尾巴旅行</Text>
          </View>
        </View>
      </View>
      {pets.map(pet => (
        <View key={pet.id} className='pet-card'>
          <Image className='pet-avatar' src={pet.avatar || 'https://via.placeholder.com/120'} mode='aspectFill' />
          <View className='pet-info'>
            <View className='pet-header'>
              <Text className='pet-name'>{pet.name}</Text>
              {pet.is_default ? <Text className='default-tag'>默认</Text> : null}
            </View>
            <Text className='pet-meta'>
              {calcAge(pet.birth_date) || '-'}岁 · {GENDER_MAP[pet.gender] || '-'} · {pet.breed || '-'} · {pet.weight || '-'}kg
            </Text>
          </View>
          <View className='pet-actions'>
            <Text
              className='action-text'
              onClick={() => Taro.navigateTo({ url: `/pages/profile/pet-edit/index?id=${pet.id}` })}
            >编辑</Text>
            <Text className='action-text delete' onClick={() => handleDelete(pet.id)}>删除</Text>
          </View>
        </View>
      ))}

      {pets.length === 0 && (
        <View className='empty-state'>
          <View className='empty-icon-wrap'>
            <Image className='empty-icon' src='/assets/see-throughlogo.png' mode='aspectFit' />
          </View>
          <Text className='empty-title'>还没有宠物资料</Text>
          <Text className='empty-desc'>添加您的宠物信息，开始规划您的下一次旅程。</Text>
          <View
            className='pets-add-btn'
            onClick={handleAddPet}
          >
            <Text className='add-btn-icon'>+</Text>
            <Text>添加宠物</Text>
          </View>
        </View>
      )}

      {pets.length > 0 && (
        <View
          className='pets-add-btn'
          onClick={handleAddPet}
        >
          + 添加宠物
        </View>
      )}
    </View>
  )
}
