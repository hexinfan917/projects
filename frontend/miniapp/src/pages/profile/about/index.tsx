import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import './index.scss'

const WECHAT_ID = 'Petway_'

const copyWechat = () => {
  Taro.setClipboardData({ data: WECHAT_ID }).then(() => {
    Taro.showToast({ title: '微信号已复制', icon: 'none' })
  }).catch(() => {
    Taro.showModal({
      title: '复制微信号',
      content: `微信号：${WECHAT_ID}\n\n（模拟器复制功能受限，请手动复制）`,
      showCancel: false,
      confirmText: '知道了'
    })
  })
}

export default function About() {
  return (
    <View className='about-page' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      <View className='brand-section'>
        <View className='logo'>🐾</View>
        <Text className='app-name'>尾巴旅行 PetWay</Text>
        <Text className='app-slogan'>与爱宠并肩同行</Text>
        <Text className='version'>Version 1.0.0</Text>
      </View>

      <View className='info-section'>
        <View className='info-item'>
          <Text className='info-label'>官方网站</Text>
          <Text className='info-value'>www.petway.travel</Text>
        </View>
        <View className='info-item'>
          <Text className='info-label'>客服微信</Text>
          <View className='info-value' onClick={copyWechat}>
            <Text>Petway_（点击复制）</Text>
          </View>
        </View>
        <View className='info-item'>
          <Text className='info-label'>工作时间</Text>
          <Text className='info-value'>周一至周五 10:00~20:00</Text>
        </View>
      </View>

      <View className='desc-section'>
        <Text className='desc-title'>关于我们</Text>
        <Text className='desc-text'>
          尾巴旅行 PetWay 是专注于宠物友好旅行的服务平台。我们致力于为爱宠家庭提供安全、舒适、有趣的旅行体验，让每一次出发都能留下与毛孩子的美好回忆。
        </Text>
      </View>
    </View>
  )
}
