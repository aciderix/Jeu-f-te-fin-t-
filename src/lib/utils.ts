export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash >>> 0;
}

export function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function getDeterministicChoices(question: any): string[] {
  const seed = hashString(question.id);
  const rng = mulberry32(seed);
  
  const required = question.phase === 1 ? 2 : 4;
  const allWrongs = [...(question.wrong_answers || [])];
  
  // Shuffle wrongs deterministically
  for (let i = allWrongs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allWrongs[i], allWrongs[j]] = [allWrongs[j], allWrongs[i]];
  }
  
  const selected = [question.correct_answer, ...allWrongs.slice(0, required - 1)];
  
  // Shuffle selected deterministically
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }
  
  return selected;
}
