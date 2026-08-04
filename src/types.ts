/**
 * 童趣游戏屋 —— 全局类型定义。
 *
 * 所有游戏、引擎、UI 都从这里取类型，保证 575 个游戏体验一致。
 */

/** 难度档位：自适应难度根据孩子表现在这三档之间切换。 */
export type Difficulty = "easy" | "medium" | "hard";

/** 游戏标识符，同时也是 hash 路由路径，如 `#/color-mixer`。 */
export type GameId =
  // —— 第一批 8 个 ——
  | "color-mixer"
  | "shape-match"
  | "number-monster"
  | "letter-bee"
  | "memory-flip"
  | "music-stairs"
  | "maze-adventure"
  | "seek-find"
  // —— 第二批 16 个 ——
  | "size-sort"
  | "jigsaw"
  | "pattern"
  | "whack-mole"
  | "doodle"
  | "weather"
  | "clock"
  | "animal-sound"
  | "color-sort"
  | "connect-dots"
  | "shadow-match"
  | "tangram"
  | "farm-math"
  | "balance"
  | "robot-code"
  | "dress-up"
  // —— 第三批 25 个 ——
  | "fruit-catch" // 接水果：移动篮子接下落水果
  | "link-match" // 连连看：相同图案连线消除
  | "feed-order" // 喂养顺序：按指定顺序点动物
  | "pinyin" // 拼音首字母：找对应拼音的字
  | "antonym" // 找反义词
  | "sliding-puzzle" // 数字华容道
  | "color-reaction" // 颜色反应：听到颜色名点对应色
  | "equation" // 等式填空：让等式成立
  | "spot-diff" // 找不同：两图差异
  | "tidy-up" // 收拾房间：物品归位
  | "mini-sudoku" // 迷你数独：2x2/3x3 填不重复
  | "pipe-connect" // 接水管：旋转管道连通
  | "weight-sort" // 称重排序：按轻重排队
  | "catch-star" // 接星星：限时收集
  | "draw-along" // 照着画：临摹虚线图形
  | "emotion" // 表情配对：情境配情绪
  | "direction" // 方向辨别：左右上下
  | "length" // 比长短
  | "more-less" // 多少比较
  | "symmetry" // 对称：补全对称图形
  | "rhythm" // 节奏模仿：记忆并重复节奏
  | "fishing" // 钓鱼：钓指定鱼
  | "block-tower" // 搭积木塔
  | "word-chain" // 词语接龙（图）
  | "reverse-memory" // 倒序记忆
  // —— 第四批 32 个 ——
  | "claw" // 抓娃娃机
  | "bubble-shoot" // 泡泡射击
  | "wheel" // 转盘抽奖
  | "pinball" // 弹珠台
  | "guess-card" // 翻牌猜大小
  | "snake" // 贪吃蛇
  | "2048" // 数字合并
  | "number-sequence" // 数字序列填空
  | "pinyin-puzzle" // 拼音拼图
  | "radical" // 部首配对
  | "idiom" // 成语接龙
  | "measure-word" // 量词搭配
  | "stroke-order" // 笔画顺序
  | "homophone" // 同音字
  | "similar-char" // 形近字
  | "word-classify" // 词语分类
  | "fraction" // 分数披萨
  | "time-timeline" // 时间线排序
  | "thermometer" // 温度计认读
  | "calendar" // 日历认知
  | "money" // 人民币换算
  | "ruler" // 测量尺
  | "symmetry-axis" // 对称轴判定
  | "3d-shape" // 立体图形
  | "color-gradient" // 颜色渐变排序
  | "spectrum" // 光谱波长
  | "constellation" // 星座连线
  | "planet-orbit" // 行星轨道
  | "ecosystem" // 食物链
  | "weather-forecast" // 天气预测
  | "magnet-maze" // 磁铁迷宫
  | "circuit" // 电路连通
  // —— 第五批 32 个 ——
  | "bubble-wrap" // 捏泡泡纸
  | "feed-animals" // 按食性喂动物
  | "trace-line" // 描线迷宫
  | "balance-scale" // 平衡秤配平
  | "sorting-hat" // 多维度分类
  | "reaction-light" // 亮灯反应
  | "pop-balloon" // 按规则戳气球
  | "make-face" // 拼五官表情
  | "knock-blocks" // 计数积木
  | "mirror-draw" // 对称镜像画
  | "treasure-hunt" // 翻牌寻宝
  | "pond-skip" // 跳荷叶过河
  | "wind-mill" // 风车节奏
  | "garden-bloom" // 种花开花
  | "ice-cream-stack" // 叠冰淇淋
  | "fishing-rod" // 拖竿钓鱼
  | "egg-hatch" // 破壳配对
  | "ladder-step" // 数字跳格子
  | "color-traffic" // 红绿灯指挥
  | "feed-monster-color" // 怪兽吃颜色
  | "puzzle-rotate" // 旋转拼图
  | "rainbow-bridge" // 彩虹桥排序
  | "ant-march" // 蚂蚁排队
  | "spin-bottle" // 转瓶任务
  | "fruit-weight" // 水果称重
  | "dino-bones" // 恐龙骨头排序
  | "moon-phase" // 月相认知
  | "leaf-sort" // 落叶分类
  | "bubble-pop-math" // 算术戳泡泡
  | "shape-builder" // 拼图造形
  | "sound-sequence" // 声音顺序记忆
  | "candy-pattern" // 糖果花纹
  // —— 第六批 32 个 ——
  | "dot-to-dot" // 连点成图（数字顺序）
  | "flying-bird" // 点击让小鸟飞避障碍
  | "color-train" // 颜色火车编组
  | "seed-sprout" // 种子生长排序
  | "moon-jump" // 月球跳跳（重力不同）
  | "bottle-cap" // 瓶盖配对
  | "shadow-puppet" // 手影猜动物
  | "ice-melt" // 冰块融化顺序
  | "balloon-math" // 气球算术（升空前戳对）
  | "fruit-basket" // 水果篮凑数
  | "traffic-jam" // 滑动移车
  | "piano-keys" // 钢琴键认音
  | "cloud-shape" // 云朵形状想象
  | "ant-farm" // 蚂蚁搬运路线
  | "egg-carton" // 蛋盒计数
  | "lily-pad-math" // 荷叶数学跳
  | "rainbow-slide" // 彩虹滑道颜色
  | "cookie-count" // 饼干计数
  | "block-pattern" // 积木规律塔
  | "fish-school" // 鱼群按数分组
  | "star-map" // 星星连线认星座
  | "weather-dress" // 天气穿衣完整版
  | "grocery-store" // 超市购物找零
  | "pet-vet" // 宠物医生对症
  | "construction" // 建筑工地按图纸
  | "butterfly-wing" // 蝴蝶翅膀对称
  | "snail-race" // 蜗牛赛跑比慢
  | "volcano-sort" // 火山喷发顺序
  | "clock-chime" // 时钟报时
  | "picnic-ants" // 野餐蚂蚁分配
  | "dino-hatch" // 恐龙蛋孵化匹配
  | "orchard-pick" // 果园按成熟度采摘
  // —— 第七批 32 个 ——
  | "puppy-run" // 小狗跑酷躲障碍
  | "helicopter" // 直升机救援
  | "magic-hat" // 魔术帽猜球
  | "gumball" // 弹珠机配色
  | "telescope" // 望远镜找星星
  | "conveyor" // 传送带分拣
  | "domino" // 多米诺骨牌顺序
  | "sushi-roll" // 寿司卷配料顺序
  | "pizza-top" // 披萨配料按单
  | "rocket-launch" // 火箭发射倒计时
  | "zoo-keeper" // 动物园归类
  | "firefighter" // 消防员灭火
  | "postman" // 邮递员送信地址
  | "barber-shop" // 理发师按发型
  | "baker" // 面包师按订单
  | "astronaut" // 宇航员修飞船
  | "submarine" // 潜艇避鱼雷
  | "safari-photo" // 野生动物拍照
  | "farm-harvest" // 农场按季收成
  | "laundry" // 洗衣分色
  | "library" // 图书馆分类
  | "recycle" // 垃圾分类回收
  | "hospital" // 医院分诊
  | "kitchen" // 厨房备菜顺序
  | "shoe-shop" // 鞋店配对
  | "florist" // 花店按花束
  | "toy-fix" // 玩具修理配零件
  | "jewelry" // 珠宝按规律串
  | "origami" // 折纸顺序
  | "pottery" // 陶艺塑形
  | "stained-glass" // 彩窗拼图
  | "carousel" // 旋转木马找座位
  // —— 第八批 32 个 ——
  | "fruit-slicer" // 切水果
  | "ninja-jump" // 忍者跳跃
  | "boulder-dash" // 躲滚石
  | "spider-web" // 蜘蛛网连线
  | "dune-bug" // 沙虫避障
  | "cloud-hop" // 踩云跳高
  | "dragon-breath" // 喷龙焰灭蜡烛
  | "ocean-clean" // 海洋清理垃圾
  | "tree-climber" // 爬树比赛
  | "mole-town" // 鼹鼠出洞计次
  | "bee-garden" // 蜜蜂采蜜配色
  | "mushroom-hop" // 蘑菇跳跃
  | "star-catch" // 捞星星网
  | "leaf-vein" // 叶脉对称补全
  | "rainbow-pour" // 彩虹倒水配色
  | "crystal-sort" // 水晶按光泽排序
  | "puzzle-slide-maze" // 滑块迷宫
  | "color-recipe" // 调色配方
  | "music-echo" // 音乐回声复奏
  | "shape-shadow-trace" // 描图形轮廓
  | "number-bridge" // 数字搭桥过河
  | "word-bubble" // 词语泡泡分类
  | "animal-home" // 动物找家
  | "seasons-wheel" // 季节转盘
  | "day-night" // 昼夜活动分类
  | "tool-match" // 工具配职业
  | "emotion-story" // 情绪故事排序
  | "size-recipe" // 按大小分量
  | "speed-typing" // 字母快打
  | "memory-tray" // 托盘记忆
  | "price-tag" // 看价标付钱
  | "shape-count" // 数图形里有多少
  // —— 第九批 32 个 ——
  | "bouncy-ball" // 弹球躲刺
  | "flame-jump" // 跳过火焰
  | "ice-slide" // 冰面滑行
  | "wind-push" // 风推箱子
  | "light-maze" // 光线反射迷宫
  | "mirror-room" // 镜面房间找出口
  | "gear-spin" // 齿轮转动方向
  | "lever-balance" // 杠杆原理
  | "pulley-lift" // 滑轮起重
  | "ramp-roll" // 斜坡滚落比快慢
  | "pendulum-swing" // 钟摆接物
  | "spring-bounce" // 弹簧跳跃高度
  | "compass-find" // 指南针找方向
  | "map-read" // 看地图找宝藏
  | "flag-semaphore" // 旗语字母
  | "morse-code" // 摩斯密码
  | "clock-tower" // 钟楼对时间
  | "calendar-event" // 日历排日程
  | "sand-timer" // 沙漏比时长
  | "thermometer-dress" // 温度穿衣
  | "shadow-clock" // 日晷影子看时间
  | "rainbow-order" // 彩虹色序复原
  | "color-mix-advanced" // 进阶调色
  | "pixel-art" // 像素画填色
  | "mosaic" // 马赛克拼图
  | "stitch-pattern" // 十字绣花纹
  | "bead-abacus" // 算盘拨珠计数
  | "math-balance" // 数字天平
  | "fraction-cake" // 蛋糕分份
  | "geometry-tangram-2" // 进阶七巧板
  | "volume-pour" // 量杯倒水体积
  // —— 第十批 32 个 ——
  | "duck-pond" // 鸭塘数鸭
  | "lighthouse" // 灯塔旋转开关
  | "bridge-build" // 搭桥过河
  | "cave-explore" // 洞穴探路
  | "jungle-vine" // 藤蔓摆荡
  | "volcano-escape" // 火山逃生
  | "frost-slide" // 冰滑迷宫2
  | "magnet-fish" // 磁铁钓色鱼
  | "echo-cave" // 回声洞辨位
  | "gravity-flip" // 翻转重力
  | "bubble-trap" // 泡泡困虫
  | "shadow-tag" // 影子追逃
  | "petal-count" // 数花瓣
  | "shell-game" // 贝壳猜珠
  | "candle-blow" // 吹蜡烛算数
  | "feather-fall" // 羽毛飘落接
  | "barn-shape" // 谷仓形状归类
  | "tide-pool" // 潮汐池分类
  | "cloud-count" // 数云朵
  | "raindrop-math" // 雨滴算术
  | "maple-leaf" // 枫叶找相同
  | "snowflake-match" // 雪花配对
  | "pumpkin-sort" // 南瓜大小排
  | "scarecrow-dress" // 稻草人穿搭
  | "harvest-weight" // 收成比轻重
  | "cider-pour" // 果汁按量倒
  | "hay-bale-jump" // 干草垛跳
  | "corn-maze-mini" // 玉米小迷宫
  | "apple-pick" // 摘苹果比多
  | "barn-door" // 谷仓门配色
  | "chicken-count" // 数小鸡
  | "tractor-park" // 拖拉机泊车
  // —— 第十一批 32 个（最终批：突破300） ——
  | "dolphin-jump" // 海豚跳圈
  | "crab-walk" // 螃蟹横走
  | "owl-hoot" // 猫头鹰叫声辨夜
  | "fox-sneak" // 狐狸潜行
  | "deer-watch" // 数鹿群
  | "koala-climb" // 考拉爬树
  | "penguin-slide" // 企鹅滑冰
  | "kangaroo-hop" // 袋鼠跳远
  | "beaver-dam" // 海狸筑坝
  | "hedgehog-roll" // 刺猬滚
  | "chameleon-color" // 变色龙变色
  | "firefly-catch" // 萤火虫
  | "dragonfly-count" // 蜻蜓数数
  | "caterpillar-grow" // 毛毛虫长大
  | "spiral-snail" // 蜗牛螺旋
  | "ant-bridge" // 蚂蚁搭桥
  | "bee-honey" // 蜂蜜量杯
  | "ladybug-spot" // 瓢虫斑点数
  | "butterfly-catch" // 捕蝶网
  | "frog-croak" // 青蛙叫声节奏
  | "turtle-race" // 乌龟赛跑2
  | "fish-bowl" // 鱼缸水位
  | "bird-nest" // 鸟巢数蛋
  | "squirrel-hide" // 松鼠藏坚果
  | "rabbit-burrow" // 兔洞迷宫
  | "bat-cave" // 蝙蝠洞倒挂
  | "snake-slither" // 蛇行
  | "owl-pellet" // 猫头鹰丸子分类
  | "mole-vision" // 鼹鼠视野
  | "plankton-feed" // 浮游生物
  | "coral-reef" // 珊瑚礁配色
  | "jellyfish-glow" // 水母发光
  // —— 第十二批 32 个（世界文化/运动/美食主题） ——
  | "sushi-master" // 寿司大师
  | "pizza-chef" // 披萨师傅
  | "cake-decor" // 蛋糕装饰
  | "juice-blend" // 果汁调配
  | "noodle-pull" // 拉面长短
  | "dumpling-count" // 饺子计数
  | "tea-cup" // 茶杯温度
  | "cookie-decor" // 饼干装饰
  | "pancake-flip" // 煎饼翻面
  | "popcorn-pop" // 爆米花计时
  | "ice-cream-flavor" // 冰淇淋口味配
  | "sandwich-stack" // 三明治叠层
  | "olympic-rings" // 奥运五环顺序
  | "medal-count" // 奖牌计数
  | "stadium-cheer" // 观众席找不同
  | "relay-baton" // 接力棒传递
  | "swim-lane" // 泳道编号
  | "archery-target" // 射箭环数
  | "skate-trick" // 滑板动作序列
  | "basketball-hoop" // 投篮进框
  | "soccer-pass" // 传球路线
  | "gymnastics-score" // 体操评分
  | "karate-belt" // 腰带颜色等级
  | "flag-raising" // 升旗顺序
  | "torch-relay" // 火炬接力城市
  | "dice-roll" // 掷骰子点数
  | "card-deal" // 发牌比大小
  | "coin-flip" // 翻硬币概率
  | "slot-machine" // 拉霸机配图案
  | "bingo-card" // 宾果卡配对
  | "puzzle-jigsaw-3" // 进阶拼图
  | "rubik-mini" // 迷你魔方
  // —— 第十三批 32 个（科技/太空/奇幻主题） ——
  | "robot-maze" // 机器人迷宫
  | "satellite-orbit" // 卫星轨道排序
  | "mars-rover" // 火星车避障
  | "alien-translate" // 外星语翻译
  | "ufo-catch" // UFO吸物
  | "asteroid-dodge" // 躲小行星
  | "space-dock" // 太空站对接
  | "black-hole" // 黑洞引力吸入
  | "meteor-shower" // 流星雨接星
  | "gravity-well" // 引力井弹射
  | "crystal-mine" // 水晶矿按色分
  | "dragon-treasure" // 龙窟宝藏按值排
  | "wizard-potion" // 巫师药水配色
  | "fairy-dust" // 仙粉撒对色
  | "knight-shield" // 骑士盾牌纹样配
  | "castle-gate" // 城堡门密码
  | "mermaid-pearl" // 美人鱼珍珠串
  | "phoenix-feather" // 凤凰羽毛排色
  | "unicorn-horn" // 独角兽角颜色配
  | "elf-bow" // 精灵弓箭射击
  | "troll-bridge" // 巨魔桥问答
  | "ghost-castle" // 鬼城堡记忆
  | "vampire-bat" // 吸血蝙蝠避光
  | "werewolf-shadow" // 狼人影子追逃
  | "zombie-garden" // 僵尸花园种花
  | "pumpkin-carve" // 南瓜雕刻对称
  | "haunted-mirror" // 鬼镜找不同
  | "spell-circle" // 魔法阵连线
  | "potion-brew" // 魔药熬制顺序
  | "magic-wand" // 魔棒点对色
  | "crystal-ball" // 水晶球预测
  | "enchantment" // 附魔颜色匹配
  // —— 五大领域补缺 51 个 ——
  // 语言类 15
  | "listen-act" // 听指令做动作
  | "story-order" // 故事排序卡
  | "rhyme-fill" // 儿歌填词
  | "picture-talk" // 看图说话
  | "tongue-twist" // 绕口令
  | "upper-lower" // 大小写配对
  | "sentence-build" // 句子拼读
  | "opposite-match" // 反义词扩展
  | "describe-pic" // 描述图片
  | "question-answer" // 问答选择
  | "sound-letter" // 字母发音
  | "category-name" // 说出类别
  | "find-mistake" // 找语病
  | "sequence-word" // 词语排序
  | "story-end" // 故事结尾
  // 社交类 10
  | "share-toy" // 分享玩具
  | "queue-up" // 排队礼仪
  | "coop-build" // 合作搭建
  | "say-sorry" // 道歉练习
  | "greeting" // 打招呼
  | "take-turns" // 轮流发言
  | "resolve-fight" // 解决冲突
  | "help-others" // 帮助他人
  | "team-task" // 团队任务
  | "mood-read" // 读表情
  // 艺术类 10
  | "warm-cool" // 暖色冷色
  | "beat-clap" // 节奏打拍
  | "instrument" // 乐器辨听
  | "finger-paint" // 手指画
  | "origami-2" // 折纸进阶
  | "dance-copy" // 舞蹈模仿
  | "color-fill" // 涂色画
  | "pattern-design" // 图案设计
  | "music-mood" // 音乐情绪
  | "paper-cut" // 剪纸创作
  // 精细动作 8
  | "lace-board" // 穿线板
  | "pick-beans" // 夹豆子
  | "cut-line" // 剪刀沿线
  | "tie-shoe" // 系鞋带
  | "zipper-pull" // 拉拉链
  | "button-press" // 按纽扣
  | "tear-paste" // 撕纸贴画
  | "bead-string" // 串珠子
  // 生活自理 8
  | "brush-teeth" // 刷牙步骤
  | "wash-hands" // 洗手七步
  | "dress-order" // 穿衣顺序
  | "cross-road" // 过马路
  | "stranger" // 防陌生人
  | "healthy-eat" // 健康饮食
  | "pack-bag" // 收书包
  | "tidy-room" // 收拾房间2
  // —— 第十四批 32 个（世界文化/多元智能深化） ——
  | "world-landmark" // 世界地标配对
  | "flag-match" // 国旗配大洲
  | "currency-world" // 各国货币认识
  | "hello-world" // 各国语言打招呼
  | "food-world" // 世界美食配国家
  | "animal-continent" // 动物住哪个洲
  | "season-nature" // 季节自然现象
  | "weather-type" // 天气类型认知
  | "plant-grow" // 植物生长排序
  | "rock-cycle" // 岩石循环
  | "water-cycle" // 水循环
  | "food-chain-2" // 食物链扩展
  | "body-parts" // 身体部位认知
  | "five-senses" // 五官认识
  | "healthy-habit" // 健康习惯
  | "emotion-cope" // 情绪应对
  | "color-feeling" // 颜色与情绪
  | "music-speed" // 音乐快慢
  | "rhythm-copy" // 节奏模仿扩展
  | "story-moral" // 故事道理
  | "fairytale" // 童话配对
  | "count-song" // 数数歌
  | "shape-hunt" // 形状搜寻
  | "mirror-word" // 镜像字
  | "letter-trace" // 字母描红
  | "number-trace" // 数字描红
  | "color-name" // 认颜色名
  | "shape-name" // 认形状名
  | "opposite-act" // 相反动作
  | "same-different" // 找相同与不同
  | "before-after" // 前后顺序
  | "part-whole" // 部分与整体
  // —— 第十五批 32 个（社交深化+精细动作+生活技能+低龄专属） ——
  | "play-date" // 约朋友玩
  | "birthday-party" // 生日派对礼仪
  | "lost-found" // 丢失物品找回
  | "good-listener" // 好好听话
  | "please-thanks" // 请和谢谢
  | "wait-patient" // 耐心等待
  | "share-snack" // 分享零食
  | "comfort-friend" // 安慰朋友
  | "table-manners" // 餐桌礼仪
  | "public-rules" // 公共场所规则
  | "tie-bow" // 蝴蝶结
  | "screw-cap" // 拧瓶盖
  | "fold-paper-2" // 折纸精细
  | "peel-sticker" // 撕贴纸
  | "insert-key" // 钥匙开锁
  | "thread-needle" // 穿针引线
  | "open-box" // 开盒子
  | "stack-coins" // 叠硬币
  | "tie-hair" // 扎头发
  | "button-shirt" // 扣衬衫
  | "bath-steps" // 洗澡步骤
  | "sleep-routine" // 睡前流程
  | "wake-up" // 起床步骤
  | "table-setting" // 摆餐具
  | "sort-trash" // 垃圾分类扩展
  | "kitchen-safety" // 厨房安全
  | "medicine-safety" // 用药安全
  | "fire-safety" // 消防安全
  | "water-safety" // 水边安全
  | "traffic-sign" // 交通标志
  | "emergency-call" // 紧急电话
  | "sun-safety" // 防晒防暑
  // —— 第十六批 32 个（自然探索+音乐艺术+逻辑思维+身体运动） ——
  | "bird-watch" // 观鸟识鸟
  | "leaf-id" // 树叶辨认
  | "flower-type" // 花的种类
  | "rock-id" // 岩石辨认
  | "cloud-type" // 云的类型
  | "insect-id" // 昆虫辨认
  | "tree-type" // 树的种类
  | "mushroom-id" // 蘑菇辨认
  | "fruit-tree" // 水果长在哪
  | "animal-track" // 动物脚印
  | "scale-piano" // 音阶钢琴
  | "chord-match" // 和弦配对
  | "tempo-game" // 节拍速度
  | "scale-up" // 音阶上行
  | "scale-down" // 音阶下行
  | "echo-song" // 回声唱歌
  | "drum-pattern" // 鼓点花样
  | "sudoku-shape" // 形状数独
  | "logic-grid" // 逻辑网格
  | "pattern-3d" // 3D规律
  | "number-cross" // 数字交叉
  | "color-sudoku" // 颜色数独
  | "maze-3d" // 3D迷宫
  | "balance-puzzle" // 平衡谜题
  | "jump-rope" // 跳绳节奏
  | "balance-beam" // 平衡木
  | "ball-catch" // 接球
  | "hula-hoop" // 呼啦圈
  | "obstacle-run" // 障碍跑
  | "dance-step" // 舞步记忆
  | "stretch-game" // 伸展运动
  | "breath-game" // 呼吸练习
  // —— 古诗 / 3-4岁认知启蒙 / 大动作（内容补缺）——
  | "classical-poem" // 古诗学习
  | "big-small" // 比大小（3-4岁）
  | "color-find" // 找颜色（3-4岁）
  | "shape-find" // 找形状（3-4岁）
  | "count-finger" // 手指数1-5（3-4岁）
  | "throw-ball" // 投球大动作
  | "kick-ball" // 踢球大动作
  | "follow-action" // 跟做动作大动作
  // —— 内容补缺 5 个（唐诗/季节/安全/科学/货币）——
  | "tang-sanbai" // 唐诗三百首精选（填空）
  | "seasons-match" // 四季配对（3-4 岁）
  | "traffic-light" // 红绿灯过马路
  | "shadow-size" // 影子比大小（科学）
  | "money-pay" // 付钱练习（硬币组合）
  | "color-flash" // 颜色快闪：Simon Says 风格颜色记忆
  // —— 数字/数学学习 6 个 ——
  | "number-trace-2" // 数字描红 2（1-20 书写练习）
  | "skip-count" // 跳数（2/5/10/3 的倍数序列）
  | "number-bond" // 数字分解（几和几合成它）
  | "number-line" // 数轴找数（箭头指的数字）
  | "missing-number" // 填缺失数（连续数序）
  | "odd-even" // 奇偶分类（单数/双数）
  // —— 文字/语言学习 6 个 ——
  | "radical-build" // 偏旁组字：偏旁+部件拼成真字
  | "picture-word" // 看图认字：emoji 图配基础汉字
  | "word-pair" // 词语配对：名词配关联词
  | "tone-game" // 声调练习：同音不同调四声
  | "char-structure" // 汉字结构：左右/上下/包围/独体
  | "sentence-order" // 句子排序进阶：丰富句库拼句
  // —— 科学原理学习 8 个（物理/化学/天文/地球/声学等）——
  | "magnet-push" // 磁铁推拉：拖磁铁吸铁珠到目标
  | "light-prism" // 光的折射：白光过棱镜分七色，按序排彩虹
  | "sound-wave" // 声音高低：听两音判更高/更低
  | "heat-flow" // 热传导：判断哪种材质先变烫
  | "state-change" // 物质三态变化：冰水汽循环/融化排序
  | "sink-float" // 沉浮实验：判断物品沉还是浮
  | "day-night-cycle" // 昼夜变化：地球自转对应时段
  | "soil-layers" // 土壤层次：从上到下排地层
  // —— 趣味探索类 8 个（强调探索·发现·惊喜·创造）——
  | "mystery-box" // 神秘盲盒：拆盒惊喜 + 认物
  | "dino-dig" // 考古挖掘：挖泥土找化石
  | "bubble-workshop" // 泡泡工坊：自由吹泡泡戳泡泡
  | "scratch-card" // 刮刮乐：刮开揭晓图案
  | "kaleidoscope" // 万花筒：转动找对称图案
  | "ocean-explore" // 海底探险：翻海草找海洋生物
  | "color-lab" // 色彩实验室：自由混色探索
  | "sound-garden" // 声音花园：弹花朵奏旋律
  // —— 注意力训练 6 个（选择性/持续/分配/反应抑制/听觉/视觉追踪）——
  | "schulte-grid" // 舒尔特方格：按序点击数字，训练专注
  | "find-target" // 找目标：在干扰物中找目标，选择性注意力
  | "whack-mole-2" // 打地鼠进阶：Go/No-Go 反应抑制
  | "listen-count" // 听音数数：听"叮"声次数，听觉注意力
  | "stroop-test" // 色词干扰：Stroop 抗干扰
  | "eye-trace" // 视觉追踪：跟随弯曲线找终点
  // —— 深度益智 6 个（推箱/三消/造迷宫/拼字/填色/连线）——
  | "sokoban" // 推箱子：经典推箱到目标
  | "match-three" // 三消：交换宝石凑同色连线
  | "maze-builder" // 迷宫建造：放墙引导动物到终点
  | "word-puzzle" // 汉字拼图：部件拼回完整字
  | "color-fill-2" // 区域填色：行列颜色不重复
  | "path-connect" // 路径连通：同色端点连线不交叉
  // —— 大脑发育深度教育 6 个（执行功能/情绪/因果/节奏/叙事/空间记忆）——
  | "task-switch" // 任务切换：交替切换规则，训练认知灵活性
  | "emotion-regulate" // 情绪调节：情境选好的应对方式
  | "cause-effect" // 因果推理：由原因预测结果
  | "rhythm-tap" // 节奏拍打：听鼓点模仿节拍
  | "story-create" // 故事编创：排序后自由讲故事
  | "spatial-memory"; // 空间记忆：记住亮过的格子

