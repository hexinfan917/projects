import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button, Image } from '@tarojs/components'
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
  const [statusBarHeight, setStatusBarHeight] = useState(40)
  const [navHeight, setNavHeight] = useState(88)

  useEffect(() => {
    const sysInfo = Taro.getSystemInfoSync()
    const sbh = sysInfo.statusBarHeight || 40
    setStatusBarHeight(sbh)
    setNavHeight((sbh + 44 + 4) * 2)
  }, [])

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
        if (res?.code !== 200) {
          throw new Error(res?.message || '保存失败')
        }
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
        if (res?.code !== 200) {
          throw new Error(res?.message || '保存失败')
        }
        if (res?.data?.id) {
          Taro.setStorageSync('order_confirm_select_traveler_id', res.data.id)
        }
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
    <View className='traveler-edit-page'>
      {/* 顶部导航 */}
      <View className='traveler-edit-header' style={{ paddingTop: `${statusBarHeight}px`, height: `${navHeight}rpx` }}>
        <View className='header-back' onClick={() => safeNavigateBack()}>
          <View className='header-back-arrow' />
        </View>
        <Text className='header-title'>{isEdit ? '编辑出行人' : '添加出行人'}</Text>
        <View className='header-placeholder' />
      </View>

      {/* 白色卡片 */}
      <View className='traveler-edit-card' style={{ marginTop: `${navHeight}rpx` }}>
        <View className='traveler-form'>
          {/* 姓名 */}
          <View className='form-item'>
            <View className='form-item-header'>
              <Text className='form-label'>姓名</Text>
              {!isEdit && (
                <Text className='fill-self-btn' onClick={handleFillSelf}>使用本人信息</Text>
              )}
            </View>
            <Input
              className='form-input'
              placeholder='请输入真实姓名'
              placeholderStyle='color: #b0b8c4;'
              value={form.name}
              onInput={(e) => setForm({ ...form, name: e.detail.value })}
            />
          </View>

          {/* 手机号 */}
          <View className='form-item'>
            <Text className='form-label'>手机号</Text>
            <Input
              className='form-input'
              type='number'
              placeholder='请输入手机号'
              placeholderStyle='color: #b0b8c4;'
              value={form.phone}
              onInput={(e) => setForm({ ...form, phone: e.detail.value })}
            />
          </View>

          {/* 身份证号 */}
          <View className='form-item'>
            <Text className='form-label'>身份证号</Text>
            <Input
              className='form-input'
              placeholder='请输入身份证号'
              placeholderStyle='color: #b0b8c4;'
              value={form.id_card}
              onInput={(e) => setForm({ ...form, id_card: e.detail.value })}
            />
          </View>

          {/* 设为默认 */}
          <View className='default-traveler-row' onClick={() => setForm({ ...form, is_default: form.is_default ? 0 : 1 })}>
            <View className={`custom-checkbox ${form.is_default ? 'checked' : ''}`}>
              {form.is_default ? <View className='checkbox-checkmark' /> : null}
            </View>
            <Text className='default-traveler-label'>设为默认出行人</Text>
          </View>
        </View>
      </View>

      {/* 提示 */}
      <View className='traveler-tip'>
        <View className='tip-icon'>
          <Text className='tip-icon-i'>i</Text>
        </View>
        <Text className='traveler-tip-text'>
          您的个人信息将受到严格保护，仅用于宠物出行预订及保险购买。
        </Text>
      </View>

      {/* 底部按钮 */}
      <View className='traveler-edit-footer'>
        <Button className='save-btn' onClick={handleSave}>
          确认并保存
        </Button>
      </View>
    </View>
  )
}
