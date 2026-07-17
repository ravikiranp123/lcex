import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect } from "vitest";
import type { Problem } from "../src/modules/interface/Problem";
import { generateTemplate } from "../src/modules/TemplateEngine";
import { compareOutput } from "../src/modules/ExampleRunner";
import {
  javaEntryClassName,
  problemKeyFromSolutionFileBase,
  solutionFileBaseName,
} from "../src/modules/language/LanguageStrategy";

function findJavac(): string | null {
  const candidates = [
    "javac",
    "/opt/homebrew/opt/openjdk/bin/javac",
    "/opt/homebrew/opt/openjdk@21/bin/javac",
    "/opt/homebrew/opt/openjdk@17/bin/javac",
    "/usr/local/opt/openjdk/bin/javac",
  ];
  for (const c of candidates) {
    try {
      execFileSync(c, ["-version"], { stdio: "pipe" });
      return c;
    } catch {
      /* try next */
    }
  }
  return null;
}

const JAVAC = findJavac();

function compileAndRun(entryClass: string, source: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lcex-java-test-"));
  try {
    const file = path.join(dir, `${entryClass}.java`);
    fs.writeFileSync(file, source, "utf8");
    execFileSync(JAVAC as string, ["-d", dir, file], { stdio: "pipe" });
    const javaBin = JAVAC === "javac" ? "java" : path.join(path.dirname(JAVAC as string), "java");
    return execFileSync(javaBin, ["-cp", dir, entryClass], { stdio: "pipe" }).toString();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function problem(p: Partial<Problem> & { id: string; titleSlug: string }): Problem {
  return {
    title: p.titleSlug,
    difficulty: "Easy",
    content: "",
    codeSnippet: "",
    sampleTestCase: "",
    ...p,
  } as Problem;
}

describe("Java solution file naming", () => {
  it("names files after the entry class so javac/java can run them", () => {
    expect(solutionFileBaseName("java", "2")).toBe("LeetPlusMain2");
    expect(solutionFileBaseName("java", "two-sum")).toBe("LeetPlusMainTwoSum");
    expect(solutionFileBaseName("java", "2", "-abc")).toBe("LeetPlusMain2_abc");
    expect(solutionFileBaseName("typescript", "2")).toBe("2");
    expect(solutionFileBaseName("python", "two-sum", "-abc")).toBe("two-sum-abc");
  });

  it("maps file bases back to problem ids/slugs", () => {
    expect(problemKeyFromSolutionFileBase("LeetPlusMain2")).toBe("2");
    expect(problemKeyFromSolutionFileBase("LeetPlusMain2_abc")).toBe("2");
    expect(problemKeyFromSolutionFileBase("LeetPlusMainTwoSum")).toBe("two-sum");
    expect(problemKeyFromSolutionFileBase("2")).toBe("2");
    expect(problemKeyFromSolutionFileBase("two-sum")).toBe("two-sum");
  });

  it("builds valid Java class names", () => {
    for (const name of [javaEntryClassName("2"), javaEntryClassName("two-sum"), javaEntryClassName("3sum")]) {
      expect(name).toMatch(/^[A-Za-z_$][\w$]*$/);
    }
  });
});

describe("Java template generation", () => {
  const twoSum = problem({
    id: "1",
    titleSlug: "two-sum",
    title: "Two Sum",
    content:
      "<p>Example 1:</p><pre>Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\n</pre>" +
      "<p>Example 2:</p><pre>Input: nums = [3,2,4], target = 6\nOutput: [1,2]\n</pre>",
    exampleTestCases: ["[2,7,11,15]\n9", "[3,2,4]\n6"],
    codeSnippets: {
      java:
        "class Solution {\n" +
        "    public int[] twoSum(int[] nums, int target) {\n" +
        "        \n" +
        "    }\n" +
        "}",
    },
  });

  it("emits an entry class matching the file base, with typed example calls and expected comments", () => {
    const content = generateTemplate(twoSum, { language: "java", fileBaseName: "LCexMain1" });
    expect(content.includes("class LCexMain1 {"), "entry class should match file base").toBeTruthy();
    expect(content.includes("public static void main(String[] args)"), "should have main").toBeTruthy();
    expect(content.includes("import java.util.*;"), "should import java.util").toBeTruthy();
    expect(content.includes("new Solution().twoSum(new int[]{2, 7, 11, 15}, 9)")).toBeTruthy();
    expect(content.includes("// [0,1]"), "should carry expected output as comment").toBeTruthy();
    expect(content.includes("Arrays.toString("), "int[] result should print via Arrays.toString").toBeTruthy();
  });

  it("generated two-sum file compiles, runs, and examples pass once solved", (t) => {
    if (!JAVAC) return t.skip("no JDK available");
    const content = generateTemplate(twoSum, { language: "java", fileBaseName: "LCexMain1" }).replace(
      "        \n",
      "        java.util.Map<Integer, Integer> seen = new java.util.HashMap<>();\n" +
        "        for (int i = 0; i < nums.length; i++) {\n" +
        "            if (seen.containsKey(target - nums[i])) return new int[]{seen.get(target - nums[i]), i};\n" +
        "            seen.put(nums[i], i);\n" +
        "        }\n" +
        "        return new int[0];\n"
    );
    const stdout = compileAndRun("LCexMain1", content);
    const results = compareOutput(content, stdout, "java");
    expect(results.length).toBe(2);
    for (const r of results) {
      expect(r.pass, `example at line ${r.lineIndex} should pass: expected ${r.expected}, got ${r.actual}`).toBeTruthy();
    }
  });

  it("renders design problems as direct driver calls", (t) => {
    const lru = problem({
      id: "146",
      titleSlug: "lru-cache",
      title: "LRU Cache",
      content: "<pre>Output\n[null, null, null, 1, null, -1]</pre>",
      exampleTestCases: [
        '["LRUCache","put","put","get","put","get"]\n[[2],[1,1],[2,2],[1],[3,3],[2]]',
      ],
      codeSnippets: {
        java:
          "class LRUCache {\n\n    public LRUCache(int capacity) {\n        \n    }\n    \n" +
          "    public int get(int key) {\n        \n    }\n    \n" +
          "    public void put(int key, int value) {\n        \n    }\n}",
      },
    });
    const content = generateTemplate(lru, { language: "java", fileBaseName: "LCexMain146" });
    expect(content.includes("LRUCache obj1 = new LRUCache(2);"), `ctor call missing:\n${content}`).toBeTruthy();
    expect(content.includes("obj1.put(1, 1);"), "void method should be a bare call").toBeTruthy();
    expect(content.includes("System.out.println(obj1.get(1));  // 1"), "non-void should print with expected").toBeTruthy();
    expect(content.includes("class LCexMain146 {"), "entry class should match file base").toBeTruthy();

    if (!JAVAC) return t.skip("no JDK available");
    const solved = content
      .replace("class LRUCache {\n", "class LRUCache {\n    java.util.LinkedHashMap<Integer, Integer> m = new java.util.LinkedHashMap<>();\n    int cap;\n")
      .replace("    public LRUCache(int capacity) {\n        \n    }", "    public LRUCache(int capacity) {\n        cap = capacity;\n    }")
      .replace(
        "    public int get(int key) {\n        \n    }",
        "    public int get(int key) {\n        if (!m.containsKey(key)) return -1;\n        int v = m.remove(key);\n        m.put(key, v);\n        return v;\n    }"
      )
      .replace(
        "    public void put(int key, int value) {\n        \n    }",
        "    public void put(int key, int value) {\n        m.remove(key);\n        m.put(key, value);\n        if (m.size() > cap) m.remove(m.keySet().iterator().next());\n    }"
      );
    const stdout = compileAndRun("LCexMain146", solved);
    const results = compareOutput(solved, stdout, "java");
    expect(results.length).toBe(2);
    for (const r of results) {
      expect(r.pass, `design example at line ${r.lineIndex}: expected ${r.expected}, got ${r.actual}`).toBeTruthy();
    }
  });

  it("falls back to comments for non-constructible types (ListNode) without breaking compilation", (t) => {
    const addTwo = problem({
      id: "2",
      titleSlug: "add-two-numbers",
      title: "Add Two Numbers",
      content: "<pre>Output: [7,0,8]</pre>",
      exampleTestCases: ["[2,4,3]\n[5,6,4]"],
      codeSnippets: {
        java:
          "/**\n * Definition for singly-linked list.\n * public class ListNode {\n *     int val;\n * }\n */\n" +
          "class Solution {\n    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {\n        \n    }\n}",
      },
    });
    const content = generateTemplate(addTwo, { language: "java", fileBaseName: "LCexMain2" });
    expect(content.includes("// LCex: needs manual setup"), "should fall back to a comment").toBeTruthy();
    expect(content.includes("class LCexMain2 {"), "entry class should still exist").toBeTruthy();
    expect(compareOutput(content, "", "java").length).toBe(0);

    if (!JAVAC) return t.skip("no JDK available");
    // Must compile as-is even though the example can't run (Solution body returns nothing yet).
    const compilable = content.replace("        \n    }", "        return null;\n    }");
    const stdout = compileAndRun("LCexMain2", compilable.replace(/^\/\*\*[\s\S]*?\*\/\n/m, "class ListNode { int val; }\n"));
    expect(stdout).toBe("");
  });

  it("handles void in-place problems by printing the mutated argument", (t) => {
    const rotate = problem({
      id: "189",
      titleSlug: "rotate-array",
      title: "Rotate Array",
      content: "<pre>Output: [5,6,7,1,2,3,4]</pre>",
      exampleTestCases: ["[1,2,3,4,5,6,7]\n3"],
      codeSnippets: {
        java: "class Solution {\n    public void rotate(int[] nums, int k) {\n        \n    }\n}",
      },
    });
    const content = generateTemplate(rotate, { language: "java", fileBaseName: "LCexMain189" });
    expect(content.includes("int[] lcexArg = new int[]{1, 2, 3, 4, 5, 6, 7};"), `void path missing:\n${content}`).toBeTruthy();
    expect(content.includes("new Solution().rotate(lcexArg, 3);"), "should call with the named arg").toBeTruthy();

    if (!JAVAC) return t.skip("no JDK available");
    const solved = content.replace(
      "        \n    }",
      "        k %= nums.length;\n        int[] out = new int[nums.length];\n" +
        "        for (int i = 0; i < nums.length; i++) out[(i + k) % nums.length] = nums[i];\n" +
        "        System.arraycopy(out, 0, nums, 0, nums.length);\n    }"
    );
    const stdout = compileAndRun("LCexMain189", solved);
    const results = compareOutput(solved, stdout, "java");
    expect(results.length).toBe(1);
    expect(results[0].pass, `expected ${results[0].expected}, got ${results[0].actual}`).toBeTruthy();
  });
});
