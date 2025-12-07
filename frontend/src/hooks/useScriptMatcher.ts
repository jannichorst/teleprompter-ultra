import { useState, useCallback, useRef, useEffect } from "react";

interface ScriptWord {
  word: string;
  normalizedWord: string;
  index: number;
  startChar: number;
  endChar: number;
}

interface MatchState {
  currentWordIndex: number;
  confidence: number;
  lastMatchTime: number;
  isActive: boolean;
}

interface UseScriptMatcherReturn {
  currentWordIndex: number;
  currentCharIndex: number;
  confidence: number;
  isActive: boolean;
  reset: () => void;
  processTranscript: (transcript: string) => void;
  setScript: (script: string) => void;
}

// Normalize a word for comparison (lowercase, remove punctuation)
function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Efficiently extract last N words from a string without tokenizing the whole thing
function extractLastNWords(text: string, n: number): string[] {
  const words: string[] = [];
  let end = text.length;
  
  // Work backwards from the end of the string
  while (words.length < n && end > 0) {
    // Skip trailing whitespace
    while (end > 0 && /\s/.test(text[end - 1])) {
      end--;
    }
    if (end === 0) break;
    
    // Find start of current word
    let start = end;
    while (start > 0 && !/\s/.test(text[start - 1])) {
      start--;
    }
    
    // Extract and normalize the word
    const word = text.slice(start, end);
    const normalized = normalizeWord(word);
    if (normalized.length > 0) {
      words.unshift(normalized); // Add to front since we're going backwards
    }
    
    end = start;
  }
  
  return words;
}

// Tokenize script into words with position information
function tokenizeScript(script: string): ScriptWord[] {
  const words: ScriptWord[] = [];
  const regex = /\S+/g;
  let match;
  let index = 0;

  while ((match = regex.exec(script)) !== null) {
    words.push({
      word: match[0],
      normalizedWord: normalizeWord(match[0]),
      index,
      startChar: match.index,
      endChar: match.index + match[0].length,
    });
    index++;
  }

  return words;
}

// Calculate Levenshtein distance between two strings
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1) between two strings
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

// Calculate match score for a sequence of words
function matchScore(transcriptWords: string[], scriptWords: ScriptWord[]): number {
  if (transcriptWords.length === 0 || scriptWords.length === 0) return 0;
  
  let totalScore = 0;
  const compareLength = Math.min(transcriptWords.length, scriptWords.length);
  
  for (let i = 0; i < compareLength; i++) {
    totalScore += similarity(transcriptWords[i], scriptWords[i].normalizedWord);
  }
  
  return totalScore / compareLength;
}

export function useScriptMatcher(): UseScriptMatcherReturn {
  const [matchState, setMatchState] = useState<MatchState>({
    currentWordIndex: 0,
    confidence: 0,
    lastMatchTime: 0,
    isActive: false,
  });

  const scriptWordsRef = useRef<ScriptWord[]>([]);
  const lastTranscriptRef = useRef<string>("");
  const lastProcessedLengthRef = useRef<number>(0);
  const lastMatchTimeRef = useRef<number>(0);

  // Configuration
  const SEARCH_WINDOW_SIZE = 30; // How many words ahead to search (reduced for performance)
  const MATCH_THRESHOLD = 0.6; // Minimum match score to accept
  const NGRAM_SIZE = 3; // Number of words to match at once
  const MIN_WORDS_FOR_MATCH = 2; // Minimum transcript words needed
  const THROTTLE_MS = 100; // Minimum time between processing updates

  const setScript = useCallback((script: string) => {
    scriptWordsRef.current = tokenizeScript(script);
    // Reset state when script changes
    setMatchState({
      currentWordIndex: 0,
      confidence: 0,
      lastMatchTime: 0,
      isActive: false,
    });
    lastTranscriptRef.current = "";
    lastProcessedLengthRef.current = 0;
  }, []);

  const reset = useCallback(() => {
    setMatchState({
      currentWordIndex: 0,
      confidence: 0,
      lastMatchTime: 0,
      isActive: false,
    });
    lastTranscriptRef.current = "";
    lastProcessedLengthRef.current = 0;
  }, []);

  const processTranscript = useCallback((transcript: string) => {
    if (!transcript || scriptWordsRef.current.length === 0) {
      return;
    }

    // Check if transcript has changed
    if (transcript === lastTranscriptRef.current) {
      return;
    }

    // Throttle: skip if we processed too recently
    const now = Date.now();
    if (now - lastMatchTimeRef.current < THROTTLE_MS) {
      return;
    }

    // Skip if transcript hasn't grown by at least a few characters (optimization)
    const lengthDiff = transcript.length - lastTranscriptRef.current.length;
    if (lengthDiff > 0 && lengthDiff < 3) {
      return; // Wait for more text
    }

    lastTranscriptRef.current = transcript;
    lastMatchTimeRef.current = now;

    // OPTIMIZATION: Only extract last N words from the end of transcript
    // Instead of tokenizing the entire string
    const recentWords = extractLastNWords(transcript, NGRAM_SIZE);

    if (recentWords.length < MIN_WORDS_FOR_MATCH) {
      return;
    }
    
    setMatchState((prevState) => {
      const scriptWords = scriptWordsRef.current;
      const currentIndex = prevState.currentWordIndex;

      // Define search window (from current position forward)
      const searchStart = Math.max(0, currentIndex - 2); // Allow slight backtrack
      const searchEnd = Math.min(
        scriptWords.length - recentWords.length + 1,
        currentIndex + SEARCH_WINDOW_SIZE
      );

      if (searchStart >= searchEnd) {
        return prevState;
      }

      // Find best match in search window
      let bestMatch = { index: -1, score: 0 };

      for (let i = searchStart; i < searchEnd; i++) {
        const windowWords = scriptWords.slice(i, i + recentWords.length);
        const score = matchScore(recentWords, windowWords);

        // Prefer matches closer to current position (momentum)
        const distanceBonus = 1 - Math.abs(i - currentIndex) / SEARCH_WINDOW_SIZE * 0.1;
        const adjustedScore = score * distanceBonus;

        if (adjustedScore > bestMatch.score) {
          bestMatch = { index: i, score: adjustedScore };
        }
      }

      // Update position if good match found
      if (bestMatch.score >= MATCH_THRESHOLD && bestMatch.index >= 0) {
        const newIndex = bestMatch.index + recentWords.length - 1;
        
        // Only move forward (or stay) - never jump back significantly
        if (newIndex >= currentIndex - 1) {
          return {
            currentWordIndex: newIndex,
            confidence: bestMatch.score,
            lastMatchTime: Date.now(),
            isActive: true,
          };
        }
      }

      return prevState;
    });
  }, []);

  // Calculate character index from word index
  const currentCharIndex =
    matchState.currentWordIndex < scriptWordsRef.current.length
      ? scriptWordsRef.current[matchState.currentWordIndex]?.startChar ?? 0
      : 0;

  return {
    currentWordIndex: matchState.currentWordIndex,
    currentCharIndex,
    confidence: matchState.confidence,
    isActive: matchState.isActive,
    reset,
    processTranscript,
    setScript,
  };
}

