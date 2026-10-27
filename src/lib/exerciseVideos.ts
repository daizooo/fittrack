// ─── 解説動画カタログ ────────────────────────────────────────────────────────
// 元データは Google ドライブの「トレーニング」フォルダ（01〜35 の mp4）。
// プラン・種目は videoIds でここのIDを参照する（ファイル名の拡張子を除いたものがID）。

export interface ExerciseVideo {
  id: string
  title: string
  driveId: string
}

type Row = [id: string, title: string, driveId: string]

const ROWS: Row[] = [
  ['01_monday_warmup_hip_circle', '股関節サークル', '1XdsTdQrtqKgfsmC6_IXMGhcXQ_Cq2QwN'],
  ['02_monday_warmup_ankle_stretch', '足首の背屈ストレッチ', '1oPXfHouPSP2Bs8sevGd_XRGx7lu3aNET'],
  ['03_monday_main_bulgarian_squat', 'ブルガリアンスクワット', '1QqgNpsQsVJhqlCEHpYRag5iC4Sl-mNrJ'],
  ['04_monday_main_band_good_morning', 'チューブ・グッドモーニング', '1xm0UIA0dOUux6rQLr81DugbCH5YG2HV3'],
  ['05_monday_cooldown_quad_stretch', '太もも前・お尻のストレッチ', '10thOAiB-AL0V91FW40nH3bo50IwwLtIO'],
  ['06_tuesday_warmup_cat_cow', 'キャット＆カウ', '1zOatSvoCmoBvJr_ebDgt3vOXA_JT02VC'],
  ['07_tuesday_warmup_arm_circle', 'アームサークル', '1UkNBTeDeq2EtDc5gwUbtddRbbtaks-na'],
  ['08_tuesday_main_assisted_pullup', 'アシスト・チンニング', '1kllmzkuDraMJ12Go5t1syB5jd56jsKKF'],
  ['09_tuesday_main_kneeling_face_pull', 'ニーリング・フェイスプル', '1tzprBQQcRiGZL0tJ_JOeVVPw5qHKYJqY'],
  ['10_tuesday_cooldown_lat_stretch', '広背筋ストレッチ', '1y2dUeJQz9ce_4siNFO1WOKIOsYB7rEZl'],
  ['11_wednesday_warmup_march_in_place', '足踏み腕振り', '1026DJ9otwKho8_WibmFz5Uu5hbn1eRZI'],
  ['12_wednesday_warmup_worlds_greatest_stretch', 'ワールド・グレイテスト・ストレッチ', '10wkt3IssaMD_2oKoBXQ7IssKRlU07n32'],
  ['13_wednesday_main_pushup_bar_sprawl', 'スロール（プッシュアップバー）', '1W8pmFvGQ5R3x_x9n3UZMy1CLBunl6bA-'],
  ['14_wednesday_main_mountain_climber', 'マウンテンクライマー', '1vktZYn8dPTkU2Xl_MkvtF8Wh9cYQ9gg2'],
  ['15_wednesday_cooldown_childs_pose', 'チャイルドポーズ', '1AfGOU6lEz5UE8Cjlau4mJq4XdrWPKw3i'],
  ['16_thursday_warmup_wrist_forearm_stretch', '手首回し＆前腕ストレッチ', '1UFIfGgBODkUyIxYgSk9z74RRviwWkpVx'],
  ['17_thursday_warmup_chest_open_stretch', '胸郭オープンストレッチ', '1mDenIEEkaWzErhq6elu1pbBampU5e6lg'],
  ['18_thursday_main_st146_dips', 'ディップス', '13uAo9uqG9Ewf77nLXAX-kOamdQOOIE5o'],
  ['19_thursday_main_deficit_pushup', 'デフィシット・プッシュアップ', '1E-Y3H3QYny5y45ShhrlEQ0xhrYETKpEg'],
  ['20_thursday_cooldown_chest_triceps_stretch', '胸・上腕三頭筋ストレッチ', '15menGE47IToonT4IJH8hJ-g-smvSADGP'],
  ['21_friday_warmup_inchworm', 'インチウォーム', '1_eSHFIjlzko8wfHSTQi-wGVzxD3gwehS'],
  ['22_friday_main_alternating_back_lunge', 'オルタネイティング・バックランジ', '1M19ApzMatTqBANN-ioKTALhuH_AzG1dZ'],
  ['23_friday_main_hanging_knee_raise', 'ハンギング・ニーレイズ', '1HPEoSf8o7JqwMqPOGlXiQhUSwd9fMwBC'],
  ['24_friday_main_dip_bar_knee_raise', 'ディップスバー・ニーレイズ（握力が疲れた日）', '1mdMGjEoF0oNOrAUggT0YDNT6a8VDKhrD'],
  ['25_friday_cooldown_cobra_pose', 'コブラポーズ', '1xuoVqyeqk79Zb7sRLcEuHi4q6OXs0Nw7'],
  ['26_saturday_warmup_bodyweight_squat', '自重スクワット', '1gUOslS-wKXZxhFwlWI_WeRNUCTpMP-tV'],
  ['27_saturday_warmup_thoracic_rotation', '胸椎ローテーション', '1nFhlYxzsnsRd_Dw3M7BUTAB5NhMZiKor'],
  ['28_saturday_main_band_squat_press', 'チューブ・スクワット＆プレス', '1OT5jIwdLdAvJ8DMHVTc2bnDNhmUy4XKO'],
  ['29_saturday_main_seated_band_row', 'シーテッド・チューブローイング', '1QJMX9aMZR6c9iZciroXmsMLim6HUvkff'],
  ['30_saturday_cooldown_side_bend_stretch', '体側伸ばしストレッチ', '1qzF4wTlVL96koXVhwTJJQLsIdGQbiXV1'],
  ['31_sunday_mobility_scorpion_stretch', 'スコーピオン・チェストストレッチ', '1T2A29v_DcgiGQr5WMXFspY9gAiJL1buJ'],
  ['32_sunday_mobility_90_90_hip_stretch', '90-90 ヒップストレッチ', '17rMmyXfhha7I4Su1DlAvoNTwd0XRb3-0'],
  ['33_sunday_mobility_couch_stretch', 'カウチストレッチ', '1oUoodSjhR3aqpKYeabt21Ya0IiQVXQhv'],
  ['34_sunday_mobility_downdog_to_cobra', 'ダウンドッグ〜コブラ', '1owS0tG2CdSNIZmtIbmT5zODkZZ0BgmHN'],
  ['35_sunday_cooldown_supine_deep_breathing', '仰向けディープブリージング', '1G_ZKZ9nBP9VrJMQIAda20xowRuV1alQD']
]

