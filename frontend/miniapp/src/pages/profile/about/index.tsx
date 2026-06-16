import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { safeNavigateBack } from '../../../utils/api'
import './index.scss'

const WECHAT_ID = 'Petway_'

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
  const appVersion = Taro.getStorageSync('app_version') || '1.0.3'
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight || 20

  return (
    <View className='about-page'>
      {/* 自定义顶部导航栏 */}
      <View className='about-header' style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className='header-back' onClick={() => safeNavigateBack()}>
          <Image className='back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
        <View className='header-placeholder' />
      </View>

      {/* 品牌区域 */}
      <View className='brand-section'>
        <View className='logo-wrapper'>
          <View className='logo-glow' />
          <Image
            className='logo-img'
            src={require('../../../assets/see-throughlogo.png')}
            mode='aspectFit'
          />
        </View>
        <Text className='app-name'>尾巴PetWay</Text>
        <Text className='app-slogan'>与爱宠并肩同行</Text>
        <Text className='version'>Version {appVersion}</Text>
      </View>

      {/* 关于我们卡片 */}
      <View className='info-card'>
        <View className='card-header'>
          <View className='card-icon-wrap'>
            <Image className='card-icon' src='/assets/icons/profile/about.png' mode='aspectFit' />
          </View>
          <Text className='card-title'>关于我们</Text>
        </View>
        <Text className='card-text'>
          尾巴PetWay 是专注于宠物友好型户外活动的服务平台。我们致力于为爱宠家庭提供安全、舒适、有趣的出行体验，让每一次相聚都能留下与毛孩子的美好回忆。
        </Text>
      </View>

      {/* 客服联系方式卡片 */}
      <View className='info-card'>
        <View className='card-header'>
          <View className='card-icon-wrap'>
            <Image className='card-icon' src='/assets/icons/profile/service.png' mode='aspectFit' />
          </View>
          <Text className='card-title'>客服联系方式</Text>
        </View>
        <View className='contact-list'>
          <View className='contact-item' onClick={copyWechat}>
            <View className='contact-info'>
              <Text className='contact-label'>WECHAT</Text>
              <Text className='contact-value'>Petway_</Text>
            </View>
            <View className='copy-btn'>
              <Text className='copy-icon'>⧉</Text>
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

    </View>
  )
}
