import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { safeNavigateBack } from '../../../utils/api'
import './index.scss'

export default function PrivacyPolicy() {
  return (
    <View className='agreement-page'>
      <View className='custom-navbar'>
        <View className='navbar-bg' />
        <View className='navbar-content'>
          <View className='page-back' onClick={() => safeNavigateBack()}>
            <Text className='page-back-icon'>‹</Text>
          </View>
          <Text className='navbar-title'>隐私政策</Text>
        </View>
      </View>
      <ScrollView className='agreement-content' scrollY>
        <View className='content-body'>
          <Text className='update-time'>更新日期：2026年05月24日</Text>
          <Text className='effective-time'>生效日期：2026年05月24日</Text>

          <View className='section'>
            <Text className='section-title'>引言</Text>
            <Text className='section-text'>
              尾巴旅行（以下简称"我们"或"本小程序"）深知个人信息对您的重要性，我们一向庄严承诺保护使用我们的产品和服务的用户（以下统称"用户"或"您"）的个人信息及隐私安全。您在使用尾巴旅行时，我们可能会收集和使用您的相关个人信息。我们希望通过《尾巴旅行隐私政策》（以下简称"本政策"）向您说明我们在您使用尾巴旅行时如何收集、使用、保存、共享和转让这些信息，以及我们为您提供的访问、更新、删除和保护这些信息的方式。
            </Text>
            <Text className='section-text'>
              本政策将帮助您了解以下内容：{'\n'}
              1. 我们如何收集和使用您的个人信息{'\n'}
              2. 我们如何使用 Cookie 和同类技术{'\n'}
              3. 我们如何共享、转让、公开披露您的个人信息{'\n'}
              4. 我们如何保护和存储您的个人信息{'\n'}
              5. 您的权利{'\n'}
              6. 我们如何处理未成年人的个人信息{'\n'}
              7. 本政策如何更新{'\n'}
              8. 如何联系我们
            </Text>
            <Text className='section-text highlight'>
              请您在使用尾巴旅行前，仔细阅读并了解本政策。一旦您开始使用我们的各项产品或服务，即表示您已充分理解并同意本政策。阅读过程中，如果您有任何疑问，可通过本政策文末的联系方式与我们联系。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>一、我们如何收集和使用您的个人信息</Text>
            <Text className='section-subtitle'>（一）为实现核心功能所需的信息</Text>
            <Text className='section-text'>
              1. <Text className='bold'>微信账号信息</Text>{'\n'}
              当您使用微信授权登录时，我们会收集您的微信openid、unionid（如有），用于创建您的账号并保障账号安全。{'\n\n'}
              2. <Text className='bold'>手机号</Text>{'\n'}
              为方便您使用我们的服务，在您点击"手机号快捷登录"并同意后，我们会通过平台官方接口获取您的手机号码，用于账号注册、登录验证及后续服务通知。{'\n\n'}
              3. <Text className='bold'>头像和昵称</Text>{'\n'}
              为完善您的个人资料，您可以选择使用平台头像和昵称。您也可以手动上传头像、填写昵称。{'\n\n'}
              4. <Text className='bold'>真实姓名和身份证号</Text>{'\n'}
              当您预订旅行线路、报名公益活动或添加出行人时，我们需要收集真实姓名和身份证号，用于：{'\n'}
              • 购买保险{'\n'}
              • 景区实名核验{'\n'}
              • 确保出行安全{'\n\n'}
              5. <Text className='bold'>宠物档案信息</Text>{'\n'}
              为记录您爱宠的健康状况，您可以自愿填写宠物名称、品种、年龄、性别、体重、疫苗接种时间、健康备注等信息。{'\n\n'}
              6. <Text className='bold'>位置信息</Text>{'\n'}
              当您使用地图、查找附近宠物友好场所时，我们会请求获取您的位置信息，用于展示附近的POI（兴趣点）和路线规划。
            </Text>

            <Text className='section-subtitle'>（二）设备信息</Text>
            <Text className='section-text'>
              为保障服务正常运行，我们可能收集您的设备型号、操作系统版本、微信版本、网络状态等基础设备信息。
            </Text>

            <Text className='section-subtitle'>（三）使用信息</Text>
            <Text className='section-text'>
              我们可能记录您使用本小程序的浏览记录、点击记录、订单记录、收藏记录，用于优化产品体验和推荐您可能感兴趣的内容。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>二、我们如何使用 Cookie 和同类技术</Text>
            <Text className='section-text'>
              为确保小程序正常运转，我们会在您的设备上存储必要的缓存数据（如登录状态、用户偏好设置）。您可以通过清除小程序缓存来删除这些信息。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>三、我们如何共享、转让、公开披露您的个人信息</Text>
            <Text className='section-subtitle'>（一）共享</Text>
            <Text className='section-text'>
              我们不会与尾巴旅行以外的任何公司、组织和个人分享您的个人信息，但以下情形除外：{'\n'}
              1. 在获取明确同意的情况下共享：获得您的明确同意后，我们会与其他方共享您的个人信息。{'\n'}
              2. 与旅行服务提供商共享：为完成您的订单（如景区门票、酒店住宿、旅行团服务），我们可能需要将您的姓名、手机号、身份证号共享给相关服务提供商。{'\n'}
              3. 与保险公司共享：如您购买旅行保险，我们需要将姓名、身份证号共享给承保的保险公司。{'\n'}
              4. 在法定情形下的共享：我们可能会根据法律法规规定、诉讼争议解决需要，或按行政、司法机关依法提出的要求，对外共享您的个人信息。
            </Text>

            <Text className='section-subtitle'>（二）转让</Text>
            <Text className='section-text'>
              我们不会将您的个人信息转让给任何公司、组织和个人，但以下情形除外：{'\n'}
              1. 在获取明确同意的情况下转让：获得您的明确同意后，我们会向其他方转让您的个人信息。{'\n'}
              2. 在涉及合并、收购或破产清算时，如涉及到个人信息转让，我们会要求新的持有您个人信息的公司、组织继续受此隐私政策的约束，否则我们将要求该公司、组织重新向您征求授权同意。
            </Text>

            <Text className='section-subtitle'>（三）公开披露</Text>
            <Text className='section-text'>
              我们仅会在以下情况下，公开披露您的个人信息：{'\n'}
              1. 获得您明确同意或基于您的主动选择。{'\n'}
              2. 基于法律法规规定、诉讼或政府主管部门强制性要求。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>四、我们如何保护和存储您的个人信息</Text>
            <Text className='section-subtitle'>（一）保护措施</Text>
            <Text className='section-text'>
              1. 我们已使用符合业界标准的安全防护措施保护您提供的个人信息，防止数据遭到未经授权的访问、公开披露、使用、修改、损坏或丢失。{'\n'}
              2. 我们的网络服务采取了传输层安全协议（TLS）等加密技术，确保用户数据在传输过程中的安全。{'\n'}
              3. 我们采取严格的数据访问权限控制，确保只有授权人员才能访问个人信息。{'\n'}
              4. 我们会举办安全和隐私保护培训课程，加强员工对于保护个人信息重要性的认识。
            </Text>

            <Text className='section-subtitle'>（二）存储期限</Text>
            <Text className='section-text'>
              我们只会在达成本政策所述目的所需的期限内保留您的个人信息，除非法律有强制的留存要求。在您注销账号后，我们将删除您的个人信息或做匿名化处理。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>五、您的权利</Text>
            <Text className='section-text'>
              按照中国相关的法律、法规、标准，以及其他国家、地区的通行做法，我们保障您对自己的个人信息行使以下权利：{'\n\n'}
              <Text className='bold'>（一）访问和更正您的个人信息</Text>{'\n'}
              您有权访问和更正您的个人信息。您可以通过"我的"→"编辑资料"查看和修改您的昵称、头像、手机号、真实姓名、身份证号、所在城市等信息。{'\n\n'}
              <Text className='bold'>（二）删除您的个人信息</Text>{'\n'}
              在以下情形中，您可以向我们提出删除个人信息的请求：{'\n'}
              1. 如果我们处理个人信息的行为违反法律法规。{'\n'}
              2. 如果我们收集、使用您的个人信息，却未征得您的同意。{'\n'}
              3. 如果我们处理个人信息的行为违反了与您的约定。{'\n'}
              4. 如果您不再使用我们的产品或服务，或您注销了账号。{'\n'}
              您可以通过"我的"→"设置"→"注销账号"来删除您的账号及所有个人信息。{'\n\n'}
              <Text className='bold'>（三）改变您授权同意的范围</Text>{'\n'}
              每个业务功能需要一些基本的个人信息才能得以完成。对于额外收集的个人信息的收集和使用，您可以随时给予或收回您的授权同意。{'\n\n'}
              <Text className='bold'>（四）注销账号</Text>{'\n'}
              您可以通过"我的"→"设置"→"注销账号"来注销您的账号。账号注销后，我们将停止为您提供服务，并根据您的要求删除您的个人信息，法律法规另有规定的除外。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>六、我们如何处理未成年人的个人信息</Text>
            <Text className='section-text'>
              我们的产品、网站和服务主要面向成人。如果没有父母或监护人的同意，未成年人不得创建自己的用户账户。{'\n\n'}
              对于经父母同意而收集未成年人个人信息的情况，我们只会在受到法律允许、父母或监护人明确同意或者保护未成年人所必要的情况下使用或公开披露此信息。{'\n\n'}
              尽管当地法律和习俗对未成年人的定义不同，但我们将不满 14 周岁的任何人均视为未成年人。{'\n\n'}
              如果我们发现自己在未事先获得可证实的父母同意的情况下收集了未成年人的个人信息，则会设法尽快删除相关数据。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>七、本政策如何更新</Text>
            <Text className='section-text'>
              我们的隐私政策可能变更。{'\n\n'}
              未经您明确同意，我们不会削减您依据本隐私政策所应享有的权利。我们会在本页面上发布对本政策所做的任何变更。{'\n\n'}
              对于重大变更，我们还会提供更为显著的通知（包括对于某些服务，我们会通过弹窗提示、消息推送等方式通知您，说明隐私政策的具体变更内容）。{'\n\n'}
              本政策所指的重大变更包括但不限于：{'\n'}
              1. 我们的服务模式发生重大变化。{'\n'}
              2. 我们在所有权结构、组织架构等方面发生重大变化。{'\n'}
              3. 个人信息共享、转让或公开披露的主要对象发生变化。{'\n'}
              4. 您参与个人信息处理方面的权利及其行使方式发生重大变化。{'\n'}
              5. 我们负责处理个人信息安全的责任部门、联络方式及投诉渠道发生变化时。{'\n'}
              6. 个人信息安全影响评估报告表明存在高风险时。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>八、如何联系我们</Text>
            <Text className='section-text'>
              如果您对本隐私政策有任何疑问、意见或建议，或者您想要行使您的个人信息权利，请通过以下方式与我们联系：{'\n\n'}
              • 小程序内反馈：我的 → 设置 → 意见反馈{'\n'}
              • 客服邮箱：support@tailtravel.cn{'\n'}
              • 客服电话：400-XXX-XXXX（工作日 9:00-18:00）{'\n\n'}
              一般情况下，我们将在验证您的用户身份后的十五个工作日内作出答复。{'\n\n'}
              <Text className='bold'>如果您对我们的回复不满意，特别是我们的个人信息处理行为损害了您的合法权益，您还可以通过以下外部途径寻求解决方案：</Text>{'\n'}
              向网信、电信、公安及工商等监管部门进行投诉或举报。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-text center'>
              — 本政策最终解释权归尾巴旅行所有 —
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
