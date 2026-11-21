# Reviewdesk
An AI-assisted code review workspace for individual Python and JavaScript files. Open a file or paste source, run a review, and inspect a finding to understand the suggested change. Your submitted program is read as text and never executed.

## Try the browser version immediately
Extract the ZIP and double-click **Open-Reviewdesk.html**. The example model and checks run offline. Some browsers restrict storage for local HTML files. For consistent review history or for Ollama, use the server below.

## Run it on your computer
1. Install Python 3.9 or newer. Extract the project ZIP and open the folder containing `server.py` in your terminal.
2. Start the application.
   ```sh
   python3 server.py
   ```
   On Windows, use `py server.py`. If port 8000 is busy, add `--port 8001`.
3. Open **http://127.0.0.1:8000** in your browser, using the port printed in your terminal. No Python packages or API keys are required for the browser reviewer. Press Ctrl+C in the terminal to stop the app.

## First review in five minutes
1. The workspace opens with a Python function that collects active order IDs. Click **Run review**. The browser engine flags line 1 (shared default), line 7 (bare exception handler), and line 8 (debug output).
2. Expand **Shared default argument**. Python evaluates a default argument when the function is defined. If the first call appends an ID, the next call can inherit it. Select **Line 1** to jump to the source.
3. Replace the first two lines with the following function header, docstring and initialization. Keep the existing loop and return statement below them.
   ```python
   def collect_orders(records, orders=None):
       """Collect the IDs of active orders."""
       if orders is None:
           orders = []
   ```
4. Run the review again. You should now see two findings. Open **Review history** to compare the two snapshots. The download icon on a review exports its findings as Markdown.
5. To try the other language, choose **JavaScript** and click **Load example**. The sample shows how an async callback can outlive a loop. You can also open a .py, .js, .cjs, or .mjs file.

## Add whole-file AI review with Ollama
1. Install Ollama from [ollama.com/download](https://ollama.com/download). Start the Ollama app or run `ollama serve` if the service is stopped.
2. Download the default local coding model.
   ```sh
   ollama pull qwen2.5-coder:3b
   ```
3. Start Reviewdesk with `python3 server.py`, open its local address, and select **Ollama** under **Review engine**. Click **Run review**. The first request can take longer while the model loads.
4. To use another installed model on macOS/Linux, set the model name at launch, for example `OLLAMA_MODEL=qwen2.5-coder:7b python3 server.py`. For Windows PowerShell, set `$env:OLLAMA_MODEL = "qwen2.5-coder:7b"` before starting the server.

The Python server numbers the source lines and sends them to the local Ollama chat API. It validates the returned line numbers, severities and text fields before showing results. A missing model, invalid response, or timeout produces an error. Review smaller functions if a long file takes too long. The hosted version runs the browser engine. Ollama mode is available through the downloaded local server.

## Understand the project from scratch

| File | Responsibility |
| --- | --- |
| dist/index.html, style.css | Page structure, editor overlay, responsive layout and controls |
| dist/engine.mjs | Labeled examples, nearest-neighbor classifier, explicit pattern checks and sample code |
| dist/app.mjs | Editing, rendering, filters, model selection, history and export |
| server.py | Serves the UI, accepts review requests and talks to the local model |
| build_offline.py | Rebuilds Open-Reviewdesk.html after editing the frontend |
| tests/ | Browser-engine regressions and Python HTTP/provider contract tests |

**Start with one line.** Read the `examples` table in `engine.mjs`. A positive example such as `def collect(rows=[]):` has the label `mutable`. A similar safe example ending in `rows=None` has the label `ok`. These safe examples help the classifier distinguish similar-looking statements.

**Follow the prediction.** The browser engine normalizes variable names, numbers and strings into tokens. It represents each line as pairs and triples of neighboring tokens. For each labeled example it calculates Jaccard similarity, the number of shared features divided by the number of different features in their union. It accepts a defect label only when the closest example has at least 0.84 similarity and leads the next class by at least 0.10. The examples and thresholds are small, hand-curated starting points. They have no measured real-world accuracy. Add both positive and nearby safe examples when extending coverage.

**Follow the result.** The classifier or explicit check produces a category, severity, explanation, line number and suggested fix. The UI renders those fields, allows severity filtering, and saves the last 20 completed reviews in that browser. Clearing browser storage removes history. Export a report when you need a copy.

**Understand the limits.** Browser review is line-based and specific to the included examples and checks. It skips lines longer than 2,000 characters. It can miss multiline statements, cross-file behavior and unseen bug patterns. Ollama reads one file at a time and may give incorrect suggestions. Check a proposed fix against tests and expected behavior. Browser input is capped at 50,000 characters. Model reviews accept up to 12,000 characters and 1,000 lines. This release is a single-user workspace.

## Run the regression checks
From the project folder, run:
```sh
python3 -m unittest discover -s tests
node --test tests/engine.test.mjs
```
Node.js 18+ is needed only for the browser-engine test command. The Python tests exercise the HTTP handler and provider contract with a simulated model response. To check live model generation, start Ollama, select the Ollama engine and run the included sample.

## API example
With the local platform running and the model installed:
```sh
curl http://127.0.0.1:8000/api/review -H 'Content-Type: application/json' -d '{"language":"Python","code":"def collect(items=[]):\n    return items"}'
```
A successful reply contains `engine` and `findings`. An empty findings array means the model reported no issues for this input. The browser engine runs in JavaScript without an HTTP request.

[Ollama chat API](https://docs.ollama.com/api/chat) · [Default model](https://ollama.com/library/qwen2.5-coder:3b)

## Copyright

Copyright © 2026 Venkata Rama Subba Rao Pulipaka. All rights reserved.
