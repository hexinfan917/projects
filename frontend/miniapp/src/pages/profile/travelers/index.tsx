import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { getTravelers, deleteTraveler, safeNavigateBack } from '../../../utils/api'
import './index.scss'

/** 姓名脱敏 */
const maskName = (name: string): string => {
  if (!name) return '-'
  const len = name.length
  if (len === 1) return name
  if (len === 2) return name[0] + '*'
  return name[0] + '*'.repeat(Math.min(len - 2, 2)) + name[len - 1]
}

/** 身份证脱敏 */
const maskIdCard = (idCard: string) => {
  if (!idCard || idCard.length < 8) return idCard
  return idCard.slice(0, 4) + '********' + idCard.slice(-4)
}

/** 手机号脱敏 */
const maskPhone = (phone: string) => {
  if (!phone || phone.length !== 11) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export default function Travelers() {
  const [list, setList] = useState<any[]>([])
  const [statusBarHeight, setStatusBarHeight] = useState(40)
  const [navHeight, setNavHeight] = useState(88)
  const [slideId, setSlideId] = useState<number | null>(null)
  const [touchStartX, setTouchStartX] = useState(0)

  useEffect(() => {
    const sysInfo = Taro.getSystemInfoSync()
    const sbh = sysInfo.statusBarHeight || 40
    setStatusBarHeight(sbh)
    setNavHeight((sbh + 44 + 4) * 2)
  }, [])

  useEffect(() => {
    loadTravelers()
  }, [])

  useDidShow(() => {
    loadTravelers()
  })

  const loadTravelers = () => {
    getTravelers().then(res => {
      setList(res.data || [])
      setSlideId(null)
    })
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

  const handleEdit = (id: number) => {
    Taro.navigateTo({ url: `/pages/profile/traveler-edit/index?id=${id}` })
  }

  const handleAdd = () => {
    Taro.navigateTo({ url: '/pages/profile/traveler-edit/index' })
  }

  const onTouchStart = (e: any, id: number) => {
    setTouchStartX(e.touches[0].clientX)
  }

  const onTouchMove = (e: any, id: number) => {
    const moveX = e.touches[0].clientX
    const diff = touchStartX - moveX
    if (diff > 60) {
      setSlideId(id)
    } else if (diff < -40) {
      setSlideId(null)
    }
  }

  const onTouchEnd = (e: any, id: number) => {
    const endX = e.changedTouches[0].clientX
    const diff = touchStartX - endX
    if (diff > 60) {
      setSlideId(id)
    } else if (diff < -40) {
      setSlideId(null)
    }
  }

  return (
    <View className='travelers-page'>
      {/* 顶部导航 */}
      <View className='travelers-header' style={{ paddingTop: `${statusBarHeight}px`, height: `${navHeight}rpx` }}>
        <View className='header-back' onClick={() => safeNavigateBack()}>
          <View className='header-back-arrow' />
        </View>
        <Text className='header-title'>常用出行人</Text>
        <View className='header-add' onClick={handleAdd}>
          <Text className='header-add-text'>+</Text>
        </View>
      </View>

      {/* 出行人列表 */}
      <View className='travelers-list' style={{ marginTop: `${navHeight}rpx` }}>
        {list.map(item => (
          <View
            key={item.id}
            className={`traveler-card ${slideId === item.id ? 'slide-open' : ''}`}
            onTouchStart={(e) => onTouchStart(e, item.id)}
            onTouchMove={(e) => onTouchMove(e, item.id)}
            onTouchEnd={(e) => onTouchEnd(e, item.id)}
          >
            <View className='traveler-card-inner'>
              <View className='traveler-card-content' onClick={() => handleEdit(item.id)}>
                <View className='traveler-card-info'>
                  <View className='traveler-name-row'>
                    <Text className='traveler-name'>{maskName(item.name)}</Text>
                    {item.is_default ? (
                      <Text className='traveler-default-tag'>默认</Text>
                    ) : null}
                  </View>
                  <View className='traveler-meta-row'>
                    <Image className='traveler-meta-icon' src='/assets/icons/icon-phone.svg' mode='aspectFit' />
                    <Text className='traveler-meta-text'>{maskPhone(item.phone)}</Text>
                  </View>
                  <View className='traveler-meta-row'>
                    <Image className='traveler-meta-icon' src='/assets/icons/icon-idcard.svg' mode='aspectFit' />
                    <Text className='traveler-meta-text'>{maskIdCard(item.id_card)}</Text>
                  </View>
                </View>
                <View className='traveler-card-edit' onClick={(e) => { e.stopPropagation(); handleEdit(item.id) }}>
                  <Image className='edit-icon' src='/assets/icons/icon-edit.svg' mode='aspectFit' />
                </View>
              </View>
              <View className='traveler-delete-btn' onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}>
                <Text className='delete-btn-text'>删除</Text>
              </View>
            </View>
          </View>
        ))}

        {list.length === 0 && (
          <View className='travelers-empty'>
            <View className='empty-icon-wrap'>
              <Image className='empty-icon' src='/assets/see-throughlogo.png' mode='aspectFit' />
            </View>
            <Text className='empty-title'>还没有常用出行人</Text>
            <Text className='empty-desc'>添加您的出行人信息，下单时可一键选择，预订更快捷</Text>
          </View>
        )}
      </View>

      {/* 底部添加按钮 */}
      <View className='travelers-footer'>
        <View className='travelers-add-btn' onClick={handleAdd}>
          <Text className='add-btn-icon'>+</Text>
          <Text>添加出行人</Text>
        </View>
      </View>
    </View>
  )
}
