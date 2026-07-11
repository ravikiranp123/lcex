import * as vscode from "vscode";
import * as path from "path";

export interface RatingReviewData {
  title: string;
  slug: string;
  recommendedRating: number;
  justification: string;
  source: "ai" | "heuristic" | "manual";
}

export class RatingReviewPanel {
  public static currentPanel: RatingReviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _data: RatingReviewData;
  private readonly _onAccept: (rating: number, notes: string) => void;
  private readonly _onAskAgent: () => void;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    data: RatingReviewData,
    onAccept: (rating: number, notes: string) => void,
    onAskAgent: () => void
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._data = data;
    this._onAccept = onAccept;
    this._onAskAgent = onAskAgent;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "accept":
            this._onAccept(message.rating, message.notes);
            this.dispose();
            break;
          case "askAgent":
            this._onAskAgent();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    data: RatingReviewData,
    onAccept: (rating: number, notes: string) => void,
    onAskAgent: () => void
  ): RatingReviewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (RatingReviewPanel.currentPanel) {
      RatingReviewPanel.currentPanel._data = data;
      RatingReviewPanel.currentPanel._update();
      RatingReviewPanel.currentPanel._panel.reveal(column || vscode.ViewColumn.One);
      return RatingReviewPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "leetplusRatingReview",
      `Review: ${data.title}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
      }
    );

    RatingReviewPanel.currentPanel = new RatingReviewPanel(panel, extensionUri, data, onAccept, onAskAgent);
    return RatingReviewPanel.currentPanel;
  }

  public updateData(data: RatingReviewData) {
    this._data = data;
    this._update();
  }

  public dispose() {
    RatingReviewPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = `Review: ${this._data.title}`;
    webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const data = this._data;
    const isLoading = data.recommendedRating === -1;

    const sourceLabel =
      data.source === "ai"
        ? "🤖 AI Recommendation"
        : data.source === "heuristic"
        ? "📊 Heuristic Recommendation"
        : "👤 Manual Selection";

    const sourceClass = data.source;

    // Map ratings to descriptions and classes
    const ratingsMeta = [
      { rating: 0, title: "0 — Mastered", desc: "Remove from daily review, schedule next year", color: "green" },
      { rating: 1, title: "1 — Easy", desc: "Review in 20 days", color: "green" },
      { rating: 2, title: "2 — Good", desc: "Normal progress, review in 3-14 days", color: "yellow" },
      { rating: 3, title: "3 — Hard", desc: "Struggled, review in 2 days", color: "red" },
      { rating: 4, title: "4 — Again", desc: "Failed completely, review in 1 day", color: "red" },
    ];

    const ratingOptionsHtml = ratingsMeta
      .map((meta) => {
        const isSelected = meta.rating === data.recommendedRating;
        const activeClass = isSelected ? "selected" : "";
        return `
          <button type="button" class="rating-btn ${meta.color} ${activeClass}" data-rating="${meta.rating}">
            <div class="btn-title">${meta.title}</div>
            <div class="btn-desc">${meta.desc}</div>
          </button>
        `;
      })
      .join("");

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LeetPlus Rating Review</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-editor-foreground, #d4d4d4);
            padding: 20px;
            margin: 0;
            display: flex;
            justify-content: center;
          }
          .container {
            width: 100%;
            max-width: 500px;
            background-color: var(--vscode-sideBar-background, #252526);
            border: 1px solid var(--vscode-panel-border, #3c3c3c);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3);
            box-sizing: border-box;
          }
          h2 {
            margin-top: 0;
            font-size: 20px;
            font-weight: 600;
            color: var(--vscode-editor-foreground, #f0f0f0);
            border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
            padding-bottom: 12px;
          }
          .card {
            background-color: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
          }
          .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }
          .badge.ai {
            background-color: rgba(0, 122, 255, 0.2);
            color: #007aff;
            border: 1px solid rgba(0, 122, 255, 0.4);
          }
          .badge.heuristic {
            background-color: rgba(255, 159, 10, 0.2);
            color: #ff9f0a;
            border: 1px solid rgba(255, 159, 10, 0.4);
          }
          .justification {
            font-style: italic;
            font-size: 13px;
            line-height: 1.5;
            color: var(--vscode-descriptionForeground, #aaaaaa);
            margin: 0;
          }
          .loader-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px 0;
          }
          .loader {
            border: 3px solid rgba(255,255,255,0.1);
            border-top: 3px solid var(--vscode-progressBar-background, #007aff);
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
            margin-bottom: 12px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .rating-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--vscode-editor-foreground, #e0e0e0);
          }
          .rating-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 20px;
          }
          .rating-btn {
            background-color: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 6px;
            padding: 10px 14px;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s ease;
            box-sizing: border-box;
            width: 100%;
          }
          .rating-btn:hover {
            background-color: rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.2);
          }
          .rating-btn.selected {
            background-color: rgba(0, 122, 255, 0.12);
            border-color: var(--vscode-focusBorder, #007aff);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007aff);
          }
          .rating-btn.green.selected {
            background-color: rgba(46, 160, 67, 0.15);
            border-color: #2ea44f;
          }
          .rating-btn.yellow.selected {
            background-color: rgba(210, 153, 34, 0.15);
            border-color: #d29922;
          }
          .rating-btn.red.selected {
            background-color: rgba(248, 81, 73, 0.15);
            border-color: #f85149;
          }
          .btn-title {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 2px;
            color: var(--vscode-editor-foreground, #f0f0f0);
          }
          .btn-desc {
            font-size: 11px;
            color: var(--vscode-descriptionForeground, #888);
          }
          .notes-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground, #e0e0e0);
          }
          textarea {
            width: 100%;
            height: 70px;
            background-color: var(--vscode-input-background, #1e1e1e);
            color: var(--vscode-input-foreground, #cccc);
            border: 1px solid var(--vscode-input-border, #3c3c3c);
            border-radius: 6px;
            padding: 8px;
            box-sizing: border-box;
            resize: none;
            font-size: 12px;
            margin-bottom: 20px;
          }
          textarea:focus {
            outline: 1px solid var(--vscode-focusBorder, #007aff);
            border-color: var(--vscode-focusBorder, #007aff);
          }
          .submit-btn {
            width: 100%;
            background-color: var(--vscode-button-background, #007aff);
            color: var(--vscode-button-foreground, #ffffff);
            border: none;
            border-radius: 6px;
            padding: 12px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .submit-btn:hover {
            background-color: var(--vscode-button-hoverBackground, #2788e7);
          }
          .submit-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .ask-agent-btn {
            width: 100%;
            background-color: transparent;
            color: var(--vscode-button-background, #007aff);
            border: 1px solid var(--vscode-button-background, #007aff);
            border-radius: 6px;
            padding: 10px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 10px;
            box-sizing: border-box;
            text-align: center;
          }
          .ask-agent-btn:hover {
            background-color: rgba(0, 122, 255, 0.1);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>${data.title}</h2>
          
          <div class="card">
            ${
              isLoading
                ? `
              <div class="loader-container">
                <div class="loader"></div>
                <div class="justification">Evaluating complexity and pattern mastery...</div>
              </div>
              `
                : `
              <div class="badge ${sourceClass}">${sourceLabel}</div>
              <p class="justification">"${data.justification}"</p>
              ${
                data.source === "heuristic"
                  ? `<button id="askAgentBtn" class="ask-agent-btn" type="button">Ask Agent for AI Rating</button>`
                  : ""
              }
              `
            }
          </div>

          <div class="rating-title">Rate your difficulty:</div>
          <div class="rating-list">
            ${ratingOptionsHtml}
          </div>

          <div class="notes-title">Optional Study Notes:</div>
          <textarea id="notes" placeholder="What should you remember or watch out for next time?"></textarea>

          <button id="acceptBtn" class="submit-btn" ${isLoading ? "disabled" : ""}>Accept & Schedule</button>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          let selectedRating = ${data.recommendedRating};

          // Rating button clicking
          const buttons = document.querySelectorAll('.rating-btn');
          buttons.forEach(btn => {
            btn.addEventListener('click', () => {
              buttons.forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
              selectedRating = parseInt(btn.getAttribute('data-rating'));
            });
          });

          // Submit action
          const acceptBtn = document.getElementById('acceptBtn');
          const notesArea = document.getElementById('notes');

          acceptBtn.addEventListener('click', () => {
            acceptBtn.disabled = true;
            vscode.postMessage({
              command: 'accept',
              rating: selectedRating,
              notes: notesArea.value.trim()
            });
          });

          // Ask Agent action
          const askAgentBtn = document.getElementById('askAgentBtn');
          if (askAgentBtn) {
            askAgentBtn.addEventListener('click', () => {
              vscode.postMessage({
                command: 'askAgent'
              });
            });
          }
        </script>
      </body>
      </html>`;
  }
}
