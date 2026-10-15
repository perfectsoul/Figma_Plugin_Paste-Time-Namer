const seenImageHashes = new Map();
let enabled = true;

function imageHashes(node) {
  if (!("fills" in node) || node.fills === figma.mixed || !Array.isArray(node.fills)) return [];
  return node.fills
    .filter((paint) => paint && paint.type === "IMAGE" && paint.imageHash)
    .map((paint) => paint.imageHash);
}

function remember(node) {
  const hashes = imageHashes(node);
  if (hashes.length) seenImageHashes.set(node.id, hashes.join("|"));
}

function localTimestamp(date = new Date()) {
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  return [
    date.getFullYear(), "-", pad(date.getMonth() + 1), "-", pad(date.getDate()),
    " ", pad(date.getHours()), ".", pad(date.getMinutes()), ".", pad(date.getSeconds()),
    ".", pad(date.getMilliseconds(), 3)
  ].join("");
}

function renameIfImage(node, force = false) {
  if (!node || node.removed || !("name" in node)) return false;
  const hashes = imageHashes(node);
  if (!hashes.length) return false;

  const signature = hashes.join("|");
  const previous = seenImageHashes.get(node.id);
  seenImageHashes.set(node.id, signature);
  if (!force && previous === signature) return false;

  node.name = localTimestamp();
  return true;
}

function scanInitialDocument() {
  for (const page of figma.root.children) {
    for (const node of page.findAll()) remember(node);
  }
}

function registerDocumentWatcher() {
  figma.on("documentchange", (event) => {
    if (!enabled) return;
    let renamed = 0;

    for (const change of event.documentChanges) {
      if (change.type === "CREATE") {
        if (renameIfImage(change.node, true)) renamed += 1;
        if ("findAll" in change.node) {
          for (const child of change.node.findAll()) {
            if (renameIfImage(child, true)) renamed += 1;
          }
        }
      } else if (change.type === "PROPERTY_CHANGE" && change.properties.includes("fills")) {
        if (renameIfImage(change.node)) renamed += 1;
      } else if (change.type === "DELETE") {
        seenImageHashes.delete(change.id);
      }
    }

    if (renamed) {
      figma.ui.postMessage({ type: "renamed", count: renamed, timestamp: localTimestamp() });
    }
  });
}

figma.ui.onmessage = (message) => {
  if (message.type === "set-enabled") {
    enabled = Boolean(message.enabled);
    figma.ui.postMessage({ type: "status", enabled });
  } else if (message.type === "rename-selection") {
    let renamed = 0;
    for (const node of figma.currentPage.selection) {
      if (renameIfImage(node, true)) renamed += 1;
    }
    figma.ui.postMessage({ type: "renamed", count: renamed, timestamp: localTimestamp() });
  }
};

figma.showUI(__html__, { width: 300, height: 188, themeColors: true });
figma.loadAllPagesAsync().then(() => {
  scanInitialDocument();
  registerDocumentWatcher();
  figma.ui.postMessage({ type: "status", enabled });
}).catch((error) => {
  figma.notify(`Paste Time Namer 초기화 실패: ${error.message}`);
  figma.closePlugin();
});
