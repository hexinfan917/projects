import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { safeNavigateBack } from '../../../utils/api'
import './index.scss'

export default function Terms() {
  return (
    <View className='agreement-page'>
      <View className='custom-navbar'>
        <View className='navbar-bg' />
        <View className='navbar-content'>
          <View className='page-back' onClick={() => safeNavigateBack()}>
            <Text className='page-back-icon'>‹</Text>
          </View>
          <Text className='navbar-title'>用户协议</Text>
        </View>
      </View>
      <ScrollView className='agreement-content' scrollY>
        <View className='content-body'>
          <Text className='update-time'>更新日期：2026年07月04日</Text>
          <Text className='effective-time'>生效日期：2026年07月04日</Text>

          <View className='section'>
            <Text className='section-title'>引言</Text>
            <Text className='section-text'>
              欢迎您使用尾巴PetWay（以下简称"本小程序"或"我们"）提供的各项服务。本《用户协议》（以下简称"本协议"）是您与我们之间关于您使用本小程序服务所订立的协议。在您使用本小程序之前，请您仔细阅读并充分理解本协议的全部内容，特别是涉及免除或限制我们责任、限制您权利、争议解决方式等条款。
            </Text>
            <Text className='section-text highlight'>
              当您点击"同意"或开始使用本小程序服务时，即视为您已阅读、理解并接受本协议的全部内容。如您不同意本协议的任何条款，请立即停止使用本小程序服务。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>一、服务范围</Text>
            <Text className='section-text'>
              1. 本小程序为用户提供宠物友好旅行路线查询与报名、携宠活动预订、犬格检测、狗狗领养信息展示、狗狗回顾（游记/活动回顾）分享、宠物档案管理、会员服务及相关增值服务。
            </Text>
            <Text className='section-text'>
              2. 我们可能根据业务发展需要，不时增加、减少或调整服务内容。新增或调整后的服务内容，除非另有约定，否则同样适用本协议。
            </Text>
            <Text className='section-text'>
              3. 本小程序的部分服务可能由第三方合作伙伴提供，相关服务受第三方服务条款约束，我们会在相关页面进行提示或说明。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>二、账号注册与使用</Text>
            <Text className='section-text'>
              1. 您在使用本小程序部分功能前需要注册账号。您可以通过微信授权登录并绑定手机号完成注册，注册成功后我们将为您创建唯一账号。
            </Text>
            <Text className='section-text'>
              2. 您应当提供真实、准确、完整、有效的个人信息，并在信息发生变更时及时更新。因您提供的信息不真实、不准确或不完整而导致的任何损失，由您自行承担。
            </Text>
            <Text className='section-text'>
              3. 您的账号仅限您本人使用，不得转让、出借、出租或以其他方式许可他人使用。您应妥善保管账号及相关登录信息，对账号下的所有行为承担法律责任。
            </Text>
            <Text className='section-text'>
              4. 如您发现账号存在异常或被盗用的情况，请立即通过小程序内"我的 → 设置 → 意见反馈"或客服渠道通知我们。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>三、用户行为规范</Text>
            <Text className='section-text'>
              1. 您在使用本小程序服务时，应当遵守中华人民共和国法律法规，尊重社会公德，不得利用本小程序从事任何违法违规或侵害他人合法权益的行为。
            </Text>
            <Text className='section-text'>
              2. 您不得发布、传播以下内容：
              {'\n'}• 反对宪法所确定的基本原则的；
              {'\n'}• 危害国家安全、泄露国家秘密、颠覆国家政权、破坏国家统一的；
              {'\n'}• 损害国家荣誉和利益的；
              {'\n'}• 煽动民族仇恨、民族歧视，破坏民族团结的；
              {'\n'}• 破坏国家宗教政策，宣扬邪教和封建迷信的；
              {'\n'}• 散布谣言，扰乱社会秩序，破坏社会稳定的；
              {'\n'}• 散布淫秽、色情、赌博、暴力、凶杀、恐怖或者教唆犯罪的；
              {'\n'}• 侮辱或者诽谤他人，侵害他人合法权益的；
              {'\n'}• 含有法律、行政法规禁止的其他内容的。
            </Text>
            <Text className='section-text'>
              3. 您不得从事以下行为：
              {'\n'}• 对本小程序进行反向工程、反向汇编、反向编译或以其他方式尝试发现源代码；
              {'\n'}• 对本小程序或者其运行过程中释放到任何终端内存中的数据、运行过程中客户端与服务器端的交互数据进行复制、修改、增加、删除、挂接运行或创作任何衍生作品；
              {'\n'}• 通过非我们开发、授权或认可的第三方软件、插件、外挂、系统使用本小程序服务；
              {'\n'}• 删除本小程序及其副本上关于著作权的信息；
              {'\n'}• 其他未经我们明示授权的行为。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>四、订单与支付</Text>
            <Text className='section-text'>
              1. 您在本小程序下单购买活动、路线或其他服务时，请仔细确认所购服务的名称、价格、数量、时间、地点、退改规则等信息。
            </Text>
            <Text className='section-text'>
              2. 您下单后应在规定时间内完成支付。逾期未支付的，订单将自动取消。
            </Text>
            <Text className='section-text'>
              3. 订单取消和退款规则以具体活动或服务页面的说明为准。如因不可抗力或我们原因导致活动取消，我们将按照页面公示的退改规则处理退款。
            </Text>
            <Text className='section-text'>
              4. 您理解并同意，部分服务可能需要您提供真实姓名、身份证号、手机号等信息，用于购买保险、景区实名核验及出行安全等目的。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>五、知识产权</Text>
            <Text className='section-text'>
              1. 本小程序及相关服务中展示的所有内容，包括但不限于文字、图片、音频、视频、图表、标识、界面设计、编排方式、软件代码等，其知识产权均归我们或相关权利人所有，受法律保护。
            </Text>
            <Text className='section-text'>
              2. 未经我们或相关权利人书面同意，您不得将上述内容用于任何商业目的，不得复制、修改、改编、翻译、出版、发行、出租、传播或以其他方式使用。
            </Text>
            <Text className='section-text'>
              3. 您在使用本小程序服务过程中发布、上传的内容，其知识产权归您所有或已取得合法授权。您授予我们在提供服务所必需的范围内，免费、非独占、可再许可地使用、复制、修改、发布、展示、传播该等内容。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>六、隐私保护</Text>
            <Text className='section-text'>
              1. 我们非常重视您的个人信息和隐私保护。我们将按照《尾巴PetWay隐私政策》的约定收集、使用、存储和保护您的个人信息。
            </Text>
            <Text className='section-text'>
              2. 您同意我们在法律法规允许的范围内，根据业务需要向合作伙伴、服务提供商、保险机构等必要第三方提供您的部分信息，以实现订单履约、保险购买、实名核验等服务。
            </Text>
            <Text className='section-text'>
              3. 我们将采取合理可行的安全措施保护您的个人信息安全，但请您理解，由于技术限制及可能存在的各种恶意手段，我们无法保证信息的绝对安全。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>七、免责声明</Text>
            <Text className='section-text'>
              1. 您理解并同意，本小程序作为信息展示和交易平台，对于第三方合作伙伴提供的服务质量、安全保障等不承担责任，但我们将尽力协助您处理相关纠纷。
            </Text>
            <Text className='section-text'>
              2. 您应对携带宠物的安全负责，妥善看护宠物，遵守公共场所秩序。因宠物自身原因、用户疏忽或不可抗力导致的任何人身、财产损失，我们不承担责任，但法律法规另有规定的除外。
            </Text>
            <Text className='section-text'>
              3. 因不可抗力、系统维护、网络故障、第三方原因或其他非我们可控因素导致的服务中断、数据丢失等，我们不承担责任，但将尽力减少因此给用户造成的损失。
            </Text>
            <Text className='section-text'>
              4. 您理解并同意，本小程序中的部分内容、信息可能来自第三方或用户上传，我们仅进行形式审核，不对其真实性、准确性、完整性、合法性作出任何明示或默示的保证。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>八、协议修改</Text>
            <Text className='section-text'>
              1. 我们有权根据法律法规、业务需要或监管要求，不时修改本协议。修改后的协议将在本小程序内公布，并自公布之日起生效。
            </Text>
            <Text className='section-text'>
              2. 如您不同意修改后的协议，应当立即停止使用本小程序服务。您继续使用本小程序服务的，视为您已接受修改后的协议。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>九、违约责任</Text>
            <Text className='section-text'>
              1. 如您违反本协议约定，我们有权依据违约情节采取包括但不限于警告、限制功能、暂停服务、终止服务、删除内容、封禁账号等措施，并保留追究您法律责任的权利。
            </Text>
            <Text className='section-text'>
              2. 如因您的行为给我们或第三方造成损失的，您应当承担赔偿责任。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>十、争议解决</Text>
            <Text className='section-text'>
              1. 本协议的订立、执行、解释及争议解决均适用中华人民共和国法律（为本协议之目的，不包括香港特别行政区、澳门特别行政区和台湾地区法律）。
            </Text>
            <Text className='section-text'>
              2. 如因本协议或本小程序服务发生争议，双方应友好协商解决；协商不成的，任何一方均可向被告所在地有管辖权的人民法院提起诉讼。
            </Text>
          </View>

          <View className='section'>
            <Text className='section-title'>十一、其他</Text>
            <Text className='section-text'>
              1. 本协议中的任何条款无论因何种原因部分无效或不可执行，其余条款仍然有效并对双方具有约束力。
            </Text>
            <Text className='section-text'>
              2. 本协议未尽事宜，按照本小程序公示的相关规则、说明执行。
            </Text>
            <Text className='section-text'>
              3. 如您对本协议有任何疑问，可通过以下方式与我们联系：
              {'\n'}• 小程序内反馈：我的 → 设置 → 意见反馈
              {'\n'}• 客服邮箱：support@tailtravel.cn
              {'\n'}• 客服电话：400-XXX-XXXX（工作日 9:00-18:00）
            </Text>
          </View>

          <View className='section'>
            <Text className='section-text center'>
              — 本协议最终解释权归尾巴PetWay所有 —
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