/** 游戏元信息：用于大厅卡片展示与路由注册。 */
export interface GameMeta {
  id: GameId;
  /** 大厅卡片标题 */
  title: string;
  /** 一句话副标题（给家长看的教育内核） */
  subtitle: string;
  /** 卡片 emoji 图标 */
  icon: string;
  /** 卡片渐变主题色（CSS 变量键名） */
  theme: string;
  /** 适龄范围文案 */
  age: string;
  /** 教育内核标签 */
  tag: string;
}

/** 单局游戏结算数据，驱动夸赞与成就。 */
export interface GameResult {
  gameId: GameId;
  /** 是否通关 */
  cleared: boolean;
  /** 星级 0-3（部分游戏按收集/用时/连击评定） */
  stars: number;
  /** 当前难度 */
  difficulty: Difficulty;
  /** 耗时（毫秒），无时效的游戏可省略 */
  durationMs?: number;
}

/** 持久化的单个游戏进度。 */
export interface GameProgress {
  /** 最高通关难度 */
  bestDifficulty: Difficulty | null;
  /** 最高星数 */
  bestStars: number;
  /** 累计游玩次数 */
  playCount: number;
  /** 累计有效游玩时长（毫秒，仅统计有结算耗时的游戏） */
  totalDurationMs: number;
  /** 是否已通关 */
  cleared: boolean;
  /** 最近一次结算 */
  lastResult: GameResult | null;
  /** 最近若干局结算（环形缓冲，用于自适应难度），最新在末尾。 */
  recentResults: GameResult[];
}

