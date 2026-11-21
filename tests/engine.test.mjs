import assert from "node:assert/strict";
import test from "node:test";
import {review, samples} from "../dist/engine.mjs";

test("the Python walkthrough starts with three correctly located findings", () => {
  const findings = review(samples.Python.code, "Python");
  assert.deepEqual(findings.map(f => [f.line, f.severity]), [[1,"high"], [7,"medium"], [8,"low"]]);
});
test("the example model generalizes to new identifier names", () => {
  assert.equal(review("def archive(tickets, archived={}):", "Python")[0].title, "Shared default argument");
});
test("corrected Python lines produce no findings", () => {
  const code = "def archive(tickets, archived=None):\n    if archived is None:\n        archived = {}\n    return archived";
  assert.deepEqual(review(code, "Python"), []);
});
test("comments and docstrings are skipped", () => {
  const code = '"""notes\nexcept:\n"""\n# def append(items=[]):\nx = "except:"';
  assert.deepEqual(review(code, "Python"), []);
  assert.deepEqual(review("/* comment\nconsole.debug(object);\n*/", "JavaScript"), []);
});
test("JavaScript example and corrected equivalents", () => {
  assert.deepEqual(review(samples.JavaScript.code, "JavaScript").map(f=>f.line), [2,3]);
  assert.deepEqual(review("for (const row of rows) {\n  if (row.status === 'open') {\n    await row.sync();\n  }\n}", "JavaScript"), []);
});
test("distinct singleton and intentionally nullish comparisons are accepted", () => {
  assert.deepEqual(review("if value is None:", "Python"), []);
  assert.deepEqual(review("if (value == null) {", "JavaScript"), []);
});
