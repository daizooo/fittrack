# ネイティブアプリ化の設計・計画

FITTRACKをAndroidネイティブアプリとして作り直すための設計メモ。同じ作者の
daizooo/sukusukuが先にPWA→Androidネイティブの移行を済ませており、そこでの
設計判断とCI運用のつまずきを踏まえて最初から設計する。

## 0. 決めたこと

| 論点 | 結論 |
| --- | --- |
| 動機 | **Tabataタイマー（work/rest/cycles）のバックグラウンド精度**。ストア配布は目的ではない |
| ネイティブ側の技術構成 | Expo (React Native) を `mobile/` に独立プロジェクトとして追加 |
| PWA(`src/`)との関係 | 将来的に畳む（sukusuku方式）。ただし急がない |
| Supabase | 既存プロジェクトをそのまま使う（新規プロジェクトは作らない） |
| ストア公開 | 出さない。自分の端末に直接インストール |
| CI/配布 | 最初から「定時1回＋手動実行」型（マージ毎ビルドはしない） |

## 1. 動機とその含意

現状の `src/components/FitTrack.tsx` のタイマーは `setInterval`(100ms) と
`Date.now()` の差分で残り時間を計算し、Web Audioで音を鳴らしている。この方式は
ブラウザが非アクティブ・画面オフになるとタイマーが間引かれる／停止する典型
パターンで、sukusukuの授乳アラームが直面したのと同種の問題。

→ **ネイティブ側にAndroidのフォアグラウンドサービスが必須。**
sukusukuが検討・実装済みの方式（計測中だけ前面サービスを動かす、
`AudioAttributes` を `USAGE_ALARM` にしてマナーモードでも鳴らす）をそのまま
転用できるため、ゼロからの設計より難易度は低い。

ただし鳴らし分けはFITTRACK固有に作り直す必要がある。Tabataは
「work開始」「残り5秒のカウントダウン」「work→restの切替」「rest→workの切替」
「セット終了」と鳴らし分けが授乳アラームより多く、`AlarmPattern.kt` の規則は
参考にはなるが、そのまま持ってこられるものではない。

## 2. どこに作るか・何が持っていけるか

sukusukuの原則をそのまま踏襲する。

```
fittrack/
├ src/          ← 今のPWA。当面は動かせる状態のまま残す
├ mobile/       ← 追加。Expo(React Native)の独立プロジェクト
│   ├ package.json    ← 依存はこちらで完結（ルートと混ぜない）
│   ├ app/            ← 画面
│   └ android/        ← `expo prebuild` で生成。前面サービスのKotlinもここ
└ docs/
```

- ルートの `package.json` / `vite.config.ts` は触らない。`mobile/` は自分の依存を
  `npm install` で完結させる
- **npm workspacesにはしない**。ExpoとViteのReact要求バージョンが将来ズレる
  リスクを避ける
- **共有パッケージ（`packages/core`等）は作らない**。持っていけるロジックは
  `mobile/` へコピーする。PWAは凍結〜将来削除の対象なので分岐の心配は小さい

### 持っていけるもの・書き直しになるもの

| 現状 | 扱い |
| --- | --- |
| `initialWorkoutPlans` 等の定義データ、型定義 | そのままコピー可（素のTypeScript） |
| `equipmentUtils.ts`（`generateEquipmentOptions`等） | そのままコピー可 |
| Tailwind + DOM前提の画面（`FitTrack.tsx` 他） | **全部書き直し**。NativeWind推奨（クラス名の書き方をほぼ保てる） |
| `lucide-react` | `lucide-react-native` にほぼ同名で入れ替え |
| Web Audioでの音の合成（`playBeep`） | 前面サービス側（Kotlin）で音を組む。鳴らし分けは新規設計（§1） |
| `setInterval`+`Date.now()` のタイマー計算 | 規則（work/rest/cycles）は残し、実行主体を前面サービスへ移す。アプリを開いている間はJS側、閉じている間はサービス側が計測を継続 |
| Supabase Auth（Cookie不使用のSPA） | `@supabase/supabase-js` をそのまま使用。セッション永続化のみAsyncStorageに変更。FITTRACKはSSR先読みをしていないため、sukusukuが直面した「認証と初回表示の作り直し」（同ドキュメント§3）は発生しない |

## 3. Supabase

