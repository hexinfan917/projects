import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { getPublicSettings, safeNavigateBack } from '../../../utils/api'
import './index.scss'

const WECHAT_ID = 'Petway_'
const appLogo = require('../../../assets/see-throughlogo.png')

const copyWechat = () => {
  Taro.setClipboardData({ data: WECHAT_ID }).then(() => {
    Taro.showToast({ title: '客服号已复制', icon: 'none' })
  }).catch(() => {
    Taro.showModal({
      title: '复制客服号',
      content: `客服号：${WECHAT_ID}\n\n（模拟器复制功能受限，请手动复制）`,
      showCancel: false,
      confirmText: '知道了'
    })
  })
}

export default function About() {
  const [appVersion, setAppVersion] = useState(Taro.getStorageSync('app_version') || '1.0.0')

  useEffect(() => {
    const cached = Taro.getStorageSync('app_version')
    if (cached) {
      setAppVersion(cached)
    }
    getPublicSettings().then((res: any) => {
      const version = res.data?.mp_version?.value
      if (version) {
        Taro.setStorageSync('app_version', version)
        setAppVersion(version)
      }
    }).catch(() => {})
  }, [])

  return (
    <View className='about-page' style={{ paddingTop: 'calc(140rpx + env(safe-area-inset-top))' }}>
      <View className='about-navbar' style={{ paddingTop: 'calc(100rpx + env(safe-area-inset-top))' }}>
        <View className='about-navbar-back' onClick={() => safeNavigateBack()}>
          <Image className='about-navbar-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
      </View>

      <View className='brand-section'>
        <View className='logo-wrap'>
          <Image className='logo-image' src={appLogo} mode='aspectFit' />
        </View>
        <Text className='app-name'>尾巴PetWay</Text>
        <Text className='app-slogan'>与爱宠并肩同行</Text>
        <View className='version-tag'>
          <Text className='version-text'>Version {appVersion}</Text>
        </View>
      </View>

      <View className='about-card'>
        <View className='about-card-header'>
          <View className='about-card-icon-wrap'>
            <Image className='about-card-icon' src='/assets/icons/profile/about.png' mode='aspectFit' />
          </View>
          <Text className='about-card-title'>关于我们</Text>
        </View>
        <Text className='about-card-desc'>
          尾巴PetWay 是专注于宠物友好型户外活动的服务平台。我们致力于为爱宠家庭提供安全、舒适、有趣的出行体验，让每一次相聚都能留下与毛孩子的美好回忆。
        </Text>
      </View>

      <View className='about-card'>
        <View className='about-card-header'>
          <View className='about-card-icon-wrap'>
            <Image className='about-card-icon' src='/assets/icons/profile/service.png' mode='aspectFit' />
          </View>
          <Text className='about-card-title'>客服联系方式</Text>
        </View>
        <View className='contact-item'>
          <View className='contact-info'>
            <Text className='contact-label'>WECHAT</Text>
            <Text className='contact-value'>{WECHAT_ID}</Text>
          </View>
          <View className='copy-btn' onClick={copyWechat}>
            <Image className='copy-icon' src='/assets/icons/profile/copy.svg' mode='aspectFit' />
            <Text className='copy-text'>复制</Text>
          </View>
        </View>
        <View className='contact-item'>
          <View className='contact-info'>
            <Text className='contact-label'>工作时间</Text>
            <Text className='contact-value'>周一至周五 10:00~20:00</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
