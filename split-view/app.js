(() => {
  "use strict";

  const MIN = 15;
  const MAX = 85;
  const STEP = 2;
  const STORAGE_KEY = "split-view-ratio";

  const config = window.SPLIT_VIEW_CONFIG || {};
  const split = document.getElementById("split");
  const divider = document.getElementById("divider");
  const narrow = window.matchMedia("(max-width: 760px)");

  // Query parameters can point a frame elsewhere for one visit; only http(s).
  function safeUrl(value, fallback) {
    if (!value) return fallback;
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : fallback;
    } catch {
      return fallback;
    }
  }

  const params = new URLSearchParams(window.location.search);
  const leftUrl = safeUrl(params.get("left"), config.left && config.left.url);
  const rightUrl = safeUrl(params.get("right"), config.right && config.right.url);
  document.getElementById("frame-left").src = leftUrl;

  // Agent Manager sign-in. The page can't look inside the cross-origin frame,
  // but the console is a single-page app: while signed in it loads once. When
  // signed out it sends the frame to its sign-in server, which refuses to be
  // framed, and that shows up here as a second load. Then offer sign-in in a
  // new tab, and reload the pane when the presenter comes back.
  const rightFrame = document.getElementById("frame-right");
  const costFrame = document.getElementById("frame-cost");
  const signIn = document.getElementById("sign-in");
  const paneSwitch = document.getElementById("pane-switch");
  const cost = config.costAnalytics || {};
  const costUrl = safeUrl(null, cost.url);
  const costLabel = cost.label || "AI cost analytics";
  let rightLoads = 0;
  let awaitingSignIn = false;
  let signInNeeded = false;
  let showingCost = false;

  // The right pane shows either Agent Manager or the cost analytics site. Each
  // keeps its own frame and the switch only hides one, so going back and forth
  // never reloads either site or loses the presenter's place.
  function renderRight() {
    rightFrame.hidden = showingCost;
    costFrame.hidden = !showingCost;
    signIn.hidden = showingCost || !signInNeeded;
    paneSwitch.textContent = showingCost ? "← Back to Agent Manager" : costLabel;
    paneSwitch.setAttribute(
      "aria-label",
      showingCost ? "Back to Agent Manager" : `Open ${costLabel} in this pane`,
    );
  }

  if (costUrl) {
    paneSwitch.hidden = false;
    paneSwitch.addEventListener("click", () => {
      showingCost = !showingCost;
      if (showingCost && !costFrame.getAttribute("src")) costFrame.src = costUrl;
      renderRight();
    });
  }

  function loadRight() {
    rightLoads = 0;
    signInNeeded = false;
    renderRight();
    rightFrame.src = rightUrl;
  }

  rightFrame.addEventListener("load", () => {
    // The frame's initial about:blank is readable from here; real loads of the
    // console (or the blocked sign-in page) are cross-origin and throw.
    try {
      if (rightFrame.contentWindow.location.href === "about:blank") return;
    } catch {}
    rightLoads += 1;
    if (rightLoads > 1) {
      signInNeeded = true;
      renderRight();
    }
  });

  document.getElementById("sign-in-button").addEventListener("click", () => {
    window.open(rightUrl, "_blank", "noopener");
    awaitingSignIn = true;
  });

  function onReturn() {
    if (!awaitingSignIn || document.visibilityState !== "visible") return;
    awaitingSignIn = false;
    loadRight();
  }
  window.addEventListener("focus", onReturn);
  document.addEventListener("visibilitychange", onReturn);

  loadRight();

  // Storage can be blocked (private windows, embedded previews); fall back quietly.
  let ratio = 50;
  try {
    const saved = Number(window.localStorage.getItem(STORAGE_KEY));
    if (saved >= MIN && saved <= MAX) ratio = saved;
  } catch {}

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(ratio));
    } catch {}
  }

  function setRatio(value) {
    ratio = Math.min(MAX, Math.max(MIN, value));
    split.style.setProperty("--split", String(ratio));
    divider.setAttribute("aria-valuenow", String(Math.round(ratio)));
    divider.setAttribute("aria-orientation", narrow.matches ? "horizontal" : "vertical");
  }

  function ratioFromPointer(event) {
    const rect = split.getBoundingClientRect();
    return narrow.matches
      ? ((event.clientY - rect.top) / rect.height) * 100
      : ((event.clientX - rect.left) / rect.width) * 100;
  }

  // The drag is tracked with its own flag and followed on the window, so it
  // keeps working even where pointer capture is refused, and it always ends.
  let dragPointer = null;
  let pending = null;
  let frameRequest = 0;

  divider.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragPointer = event.pointerId;
    try {
      divider.setPointerCapture(event.pointerId);
    } catch {}
    document.body.classList.add("dragging");
  });

  window.addEventListener("pointermove", (event) => {
    if (event.pointerId !== dragPointer) return;
    pending = ratioFromPointer(event);
    if (!frameRequest) {
      frameRequest = window.requestAnimationFrame(() => {
        frameRequest = 0;
        if (pending !== null) setRatio(pending);
      });
    }
  });

  function endDrag(event) {
    if (event.pointerId !== dragPointer) return;
    dragPointer = null;
    if (pending !== null) setRatio(pending);
    pending = null;
    document.body.classList.remove("dragging");
    save();
  }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  divider.addEventListener("lostpointercapture", endDrag);

  divider.addEventListener("dblclick", () => {
    setRatio(50);
    save();
  });

  // Keyboard: arrows nudge (Shift for bigger steps), Home/End jump to the limits.
  divider.addEventListener("keydown", (event) => {
    const back = narrow.matches ? "ArrowUp" : "ArrowLeft";
    const forward = narrow.matches ? "ArrowDown" : "ArrowRight";
    const step = event.shiftKey ? STEP * 5 : STEP;
    let next = null;
    if (event.key === back) next = ratio - step;
    else if (event.key === forward) next = ratio + step;
    else if (event.key === "Home") next = MIN;
    else if (event.key === "End") next = MAX;
    if (next === null) return;
    event.preventDefault();
    setRatio(next);
    save();
  });

  narrow.addEventListener("change", () => setRatio(ratio));
  setRatio(ratio);
})();
