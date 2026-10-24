"use client";

import { DemoControls } from "@/components/demo/DemoControls";
import { IssueDrawer } from "@/components/issues/IssueDrawer";
import { SignalList } from "@/components/issues/SignalList";
import { ReportFlow } from "@/components/report/ReportFlow";
import { landmarks } from "@/data/geo/landmarks";
import { revealLabels } from "@/lib/config/display";
import { demoMode } from "@/lib/config/env";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";
import { Camera, Crosshair, Map as MapIcon, Minus, Plus, Radio } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const CampusMap = dynamic(() => import("@/components/map/CampusMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#070B14]" />,
});

export function AppShell() {
  const campus = useCampus();
  const selected = campus.issues.find((issue) => issue.id === campus.selectedIssueId) ?? null;
  const openCount = campus.issues.filter((issue) => issue.status !== "resolved").length;
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return landmarks.filter((landmark) => landmark.name.toLowerCase().includes(needle));
  }, [query]);

  return (
    <div className="relative h-dvh overflow-hidden bg-[#070B14] text-slate-100">
      <header className="wake-header">
        <div>
          <p className="font-display text-lg leading-none">Wakefield</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">SJSU / Main Campus</p>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">{demoMode ? "Demo data" : "Campus listening"}</p>
        <p className="font-mono text-[11px] text-slate-300">{openCount} open</p>
        <p className="ml-auto hidden font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300 md:block">The campus wakes in layers</p>
        <div className="ml-auto flex gap-1 md:ml-0 md:hidden">
          <button type="button" className="wake-icon-button" aria-label="Map" onClick={() => campusStore.setPanel("map")}>
            <MapIcon size={16} />
          </button>
          <button type="button" className="wake-icon-button" aria-label="Signals" onClick={() => campusStore.setPanel("signals")}>
            <Radio size={16} />
          </button>
        </div>
      </header>
      <nav className="wake-rail" aria-label="Primary">
        <button type="button" aria-label="Map" className={campus.panel === "map" ? "is-active" : ""} onClick={() => campusStore.setPanel("map")}>
          <MapIcon size={18} />
          <span>Map</span>
        </button>
        <button type="button" aria-label="Signals" className={campus.panel === "signals" ? "is-active" : ""} onClick={() => campusStore.setPanel("signals")}>
          <Radio size={18} />
          <span>Signals</span>
        </button>
      </nav>
      <div className="absolute inset-0">
        <CampusMap />
      </div>
      <div className="wake-vignette" aria-hidden="true" />
      <div className="wake-compass" aria-hidden="true">
        <span>N</span>
      </div>
      <div className="wake-search">
        <label className="sr-only" htmlFor="building-search">Search buildings</label>
        <input
          id="building-search"
          value={query}
          placeholder="Search library, tower, engineering…"
          onChange={(event) => setQuery(event.target.value)}
        />
        {matches.length > 0 ? (
          <ul>
            {matches.map((landmark) => (
              <li key={landmark.id}>
                <button
                  type="button"
                  onClick={() => {
                    campusStore.flyTo(landmark.latitude, landmark.longitude, 18);
                    setQuery("");
                  }}
                >
                  {landmark.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className={`wake-controls ${selected ? "sheet-open" : ""}`}>
        <button type="button" aria-label="Zoom in" onClick={() => campusStore.requestZoom("zoom-in")}><Plus size={16} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => campusStore.requestZoom("zoom-out")}><Minus size={16} /></button>
        <button type="button" aria-label="Fit campus" onClick={() => campusStore.requestFit()}><Crosshair size={16} /></button>
        <button type="button" onClick={() => campusStore.requestFit()}>Recenter</button>
      </div>
      <div className={`wake-legend ${selected ? "max-md:hidden" : ""}`}>
        <p className="font-mono text-[10px] uppercase tracking-wider">Reveal</p>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <p key={level}><i className={`swatch level-${level}`} /> {revealLabels[level]}</p>
        ))}
        <p><i className="swatch urgent" /> Urgent</p>
      </div>
      <button type="button" className={`wake-camera ${selected ? "above-sheet" : ""}`} onClick={() => campusStore.openReport()}>
        <Camera size={18} />
        Report a signal
      </button>
      {campus.panel === "signals" ? <SignalList /> : null}
      {selected ? <IssueDrawer issue={selected} /> : null}
      {campus.reportOpen ? <ReportFlow /> : null}
      {demoMode ? <DemoControls /> : null}
      {campus.pendingSignalId ? (
        <div className="wake-banner">
          <span>New signal saved.</span>
          <button type="button" onClick={() => campusStore.viewPendingSignal()}>View signal</button>
          <button type="button" onClick={() => campusStore.dismissSignalBanner()}>Dismiss</button>
        </div>
      ) : null}
      {campus.notice ? (
        <p className="wake-notice" role="status">{campus.notice}</p>
      ) : null}
      <p className="wake-attr">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
      </p>
    </div>
  );
}
