"use client";

import { landmarks } from "@/data/geo/landmarks";
import { categories, mapZoom } from "@/lib/config/display";
import { metersBetween } from "@/lib/geo/distance";
import { movementBoundary, namedBuildings, nearestLandmark, reportingBoundary, streetLabelCollection } from "@/lib/geo/campus";
import { buildingHealth, healthTone } from "@/lib/health/score";
import { publishBearing } from "@/lib/map/bearing";
import { boundsOf, installNavigationLimits, pitched, prefersReducedMotion, runViewCommand } from "@/lib/map/navigation";
import { ensureLayers, syncScene } from "@/lib/map/scene";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";
import type { Issue } from "@/lib/types";
import type { Point } from "geojson";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.setWorkerUrl("/maplibre-gl-worker.js");
import { useEffect, useRef, useState } from "react";

function categoryLabel(id: string | null) {
  return categories.find((category) => category.id === id)?.label ?? "Signal";
}

function placeName(latitude: number, longitude: number) {
  const landmark = nearestLandmark(latitude, longitude, 180);
  const name = landmark?.name ?? "Main Campus";
  return name
    .replace("Dr. Martin Luther King Jr. Library", "MLK Library")
    .replace("Charles W. Davidson College of Engineering", "Engineering")
    .replace("Diaz Compean Student Union", "Student Union");
}

function clusterIssues(issues: Issue[], zoom: number) {
  const open = issues.filter((issue) => issue.status !== "resolved");
  if (zoom >= mapZoom.clusterBelow) return open.map((issue) => [issue]);
  const urgent = open.filter((issue) => issue.severity === "urgent").map((issue) => [issue]);
  const rest = open.filter((issue) => issue.severity !== "urgent");
  const groups: Issue[][] = [];
  for (const issue of rest) {
    const group = groups.find((items) => {
      const anchor = items[0];
      return metersBetween(anchor.latitude, anchor.longitude, issue.latitude, issue.longitude) <= 45;
    });
    if (group) group.push(issue);
    else groups.push([issue]);
  }
  return [...urgent, ...groups];
}

function textNode(className: string, text: string) {
  const element = document.createElement("div");
  element.className = className;
  const span = document.createElement("span");
  span.textContent = text;
  element.append(span);
  return element;
}

