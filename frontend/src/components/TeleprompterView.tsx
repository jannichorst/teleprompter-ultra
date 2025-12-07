import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";
import { enterFullscreen, exitFullscreen, isFullscreenElement } from "../lib/fullscreen";
import { Button } from "./ui/button";
import { Maximize2, Minimize2 } from "lucide-react";

interface TeleprompterViewProps {
  script: string;
  transcript: string;
  fontSize: number;
  currentWordIndex?: number;
  isFollowing?: boolean;
}

interface WordSpan {
  text: string;
  index: number;
  isWord: boolean; // true for words, false for whitespace/newlines
}

// Parse script into words and whitespace, preserving structure
function parseScript(script: string): WordSpan[] {
  const spans: WordSpan[] = [];
  const regex = /(\S+)|(\s+)/g;
  let match;
  let wordIndex = 0;

  while ((match = regex.exec(script)) !== null) {
    if (match[1]) {
      // Word
      spans.push({
        text: match[1],
        index: wordIndex,
        isWord: true,
      });
      wordIndex++;
    } else if (match[2]) {
      // Whitespace (including newlines)
      spans.push({
        text: match[2],
        index: -1,
        isWord: false,
      });
    }
  }

  return spans;
}

export function TeleprompterView({
  script,
  transcript,
  fontSize,
  currentWordIndex = 0,
  isFollowing = false,
}: TeleprompterViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const [fullscreen, setFullscreen] = useState(false);
  const [displayTranscript, setDisplayTranscript] = useState("");
  const [transcriptOpacity, setTranscriptOpacity] = useState(0);
  const fadeTimeoutRef = useRef<number | null>(null);
  const [highlightTop, setHighlightTop] = useState<number | null>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Parse script into words
  const wordSpans = useMemo(() => parseScript(script), [script]);

  const toggleFullscreen = () => {
    const node = containerRef.current;
    if (!node) return;

    if (isFullscreenElement(node)) {
      exitFullscreen();
      setFullscreen(false);
    } else {
      enterFullscreen(node);
      setFullscreen(true);
    }
  };

  // Register word ref
  const setWordRef = useCallback((index: number, el: HTMLSpanElement | null) => {
    if (el) {
      wordRefs.current.set(index, el);
    } else {
      wordRefs.current.delete(index);
    }
  }, []);

  // Handle user scroll detection
  const handleScroll = useCallback(() => {
    if (!isFollowing) return;
    
    isUserScrollingRef.current = true;
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Resume auto-scroll after 3 seconds of no manual scrolling
    scrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 3000);
  }, [isFollowing]);

  // Auto-scroll to current word and update highlight position
  useEffect(() => {
    if (!isFollowing || isUserScrollingRef.current) return;

    const wordEl = wordRefs.current.get(currentWordIndex);
    const scrollContainer = scrollContainerRef.current;

    if (!wordEl || !scrollContainer) return;

    // Get positions
    const containerRect = scrollContainer.getBoundingClientRect();
    const wordRect = wordEl.getBoundingClientRect();

    // Calculate where the word is relative to the container
    const wordRelativeTop = wordRect.top - containerRect.top + scrollContainer.scrollTop;

    // Calculate the target scroll position to center the word
    const targetScroll = wordRelativeTop - containerRect.height / 2 + wordRect.height / 2;

    // Smooth scroll to position
    scrollContainer.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: "smooth",
    });

    // Update highlight position (relative to viewport center of container)
    const highlightY = containerRect.height / 2 - wordRect.height / 2;
    setHighlightTop(highlightY);
  }, [currentWordIndex, isFollowing]);

  // Handle transcript display - show latest, fade after 3 seconds
  useEffect(() => {
    // Clear existing fade timeout
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    if (!transcript || transcript.trim() === "") {
      // If empty, fade out
      setTranscriptOpacity(0);
      setTimeout(() => {
        setDisplayTranscript("");
      }, 500);
      return;
    }

    // Get first line and truncate if needed
    const maxLength = 80;
    const firstLine = transcript.split("\n")[0] || transcript;
    let displayText = firstLine;

    if (firstLine.length > maxLength) {
      // Show most recent words that fit
      const words = firstLine.split(" ");
      let result = "";
      for (let i = words.length - 1; i >= 0; i--) {
        const candidate = words[i] + (result ? " " + result : "");
        if (candidate.length <= maxLength - 3) {
          result = candidate;
        } else {
          break;
        }
      }
      displayText = result ? "..." + result : firstLine.substring(firstLine.length - maxLength + 3);
    }

    // Update display with latest transcript
    setDisplayTranscript(displayText);
    setTranscriptOpacity(1);

    // Fade out after 3 seconds if nothing new arrives
    fadeTimeoutRef.current = window.setTimeout(() => {
      setTranscriptOpacity(0);
      setTimeout(() => {
        setDisplayTranscript("");
      }, 500); // Wait for fade transition
      fadeTimeoutRef.current = null;
    }, 3000);

    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [transcript]);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden rounded-lg border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 shadow-lg flex flex-col group"
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/20" />

      {/* Fullscreen button - dimmed, shows fully on hover */}
      <div className="absolute top-4 left-4 z-30 opacity-30 group-hover:opacity-100 transition-opacity duration-200">
        <Button
          variant="ghost"
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          className="bg-slate-900/80 hover:bg-slate-800/80 backdrop-blur-sm"
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      <div className="relative flex-1 overflow-hidden min-h-0">
        {/* Top fade gradient - matches slate-900 background */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-slate-900 via-slate-900/50 to-transparent pointer-events-none z-20" />

        {/* Bottom fade gradient - matches slate-950 background */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none z-20" />

        {/* Highlight bar - shows current reading position */}
        {isFollowing && highlightTop !== null && (
          <div
            className="absolute left-0 right-0 h-12 bg-cyan-500/10 pointer-events-none z-10 transition-all duration-300"
            style={{ top: highlightTop }}
          />
        )}

        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto px-6"
          onScroll={handleScroll}
        >
          <div
            className="flex flex-col items-center text-center"
            style={{ paddingTop: "calc(50vh - 3rem)", paddingBottom: "calc(50vh - 3rem)" }}
          >
            <p
              className={cn(
                "font-semibold leading-relaxed text-slate-100",
                fullscreen ? "md:max-w-5xl" : "md:max-w-3xl"
              )}
              style={{ fontSize }}
            >
              {wordSpans.length > 0
                ? wordSpans.map((span, i) => {
                    if (!span.isWord) {
                      // Render whitespace/newlines
                      return span.text.includes("\n") ? (
                        <br key={`ws-${i}`} />
                      ) : (
                        <span key={`ws-${i}`}>{span.text}</span>
                      );
                    }

                    // Determine if this word is highlighted (current or recently passed)
                    const isCurrent = span.index === currentWordIndex;
                    const isPassed = span.index < currentWordIndex;

                    return (
                      <span
                        key={`word-${span.index}`}
                        ref={(el) => setWordRef(span.index, el)}
                        className={cn(
                          "transition-colors duration-200",
                          isFollowing && isCurrent && "text-cyan-300",
                          isFollowing && isPassed && "text-slate-400"
                        )}
                      >
                        {span.text}
                      </span>
                    );
                  })
                : "Waiting for your script..."}
            </p>
          </div>
        </div>

        {/* Live transcript - single line at bottom, in fade region */}
        {displayTranscript && transcriptOpacity > 0 && (
          <div
            className="absolute bottom-8 left-0 right-0 z-30 flex justify-center pointer-events-none transition-opacity duration-500"
            style={{ opacity: transcriptOpacity }}
          >
            <p className="text-sm text-slate-200/90 text-center px-6 max-w-4xl">{displayTranscript}</p>
          </div>
        )}
      </div>
    </div>
  );
}
