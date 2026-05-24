import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button, Checkbox, Image } from '@tarojs/components'
import { login, getAgreements } from '../../utils/api'
import './index.scss'

export default function Login() {
  const [agreed, setAgreed] = useState(false)
  const [agreements, setAgreements] = useState<any[]>([])

  useEffect(() => {
    loadAgreements()
  }, [])

  const loadAgreements = async () => {
    try {
      const res = await getAgreements()
      if (res.code === 200) {
        const list = res.data?.list || []
        setAgreements(list)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const goAgreementDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/agreements/detail/index?id=${id}` })
  }

  const getAgreementIdByKeyword = (keyword: string) => {
    const found = agreements.find((a: any) => a.title?.includes(keyword))
    return found?.id
  }

  const getAgreementIdByKeywords = (...keywords: string[]) => {
    const found = agreements.find((a: any) => keywords.some(k => a.title?.includes(k)))
    return found?.id
  }

  const doLoginSuccess = (data: any) => {
    const token = data?.data?.access_token
    if (token) {
      Taro.setStorageSync('access_token', token)
      Taro.setStorageSync('user_info', data.data.user)
      const savedToken = Taro.getStorageSync('access_token')
      console.log('[Login] token saved, preparing redirect... savedToken=', savedToken ? 'exists' : 'missing', 'length=', savedToken?.length)

      const isNewUser = data?.data?.is_new_user === true

      Taro.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 800,
        complete: () => {
          // 新用户引导完善资料
          if (isNewUser) {
            Taro.redirectTo({ url: '/pages/profile/complete-info/index' })
            return
          }

          // 检查是否有 redirect 参数
          const router = Taro.getCurrentInstance().router
          const redirect = router?.params?.redirect as string
          if (redirect) {
            Taro.navigateTo({ url: redirect })
            return
          }
          const pages = Taro.getCurrentPages()
          if (pages.length > 1) {
            Taro.navigateBack()
          } else {
            Taro.setStorageSync('active_tab_index', 0)
            Taro.switchTab({ url: '/pages/index/index' })
          }
        }
      })
    } else {
      console.error('[Login] no access_token in response:', data)
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

  return (
    <View className='login-page' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
      {/* 顶部导航栏 */}
      <View className='login-header-bar'>
        <View className='header-spacer' />
        <Text className='header-title'>Welcome</Text>
        <View className='header-spacer' />
      </View>

      {/* 品牌区域 */}
      <View className='brand-section'>
        <View className='logo-wrapper'>
          <View className='logo-glow' />
          <Image className='logo-img' src={require('../../assets/see-throughlogo.png')} mode='aspectFit' />
        </View>
        <View className='brand-text'>
          <Text className='brand-name'>PetWay</Text>
          <Text className='brand-subname'>尾巴旅行</Text>
          <Text className='brand-slogan'>带着您的毛孩子，探索世界的每一个角落</Text>
        </View>
      </View>

      {/* 登录操作区域 */}
      <View className='action-section'>
        <View className='btn-wrapper'>
          <Button className='wx-login-btn' onClick={handleLogin}>
            <Text className='btn-icon'>💬</Text>
            <Text className='btn-text'>微信授权手机号登录</Text>
          </Button>
        </View>

      </View>

      {/* 隐私协议 */}
      <View className='agreement-row'>
        <Checkbox className='agreement-checkbox' checked={agreed} onClick={() => setAgreed(!agreed)} />
        <Text className='agreement-text'>
          我已阅读并同意
          <Text className='link' onClick={() => {
            const id = getAgreementIdByKeyword('用户协议')
            if (id) goAgreementDetail(id)
            else Taro.showToast({ title: '暂无用户协议', icon: 'none' })
          }}>《用户协议》</Text>
          和
          <Text className='link' onClick={() => {
            const id = getAgreementIdByKeywords('隐私政策', '隐私协议')
            if (id) goAgreementDetail(id)
            else Taro.showToast({ title: '暂无隐私政策', icon: 'none' })
          }}>《隐私政策》</Text>
          ，未注册手机号登录后将自动创建账号
        </Text>
      </View>

      {/* 背景装饰 */}
      <View className='bg-decoration bg-top-right' />
      <View className='bg-decoration bg-bottom-left' />
    </View>
  )
}
