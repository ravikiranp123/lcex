import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";
import type { IProblemProvider } from "../src/modules/interface/Problem";
import { LeetCodeProvider } from "../src/modules/LeetCode";
import { InternalApiProvider } from "../src/modules/InternalProvider";
import { generateTemplate } from "../src/modules/TemplateEngine";
import { runTsFile, compareOutput } from "../src/modules/ExampleRunner";

const TEST_OUTPUT_DIR = path.join(__dirname, "..", "test-output");
const PROBLEM_SLUG = "two-sum";

function getProvider(): IProblemProvider {
  const apiUrl = process.env.LEETCODE_TEST_API_URL?.trim();
  if (apiUrl) return new InternalApiProvider(apiUrl);
  return new LeetCodeProvider();
}

describe("Integration: fetch, scrape, create file, run", () => {
  it("fetches problem from LeetCode, writes real file, runs examples", async () => {
    const provider = getProvider();
    const problem = await provider.getProblem(PROBLEM_SLUG);

    expect(problem).toBeTruthy();
    expect(problem.id).toBeTruthy();
    expect(problem.title.length > 0, "problem should have title").toBeTruthy();
    expect(problem.codeSnippet.length > 0, "problem should have code snippet").toBeTruthy();

    const content = generateTemplate(problem);
    expect(content.includes(`// [${problem.id}]`), "template should include problem header").toBeTruthy();
    expect(content.includes("console.log("), "template should include example blocks").toBeTruthy();

    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    const filePath = path.join(TEST_OUTPUT_DIR, `${problem.id}.ts`);
    fs.writeFileSync(filePath, content, "utf8");

    expect(fs.existsSync(filePath), "file should exist on disk").toBeTruthy();

    const { stdout, stderr } = await runTsFile(filePath);
    expect(stdout.length > 0 || stderr.length > 0, "run should produce output").toBeTruthy();

    const results = compareOutput(content, stdout);
    expect(results.length > 0, "should have at least one example result").toBeTruthy();
  });
});
