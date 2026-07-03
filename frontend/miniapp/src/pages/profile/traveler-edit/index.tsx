import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Image } from '@tarojs/components'
import { getTravelers, createTraveler, updateTraveler, updateUserProfile, safeNavigateBack } from '../../../utils/api'
import './index.scss'

/** 校验手机号 */
const isValidPhone = (phone: string): boolean => {
  return /^1[3-9]\d{9}$/.test(phone)
}

/** 校验身份证号 */
const isValidIdCard = (idCard: string): boolean => {
  if (!idCard || idCard.length !== 18) return false
  if (!/^\d{17}[\dXx]$/.test(idCard)) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idCard[i], 10) * weights[i]
  }
  const calcCheck = checkCodes[sum % 11]
  const actualCheck = idCard[17].toUpperCase()
  return calcCheck === actualCheck
}

/** 校验姓名 */
const isValidName = (name: string): boolean => {
  if (!name || name.length < 2 || name.length > 20) return false
  return /^[\u4e00-\u9fa5a-zA-Z·•]+$/.test(name)
}

/** 身份证脱敏 */
const maskIdCardSimple = (idCard: string) => {
  if (!idCard || idCard.length < 8) return idCard
  return idCard.slice(0, 4) + '********' + idCard.slice(-4)
}

export default function TravelerEdit() {
  const [form, setForm] = useState<any>({ name: '', phone: '', id_card: '', gender: 0, is_default: 0 })
  const [isEdit, setIsEdit] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      getTravelers().then(res => {
        const found = (res.data || []).find((t: any) => String(t.id) === id)
        if (found) {
          setForm({
            name: found.name || '',
            phone: found.phone || '',
            id_card: found.id_card || '',
            gender: found.gender || 0,
            is_default: found.is_default || 0,
            id: found.id
          })
          setIsEdit(true)
        }
      })
    }
  }, [])

  const handleFillSelf = () => {
    const userInfo = Taro.getStorageSync('user_info')
    if (!userInfo) {
      Taro.showToast({ title: '未找到本人信息，请先完善个人资料', icon: 'none' })
      return
    }
    if (!userInfo.real_name || !userInfo.phone || !userInfo.id_card) {
      Taro.showToast({ title: '个人资料信息不完整，请先完善', icon: 'none' })
      return
    }
    setForm({
      ...form,
      name: userInfo.real_name || '',
      phone: userInfo.phone || '',
      id_card: userInfo.id_card || '',
      gender: userInfo.gender || 0,
    })
    Taro.showToast({ title: '已填充本人信息', icon: 'success' })
  }

  const handleSave = async () => {
    if (!form.name) {
      Taro.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!isValidName(form.name)) {
      Taro.showToast({ title: '姓名仅限2-20位中文/英文/·', icon: 'none' })
      return
    }
    if (!form.phone) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!isValidPhone(form.phone)) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    if (!form.id_card) {
      Taro.showToast({ title: '请输入身份证号', icon: 'none' })
      return
    }
    if (!isValidIdCard(form.id_card)) {
      Taro.showToast({ title: '身份证号格式不正确', icon: 'none' })
      return
    }

    try {
      const userInfo = Taro.getStorageSync('user_info') || {}
      const hasCriticalProfile = userInfo.real_name && userInfo.id_card
      let existList: any[] = []

      if (!form.id) {
        const existRes: any = await getTravelers()
        existList = existRes.data || []
        const duplicate = existList.find((t: any) => t.id_card === form.id_card)
        if (duplicate) {
          Taro.showModal({
            title: '提示',
            content: `已存在身份证号为 ${maskIdCardSimple(form.id_card)} 的出行人（${duplicate.name}），请勿重复添加。`,
            showCancel: false,
            confirmText: '知道了',
          })
          return
        }
      }

      let isSelf = false
      if (form.id_card && userInfo.id_card) {
        isSelf = form.id_card === userInfo.id_card
      } else if (!hasCriticalProfile && !form.id) {
        isSelf = existList.length === 0
      }

      if (form.id) {
        const res: any = await updateTraveler(form.id, form)
        if (res?.code !== 200) throw new Error(res?.message || '保存失败')
        Taro.showToast({ title: '保存成功', icon: 'success' })

        const changed = isSelf && (
          form.name !== userInfo.real_name ||
          form.phone !== userInfo.phone ||
          form.id_card !== userInfo.id_card
        )
        if (changed) {
          setTimeout(() => {
            Taro.showModal({
              title: '同步个人信息',
              content: '出行人信息已变更，是否同步更新到个人资料？',
              confirmText: '同步',
              cancelText: '不同步',
              success: async (modalRes) => {
                if (modalRes.confirm) {
                  try {
                    const updateData = {
                      real_name: form.name,
                      phone: form.phone,
                      id_card: form.id_card,
                      nickname: userInfo.nickname,
                      avatar: userInfo.avatar,
                      gender: userInfo.gender || 1,
                      city: userInfo.city,
                    }
                    const profileRes: any = await updateUserProfile(updateData)
                    if (profileRes.code === 200) {
                      Taro.setStorageSync('user_info', { ...userInfo, ...updateData })
                      Taro.showToast({ title: '同步成功', icon: 'success' })
                    }
                  } catch {
                    Taro.showToast({ title: '同步失败', icon: 'none' })
                  }
                }
                setTimeout(() => safeNavigateBack(), 800)
              }
            })
          }, 500)
        } else {
          setTimeout(() => safeNavigateBack(), 1000)
        }
      } else {
        const res: any = await createTraveler(form)
        if (res?.code !== 200) throw new Error(res?.message || '保存失败')
        Taro.showToast({ title: '保存成功', icon: 'success' })

        if (isSelf && !hasCriticalProfile) {
          setTimeout(() => {
            Taro.showModal({
              title: '同步个人信息',
              content: '是否将出行人信息同步到个人资料？同步后购买会员、下单时可自动填充。',
              confirmText: '同步',
              cancelText: '不同步',
              success: async (modalRes) => {
                if (modalRes.confirm) {
                  try {
                    const updateData = {
                      real_name: form.name,
                      phone: form.phone,
                      id_card: form.id_card,
                      nickname: userInfo.nickname,
                      avatar: userInfo.avatar,
                      gender: userInfo.gender || 1,
                      city: userInfo.city,
                    }
                    const profileRes: any = await updateUserProfile(updateData)
                    if (profileRes.code === 200) {
                      Taro.setStorageSync('user_info', { ...userInfo, ...updateData })
                      Taro.showToast({ title: '同步成功', icon: 'success' })
                    }
                  } catch {
                    Taro.showToast({ title: '同步失败', icon: 'none' })
                  }
                }
                setTimeout(() => safeNavigateBack(), 800)
              }
            })
          }, 500)
        } else {
          setTimeout(() => safeNavigateBack(), 1000)
        }
      }
    } catch (err: any) {
      Taro.showToast({ title: err.message || '保存失败', icon: 'none' })
    }
  }

  return (
    <View className='traveler-edit' style={{ paddingTop: 'calc(100rpx + env(safe-area-inset-top))' }}>
      <View className='traveler-edit-navbar' style={{ paddingTop: 'calc(100rpx + env(safe-area-inset-top))' }}>
        <View className='traveler-edit-navbar-back' onClick={() => safeNavigateBack()}>
          <Image className='traveler-edit-navbar-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
        <Text className='traveler-edit-navbar-title'>{isEdit ? '编辑出行人' : '添加出行人'}</Text>
      </View>

      <View className='traveler-edit-card'>
        <View className='traveler-edit-row'>
          <Text className='traveler-edit-label'>姓名</Text>
          {!isEdit && (
            <View className='traveler-edit-fill-self-wrap' onClick={handleFillSelf}>
              <Text className='traveler-edit-fill-self'>使用本人信息</Text>
            </View>
          )}
        </View>
        <Input
          className='traveler-edit-input'
          placeholder='请输入真实姓名'
          value={form.name}
          onInput={(e) => setForm({ ...form, name: e.detail.value })}
          placeholderClass='traveler-edit-placeholder'
        />

        <View className='traveler-edit-row'>
          <Text className='traveler-edit-label'>手机号</Text>
        </View>
        <Input
          className='traveler-edit-input'
          type='number'
          placeholder='请输入手机号'
          value={form.phone}
          onInput={(e) => setForm({ ...form, phone: e.detail.value })}
          placeholderClass='traveler-edit-placeholder'
        />

        <View className='traveler-edit-row'>
          <Text className='traveler-edit-label'>身份证号</Text>
        </View>
        <Input
          className='traveler-edit-input'
          placeholder='请输入身份证号'
          value={form.id_card}
          onInput={(e) => setForm({ ...form, id_card: e.detail.value })}
          placeholderClass='traveler-edit-placeholder'
        />

        <View className='traveler-edit-checkbox-row' onClick={() => setForm({ ...form, is_default: form.is_default ? 0 : 1 })}>
          <View className={`traveler-edit-checkbox ${form.is_default ? 'checked' : ''}`}>
            {form.is_default ? <Text className='traveler-edit-check-icon'>✓</Text> : null}
          </View>
          <Text className='traveler-edit-checkbox-label'>设为默认出行人</Text>
        </View>
      </View>

      <View className='traveler-edit-tip'>
        <View className='traveler-edit-tip-icon'>!</View>
        <Text className='traveler-edit-tip-text'>您的个人信息将受到严格保护，仅用于宠物出行预订及保险购买。</Text>
      </View>

      <View className='traveler-edit-save-btn' onClick={handleSave}>
        <Text className='traveler-edit-save-text'>确认并保存</Text>
      </View>
    </View>
  )
}
