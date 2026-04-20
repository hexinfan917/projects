import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import './index.scss'

const POSTS = [
  { id: 1, author: '豆豆妈', avatar: 'https://via.placeholder.com/80', title: '带金毛去海边要注意什么？', image: 'https://via.placeholder.com/300x400/4ECDC4/FFFFFF?text=Beach', likes: 128, comments: 32 },
  { id: 2, author: '柯基爸爸', avatar: 'https://via.placeholder.com/80', title: '露营装备清单分享', image: 'https://via.placeholder.com/300x360/96C93D/FFFFFF?text=Camp', likes: 86, comments: 18 },
  { id: 3, author: '边牧铲屎官', avatar: 'https://via.placeholder.com/80', title: '城市夜跑路线推荐', image: 'https://via.placeholder.com/300x380/45B7D1/FFFFFF?text=Run', likes: 210, comments: 45 },
]

export default function Community() {
  const [activeTab, setActiveTab] = useState('recommend')

  return (
    <View className='community-page'>
      <View className='community-tabs'>
        <Text className={`tab ${activeTab === 'recommend' ? 'active' : ''}`} onClick={() => setActiveTab('recommend')}>推荐</Text>
        <Text className={`tab ${activeTab === 'follow' ? 'active' : ''}`} onClick={() => setActiveTab('follow')}>关注</Text>
        <Text className={`tab ${activeTab === 'nearby' ? 'active' : ''}`} onClick={() => setActiveTab('nearby')}>附近</Text>
      </View>

      <ScrollView className='waterfall' scrollY>
        <View className='post-list'>
          {POSTS.map(post => (
            <View key={post.id} className='post-card'>
              <Image className='post-image' src={post.image} mode='widthFix' />
              <Text className='post-title'>{post.title}</Text>
              <View className='post-footer'>
                <Image className='post-avatar' src={post.avatar} mode='aspectFill' />
                <Text className='post-author'>{post.author}</Text>
                <Text className='post-likes'>❤ {post.likes}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
