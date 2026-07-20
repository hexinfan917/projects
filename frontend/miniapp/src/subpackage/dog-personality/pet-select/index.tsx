import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, Button } from '@tarojs/components'
import { useState } from 'react'
import { getSimplePetList, submitDogPersonalityResult } from '@/utils/api'
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

export default function DogPersonalityPetSelect() {
  const [pets, setPets] = useState<any[]>([])
  const [tempPet, setTempPet] = useState<any>(null)
  const [selectedId, setSelectedId] = useState<number | string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useDidShow(() => {
    loadPets()
  })

  const loadPets = async () => {
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      setPets([])
      setLoading(false)
      return
    }
    try {
      const res = await getSimplePetList()
      const list = res.data || []
      const tempInfo = Taro.getStorageSync('dp_temp_pet_info')
      const preselectId = Taro.getStorageSync('dp_preselect_pet_id')
      const selectedPetId = Taro.getStorageSync('dp_selected_pet_id')

      if (tempInfo) {
        setTempPet({ ...tempInfo, id: 'temp' })
        setSelectedId('temp')
      } else if (preselectId) {
        setSelectedId(preselectId)
        Taro.removeStorageSync('dp_preselect_pet_id')
      } else if (list.length > 0) {
        setSelectedId(selectedPetId || list[0].id)
        if (selectedPetId) {
          Taro.removeStorageSync('dp_selected_pet_id')
        }
      }

      setPets(list)
    } catch (err) {
      console.error('加载宠物列表失败:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const buildAnswersList = (draft: any, modules: any[]) => {
    const answersMap: Record<number, { order: number; score: number }> = draft.answers || {}
    const answersList: any[] = []
    modules.forEach((module) => {
      module.questions.forEach((q: any) => {
        if (answersMap[q.id]) {
          answersList.push({
            question_id: q.id,
            module_name: module.module_name,
            option_order: answersMap[q.id].order,
            score: answersMap[q.id].score,
          })
        }
      })
    })
    return answersList
  }

  const submitResult = async (payload: any) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await submitDogPersonalityResult(payload)
      if (res.code === 200) {
        Taro.removeStorageSync('dp_test_draft')
        Taro.removeStorageSync('dp_temp_pet_info')
        Taro.removeStorageSync('dp_result_pending')
        Taro.removeStorageSync('dp_selected_pet_id')
        Taro.removeStorageSync('dp_preselect_pet_id')
        Taro.removeStorageSync('dp_test_start_time')
        Taro.redirectTo({
          url: `/subpackage/dog-personality/result/index?id=${res.data.result_id}&from=test`,
        })
      } else {
        Taro.showToast({ title: res.message || '提交失败', icon: 'none' })
        setSubmitting(false)
      }
    } catch (err: any) {
      console.error('提交测评失败:', err)
      Taro.showToast({ title: err.message || '提交失败', icon: 'none' })
      setSubmitting(false)
    }
  }

  const handleConfirm = async () => {
    if (!selectedId) {
      Taro.showToast({ title: '请选择宠物', icon: 'none' })
      return
    }

    const pending = Taro.getStorageSync('dp_result_pending')
    const draft = Taro.getStorageSync('dp_test_draft')

    // 临时宠物：使用填写的信息继续
    if (selectedId === 'temp') {
      const tempInfo = Taro.getStorageSync('dp_temp_pet_info')
      if (!tempInfo) {
        Taro.showToast({ title: '临时宠物信息已失效，请重新添加', icon: 'none' })
        return
      }
      if (!pending || !draft) {
        Taro.navigateTo({ url: '/subpackage/dog-personality/test/index' })
        return
      }
      const modules = draft.modules || []
      const answersList = buildAnswersList(draft, modules)
      if (answersList.length === 0) {
        Taro.showToast({ title: '答案数据异常，请重新测评', icon: 'none' })
        return
      }
      const startTime = Taro.getStorageSync('dp_test_start_time') || Date.now()
      const durationSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000))
      await submitResult({ temp_pet_info: tempInfo, answers: answersList, duration_seconds: durationSeconds })
      return
    }

    // 已有宠物
    if (!pending || !draft) {
      Taro.setStorageSync('dp_selected_pet_id', selectedId)
      Taro.navigateTo({ url: `/subpackage/dog-personality/test/index?petId=${selectedId}` })
      return
    }

    const modules = draft.modules || []
    const answersList = buildAnswersList(draft, modules)
    if (answersList.length === 0) {
      Taro.showToast({ title: '答案数据异常，请重新测评', icon: 'none' })
      return
    }

    const startTime = Taro.getStorageSync('dp_test_start_time') || Date.now()
    const durationSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000))
    await submitResult({ pet_id: selectedId, answers: answersList, duration_seconds: durationSeconds })
  }

  const handleAddPet = () => {
    const pkInviterId = Taro.getStorageSync('dp_pk_inviter_id')
    const url = pkInviterId
      ? `/subpackage/dog-personality/pet-form/index?pk_inviter_result_id=${pkInviterId}`
      : '/subpackage/dog-personality/pet-form/index'
    Taro.navigateTo({ url })
  }

  if (loading) {
    return (
      <View className='dp-pet-select-page'>
        <CustomNavBar title='犬格检测' backgroundColor='#FAF9F6' color='#1a4d2e' />
        <View className='dp-loading-wrap'>
          <Text className='dp-loading'>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='dp-pet-select-page'>
      <CustomNavBar title='犬格检测' backgroundColor='#FAF9F6' color='#1a4d2e' />

      <View className='dp-header'>
        <Text className='dp-title'>选择要测评的宠物</Text>
        <Text className='dp-subtitle'>请选择您想要进行性格测评的伙伴</Text>
      </View>

      {pets.length === 0 && !tempPet ? (
        <View className='dp-empty-state'>
          <Text className='dp-empty-text'>还没有宠物档案</Text>
          <Button className='dp-add-btn' onClick={handleAddPet}>添加宠物</Button>
        </View>
      ) : (
        <>
          <View className='dp-pet-list'>
            {tempPet && (
              <View
                key='temp'
                className={`dp-pet-card ${selectedId === 'temp' ? 'active' : ''}`}
                onClick={() => setSelectedId('temp')}
              >
                <Image className='dp-pet-avatar' src={tempPet.avatar || defaultAvatar} mode='aspectFill' />
                <View className='dp-pet-info'>
                  <View className='dp-pet-name-row'>
                    <Text className='dp-pet-name'>{tempPet.name}</Text>
                    {selectedId === 'temp' && <Text className='dp-selected-tag'>已选</Text>}
                  </View>
                  <Text className='dp-pet-meta'>
                    {tempPet.breed} · {tempPet.age_str || '-'} · {genderMap[tempPet.gender] || '-'}
                  </Text>
                  <Text className='dp-pet-last dp-pet-no-record'>新添加的宠物</Text>
                </View>
                <View className='dp-pet-radio'>
                  {selectedId === 'temp' && <View className='dp-radio-inner' />}
                </View>
              </View>
            )}
            {pets.map((pet) => {
              const isSelected = selectedId === pet.id
              return (
                <View
                  key={pet.id}
                  className={`dp-pet-card ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedId(pet.id)}
                >
                  <Image className='dp-pet-avatar' src={pet.avatar || defaultAvatar} mode='aspectFill' />
                  <View className='dp-pet-info'>
                    <View className='dp-pet-name-row'>
                      <Text className='dp-pet-name'>{pet.name}</Text>
                      {isSelected && <Text className='dp-selected-tag'>已选</Text>}
                    </View>
                    <Text className='dp-pet-meta'>
                      {pet.breed} · {pet.age_str || '-'} · {genderMap[pet.gender] || '-'}
                    </Text>
                    {pet.last_type_code ? (
                      <Text className='dp-pet-last' style={{ color: TYPE_CODE_COLORS[pet.last_type_code] || '#6b7280' }}>
                        上次测评：{pet.last_type_code}
                      </Text>
                    ) : (
                      <Text className='dp-pet-last dp-pet-no-record'>暂无测评记录</Text>
                    )}
                  </View>
                  <View className='dp-pet-radio'>
                    {isSelected && <View className='dp-radio-inner' />}
                  </View>
                </View>
              )
            })}
          </View>

          <View className='dp-add-other' onClick={handleAddPet}>
            <Text className='dp-add-other-icon'>+</Text>
            <Text className='dp-add-other-text'>为其他宠物测评</Text>
          </View>

          <View className='dp-footer'>
            <Button className='dp-confirm-btn' onClick={handleConfirm} loading={submitting}>
              {submitting
                ? '提交中...'
                : (Taro.getStorageSync('dp_result_pending') && Taro.getStorageSync('dp_test_draft')
                    ? '查看报告'
                    : '开始测评')}
            </Button>
            <Text className='dp-footer-tip'>
              性格报告基于犬类行为学数据分析生成，结果仅供参考
            </Text>
          </View>
        </>
      )}
    </View>
  )
}