export default function CampusMap() {
  const campus = useCampus();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(15);
  const signature = `${campus.issues.map((issue) => `${issue.id}:${issue.updatedAt}:${issue.reportCount}:${issue.severity}:${issue.status}:${issue.regionId}`).join("|")}:${campus.previewLevel}:${campus.reports.length}:${campus.focusLocation?.id ?? ""}`;

  useEffect(() => {
    const node = containerRef.current;
    const reporting = reportingBoundary;
    const movement = movementBoundary;
    if (!node || !reporting || !movement) return;
    const area = boundsOf(reporting);
    const west = area[0][0];
    const south = area[0][1];
    const east = area[1][0];
    const north = area[1][1];
    const pose = pitched();
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: node,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: "background", type: "background", paint: { "background-color": "#070B14" } }],
        },
        center: [(west + east) / 2, (south + north) / 2],
        zoom: 15.2,
        bearing: pose.bearing,
        pitch: pose.pitch,
        maxPitch: pose.pitch === 0 ? 0 : 60,
        attributionControl: false,
        maxZoom: mapZoom.max,
        renderWorldCopies: false,
        dragRotate: false,
        touchPitch: false,
        fadeDuration: prefersReducedMotion() ? 0 : 300,
      });
      map.touchZoomRotate.disableRotation();
    } catch (reason) {
      console.error("Wakefield interactive map could not start", reason);
      window.setTimeout(() => setMapError("Interactive map unavailable here. Showing the campus map preview."), 0);
      return;
    }
    mapRef.current = map;
    let stopLimits = () => {};
    let alive = true;
    let loaded = false;
    const bootTimeout = window.setTimeout(() => {
      if (!loaded) setMapError("Interactive map is taking too long to load. Showing the campus map preview.");
    }, 7000);
    map.on("load", () => {
      if (!alive) return;
      try {
        ensureLayers(map);
        stopLimits = installNavigationLimits(map, movement, reporting);
        publishBearing(map.getBearing());
        setZoom(map.getZoom());
        loaded = true;
        window.clearTimeout(bootTimeout);
        setMapError(null);
        setReady(true);
      } catch (reason) {
        console.error("Wakefield campus map layers could not be prepared", reason);
        window.clearTimeout(bootTimeout);
        setMapError("The interactive map could not finish loading. Showing the campus map preview.");
      }
    });
    map.on("error", (event) => {
      if (!loaded) {
        console.error("Wakefield interactive map reported an error", event.error);
        setMapError("Interactive map unavailable here. Showing the campus map preview.");
      }
    });
    map.on("rotate", () => publishBearing(map.getBearing()));
    map.on("zoomend", () => setZoom(map.getZoom()));
    map.on("click", (event) => {
      if (!campusStore.getSnapshot().placingPin) return;
      const target = event.originalEvent.target;
      if (target instanceof Element && target.closest("button")) return;
      campusStore.setFocusLocation(null);
      campusStore.setDraftLocation({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
        accuracy: null,
        source: "manual",
      });
    });
    return () => {
      alive = false;
      window.clearTimeout(bootTimeout);
      stopLimits();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    syncScene(map, { issues: campus.issues, reports: campus.reports, previewLevel: campus.previewLevel, focusLocation: campus.focusLocation }, prefersReducedMotion());
  }, [ready, signature, campus.issues, campus.reports, campus.previewLevel, campus.focusLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const reporting = reportingBoundary;
    if (!ready || !map || !campus.viewCommand || !reporting) return;
    runViewCommand(map, campus.viewCommand, reporting);
  }, [ready, campus.viewCommand]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const markers: maplibregl.Marker[] = [];
    const add = (
      element: HTMLElement,
      longitude: number,
      latitude: number,
      anchor: maplibregl.PositionAnchor = "center",
      offset?: [number, number],
    ) => {
      markers.push(new maplibregl.Marker({ element, anchor, offset }).setLngLat([longitude, latitude]).addTo(map));
    };

    for (const group of clusterIssues(campus.issues, zoom)) {
      const issue = group.find((item) => item.severity === "urgent") ?? group[0];
      const selected = campus.selectedIssueId === issue.id;
      const photo = group.length === 1 && (selected || zoom >= mapZoom.evidenceAt)
        ? campus.photos.find((item) => item.issueId === issue.id && campusStore.previewFor(item.id))
        : null;
      const preview = photo ? campusStore.previewFor(photo.id) : null;
      if (preview) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wake-photo";
        const image = document.createElement("img");
        image.src = preview;
        image.alt = "Evidence for this signal";
        const caption = document.createElement("span");
        caption.textContent = issue.severity;
        button.append(image, caption);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          campusStore.selectIssue(issue.id, false);
        });
        add(button, issue.longitude, issue.latitude, "bottom");
      } else if (selected) {
        const card = document.createElement("div");
        card.className = `wake-callout${issue.severity === "urgent" ? " is-urgent" : ""}`;
        const place = document.createElement("strong");
        place.textContent = placeName(issue.latitude, issue.longitude);
        const meta = document.createElement("span");
        const reports = group.reduce((sum, item) => sum + item.reportCount, 0);
        meta.textContent = `${reports} report${reports === 1 ? "" : "s"} · ${group.length} open`;
        card.append(place, meta);
        const anchor = document.createElement("div");
        anchor.append(card);
        add(anchor, issue.longitude, issue.latitude, "bottom", [0, -16]);
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "wake-marker is-selected";
        dot.setAttribute("aria-label", placeName(issue.latitude, issue.longitude));
        const mark = document.createElement("span");
        mark.className = `wake-marker-dot wake-${issue.severity}`;
        dot.append(mark);
        dot.addEventListener("click", (event) => {
          event.stopPropagation();
          campusStore.selectIssue(issue.id, false);
        });
        add(dot, issue.longitude, issue.latitude, "center");
      } else {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wake-marker";
        const mark = document.createElement("span");
        mark.className = `wake-marker-dot wake-${issue.severity}`;
        const copy = document.createElement("span");
        copy.className = "wake-marker-copy";
        const title = document.createElement("strong");
        title.textContent = placeName(issue.latitude, issue.longitude);
        const detail = document.createElement("em");
        detail.textContent = `${group.length} signal${group.length === 1 ? "" : "s"} · ${categoryLabel(issue.category)}`;
        copy.append(title, detail);
        button.append(mark, copy);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          campusStore.selectIssue(issue.id, false);
        });
        add(button, issue.longitude, issue.latitude, "left");
      }
    }

    for (const feature of streetLabelCollection.features) {
      const coordinates = (feature.geometry as Point).coordinates;
      const outer = feature.properties && "edge" in feature.properties && feature.properties.edge === "outer";
      add(textNode(outer ? "wake-street is-outer" : "wake-street", String(feature.properties?.name ?? "")), coordinates[0], coordinates[1]);
    }

    for (const building of namedBuildings) {
      if (zoom < (building.band === "block" ? mapZoom.namesAt + 1.5 : mapZoom.namesAt)) continue;
      add(textNode(building.band === "block" ? "wake-building is-block" : "wake-building", building.name), building.longitude, building.latitude);
    }

    for (const landmark of landmarks) {
      add(
        textNode(
          "wake-landmark",
          landmark.name
            .replace("Dr. Martin Luther King Jr. Library", "MLK Library")
            .replace("Charles W. Davidson College of Engineering", "Engineering")
            .replace("Diaz Compean Student Union", "Student Union"),
        ),
        landmark.longitude,
        landmark.latitude,
      );
    }

    for (const place of buildingHealth(campus.issues)) {
      if (place.health >= 100) continue;
      const meter = document.createElement("div");
      meter.className = "wake-building-health";
      meter.setAttribute("aria-label", `${place.name} health ${place.health}`);
      const track = document.createElement("span");
      track.className = "wake-health";
      const fill = document.createElement("span");
      fill.style.width = `${place.health}%`;
      fill.style.background = healthTone(place.health);
      track.append(fill);
      const label = document.createElement("em");
      label.textContent = String(place.health);
      meter.append(track, label);
      add(meter, place.longitude, place.latitude, "bottom", [0, -28]);
    }

    if (campus.draftLocation) {
      const pin = document.createElement("div");
      pin.className = "wake-pin";
      const span = document.createElement("span");
      pin.append(span);
      const marker = new maplibregl.Marker({ element: pin, anchor: "center", draggable: true })
        .setLngLat([campus.draftLocation.longitude, campus.draftLocation.latitude])
        .addTo(map);
      marker.on("dragend", () => {
        const next = marker.getLngLat();
        campusStore.setFocusLocation(null);
        campusStore.setDraftLocation({
          latitude: next.lat,
          longitude: next.lng,
          accuracy: null,
          source: "manual",
        });
      });
      markers.push(marker);
    }

    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [ready, zoom, campus.issues, campus.selectedIssueId, campus.photos, campus.draftLocation]);

  return (
    <div className="wake-map-host">
      {!ready ? <div className="wake-map-fallback" role="img" aria-label="SJSU campus map preview" /> : null}
      <div ref={containerRef} className={`wake-map${ready ? " is-ready" : ""}`} />
      {mapError ? <p className="wake-map-status" role="status">{mapError}</p> : null}
    </div>
  );
}
