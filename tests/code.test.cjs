const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "code.js"), "utf8");
const timestamp = "2026-10-15 12.00.00.123";
const instant = new Date(2026, 9, 15, 12, 0, 0, 123).getTime();
let nextId = 0;

function image(name = "Image") {
  return { id: String(++nextId), name, fills: [{ type: "IMAGE", imageHash: "hash" }] };
}

async function runPlugin(nodes = [], waitForLoad = true) {
  const handlers = {};
  const messages = [];
  const notifications = [];
  let time = instant;
  let finishLoading;
  const loading = new Promise((resolve) => { finishLoading = resolve; });
  const figma = {
    mixed: Symbol("mixed"),
    root: { children: [{ findAll: () => nodes }] },
    currentPage: { selection: [] },
    ui: { postMessage: (message) => messages.push(message) },
    on: (event, handler) => { handlers[event] = handler; },
    showUI() {},
    loadAllPagesAsync: () => loading,
    notify: (message) => notifications.push(message),
    closePlugin: () => assert.fail("Unexpected plugin initialization failure"),
  };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [time])); }
  }
  vm.runInNewContext(source, { figma, __html__: "", Date: FixedDate });
  const initialize = async () => { finishLoading(); await loading; };
  if (waitForLoad) await initialize();
  return {
    figma, messages, notifications, initialize,
    setTime: (value) => { time = value; },
    create: (...created) => {
      nodes.push(...created);
      handlers.documentchange({ documentChanges: created.map((node) => ({ type: "CREATE", node })) });
    },
    change: (node, property) => handlers.documentchange({ documentChanges: [{ type: "PROPERTY_CHANGE", node, properties: [property] }] }),
    toggle: (enabled) => figma.ui.onmessage({ type: "set-enabled", enabled }),
    renameSelection: (...selected) => {
      figma.currentPage.selection = selected;
      figma.ui.onmessage({ type: "rename-selection" });
    },
  };
}

test("same-millisecond image creations have distinct names and preserve existing names", async () => {
  const existing = image(`${timestamp}-1`);
  const plugin = await runPlugin([existing]);
  const created = Array.from({ length: 100 }, () => image());
  plugin.create(...created);
  assert.equal(existing.name, `${timestamp}-1`);
  assert.equal(created[0].name, `${timestamp}-2`);
  assert.equal(created[99].name, `${timestamp}-101`);
  assert.equal(new Set(created.map((node) => node.name)).size, 100);
});

test("manual naming and clock changes stay unique; restarts skip current names", async () => {
  const first = image();
  const second = image();
  const plugin = await runPlugin([first, second]);
  plugin.renameSelection(first, second);
  assert.equal(first.name, `${timestamp}-1`);
  assert.equal(second.name, `${timestamp}-2`);
  plugin.setTime(instant + 1);
  plugin.renameSelection(first);
  assert.equal(first.name, "2026-10-15 12.00.00.124-1");
  plugin.setTime(instant);
  plugin.renameSelection(first);
  assert.equal(first.name, `${timestamp}-3`);
  const restarted = await runPlugin([first, second]);
  restarted.renameSelection(second);
  assert.equal(second.name, `${timestamp}-1`);
  assert.notEqual(second.name, first.name);
});

test("names observed while paused are reserved without renaming or catching up on resume", async () => {
  const plugin = await runPlugin();
  plugin.toggle(false);
  const duplicate = image(`${timestamp}-1`);
  const child = image(`${timestamp}-2`);
  const group = { id: String(++nextId), name: "Group", findAll: () => [child] };
  plugin.create(duplicate, group);
  plugin.toggle(true);
  assert.equal(duplicate.name, `${timestamp}-1`);
  assert.equal(child.name, `${timestamp}-2`);
  const pasted = image();
  plugin.create(pasted);
  assert.equal(pasted.name, `${timestamp}-3`);
});

test("a live rename of a non-image layer also reserves its name", async () => {
  const text = { id: String(++nextId), name: "Text" };
  const plugin = await runPlugin([text]);
  text.name = `${timestamp}-1`;
  plugin.change(text, "name");
  const pasted = image();
  plugin.create(pasted);
  assert.equal(pasted.name, `${timestamp}-2`);
});

test("unchanged image fills keep their names; replacing the image gets a unique name", async () => {
  const existing = image("Keep this name");
  const plugin = await runPlugin([existing]);
  plugin.change(existing, "fills");
  assert.equal(existing.name, "Keep this name");
  existing.fills[0].imageHash = "replacement";
  plugin.change(existing, "fills");
  assert.equal(existing.name, `${timestamp}-1`);
});

test("manual naming waits until existing names have been scanned", async () => {
  const existing = image(`${timestamp}-1`);
  const pasted = image();
  const plugin = await runPlugin([existing, pasted], false);
  plugin.renameSelection(pasted);
  assert.equal(pasted.name, "Image");
  assert.equal(plugin.notifications.length, 1);
  await plugin.initialize();
  plugin.renameSelection(pasted);
  assert.equal(pasted.name, `${timestamp}-2`);
});
