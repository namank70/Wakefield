"use client";

import { prototypeRevealResolver, type LocalReveal } from "@/lib/activation/reveal";
import { categories, colors, mapZoom } from "@/lib/config/display";
import {
  buildingCollection,
  facilityCollection,
  movementBoundary,
  movementMask,
  pathCollection,
  reportingBoundary,
  streetLabelCollection,
} from "@/lib/geo/campus";
import { landmarks } from "@/data/geo/landmarks";
import { installNavigationLimits, runViewCommand } from "@/lib/map/navigation";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";
import type { Issue } from "@/lib/types";
import { metersBetween, metersToGeometry } from "@/lib/geo/distance";
import type { Feature, Point } from "geojson";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";

const library = landmarks.find((landmark) => landmark.id === "library")!;

function categoryLabel(id: string | null) {
  return categories.find((category) => category.id === id)?.label ?? "Signal";
}

function nearLibrary(feature: Feature) {
  if (feature.properties && "landmarkId" in feature.properties && feature.properties.landmarkId === "library") return true;
  return metersToGeometry(library.latitude, library.longitude, feature.geometry) <= 55;
}

function paint(reveal: LocalReveal, kind: "building" | "path" | "boundary") {
  if (kind === "boundary") {
    return { color: "#8AA0B8", weight: 1.4, opacity: 0.85, fillOpacity: 0 };
  }
  if (reveal.level === 0) {
    if (kind === "path") return { color: "#8EA3BD", weight: 1.4, opacity: 0.9 };
    return { color: "#B7C8DC", weight: 1.35, opacity: 0.95, fillColor: colors.background, fillOpacity: 0 };
  }
  const color = reveal.urgent ? colors.urgent : reveal.level === 1 ? colors.cyan : reveal.level === 2 ? colors.violet : reveal.level === 3 ? colors.amber : colors.cyan;
  if (kind === "path") {
    return { color, weight: reveal.level >= 4 ? 3 : 2, opacity: 0.95, dashArray: reveal.level === 3 ? "7 5" : undefined };
  }
  return {
    color,
    weight: 1.4 + reveal.level * 0.35,
    opacity: 1,
    fillColor: color,
    fillOpacity: 0.08,
    dashArray: reveal.level === 3 ? "6 4" : undefined,
  };
}

