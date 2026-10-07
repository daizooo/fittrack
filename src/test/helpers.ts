import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

/** 開いている種目ピッカーで、検索して1件以上を選ぶ（まだ確定はしない） */
export async function selectInPicker(user: UserEvent, ...names: string[]) {
  const dialog = screen.getByRole('dialog', { name: '種目を選ぶ' })
  for (const name of names) {
    const search = within(dialog).getByLabelText('種目を検索')
    await user.clear(search)
    await user.type(search, name)
    await user.click(within(dialog).getByRole('checkbox', { name: new RegExp(`^${name}`) }))
  }
}

/** 「種目を追加」→ 一覧から選んで追加、までを行う（エディタ上の「種目を追加」ボタンから） */
export async function addExercisesViaPicker(user: UserEvent, ...names: string[]) {
  await user.click(screen.getByText('種目を追加'))
  await selectInPicker(user, ...names)
  await user.click(screen.getByText(/件を追加/))
}

/** 開いている種目ピッカーで、一覧に無い種目をカスタム作成して追加する */
export async function createInPicker(user: UserEvent, name: string, muscleLabel = 'その他') {
  const dialog = screen.getByRole('dialog', { name: '種目を選ぶ' })
  await user.click(within(dialog).getByText(/新しい種目を作成|を新しい種目として作成/))
  const nameInput = within(dialog).getByLabelText('種目名')
  await user.clear(nameInput)
  await user.type(nameInput, name)
  await user.click(within(dialog).getByRole('button', { name: muscleLabel }))
  await user.click(within(dialog).getByText('作成して追加'))
}

/** 「サーキット追加」→ 開いた一覧から種目を選んで追加する */
export async function addCircuitViaPicker(user: UserEvent, ...names: string[]) {
  await user.click(screen.getByText('サーキット追加'))
  await selectInPicker(user, ...names)
  await user.click(screen.getByText(/件を追加/))
}

/** プランエディタに並んでいる種目名（単独の種目・サーキットの種目を上から順に） */
export const editorExerciseNames = () =>
  screen.queryAllByRole('button', { name: /^種目を変更: / }).map(b => b.getAttribute('aria-label')!.replace('種目を変更: ', ''))
