import { Component } from 'react'
import Taro, { eventCenter } from '@tarojs/taro'
import { CoverView, CoverImage } from '@tarojs/components'
import { TAB_BAR_SELECT_EVENT } from './constants'
import './index.scss'

const tabList = [
  {
    pagePath: 'pages/index/index',
    text: '首页',
    iconPath: '/assets/icons/tab-home.png',
    selectedIconPath: '/assets/icons/tab-home-active.png'
  },
  {
    pagePath: 'pages/routes/index',
    text: '活动',
    iconPath: '/assets/icons/tab-route.png',
    selectedIconPath: '/assets/icons/tab-route-active.png'
  },
  {
    pagePath: 'pages/profile/pets/index',
    text: '档案',
    iconPath: '/assets/icons/tab-pet.png',
    selectedIconPath: '/assets/icons/tab-pet-active.png'
  },
  {
    pagePath: 'pages/profile/index',
    text: '我的',
    iconPath: '/assets/icons/tab-profile.png',
    selectedIconPath: '/assets/icons/tab-profile-active.png'
  }
]

function getCurrentPageRoute(): string {
  try {
    const pages = Taro.getCurrentPages()
    const route = pages[pages.length - 1]?.route || ''
    return route.replace(/\.html$/, '')
  } catch (err) {
    console.error('[CustomTabBar] getCurrentPageRoute failed:', err)
    return ''
  }
}

function getSelectedIndexByRoute(route: string): number {
  if (!route) return -1
  return tabList.findIndex(item => item.pagePath === route)
}

export default class CustomTabBar extends Component {
  state = {
    selected: 0
  }

  setSelected = (index: number) => {
    if (index >= 0 && index < tabList.length && index !== this.state.selected) {
      this.setState({ selected: index })
    }
  }

  syncSelectedByCurrentPage = () => {
    const route = getCurrentPageRoute()
    const index = getSelectedIndexByRoute(route)
    if (index >= 0) {
      this.setSelected(index)
    }
  }

  switchTab = (index: number) => {
    if (index === this.state.selected) return
    // 立即高亮，避免点击后闪烁
    this.setSelected(index)
    Taro.switchTab({ url: '/' + tabList[index].pagePath })
  }

  componentDidMount() {
    // 通过事件中心接收页面主动设置的高亮
    eventCenter.on(TAB_BAR_SELECT_EVENT, this.setSelected)
    // 初始化时根据当前页面路径兜底对齐
    this.syncSelectedByCurrentPage()
  }

  componentWillUnmount() {
    eventCenter.off(TAB_BAR_SELECT_EVENT, this.setSelected)
  }

  render() {
    const { selected } = this.state
    return (
      <CoverView className='custom-tab-bar'>
        {tabList.map((item, index) => {
          const isSelected = selected === index
          return (
            <CoverView
              key={item.pagePath}
              className={`custom-tab-bar-item ${isSelected ? 'active' : ''}`}
              onClick={() => this.switchTab(index)}
            >
              <CoverView className='tab-bar-content'>
                <CoverImage className='custom-tab-bar-icon' src={isSelected ? item.selectedIconPath : item.iconPath} />
                <CoverView className='custom-tab-bar-text'>{item.text}</CoverView>
              </CoverView>
            </CoverView>
          )
        })}
      </CoverView>
    )
  }
}
