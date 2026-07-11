import * as vscode from "vscode";

export interface AIRatingResult {
  rating: number;
  justification: string;
  source: "ai";
}

/**
 * Programmatically calls the VS Code Language Model API, or falls back to local
 * Antigravity Manager API, or local Ollama, to compute the AI auto-rating.
 */
export async function computeAIRating(prompt: string, enableOllamaFallback: boolean = false): Promise<AIRatingResult> {
  // Skip local models/lm if Antigravity is detected, as it doesn't support local vscode.lm chat models
  try {
    if (vscode.commands.getCommands) {
      const commands = await vscode.commands.getCommands(true);
      if (commands.some((c) => c.startsWith("antigravity."))) {
        throw new Error("Antigravity IDE detected. Skipping calling local AI models directly.");
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("Antigravity")) {
      throw err;
    }
  }

  // 1. Try VS Code Language Model API
  try {
    const lm = (vscode as any).lm;
    if (lm) {
      const models = await lm.selectChatModels();
      if (models && models.length > 0) {
        const model = models[0];
        const messages = [
          (vscode as any).LanguageModelChatMessage.User(prompt)
        ];
        const tokenSource = new vscode.CancellationTokenSource();
        const timeoutId = setTimeout(() => tokenSource.cancel(), 5000);

        try {
          const response = await model.sendRequest(messages, {}, tokenSource.token);
          let text = "";
          for await (const chunk of response.text) {
            text += chunk;
          }
          clearTimeout(timeoutId);

          const match = text.match(/\{[\s\S]*?\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (typeof parsed.rating === "number" && typeof parsed.justification === "string") {
              return {
                rating: parsed.rating,
                justification: parsed.justification,
                source: "ai"
              };
            }
          }
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      }
    }
  } catch (err) {
    // Ignore and proceed
  }

  // 2. Fallback to local Ollama (127.0.0.1:11434) if enabled
  if (enableOllamaFallback) {
    try {
      const tagsRes = await fetch("http://127.0.0.1:11434/api/tags");
      if (tagsRes.ok) {
        const tagsData: any = await tagsRes.json();
        const models = tagsData.models || [];
        if (models.length > 0) {
          // Prefer a coder model or mistral, fallback to the first model
          let selectedModel = models[0].name;
          const coderModel = models.find((m: any) => m.name.includes("coder"));
          if (coderModel) {
            selectedModel = coderModel.name;
          }

          const chatRes = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: selectedModel,
              messages: [
                { role: "user", content: prompt }
              ],
              stream: false,
              options: {
                temperature: 0
              }
            })
          });

          if (chatRes.ok) {
            const chatData: any = await chatRes.json();
            const text = chatData.message?.content || "";
            const match = text.match(/\{[\s\S]*?\}/);
            if (match) {
              const parsed = JSON.parse(match[0]);
              if (typeof parsed.rating === "number" && typeof parsed.justification === "string") {
                return {
                  rating: parsed.rating,
                  justification: parsed.justification,
                  source: "ai"
                };
              }
            }
          }
        }
      }
    } catch (err) {
      // Ignore, let the outer rater fallback to Heuristic
    }
  }

  throw new Error("No chat models available (both VS Code LM and Ollama fallback failed/disabled).");
}
