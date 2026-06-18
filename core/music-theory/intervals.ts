export const INTERVAL_NAMES: Record<number, string> = {
  0:  '根音',
  1:  '小二度',
  2:  '大二度',
  3:  '小三度',
  4:  '大三度',
  5:  '完全四度',
  6:  '減五度',
  7:  '完全五度',
  8:  '小六度',
  9:  '大六度',
  10: '小七度',
  11: '大七度',
}

export function intervalBetween(root: number, note: number): number {
  return ((note - root) + 12) % 12
}
