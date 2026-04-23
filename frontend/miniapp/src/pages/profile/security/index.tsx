import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button } from '@tarojs/components'
import './index.scss'

export default function Security() {
  const [phone, setPhone] = useState('')
  const [modalType, setModalType] = useState<'phone' | 'password' | null>(null)
  const [newPhone, setNewPhone] = useState('')
  const [code, setCode] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    const info = Taro.getStorageSync('user_info')
    if (info?.phone) setPhone(info.phone)
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const sendCode = () => {
    if (countdown > 0) return
    if (!newPhone && modalType === 'phone') {
      Taro.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    // TODO: 接入短信服务后调用后端发送验证码接口
    Taro.showToast({ title: '验证码已发送（演示: 1234）', icon: 'none' })
    setCountdown(60)
  }

  const handleChangePhone = () => {
    if (code !== '1234') {
      Taro.showToast({ title: '验证码错误（演示码: 1234）', icon: 'none' })
      return
    }
    if (!newPhone || !/^1\d{10}$/.test(newPhone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    // TODO: 调用后端更换手机号接口
    Taro.showToast({ title: '手机号更换成功', icon: 'success' })
    setPhone(newPhone)
    setModalType(null)
    setNewPhone('')
    setCode('')
    setCountdown(0)
    const info = Taro.getStorageSync('user_info') || {}
    info.phone = newPhone
    Taro.setStorageSync('user_info', info)
  }

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    if (newPassword.length < 6) {
      Taro.showToast({ title: '新密码至少6位', icon: 'none' })
      return
    }
    // TODO: 调用后端修改密码接口
    Taro.showToast({ title: '密码修改成功', icon: 'success' })
    setModalType(null)
    setOldPassword('')
    setNewPassword('')
  }

  return (
    <View className='security-page' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      <View className='info-section'>
        <View className='info-item'>
          <Text className='info-label'>当前手机号</Text>
          <Text className='info-value'>{phone || '未绑定'}</Text>
        </View>
        <View className='info-item' onClick={() => setModalType('phone')}>
          <Text className='info-label'>更换手机号</Text>
          <Text className='info-arrow'>{'>'}</Text>
        </View>
        <View className='info-item' onClick={() => setModalType('password')}>
          <Text className='info-label'>修改密码</Text>
          <Text className='info-arrow'>{'>'}</Text>
        </View>
      </View>

      <View className='tip-section'>
        <Text className='tip-text'>提示：更换手机号需要验证身份，修改密码需要原密码验证。如忘记原密码，请联系客服处理。</Text>
      </View>

      {/* 更换手机号弹窗 */}
      {modalType === 'phone' && (
        <View className='modal-overlay' onClick={() => setModalType(null)}>
          <View className='modal-content' onClick={(e) => e.stopPropagation()}>
            <Text className='modal-title'>更换手机号</Text>
            <View className='form-item'>
              <Text className='form-label'>新手机号</Text>
              <Input
                className='form-input'
                type='number'
                placeholder='请输入新手机号'
                value={newPhone}
                onInput={(e) => setNewPhone(e.detail.value)}
                maxlength={11}
              />
            </View>
            <View className='form-item code-row'>
              <Input
                className='form-input code-input'
                type='number'
                placeholder='请输入验证码'
                value={code}
                onInput={(e) => setCode(e.detail.value)}
                maxlength={6}
              />
              <Button
                className={`code-btn ${countdown > 0 ? 'disabled' : ''}`}
                onClick={sendCode}
              >
                {countdown > 0 ? `${countdown}s后重发` : '获取验证码'}
              </Button>
            </View>
            <Button className='submit-btn' onClick={handleChangePhone}>确认更换</Button>
            <Button className='cancel-btn' onClick={() => setModalType(null)}>取消</Button>
          </View>
        </View>
      )}

      {/* 修改密码弹窗 */}
      {modalType === 'password' && (
        <View className='modal-overlay' onClick={() => setModalType(null)}>
          <View className='modal-content' onClick={(e) => e.stopPropagation()}>
            <Text className='modal-title'>修改密码</Text>
            <View className='form-item'>
              <Text className='form-label'>原密码</Text>
              <Input
                className='form-input'
                type='password'
                placeholder='请输入原密码'
                value={oldPassword}
                onInput={(e) => setOldPassword(e.detail.value)}
              />
            </View>
            <View className='form-item'>
              <Text className='form-label'>新密码</Text>
              <Input
                className='form-input'
                type='password'
                placeholder='请输入新密码（至少6位）'
                value={newPassword}
                onInput={(e) => setNewPassword(e.detail.value)}
              />
            </View>
            <Button className='submit-btn' onClick={handleChangePassword}>确认修改</Button>
            <Button className='cancel-btn' onClick={() => setModalType(null)}>取消</Button>
          </View>
        </View>
      )}
    </View>
  )
}
