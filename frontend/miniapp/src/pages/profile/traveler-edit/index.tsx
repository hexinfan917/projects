import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button , Image } from '@tarojs/components'
import { getTravelers, createTraveler, updateTraveler, updateUserProfile } from '../../../utils/api'
import './index.scss'

/** 校验手机号 */
const isValidPhone = (phone: string): boolean => {
  return /^1[3-9]\d{9}$/.test(phone)
}

/** 校验身份证号 */
const isValidIdCard = (idCard: string): boolean => {
  if (!idCard || idCard.length !== 18) return false
  // 基本格式：前17位数字，最后一位数字或X
  if (!/^\d{17}[\dXx]$/.test(idCard)) return false
  // 校验码验证
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
  // 允许中文、英文、·、•，长度2-20
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
    // 姓名校验
    if (!form.name) {
      Taro.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!isValidName(form.name)) {
      Taro.showToast({ title: '姓名仅限2-20位中文/英文/·', icon: 'none' })
      return
    }

    // 手机号校验
    if (!form.phone) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!isValidPhone(form.phone)) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }

    // 身份证校验
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
      // 资料关键信息是否完整：真实姓名 + 身份证号
      // 手机号不算关键信息（可能自动获取），同步目的是填充姓名和身份证
      const hasCriticalProfile = userInfo.real_name && userInfo.id_card

      // 新建时检查是否已存在相同身份证号的出行人
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

      // 判断是否是本人
      // - 资料有身份证：通过身份证号匹配
      // - 资料完全空白：第一个出行人默认认为是本人
      let isSelf = false
      if (form.id_card && userInfo.id_card) {
        isSelf = form.id_card === userInfo.id_card
      } else if (!hasCriticalProfile && !form.id) {
        isSelf = existList.length === 0
      }

      if (form.id) {
        // 编辑已有出行人
        const res: any = await updateTraveler(form.id, form)
        if (res?.code !== 200) {
          throw new Error(res?.message || '保存失败')
        }
        Taro.showToast({ title: '保存成功', icon: 'success' })

        // 编辑本人且信息有变化时，询问同步
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
                setTimeout(() => Taro.navigateBack(), 800)
              }
            })
          }, 500)
        } else {
          setTimeout(() => Taro.navigateBack(), 1000)
        }
      } else {
        // 新建出行人
        const res: any = await createTraveler(form)
        if (res?.code !== 200) {
          throw new Error(res?.message || '保存失败')
        }
        if (res?.data?.id) {
          Taro.setStorageSync('order_confirm_select_traveler_id', res.data.id)
        }
        Taro.showToast({ title: '保存成功', icon: 'success' })

        // 新建本人且个人资料完全空白时才询问同步
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
                setTimeout(() => Taro.navigateBack(), 800)
              }
            })
          }, 500)
        } else {
          setTimeout(() => Taro.navigateBack(), 1000)
        }
      }
    } catch (err: any) {
      Taro.showToast({ title: err.message || '保存失败', icon: 'none' })
    }
  }

  return (
    <View className='traveler-edit' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
      <View className='form-section'>
        <View className='input-row'>
          <Text className='label'>姓名</Text>
          <Input className='input' placeholder='请输入真实姓名' value={form.name} onInput={(e) => setForm({ ...form, name: e.detail.value })} />
          {!isEdit && (
            <Text className='fill-self-btn' onClick={handleFillSelf}>使用本人信息</Text>
          )}
        </View>
        <View className='input-row'>
          <Text className='label'>手机号</Text>
          <Input className='input' type='number' placeholder='请输入手机号' value={form.phone} onInput={(e) => setForm({ ...form, phone: e.detail.value })} />
        </View>
        <View className='input-row'>
          <Text className='label'>身份证号</Text>
          <Input className='input' placeholder='请输入身份证号' value={form.id_card} onInput={(e) => setForm({ ...form, id_card: e.detail.value })} />
        </View>
      </View>

      <View className='form-section'>
        <View className='checkbox-row' onClick={() => setForm({ ...form, is_default: form.is_default ? 0 : 1 })}>
          <View className={`check-box ${form.is_default ? 'checked' : ''}`} />
          <Text className='checkbox-label'>设为默认出行人</Text>
        </View>
      </View>

      <Button className='save-btn' onClick={handleSave}>保存</Button>
    </View>
  )
}
