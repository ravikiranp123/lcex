import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { parseProblemConstraints } from "./ConstraintParser";
import { deriveBudget, estimateLoopNesting, compareToBudget } from "./ComplexityBudget";
import { detectPatterns } from "./PatternDetector";
import type { SupportedLanguage } from "./interface/Problem";

export interface HeuristicRatingResult {
  rating: number; // 0-4
  justification: string;
  source: "heuristic";
  patternsDetected: string[];
}

/**
 * Computes a heuristic SRS rating (0-4) based on static complexity bounds,
 * problem size constraints, and structural pattern detection.
 */
export async function estimateRating(
  workspaceRoot: string,
  slug: string,
  sourceCode: string,
  lang: SupportedLanguage,
  problemDescriptionHtmlOrText: string
): Promise<HeuristicRatingResult> {
  // 1. Detect patterns used
  let patternsDetected: string[] = [];
  try {
    const detection = detectPatterns(sourceCode, lang);
    patternsDetected = detection.matched;
  } catch (e) {
    // ignore
  }

  // 1.5 Check for obvious placeholder/incomplete code
  const trimmedCode = sourceCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*|#.*/g, "").trim(); // strip comments
  if (
    trimmedCode.length < 40 || 
    /^\s*(class\s+\w+\s*:\s*)?\s*def\s+\w+\s*\(.*?\)\s*:\s*(pass|return\s*(None|\[\]|\{\}|0|False)?)\s*$/i.test(trimmedCode) ||
    /^\s*(function\s+\w+\s*\(.*?\)\s*\{\s*(return\s*(null|\[\]|\{\}|0|false)?)?;\s*\}|\s*const\s+\w+\s*=\s*\(.*?\)\s*=>\s*(\{.*?\}|null|\[\]|\{\}|0|false))\s*$/i.test(trimmedCode)
  ) {
    return {
      rating: 4, // Again
      justification: "The solution is empty, incomplete, or contains only default placeholder statements.",
      source: "heuristic",
      patternsDetected
    };
  }

  // 2. Parse constraints and derive complexity budget
  let justification = "";
  let rating = 2; // Default "Good"

  try {
    const constraints = parseProblemConstraints(problemDescriptionHtmlOrText);
    const budget = deriveBudget(constraints);
    const estimate = estimateLoopNesting(sourceCode, lang);

    if (budget) {
      const verdict = compareToBudget(estimate, budget);
      if (verdict.tone === "over") {
        rating = 3; // Hard (complexity exceeds budget)
        justification = `Complexity is estimated as ${estimate.bigO}, which exceeds the recommended budget of ${budget.targetLabel} for constraints ${budget.maxSizeLabel}.`;
      } else if (verdict.tone === "tight") {
        rating = 2; // Good (tight complexity)
        justification = `Complexity is ${estimate.bigO}, matching the budget bounds (${budget.targetLabel}) tightly.`;
      } else {
        rating = 1; // Easy (complexity well within budget)
        justification = `Complexity is ${estimate.bigO}, which is well within the budget bounds (${budget.targetLabel}).`;
      }
    } else {
      justification = `Analyzed complexity as ${estimate.bigO}. No explicit constraint budget found.`;
    }
  } catch (e: any) {
    rating = 2; // default
    justification = `Fallback to heuristic rating due to parsing error: ${e.message || String(e)}`;
  }

  return {
    rating,
    justification,
    source: "heuristic",
    patternsDetected
  };
}
