import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button, Checkbox } from '@tarojs/components'
import { login, testLogin } from '../../utils/api'
import './index.scss'

export default function Login() {
  const [agreed, setAgreed] = useState(false)

  const doLoginSuccess = (data: any) => {
    const token = data?.data?.access_token
    if (token) {
      Taro.setStorageSync('access_token', token)
      Taro.setStorageSync('user_info', data.data.user)
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        const pages = Taro.getCurrentPages()
        if (pages.length > 1) {
          Taro.navigateBack()
        } else {
          Taro.setStorageSync('active_tab_index', 0)
          Taro.switchTab({ url: '/pages/index/index' })
        }
      }, 1000)
    } else {
      Taro.showToast({ title: data?.message || '登录异常，请检查后端', icon: 'none' })
    }
  }

  const handleLogin = async () => {
    if (!agreed) {
      Taro.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }
    try {
      const res = await Taro.login()
      console.log('wx.login code:', res.code)
      const data = await login(res.code)
      console.log('login response:', data)
      doLoginSuccess(data)
    } catch (err) {
      console.error('login error:', err)
      Taro.showToast({ title: '登录失败，请检查网络或后端服务', icon: 'none' })
    }
  }

  const handleDefaultLogin = async () => {
    if (!agreed) {
      Taro.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }
    try {
      const data = await testLogin()
      console.log('default login response:', data)
      doLoginSuccess(data)
    } catch (err) {
      console.error('default login error:', err)
      Taro.showToast({ title: '登录失败，请检查网络或后端服务', icon: 'none' })
    }
  }

  return (
    <View className='login-page'>
      <View className='login-header'>
        <Text className='app-name'>尾巴旅行PetWay</Text>
        <Text className='app-slogan'>尾巴旅行，与爱宠并肩同行</Text>
      </View>

      <View className='login-card'>
        <Text className='login-title'>欢迎登录</Text>
        <Text className='login-tip'>授权登录后可预订路线、管理订单</Text>

        <Button className='wx-login-btn' onClick={handleLogin}>
          微信一键登录
        </Button>

        <Button className='default-login-btn' onClick={handleDefaultLogin}>
          默认账户登录（开发测试）
        </Button>

        <View className='agreement-row'>
          <Checkbox checked={agreed} onClick={() => setAgreed(!agreed)} />
          <Text className='agreement-text'>
            我已阅读并同意
            <Text className='link'>《用户协议》</Text>
            和
            <Text className='link'>《隐私政策》</Text>
          </Text>
        </View>
      </View>
    </View>
  )
}
