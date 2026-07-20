import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { View, Text, Image, Button } from '@tarojs/components'
import { useState, useRef } from 'react'
import { getDogPersonalityResultPublic, getSimplePetList } from '@/utils/api'
import CustomNavBar from '@/components/CustomNavBar'
import './index.scss'

const defaultAvatar = '/assets/images/placeholder-avatar.png'
const genderMap: Record<number, string> = { 0: '母', 1: '公' }

const TYPE_CODE_COLORS: Record<string, string> = {
  ESFP: '#f59e0b', ESTP: '#f97316', ENFP: '#22c55e', ENTP: '#14b8a6',
  ESFJ: '#8b5cf6', ESTJ: '#6366f1', ENFJ: '#ec4899', ENTJ: '#0ea5e9',
  ISFP: '#f43f5e', ISTP: '#78716c', INFP: '#a855f7', INTP: '#3b82f6',
  ISFJ: '#10b981', ISTJ: '#64748b', INFJ: '#d946ef', INTJ: '#4f46e5',
}

function sumDimensionScores(dimensionScores?: Record<string, any>) {
  if (!dimensionScores) return 0
  return Object.values(dimensionScores).reduce((sum: number, ds: any) => sum + (ds.score || 0), 0)
}

export default function DogPersonalityPkIndex() {
  const [inviter, setInviter] = useState<any>(null)
  const [pets, setPets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loginNavigating, setLoginNavigating] = useState(false)
  const navigatingRef = useRef(false)

  const safeNavigate = (url: string) => {
    if (navigatingRef.current) return
    navigatingRef.current = true
    Taro.navigateTo({
      url,
      success: () => {
        // 跳转成功即可解锁（页面已切换，当前页不再接收点击）
        navigatingRef.current = false
      },
      fail: (err) => {
        navigatingRef.current = false
        console.error('[safeNavigate] 跳转失败:', err)
      },
    })
  }

  useLoad(async (options) => {
    const inviterId = options.inviter_result_id
      ? Number(options.inviter_result_id)
      : Taro.getStorageSync('dp_pk_inviter_id')
    if (inviterId) {
      Taro.setStorageSync('dp_pk_inviter_id', inviterId)
      await loadInviter(inviterId)
    }
    const token = Taro.getStorageSync('access_token')
    if (token) {
      await loadPets()
    }
    setLoading(false)
  })

  useDidShow(() => {
    // 用户从登录页放弃返回时重置按钮状态，避免「跳转中...」永久失效
    setLoginNavigating(false)
  })

  const handleLogin = () => {
    if (loginNavigating) return
    setLoginNavigating(true)
    const inviterId = inviter?.id || Taro.getStorageSync('dp_pk_inviter_id')
    const redirectUrl = inviterId
      ? `/subpackage/dog-personality/pk/index/index?inviter_result_id=${inviterId}`
      : '/subpackage/dog-personality/pk/index/index'
    safeNavigate(`/pages/login/index?redirect=${encodeURIComponent(redirectUrl)}`)
  }

  const loadInviter = async (id: number) => {
    try {
      const res = await getDogPersonalityResultPublic(id)
      if (res.code === 200) {
        setInviter(res.data)
      }
    } catch (err) {
      console.error('加载邀请方报告失败:', err)
    }
  }

  const loadPets = async () => {
    try {
      const res = await getSimplePetList()
      setPets(res.data || [])
    } catch (err) {
      console.error('加载宠物列表失败:', err)
    }
  }

  const handleUsePet = (pet: any) => {
    if (!inviter) return
    if (pet.id === inviter.pet_id) {
      Taro.showToast({ title: '不能和自己的宠物 PK 哦', icon: 'none' })
      return
    }
    safeNavigate(`/subpackage/dog-personality/pk/result/index?a=${inviter.id}&b=${pet.last_result_id}`)
  }

  const handleChallenge = () => {
    if (!inviter) return
    // 清理旧测评草稿与计时，避免 PK 答题恢复旧草稿、计时失真
    Taro.removeStorageSync('dp_test_draft')
    Taro.removeStorageSync('dp_test_start_time')
    safeNavigate(`/subpackage/dog-personality/test/index?pk_inviter_result_id=${inviter.id}`)
  }

  const handleAddPetForPk = () => {
    if (!inviter) return
    safeNavigate(`/subpackage/dog-personality/pet-form/index?pk_inviter_result_id=${inviter.id}`)
  }

  if (loading) {
    return (
      <View className='dp-pk-index-page'>
        <CustomNavBar title='犬格 PK' backgroundColor='#FAF9F6' color='#1a4d2e' />
        <View className='dp-pk-loading'>
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  if (!inviter) {
    return (
      <View className='dp-pk-index-page'>
        <CustomNavBar title='犬格 PK' backgroundColor='#FAF9F6' color='#1a4d2e' />
        <View className='dp-pk-loading'>
          <Text>挑战链接无效</Text>
        </View>
      </View>
    )
  }

  const handleViewReport = () => {
    safeNavigate(`/subpackage/dog-personality/result/index?id=${inviter.id}`)
  }

  // 自己点开自己分享的 PK 链接：展示挑战信息并引导分享/查看报告
  if (inviter.is_owner) {
    return (
      <View className='dp-pk-index-page'>
        <CustomNavBar title='犬格 PK' backgroundColor='#FAF9F6' color='#1a4d2e' />
        <View className='dp-pk-header'>
          <Text className='dp-pk-title'>这是你发起的 PK 挑战</Text>
        </View>
        <View className='dp-pk-inviter'>
          <Image
            className='dp-pk-avatar'
            src={inviter.pet_avatar || defaultAvatar}
            mode='aspectFill'
          />
          <Text className='dp-pk-name'>{inviter.pet_name || '未命名'}</Text>
          <Text className='dp-pk-type-code' style={{ color: TYPE_CODE_COLORS[inviter.type_code] || '#16a34a' }}>
            {inviter.type_code}
          </Text>
          <View className='dp-pk-type-title' style={{ background: TYPE_CODE_COLORS[inviter.type_code] || '#16a34a' }}>
            <Text>{inviter.title || '未知犬格'}</Text>
          </View>
          <Text className='dp-pk-total'>{sumDimensionScores(inviter.dimension_scores)} 分</Text>
        </View>
        <View className='dp-pk-section'>
          <Text className='dp-pk-section-title'>分享给好友，看看谁家狗子更厉害</Text>
          <View className='dp-pk-empty'>
            <Text className='dp-pk-empty-text'>好友打开链接完成测评后，就能看到 PK 结果</Text>
            <Button className='dp-pk-btn' onClick={handleViewReport}>
              查看我的报告
            </Button>
          </View>
        </View>
      </View>
    )
  }

  const inviterColor = TYPE_CODE_COLORS[inviter.type_code] || '#16a34a'
  const hasReportPets = pets.filter((p) => p.last_result_id)
  const isLoggedIn = !!Taro.getStorageSync('access_token')

  return (
    <View className='dp-pk-index-page'>
      <CustomNavBar title='犬格 PK' backgroundColor='#FAF9F6' color='#1a4d2e' />

      <View className='dp-pk-header'>
        <Text className='dp-pk-title'>向你发起犬格 PK 挑战</Text>
      </View>

      <View className='dp-pk-inviter'>
        <Image
          className='dp-pk-avatar'
          src={inviter.pet_avatar || defaultAvatar}
          mode='aspectFill'
        />
        <Text className='dp-pk-name'>{inviter.pet_name || '未命名'}</Text>
        <Text className='dp-pk-type-code' style={{ color: inviterColor }}>
          {inviter.type_code}
        </Text>
        <View className='dp-pk-type-title' style={{ background: inviterColor }}>
          <Text>{inviter.title || '未知犬格'}</Text>
        </View>
        <Text className='dp-pk-total'>{sumDimensionScores(inviter.dimension_scores)} 分</Text>
      </View>

      <View className='dp-pk-section'>
        <Text className='dp-pk-section-title'>选择你的宠物进行 PK</Text>
        {!isLoggedIn ? (
          <View className='dp-pk-empty'>
            <Text className='dp-pk-empty-text'>登录后即可接受挑战，和你家狗子一起 PK</Text>
            <Button className='dp-pk-btn' onClick={handleLogin} disabled={loginNavigating}>
              {loginNavigating ? '跳转中...' : '登录参与 PK'}
            </Button>
          </View>
        ) : hasReportPets.length === 0 ? (
          <View className='dp-pk-empty'>
            <Text className='dp-pk-empty-text'>
              {pets.length === 0 ? '还没有宠物档案，添加后即可 PK' : '你的宠物还没有测评记录'}
            </Text>
            {pets.length === 0 ? (
              <Button className='dp-pk-btn' onClick={handleAddPetForPk}>
                添加宠物，立即 PK
              </Button>
            ) : (
              <Button className='dp-pk-btn' onClick={handleChallenge}>
                接受挑战，去测评
              </Button>
            )}
          </View>
        ) : (
          <View className='dp-pk-pet-list'>
            {hasReportPets.map((pet) => (
              <View
                key={pet.id}
                className='dp-pk-pet-card'
                onClick={() => handleUsePet(pet)}
              >
                <Image
                  className='dp-pk-pet-avatar'
                  src={pet.avatar || defaultAvatar}
                  mode='aspectFill'
                />
                <View className='dp-pk-pet-info'>
                  <Text className='dp-pk-pet-name'>{pet.name}</Text>
                  <Text className='dp-pk-pet-meta'>
                    {pet.breed} · {pet.age_str || '-'} · {genderMap[pet.gender]}
                  </Text>
                  <Text
                    className='dp-pk-pet-last'
                    style={{ color: TYPE_CODE_COLORS[pet.last_type_code] || '#6b7280' }}
                  >
                    上次测评：{pet.last_type_code || '未测评'}
                  </Text>
                </View>
                <Text className='dp-pk-arrow'>›</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {isLoggedIn && (
        <View className='dp-pk-footer'>
          <Button className='dp-pk-btn dp-pk-btn-outline' onClick={handleChallenge}>
            为其他宠物测评并 PK
          </Button>
        </View>
      )}
    </View>
  )
}