既存プロジェクトをそのまま使う。RLSは `user_id` ベースなので、ネイティブ
クライアントもsupabase-jsで直接つなげばそのまま動く。データ移行は不要。

## 4. オフライン対応（検討課題）

sukusukuは家族2人の同時記録という要件があり、オフライン同期の設計が必須
だった。FITTRACKは単一ユーザーの記録なので、複数端末間の書き込み競合は
基本的に起きない。ジム内の電波不良を考慮するなら、フェーズ1で「記録を
端末内に一時保存し、送信できたら消す」程度の簡易対応に留めるのが妥当。
sukusuku同様の本格的なローカルDB＋同期の仕組みまでは、現時点では過剰。

## 5. 進める順番

| フェーズ | やること | 終わったとき |
| --- | --- | --- |
| 0. 土台 | `mobile/` にExpoを置き、Supabaseへログインできるところまで。ロジック層（定義データ・型・equipmentUtils）を移植 | 実機で自分の記録が1件読める |
| 1. Tabataタイマー | ワークアウト記録画面＋前面サービス（Kotlin）＋鳴らし分け＋簡易オフライン対応（§4） | **タイマーだけネイティブで正確に回る。**当初の目的はここで達成される |
| 1a. （進捗）ワークアウト記録画面＋タイマーUI | JS側で実装済み（`mobile/src/components/WorkoutRecordScreen.tsx`, `mobile/src/hooks/useWorkoutTimer.ts`）。setInterval+Date.now()方式のためフォアグラウンドでのみ正確 | — |
| 1b. （設計済み・未実装）前面サービス | Kotlin側の詳細設計は`docs/tabata-foreground-service.md`を参照。Android SDKが無い環境のため実装はまだ | — |
| 2. 残りの画面 | プラン／履歴／分析／プロフィールの各タブ | Android上でPWA相当の全機能が揃う |
| 3. 通知 | 現状FitTrackに通知機能は無い。将来トレーニングリマインダー等を足すなら検討 | — |
| 4. 畳む | PWAのデプロイを止め、`src/` を削除 | Android移行が安定し、退路が不要と確認できてから |

- フェーズ1で一度実機に入れて使う。sukusukuの凍結の真因（実機で一度も動かない
  まま積み上がったこと）を避けるため、早期に実機確認する原則をそのまま採用
- フェーズ4は急がない。ストア非公開・自端末専用なので、畳んで得られるのは
  見通しの良さだけであり、失うのは「ネイティブ版が壊れたときの退路」

## 6. CI/配布 — 最初から「定時＋手動」型

sukusukuは「マージ毎に `.apk` をビルド（1回18〜19分）」を続けた結果、
GitHub Actionsの無料枠（月2000分）を使い切った。FITTRACKは同じ轍を踏まず、
**最初から**次の形で設計する（`.github/workflows/mobile-apk.yml` を移植・調整）。

- PR: 型チェックのみ（Androidのフルビルドはしない）
- 毎日定時実行（1回）＋ `workflow_dispatch`（手動実行）のみでフルビルド
- 前回配布時点からの差分（`mobile/` の変更有無）が無ければビルドをスキップ
- ビルド対象は `arm64-v8a` のみ（自分の端末に合わせる。4アーキ全部だと
  ビルドだけで37分かかる実測あり）
- 配布はFirebase App Distribution（FITTRACK用に新規Firebaseプロジェクトの
  セットアップが要る。sukusukuとは別プロジェクトにする）

### 署名鍵は最初から自前で用意する

sukusukuはExpoのdebug鍵からスタートし、Androidデベロッパー確認
（2027年に日本へ拡大予定）への対応として後から自前鍵に移行した。この移行は
「署名が変わると上書きインストールできない＝一度アンインストールして入れ直し」
という手間を伴う。FITTRACKは**最初から**自前のkeystoreを作り、
`ANDROID_KEYSTORE_BASE64` 等をSecretsに登録しておくことで、この手戻りを避ける。

## 7. 見送るもの・急がないもの

- ストアへの公開（Play Console登録、Play App Signing、EAS Build）は現時点では
  検討しない。必要になった時点で `docs/store-release.md`（sukusuku）の型を参照する
- 共有パッケージ化・monorepo化はしない（§2）
- PWAを畳む作業（フェーズ4）は、ネイティブ移行が安定するまで急がない
