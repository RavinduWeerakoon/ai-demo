"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

import template from "./canvas-template.json";

const MOESIF_ORIGIN = "https://www.moesif.com";
// Four rows: KPI cards (200px) and three chart rows (420px), plus the toolbar.
const DEFAULT_HEIGHT = 1_600;
// The management-key route: Moesif reads the org and app from the key itself.
const CANVAS_URL = `${MOESIF_ORIGIN}/embed/canvas`;

// Sent beside the template, not inside it (Canvas ignores a theme in the file).
const THEME = {
  brandColor: "#ff7300",
  brandTextColor: "#40404b",
  chartColors: ["#ff7300", "#4a29a5", "#3ab65b", "#2f80ed", "#e04e5b", "#f2b134"],
  navigation: { type: "tabs", showIcons: false },
  autoHeight: true,
};

type Status = "loading" | "ready" | "error";
type FilterOption = { label: string; value: string };
type AppliedFilter = { options: FilterOption[]; selected: string[] };
/**
 * The filter to start Canvas with: the template's "proxy" context filter
 * (dashboards[].filters.context), with the exact proxy names the page's own
 * controls chose, plus a visibility for Moesif's own copy of it.
 */
export type AppliedFilters = { proxy: AppliedFilter; visibility: string };

/**
 * The template and context to start Canvas with. Only the proxy filter is
 * sent: Moesif matches its values exactly, and the page has already turned
 * any agent choice into that agent's proxy names. The filter is sent only
 * once it is narrowed; with every proxy (or nothing usable) selected, every
 * context filter is dropped from the template, so that view covers all
 * traffic and Moesif has no filter of its own to show.
 */
function canvasInit(filters: AppliedFilters | null) {
  const proxy = filters?.proxy;
  const narrowed = !!proxy && proxy.selected.length > 0 && proxy.selected.length < proxy.options.length;
  return {
    template: {
      ...template,
      dashboards: template.dashboards.map((d) => ({
        ...d,
        filters: {
          ...d.filters,
          context: narrowed
            ? d.filters.context
                .filter((f) => f.id === "proxy")
                .map((f) => ({ ...f, visibility: filters!.visibility }))
            : [],
        },
      })),
    },
    context: narrowed ? { proxy: { options: proxy!.options, value: proxy!.selected } } : {},
  };
}

/**
 * Moesif Canvas in an iframe, authenticated with a management API key.
 *
 * On the key route the handshake has two stages, unlike Moesif's guide
 * describes. /embed/canvas first waits, silently, for SET_TOKEN: it reads the
 * org and app from the key and only then moves to /embed/canvas/<org>-<app>.
 * That second page posts CANVAS_READY and takes the key again plus the
 * template. So the key is offered repeatedly until CANVAS_READY arrives.
 * Canvas has not been seen to send CANVAS_RENDERED or CANVAS_RESIZE on this
 * route, so the frame is shown once the template is sent (each card has its
 * own loading state) and starts tall enough for the whole dashboard.
 */
export function CanvasEmbed({ filters }: { filters: AppliedFilters | null }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);

  useEffect(() => {
    let cancelled = false;
    const fail = (message: string) => {
      if (cancelled) return;
      setError(message);
      setStatus("error");
    };

    // Fetched straight away, so a missing key shows at once rather than after
    // Canvas has loaded.
    const tokenRequest = fetch("/api/canvas-token", { cache: "no-store" }).then(async (res) => {
      const body = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !body.token) throw new Error(body.error ?? "Could not load the analytics key.");
      return body.token;
    });
    tokenRequest.catch((err: unknown) => fail(err instanceof Error ? err.message : "Could not load the analytics key."));

    const timeout = window.setTimeout(
      () => fail("Moesif didn't respond. Reload the page to try again."),
      30_000,
    );

    // First stage: keep offering the key until Canvas says it is ready. A
    // message sent while the frame is still loading is simply dropped.
    let ready = false;
    async function offerToken() {
      const token = await tokenRequest.catch(() => null);
      if (!token || cancelled || ready) return;
      frame.current?.contentWindow?.postMessage({ type: "SET_TOKEN", token }, MOESIF_ORIGIN);
    }
    void offerToken();
    const offer = window.setInterval(() => void offerToken(), 1_500);

    // Second stage: the app page is listening; send the key and the dashboard.
    async function start(target: Window) {
      const token = await tokenRequest.catch(() => null);
      if (!token || cancelled) return;
      target.postMessage({ type: "SET_TOKEN", token }, MOESIF_ORIGIN);
      target.postMessage({ type: "CANVAS_INIT", ...canvasInit(filters), theme: THEME }, MOESIF_ORIGIN);
      window.clearTimeout(timeout);
      setStatus("ready");
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== MOESIF_ORIGIN || event.source !== frame.current?.contentWindow) return;
      switch (event.data?.type) {
        case "CANVAS_READY":
          ready = true;
          window.clearInterval(offer);
          void start(event.source as Window);
          break;
        case "CANVAS_RENDERED":
          window.clearTimeout(timeout);
          setStatus("ready");
          break;
        case "CANVAS_RESIZE":
          if (typeof event.data.height === "number" && event.data.height > 0) setHeight(event.data.height);
          break;
      }
    }

    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.clearInterval(offer);
      window.removeEventListener("message", onMessage);
    };
    // The page remounts this component (new key) to apply a new selection, so
    // the filters are read once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative rounded-xl border border-line bg-white shadow-sm">
      {status !== "ready" && (
        <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-white pt-32 text-ink">
          {status === "error" ? (
            <p role="alert" className="max-w-md px-6 text-center text-sm font-medium text-error-ink">
              {error}
            </p>
          ) : (
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Loading analytics…
            </span>
          )}
        </div>
      )}
      <iframe
        ref={frame}
        src={CANVAS_URL}
        title="AI cost and usage analytics"
        className="block w-full rounded-xl border-0 bg-white"
        style={{ height, visibility: status === "ready" ? "visible" : "hidden" }}
      />
    </div>
  );
}
