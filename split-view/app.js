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
  const signIn = document.getElementById("sign-in");
  let rightLoads = 0;
  let awaitingSignIn = false;
  let signInNeeded = false;

  // The right pane's tabs: Agent Manager, then each view in config.rightTabs.
  // Every view keeps its own frame and a tab only hides the others, so
  // switching never reloads a site or loses the presenter's place. A view's
  // frame loads the first time its tab is opened.
  const tabBar = document.getElementById("pane-tabs");
  const views = [{ label: (config.right && config.right.label) || "Agent Manager", frame: rightFrame }];
  for (const tab of config.rightTabs || []) {
    const url = safeUrl(null, tab.url);
    if (!url || !tab.label) continue;
    const frame = document.createElement("iframe");
    frame.className = "frame";
    frame.title = tab.label;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allow = "clipboard-read; clipboard-write; fullscreen";
    frame.hidden = true;
    signIn.before(frame);
    views.push({ label: tab.label, url, frame });
  }
  let active = 0;

  function renderRight() {
    views.forEach((view, i) => {
      view.frame.hidden = i !== active;
      if (view.tab) view.tab.setAttribute("aria-selected", String(i === active));
    });
    // The sign-in cover belongs to Agent Manager only.
    signIn.hidden = active !== 0 || !signInNeeded;
  }

  if (views.length > 1) {
    views.forEach((view, i) => {
      view.tab = document.createElement("button");
      view.tab.type = "button";
      view.tab.className = "pane-tab";
      view.tab.setAttribute("role", "tab");
      view.tab.textContent = view.label;
      view.tab.addEventListener("click", () => {
        active = i;
        if (view.url && !view.frame.getAttribute("src")) view.frame.src = view.url;
        renderRight();
      });
      tabBar.append(view.tab);
    });
    tabBar.hidden = false;
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
