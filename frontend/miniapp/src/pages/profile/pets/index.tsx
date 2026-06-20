import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
const logoIcon = '/assets/toplogo.png'
import { getPets, deletePet, setActiveTab, compressImageUrl } from '../../../utils/api'
import { setTabBarSelected } from '../../../utils/tabbar'
import './index.scss'

function fullImageUrl(url?: string) {
  if (!url) return ''
  return compressImageUrl(url, 200)
}

const GENDER_MAP: any = { 0: '/assets/icons/icon-female.svg', 1: '/assets/icons/icon-male.svg' }

function calcAge(birthDate?: string) {
  if (!birthDate) return ''
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age > 0 ? String(age) : ''
}

function formatAge(ageStr?: string) {
  if (!ageStr) return ''
  const s = ageStr.trim()
  if (!s) return ''
  if (/[岁半]/.test(s)) return s
  return s + '岁'
}

export default function Pets() {
  const [pets, setPets] = useState<any[]>([])
  const [navHeight, setNavHeight] = useState(176)
  const [statusBarHeight, setStatusBarHeight] = useState(40)
  const [swipedId, setSwipedId] = useState<number | null>(null)
  const [touchStartX, setTouchStartX] = useState(0)

  useDidShow(() => {
    setTabBarSelected(2)
    loadPets()
    setActiveTab(2, 'pages/profile/pets/index')
  })

  useEffect(() => {
    loadPets()
    const sys = Taro.getSystemInfoSync()
    const sbh = sys.statusBarHeight || 20
    setStatusBarHeight(sbh * 2)
    setNavHeight((sbh + 44 + 4) * 2)
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
            setSwipedId(null)
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

  const onTouchStart = (e: any, id: number) => {
    setTouchStartX(e.touches[0].clientX)
    setSwipedId(null)
  }

  const onTouchMove = (e: any, id: number) => {
    const diff = touchStartX - e.touches[0].clientX
    if (diff > 60) setSwipedId(id)
    else if (diff < -40) setSwipedId(null)
  }

  return (
    <View className='pets-page' style={{ paddingTop: `${navHeight}rpx` }}>
      {/* 顶部导航栏 */}
      <View className='pets-navbar' style={{ height: `${navHeight}rpx`, paddingTop: `${statusBarHeight}rpx` }}>
        <View className='navbar-inner'>
          <View className='navbar-brand'>
            <Image className='brand-logo' src={logoIcon} mode='aspectFit' />
            <Text className='brand-text'>PetWay</Text>
          </View>
          <View className='navbar-placeholder' />
        </View>
      </View>

      {/* 页面标题 */}
      <View className='pets-header-section'>
        <Text className='pets-page-title'>宠物档案</Text>
      </View>

      {/* 宠物列表 */}
      <View className='pets-list'>
        {pets.map(pet => {
          const ageText = formatAge(pet.age_str) || (calcAge(pet.birth_date) ? calcAge(pet.birth_date) + '岁' : '-')
          const genderIcon = GENDER_MAP[pet.gender] || '-'
          const vaccineDate = pet.vaccine_date ? pet.vaccine_date.split('T')[0] : '-'
          const isSwiped = swipedId === pet.id
          return (
            <View
              key={pet.id}
              className={`pet-card ${isSwiped ? 'swiped' : ''}`}
              onTouchStart={(e) => onTouchStart(e, pet.id)}
              onTouchMove={(e) => onTouchMove(e, pet.id)}
            >
              {/* 可滑动内容区 */}
              <View className='pet-card-content'>
                {/* 头像区域 */}
                <View className='pet-avatar-section'>
                  <Image
                    className='pet-avatar'
                    src={fullImageUrl(pet.avatar) || '/assets/images/placeholder-avatar.png'}
                    mode='aspectFill'
                  />
                  <View className='pet-gender-badge'>
                    <Image className='gender-icon' src={genderIcon} mode='aspectFit' />
                  </View>
                </View>

                {/* 信息区域 */}
                <View className='pet-info-section'>
                  <View className='pet-info-top'>
                    <View className='pet-name-wrap'>
                      <Text className='pet-name'>{pet.name}</Text>
                      <View className='pet-tags'>
                        <Text className='pet-tag'>{ageText}</Text>
                        {pet.breed ? <Text className='pet-tag'>{pet.breed}</Text> : null}
                        {pet.weight ? <Text className='pet-tag'>{pet.weight}kg</Text> : null}
                        {pet.is_default ? <Text className='pet-tag default'>默认</Text> : null}
                      </View>
                    </View>
                    <View className='pet-edit-btn'>
                      <Image
                        className='edit-icon'
                        src='/assets/icons/icon-edit.svg'
                        mode='aspectFit'
                        onClick={(e) => {
                          e.stopPropagation()
                          Taro.navigateTo({ url: `/pages/profile/pet-edit/index?id=${pet.id}` })
                        }}
                      />
                    </View>
                  </View>

                  <View className='pet-vaccine-row'>
                    <Text className='vaccine-text'>疫苗时间: <Text className='vaccine-date'>{vaccineDate}</Text></Text>
                  </View>
                </View>
              </View>

              {/* 右滑删除按钮 */}
              <View className='pet-delete-btn' onClick={() => handleDelete(pet.id)}>
                <Text className='pet-delete-text'>删除</Text>
              </View>
            </View>
          )
        })}
      </View>

      {/* 空状态 */}
      {pets.length === 0 && (
        <View className='empty-state'>
          <View className='empty-icon-wrap'>
            <Image className='empty-icon' src='/assets/see-throughlogo.png' mode='aspectFit' />
          </View>
          <Text className='empty-title'>还没有宠物资料</Text>
          <Text className='empty-desc'>添加您的宠物信息，开始规划您的下一次旅程。</Text>
          <View className='add-pet-btn empty-add' onClick={handleAddPet}>
            <Text className='add-btn-icon'>+</Text>
            <Text>添加宠物</Text>
          </View>
        </View>
      )}

      {/* 有数据时的添加按钮 */}
      {pets.length > 0 && (
        <View className='pets-footer'>
          <View className='add-pet-btn' onClick={handleAddPet}>
            <Text className='add-btn-icon'>+</Text>
            <Text>添加宠物</Text>
          </View>
        </View>
      )}
    </View>
  )
}