export const EXERCISE_VIDEOS: ExerciseVideo[] = ROWS.map(([id, title, driveId]) => ({ id, title, driveId }))

const byId = new Map(EXERCISE_VIDEOS.map(v => [v.id, v]))

/** videoIds → 動画。カタログに無いIDは捨てる */
export const resolveVideos = (ids: readonly string[] | undefined): ExerciseVideo[] =>
  (ids ?? []).flatMap(id => byId.get(id) ?? [])

/** アプリ内に埋め込む再生用URL（Google ドライブのプレビュー） */
export const videoEmbedUrl = (v: ExerciseVideo) => `https://drive.google.com/file/d/${v.driveId}/preview`
/** ドライブで開くURL（埋め込めないときの逃げ道） */
export const videoOpenUrl = (v: ExerciseVideo) => `https://drive.google.com/file/d/${v.driveId}/view`

/** 標準の種目（'sys:' の後ろのID）→ 解説動画。プランに入れた種目に自動で付く */
export const BUILTIN_EXERCISE_VIDEOS: Record<string, string[]> = {
  'bulgarian-squat': ['03_monday_main_bulgarian_squat'],
  'bulgarian-squat-left': ['03_monday_main_bulgarian_squat'],
  'bulgarian-squat-right': ['03_monday_main_bulgarian_squat'],
  'tube-good-morning': ['04_monday_main_band_good_morning'],
  'chin-up': ['08_tuesday_main_assisted_pullup'],
  'kneeling-face-pull': ['09_tuesday_main_kneeling_face_pull'],
  'pushup-bar-sprawl': ['13_wednesday_main_pushup_bar_sprawl'],
  'mountain-climber': ['14_wednesday_main_mountain_climber'],
  'assist-dips': ['18_thursday_main_st146_dips'],
  'deficit-push-up': ['19_thursday_main_deficit_pushup'],
  'back-lunge': ['22_friday_main_alternating_back_lunge'],
  'hanging-knee-raise': ['23_friday_main_hanging_knee_raise', '24_friday_main_dip_bar_knee_raise'],
  'squat': ['26_saturday_warmup_bodyweight_squat'],
  'tube-squat-press': ['28_saturday_main_band_squat_press'],
  'seated-tube-row': ['29_saturday_main_seated_band_row'],
  'cat-cow': ['06_tuesday_warmup_cat_cow'],
  'scorpion-chest-stretch': ['31_sunday_mobility_scorpion_stretch'],
  '90-90-hip-stretch': ['32_sunday_mobility_90_90_hip_stretch'],
  'couch-stretch': ['33_sunday_mobility_couch_stretch'],
  'downdog-to-cobra': ['34_sunday_mobility_downdog_to_cobra'],
  'supine-deep-breathing': ['35_sunday_cooldown_supine_deep_breathing']
}