/** 整体存档结构（localStorage）。 */
export interface SaveData {
  version: number;
  progress: Record<GameId, GameProgress>;
  /** 已解锁的成就 id 列表 */
  achievements: string[];
  /** 家长设置 */
  settings: ParentSettings;
}

/** 家长面板可控设置。 */
export interface ParentSettings {
  /** 是否静音 */
  muted: boolean;
  /** 锁定难度（null = 自适应） */
  lockedDifficulty: Difficulty | null;
  /** 是否启用"连续答错休息"护盾 */
  restShield: boolean;
}

/** 反馈同步到 generic-admin 后台的配置（独立 localStorage key，不进存档结构以免迁移）。
 *  默认关闭；家长在面板里填 baseUrl + token 后才联网。 */
export interface SyncConfig {
  /** 是否启用同步 */
  enabled: boolean;
  /** generic-admin API base，如 http://127.0.0.1:8080/api/v1 */
  baseUrl: string;
  /** API token（generic-admin 后台创建，Bearer 头用） */
  token: string;
}

/** 标准化指针位置，input.ts 把 mouse/touch/pen 统一成这个。 */
export interface Pointer {
  x: number;
  y: number;
  /** 指针唯一 id（多点触控区分） */
  id: number;
}

/** 统一指针事件回调签名。 */
export type PointerHandler = (p: Pointer) => void;

/** 粒子（彩纸/星星）定义，particles.ts 使用。 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  /** 旋转（弧度） */
  rot: number;
  vrot: number;
  /** 剩余生命（帧） */
  life: number;
  maxLife: number;
  shape: "circle" | "star" | "rect" | "heart";
}