function markerIcon(issue: Issue, count: number) {
  const label = count > 1 ? `${count} signals` : `${issue.severity} · ${categoryLabel(issue.category)}`;
  return L.divIcon({
    className: "wake-marker",
    html: `<span class="wake-marker-dot wake-${issue.severity}"></span><span>${label}</span>`,
    iconSize: [168, 28],
    iconAnchor: [12, 14],
  });
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

function VectorField() {
  const map = useMap();
  const campus = useCampus();
  const signature = `${campus.issues.map((issue) => `${issue.id}:${issue.updatedAt}:${issue.reportCount}`).join("|")}:${campus.previewLevel}:${campus.reports.length}`;

  useEffect(() => {
    const revealFor = (feature: Feature, kind: "building" | "path" | "facility") => {
      if (campus.previewLevel !== null && nearLibrary(feature)) {
        return {
          level: campus.previewLevel,
          score: 0,
          urgent: campus.previewLevel === 4,
          accessibilityFloor: false,
          summary: "Visual preview",
          category: null,
          severity: null,
          status: null,
          issueIds: [],
        } satisfies LocalReveal;
      }
      const properties = feature.properties as { id?: string; landmarkId?: string } | null;
      return prototypeRevealResolver.resolve(
        {
          id: properties?.id ?? String(feature.id ?? ""),
          kind,
          geometry: feature.geometry,
          landmarkId: properties?.landmarkId,
        },
        campus.issues,
        campus.reports,
      );
    };

    const mask = L.geoJSON(movementMask(), {
      interactive: false,
      style: { stroke: false, fillColor: colors.background, fillOpacity: 1 },
    });
    const paths = L.geoJSON(pathCollection, {
      interactive: false,
      style: (feature) => paint(feature ? revealFor(feature, "path") : { level: 0 } as LocalReveal, "path"),
    });
    const builds = L.geoJSON(buildingCollection, {
      interactive: false,
      style: (feature) => paint(feature ? revealFor(feature, "building") : { level: 0 } as LocalReveal, "building"),
    });
    const limit = L.geoJSON(movementBoundary!, {
      interactive: false,
      style: { color: "#243044", weight: 1, opacity: 0.9, fillOpacity: 0, dashArray: "2 6" },
    });
    const campusEdge = L.geoJSON(reportingBoundary!, {
      interactive: false,
      style: () => paint({ level: 0 } as LocalReveal, "boundary"),
    });
    const shownFacilities = {
      type: "FeatureCollection" as const,
      features: facilityCollection.features.filter((feature) => {
        const reveal = revealFor(feature, "facility");
        return reveal.level >= 3;
      }),
    };
    const facilityLayer = L.geoJSON(shownFacilities, {
      pointToLayer: (feature, latlng) => {
        const kind = feature.properties && "kind" in feature.properties ? String(feature.properties.kind) : "entrance";
        return L.circleMarker(latlng, {
          radius: 4,
          color: kind === "bicycle_parking" ? colors.violet : colors.amber,
          weight: 1.5,
          fillOpacity: 0.2,
        });
      },
    });

    mask.addTo(map);
    paths.addTo(map);
    builds.addTo(map);
    limit.addTo(map);
    campusEdge.addTo(map);
    facilityLayer.addTo(map);
    return () => {
      mask.remove();
      paths.remove();
      builds.remove();
      limit.remove();
      campusEdge.remove();
      facilityLayer.remove();
    };
  }, [map, signature, campus.issues, campus.previewLevel, campus.reports]);

  return null;
}

function SignalMarkers() {
  const map = useMap();
  const campus = useCampus();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const groups = useMemo(() => clusterIssues(campus.issues, zoom), [campus.issues, zoom]);
  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    click(event) {
      if (!campusStore.getSnapshot().placingPin) return;
      campusStore.setDraftLocation({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        accuracy: null,
        source: "manual",
      });
    },
  });

  return (
    <>
      {groups.map((group) => {
        const issue = group.find((item) => item.severity === "urgent") ?? group[0];
        const showPhoto = group.length === 1 && zoom >= mapZoom.evidenceAt;
        const photo = showPhoto ? campus.photos.find((item) => item.issueId === issue.id && campusStore.previewFor(item.id)) : null;
        const preview = photo ? campusStore.previewFor(photo.id) : null;
        return (
          <Marker
            key={group.map((item) => item.id).join("-")}
            position={[issue.latitude, issue.longitude]}
            icon={
              preview
                ? L.divIcon({
                    className: "wake-photo",
                    html: `<img src="${preview}" alt="" /><span>${issue.severity}</span>`,
                    iconSize: [88, 72],
                    iconAnchor: [44, 72],
                  })
                : markerIcon(issue, group.length)
            }
            eventHandlers={{
              click: () => campusStore.selectIssue(issue.id, false),
            }}
          />
        );
      })}
      {streetLabelCollection.features.map((feature) => {
        const coordinates = (feature.geometry as Point).coordinates;
        const name = String(feature.properties?.name ?? "");
        return (
          <Marker
            key={String(feature.id)}
            position={[coordinates[1], coordinates[0]]}
            interactive={false}
            icon={L.divIcon({
              className: "wake-street",
              html: `<span>${name}</span>`,
              iconSize: [120, 18],
              iconAnchor: [60, 9],
            })}
          />
        );
      })}
      {landmarks.map((landmark) => (
        <Marker
          key={landmark.id}
          position={[landmark.latitude, landmark.longitude]}
          interactive={false}
          icon={L.divIcon({
            className: "wake-landmark",
            html: `<span>${landmark.name.replace("Dr. Martin Luther King Jr. Library", "MLK Library").replace("Charles W. Davidson College of Engineering", "Engineering").replace("Diaz Compean Student Union", "Student Union")}</span>`,
            iconSize: [160, 18],
            iconAnchor: [80, 28],
          })}
        />
      ))}
      {campus.draftLocation ? (
        <Marker
          draggable
          position={[campus.draftLocation.latitude, campus.draftLocation.longitude]}
          icon={L.divIcon({
            className: "wake-pin",
            html: `<span></span>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          })}
          eventHandlers={{
            dragend(event) {
              const latlng = event.target.getLatLng();
              campusStore.setDraftLocation({
                latitude: latlng.lat,
                longitude: latlng.lng,
                accuracy: null,
                source: "manual",
              });
            },
          }}
        />
      ) : null}
    </>
  );
}

function NavigationLock() {
  const map = useMap();
  const campus = useCampus();

  useEffect(() => installNavigationLimits(map, movementBoundary!, reportingBoundary!), [map]);

  useEffect(() => {
    const command = campus.viewCommand;
    if (!command || !reportingBoundary) return;
    runViewCommand(map, command, reportingBoundary);
  }, [campus.viewCommand, map]);

  return null;
}

export default function CampusMap() {
  const center = L.geoJSON(reportingBoundary!).getBounds().getCenter();
  return (
    <MapContainer
      center={center}
      zoom={16}
      minZoom={15}
      maxZoom={mapZoom.max}
      maxBounds={L.geoJSON(movementBoundary!).getBounds()}
      maxBoundsViscosity={1}
      zoomControl={false}
      attributionControl={false}
      worldCopyJump={false}
      bounceAtZoomLimits={false}
      zoomSnap={0.25}
      className="h-full w-full"
    >
      <NavigationLock />
      <VectorField />
      <SignalMarkers />
    </MapContainer>
  );
}
