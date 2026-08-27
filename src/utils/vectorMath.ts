/**
 * Utility for local Jaro-Winkler string similarity calculations.
 * Measures distance between two strings (value between 0.0 and 1.0).
 */
export function jaroWinkler(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;
  
  const matchWindow = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(b.length - 1, i + matchWindow);
    
    for (let j = start; j <= end; j++) {
      if (!bMatches[j] && a[i] === b[j]) {
        aMatches[i] = true;
        bMatches[j] = true;
        matches++;
        break;
      }
    }
  }
  
  if (matches === 0) return 0.0;
  
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (aMatches[i]) {
      while (!bMatches[k]) k++;
      if (a[i] !== b[k]) transpositions++;
      k++;
    }
  }
  
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  
  // Prefix scale boost (Winkler adjustment)
  const prefixLimit = 4;
  let prefix = 0;
  for (let i = 0; i < Math.min(prefixLimit, a.length, b.length); i++) {
    if (a[i] === b[i]) {
      prefix++;
    } else {
      break;
    }
  }
  
  return jaro + prefix * 0.1 * (1.0 - jaro);
}

/**
 * Checks similarity score between a query label and a target synonym list.
 * Computes Jaro-Winkler and token overlap calculations.
 */
export function getSemanticScore(query: string, synonyms: string[]): number {
  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);
  
  let highestScore = 0.0;
  
  for (const synonym of synonyms) {
    const cleanSynonym = synonym.toLowerCase().trim();
    const synTokens = cleanSynonym.split(/\s+/).filter(Boolean);
    
    // 1. Direct Jaro-Winkler similarity
    const jwScore = jaroWinkler(cleanQuery, cleanSynonym);
    if (jwScore > highestScore) highestScore = jwScore;
    
    // 2. Token overlap checks (e.g. "email address" matching "email")
    let tokenMatches = 0;
    for (const qTok of queryTokens) {
      if (synTokens.includes(qTok) || synTokens.some(sTok => sTok.includes(qTok) || qTok.includes(sTok))) {
        tokenMatches++;
      }
    }
    
    if (tokenMatches > 0) {
      const overlapScore = tokenMatches / Math.max(queryTokens.length, synTokens.length);
      // Give a boost to token matches
      const finalOverlap = overlapScore * 0.9;
      if (finalOverlap > highestScore) highestScore = finalOverlap;
    }
  }
  
  return highestScore;
}
