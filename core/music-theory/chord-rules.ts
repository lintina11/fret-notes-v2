export interface ChordRule {
  symbol: string   // e.g. "m7", "maj7", "sus2"
  name: string     // e.g. "小七和弦"
  intervals: number[]  // sorted, starts with 0
}

// More specific rules (more intervals) must come before less specific ones
export const CHORD_RULES: ChordRule[] = [
  // 四音和弦（Seven chords）
  { symbol: 'maj7',  name: '大七和弦',       intervals: [0, 4, 7, 11] },
  { symbol: 'm7',    name: '小七和弦',       intervals: [0, 3, 7, 10] },
  { symbol: '7',     name: '屬七和弦',       intervals: [0, 4, 7, 10] },
  { symbol: 'm7b5',  name: '半減七和弦',     intervals: [0, 3, 6, 10] },
  { symbol: '6',     name: '大六和弦',       intervals: [0, 4, 7,  9] },
  { symbol: 'm6',    name: '小六和弦',       intervals: [0, 3, 7,  9] },
  { symbol: 'add9',  name: '加九和弦',       intervals: [0, 2, 4,  7] },
  // 三音和弦（Triads）
  { symbol: '',      name: '大三和弦',       intervals: [0, 4, 7] },
  { symbol: 'm',     name: '小三和弦',       intervals: [0, 3, 7] },
  { symbol: 'dim',   name: '減三和弦',       intervals: [0, 3, 6] },
  { symbol: 'aug',   name: '增三和弦',       intervals: [0, 4, 8] },
  { symbol: 'sus2',  name: '掛留二和弦',     intervals: [0, 2, 7] },
  { symbol: 'sus4',  name: '掛留四和弦',     intervals: [0, 5, 7] },
  // Power chord
  { symbol: '5',     name: '強力和弦',       intervals: [0, 7] },
]
