// Case-based learning: compare token sequences to labeled examples for this language.
export const catalog = {
  mutable: ["high", "Bug risk", "Shared default argument", "Python creates this default once. Calls that omit the argument can share changes across requests.", "Use None as the default and create a fresh collection inside the function."],
  identity: ["medium", "Correctness", "Identity used for a value", "Object identity can differ for two equal values. The result may depend on how Python created the objects.", "Compare values with == or !=. Reserve is for singleton checks such as None."],
  bare: ["medium", "Reliability", "Catch a specific exception", "A bare except also catches interrupts and exit signals, making this function hard to stop or diagnose.", "Catch the exception this operation can raise. For a missing dictionary key, use except KeyError."],
  debug: ["low", "Maintainability", "Debug output in application code", "This diagnostic runs each time the code reaches it and may write record details to the console.", "Remove the debug statement or use configurable logging with selected fields."],
  loose: ["medium", "Correctness", "Implicit type conversion", "Loose comparison can treat values of different types as equal and select an unexpected branch.", "Normalize the input type if needed, then compare with === or !==."],
  asyncEach: ["high", "Bug risk", "Async work escapes the loop", "forEach discards the promises returned by its callback. Later code can run before the work finishes.", "Await a for...of loop for ordered work, or await Promise.all over a mapped array for independent work."],
  finallyReturn: ["high", "Bug risk", "Return inside finally", "A return here can override a pending result or suppress an exception.", "Move the return outside the finally block and keep cleanup inside it."]
};
export const samples = {
  Python: {file:"order_service.py", code:`def collect_orders(records, orders=[]):
    """Collect the IDs of active orders."""
    for record in records:
        try:
            if record["active"]:
                orders.append(record["id"])
        except:
            print("DEBUG:", record)

    return orders`},
  JavaScript: {file:"task_queue.js", code:`async function syncTasks(tasks) {
  tasks.forEach(async (task) => {
    if (task.status == "ready") {
      await task.sync();
    }
  });

  return tasks.length;
}`}
};

const examples = {
  Python: {
    mutable: ["def collect(records, orders=[]):","def load(rows=[]):","def group(items, index={}):","def record(cache={}):","def visit(items=set()):","def update(self, items=[]):"],
    identity: ["if count is 0:","if name is 'admin':","if state is not 'ready':","return score is 1","return state is 'ok'"],
    ok: ["def collect(records, orders=None):","def append(items, value):","def group(items, index):","def load():","def sample(limit=0):","if x is None:","if x is not None:","if flag is True:","return score == 1","if x == 'admin':","def load(items=()):","def record(cache=None):"]
  },
  JavaScript: {
    asyncEach: ["items.forEach(async (item) => {","rows.forEach(async row => {","await items.forEach(async (item) => {","this.items.forEach(async (item) => {"],
    loose: ["if (value == 1) {","if (task.status == 'ready') {","if (value != 'ready') {","return item == value;","if (value == expected) {"],
    ok: ["if (value === 1) {","if (task.status === 'ready') {","if (value !== 'ready') {","return item === value;","items.map(async (item) => {","items.forEach((item) => {","if (value == null) {","if (value != null) {"]
  }
};

const vocab = new Set("def if is not None True False return set forEach async await map this null finally except try function const let".split(" "));
function normalized(line) {
  const parts = line.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|===|!==|==|!=|=>|[^\s]/g) || [];
  return parts.map(p => /^["']/.test(p) ? "STR" : /^\d/.test(p) ? "NUM" : /^[\w$]/.test(p) && !vocab.has(p) ? "NAME" : p);
}
function features(tokens) {
  const result = new Set();
  const seq = ["^", ...tokens, "$"];
  for (const size of [2,3]) {
    for (let i=0; i+size<=seq.length; i++) result.add(seq.slice(i,i+size).join(" "));
  }
  return result;
}
const trained = Object.fromEntries(Object.entries(examples).map(([lang, classes]) => [lang,
  Object.entries(classes).flatMap(([label, lines]) => lines.map(line => ({label, v:features(normalized(line))})))
]));
function classify(line, lang) {
  const query = features(normalized(line));
  let best = 0, label = "ok", runnerUp = 0;
  const scores = new Map();
  for (const {label, v} of trained[lang]) {
    let hit = 0;
    for (const x of v) if (query.has(x)) hit++;
    const score = hit / (query.size + v.size - hit);
    scores.set(label, Math.max(scores.get(label) || 0, score));
  }
  for (const [key, score] of scores) {
    if (score > best) {runnerUp = best; best = score; label = key;}
    else runnerUp = Math.max(runnerUp, score);
  }
  return best >= .84 && best - runnerUp >= .10 && label !== "ok" ? label : null;
}
// Remove comments before matching. Preserve ordinary literals as tokens and skip multiline text.
function cleanLines(code, lang) {
  let close = "";
  return code.split("\n").map(raw => {
    let i=0, out="";
    while (i < raw.length) {
      if (close) {
        const end=raw.indexOf(close,i);
        if (end<0) break;
        i=end+close.length; close=""; out+=" "; continue;
      }
      const rest=raw.slice(i);
      if ((lang==="Python" && rest[0]==="#") || (lang==="JavaScript" && rest.startsWith("//"))) break;
      const block=lang==="Python" ? ["\"\"\"","'''"].find(q=>rest.startsWith(q)) : rest.startsWith("/*") ? "/*" : rest[0]==="`" ? "`" : null;
      if (block) {close=block==="/*" ? "*/" : block; i+=block.length; continue;}
      const quote=raw[i];
      if (quote==='"' || quote==="'") {
        const start=i++;
        while(i<raw.length) {const ch=raw[i++]; if(ch==="\\") i++; else if(ch===quote) break;}
        out+=raw.slice(start,i); continue;
      }
      out+=raw[i++];
    }
    return out.trim();
  });
}
export function review(code, lang) {
  if (!trained[lang]) throw new Error("Choose Python or JavaScript.");
  const findings=[];
  const lines=cleanLines(code,lang);
  for (const [index,line] of lines.entries()) {
    if (!line || line.length>2000) continue;
    let label, source="Pattern check";
    if(lang==="Python" && /^except\s*:\s*$/.test(line)) label="bare";
    else if(lang==="Python" && /^print\(\s*["']debug\b/i.test(line) || lang==="JavaScript" && /^(?:debugger\s*;?$|console\.debug\()/.test(line)) label="debug";
    else if(lang==="JavaScript" && /^(?:}\s*)?finally\s*\{\s*return\b/.test(line)) label="finallyReturn";
    else {label=classify(line,lang); source="Example model";}
    if(label) {
      const [severity,category,title,detail,fix]=catalog[label];
      findings.push({line:index+1,severity,category,title,detail,fix,source});
    }
  }
  return findings;
}
