import Taro, { eventCenter } from '@tarojs/taro'
import { TAB_BAR_SELECT_EVENT } from '../custom-tab-bar/constants'

/**
 * 设置自定义 tabBar 当前选中项。
 * 通过事件中心通知 custom-tab-bar 更新，避免 getTabBar() 实例不稳定的问题。
 */
export function setTabBarSelected(index: number) {
  try {
    eventCenter.trigger(TAB_BAR_SELECT_EVENT, index)
  } catch (err) {
    console.error('[setTabBarSelected] failed:', err)
  }
}
