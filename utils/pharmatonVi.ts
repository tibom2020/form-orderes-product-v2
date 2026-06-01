export const PHARMATON_VI_GOI_NOTE = 'Gói PHARMATON VỈ';

export const PHARMATON_VI_GOI_NOTE_LEGACY = ['Gói PHARMATON VITALITY BLISTER (5h)'] as const;

export const PHARMATON_VI_GOI_ALL_NOTES: readonly string[] = [
  PHARMATON_VI_GOI_NOTE,
  ...PHARMATON_VI_GOI_NOTE_LEGACY,
];

export function noteHasPharmatonViGoi(note: string): boolean {
  const lines = note.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.some(l => PHARMATON_VI_GOI_ALL_NOTES.includes(l));
}

export function stripPharmatonViGoiNoteLines(lines: string[]): string[] {
  return lines.filter(l => !PHARMATON_VI_GOI_ALL_NOTES.includes(l));
}
