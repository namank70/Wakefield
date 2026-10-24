"use client";

import { DemoControls } from "@/components/demo/DemoControls";
import { FixingList } from "@/components/issues/FixingList";
import { IssueDrawer } from "@/components/issues/IssueDrawer";
import { SignalList } from "@/components/issues/SignalList";
import { RedeemPanel } from "@/components/rewards/RedeemPanel";
import { ReportFlow } from "@/components/report/ReportFlow";
import { landmarks } from "@/data/geo/landmarks";
import { guidedMode } from "@/lib/config/env";
import { campusHealth, creditBalance, healthTone } from "@/lib/health/score";
import { getBearing, subscribeBearing } from "@/lib/map/bearing";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";
import { Camera, Crosshair, Map as MapIcon, Minus, Plus, Radio, RotateCw, Wrench } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState, useSyncExternalStore } from "react";

function CampusMapLoading() {
  return (
    <div className="wake-map-host">
      <div className="wake-map-fallback" role="img" aria-label="SJSU campus map preview" />
    </div>
  );
}

const CampusMap = dynamic(() => import("@/components/map/CampusMap"), {
  ssr: false,
  loading: CampusMapLoading,
});

function Compass() {
  const bearing = useSyncExternalStore(subscribeBearing, getBearing, getBearing);
  return (
    <button type="button" className="wake-compass" aria-label="Reset map direction" onClick={() => campusStore.requestPoseReset()}>
      <span className="wake-compass-rose" style={{ transform: `rotate(${-bearing}deg)` }}>
        <span>N</span>
      </span>
    </button>
  );
}

export function AppShell() {
  const campus = useCampus();
  const selected = campus.issues.find((issue) => issue.id === campus.selectedIssueId) ?? null;
  const openCount = campus.issues.filter((issue) => issue.status !== "resolved").length;
  const health = campusHealth(campus.issues);
  const points = creditBalance(campus.credits, "scout-1");
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
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">{guidedMode ? "LOCAL CAMPUS FEED" : "Campus listening"}</p>
        <p className="font-mono text-[11px] text-slate-300">{openCount} open</p>
        <div className="wake-campus-health" role="meter" aria-label="Campus health" aria-valuenow={health} aria-valuemin={0} aria-valuemax={100}>
          <span>Campus</span>
          <i className="wake-health" aria-hidden="true"><i style={{ width: `${health}%`, background: healthTone(health) }} /></i>
          <strong>{health}</strong>
        </div>
        {campus.desk === "student" ? (
          <button
            key={points}
            type="button"
            className="wake-points"
            onClick={() => {
              if (campus.panel === "redeem") campusStore.setPanel("map");
              else {
                campusStore.selectIssue(null, false);
                campusStore.setPanel("redeem");
              }
            }}
          >
            {points} pts
          </button>
        ) : null}
        <div className="wake-desk" role="group" aria-label="Desk">
          <button type="button" aria-pressed={campus.desk === "student"} onClick={() => campusStore.setDesk("student")}>Student</button>
          <button type="button" aria-pressed={campus.desk === "university"} onClick={() => campusStore.setDesk("university")}>University</button>
        </div>
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
        {campus.desk === "university" ? (
          <button type="button" aria-label="Fixing list" className={campus.panel === "fixing" ? "is-active" : ""} onClick={() => campusStore.setPanel("fixing")}>
            <Wrench size={18} />
            <span>Fixing</span>
          </button>
        ) : null}
      </nav>
      <div className="absolute inset-0">
        <CampusMap />
      </div>
      <div className="wake-wash" aria-hidden="true" />
      <div className="wake-vignette" aria-hidden="true" />
      <Compass />
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
        <button type="button" aria-label="Rotate map" onClick={() => campusStore.requestRotate()}><RotateCw size={16} /></button>
        <button type="button" aria-label="Fit campus" onClick={() => campusStore.requestFit()}><Crosshair size={16} /></button>
        <button type="button" onClick={() => campusStore.requestFit()}>Recenter</button>
      </div>
      <div className={`wake-legend ${selected ? "max-md:hidden" : ""}`}>
        <p className="font-mono text-[10px] uppercase tracking-wider">Reveal</p>
        <p><i className="swatch quiet" /> Quiet</p>
        <p><i className="swatch stirring" /> Stirring</p>
        <p><i className="swatch active" /> Active</p>
        <p><i className="swatch urgent" /> Urgent</p>
        <p><i className="swatch recovered" /> Recovered</p>
        <p className="wake-legend-note">Quiet does not mean verified clear.</p>
      </div>
      {campus.desk === "student" ? (
        <button type="button" className={`wake-camera ${selected ? "above-sheet" : ""}`} onClick={() => campusStore.openReport()}>
          <Camera size={18} />
          Report a signal
        </button>
      ) : null}
      {campus.panel === "signals" ? <SignalList /> : null}
      {campus.panel === "fixing" ? <FixingList /> : null}
      {campus.panel === "redeem" ? <RedeemPanel /> : null}
      {selected ? <IssueDrawer issue={selected} /> : null}
      {campus.reportOpen ? <ReportFlow /> : null}
      {guidedMode ? <DemoControls /> : null}
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
