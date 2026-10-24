import type { AnalysisResult } from "@/lib/types";

export type CampusTestPhoto = {
  id: string;
  title: string;
  image: string;
  locationLabel: string;
  regionId: string;
  buildingId: string;
  latitude: number;
  longitude: number;
  studentDescription: string;
  synthetic?: boolean;
};

export type DemoScenario = CampusTestPhoto & { analysis: AnalysisResult };

/** Prepared demo fixtures. These are cached examples, not live computer-vision results. */
export const demoScenarios: DemoScenario[] = [
  {
    id: "demo-lighting",
    title: "Unlit ceiling fixture",
    image: "/demo/fusedLight.jpeg",
    locationLabel: "MLK Library · interior route",
    regionId: "library",
    buildingId: "library",
    latitude: 37.33511516184818,
    longitude: -121.88420119708395,
    studentDescription: "A fluorescent tube is out above an interior route; please check the lighting.",
    analysis: {
      category: "lighting",
      summary: "A fluorescent tube is out along an interior route.",
      severity: "high",
      department: "Facilities Electrical",
      confidence: 0.91,
      accessibilityImpact: true,
      tags: ["lighting", "interior-route", "visibility"],
      provider: "cached",
    },
  },
  {
    id: "demo-chairs",
    title: "Chairs narrowing an aisle",
    image: "/demo/chairsScattered.jpeg",
    locationLabel: "Student Union · classroom aisle",
    regionId: "student-union",
    buildingId: "student-union",
    latitude: 37.33662052095239,
    longitude: -121.8803850771428,
    studentDescription: "Loose chairs may be narrowing the aisle; please confirm the accessible route is clear.",
    analysis: {
      category: "walkway_obstruction",
      summary: "Loose chairs may be narrowing an accessible aisle.",
      severity: "medium",
      department: "Accessibility and Facilities",
      confidence: 0.84,
      accessibilityImpact: true,
      tags: ["chairs", "aisle", "accessibility-review"],
      provider: "cached",
    },
  },
  {
    id: "demo-chair-repair",
    title: "Damaged chair",
    image: "/demo/brokenchair.jpeg",
    locationLabel: "Engineering · classroom furniture",
    regionId: "engineering",
    buildingId: "engineering",
    latitude: 37.33680768367347,
    longitude: -121.88137599115653,
    studentDescription: "A classroom chair appears damaged and may need repair.",
    analysis: {
      category: "other",
      summary: "A wooden chair appears damaged and needs a maintenance check.",
      severity: "medium",
      department: "Facilities",
      confidence: 0.89,
      accessibilityImpact: false,
      tags: ["furniture", "chair", "repair"],
      provider: "cached",
    },
  },
  {
    id: "demo-bike-check",
    title: "Possible scooter encroachment",
    image: "/demo/bikeRACK.jpeg",
    locationLabel: "Student Union · bike rack area",
    regionId: "student-union",
    buildingId: "student-union",
    latitude: 37.33662052095239,
    longitude: -121.8803850771428,
    studentDescription: "A scooter may be outside the rack footprint. Please check whether it narrows the nearby pedestrian route.",
    analysis: {
      category: "bike_scooter_parking",
      summary: "Possible scooter encroachment near a bike rack; route impact needs an in-person check.",
      severity: "low",
      department: "Transportation and Parking Services",
      confidence: 0.72,
      accessibilityImpact: false,
      tags: ["bike-rack", "scooter", "needs-review"],
      provider: "cached",
    },
  },
];

/** Locations are suggested testing pins; generated scenes are not real campus incidents. */
export const testPhotos: CampusTestPhoto[] = [
  ...demoScenarios,
  { id: "ai-library-ramp", title: "Bins across an access ramp", image: "/demo/library-ramp-blocked.png", locationLabel: "MLK Library · access ramp", regionId: "library", buildingId: "library", latitude: 37.33530, longitude: -121.88470, studentDescription: "", synthetic: true },
  { id: "ai-library-leak", title: "Water in a library corridor", image: "/demo/library-water-leak.png", locationLabel: "MLK Library · corridor", regionId: "library", buildingId: "library", latitude: 37.33547, longitude: -121.88498, studentDescription: "", synthetic: true },
  { id: "ai-library-bin", title: "Overflowing corridor bin", image: "/demo/library-overflowing-bin.png", locationLabel: "MLK Library · study area", regionId: "library", buildingId: "library", latitude: 37.33544, longitude: -121.88492, studentDescription: "", synthetic: true },
  { id: "ai-engineering-leak", title: "Water beside electrical equipment", image: "/demo/engineering-electrical-leak.png", locationLabel: "Engineering · lab utility area", regionId: "engineering", buildingId: "engineering", latitude: 37.336807, longitude: -121.881376, studentDescription: "", synthetic: true },
  { id: "ai-engineering-door", title: "Damaged corridor door", image: "/demo/engineering-broken-door.png", locationLabel: "Engineering · corridor", regionId: "engineering", buildingId: "engineering", latitude: 37.33670, longitude: -121.88139, studentDescription: "", synthetic: true },
  { id: "ai-engineering-path", title: "Uneven concrete walkway", image: "/demo/campus-cracked-walkway.png", locationLabel: "Engineering · outside walkway", regionId: "engineering", buildingId: "engineering", latitude: 37.33667, longitude: -121.88143, studentDescription: "", synthetic: true },
  { id: "ai-union-aisle", title: "Furniture across a main aisle", image: "/demo/union-blocked-aisle.png", locationLabel: "Student Union · common room", regionId: "student-union", buildingId: "student-union", latitude: 37.33662, longitude: -121.880385, studentDescription: "", synthetic: true },
  { id: "ai-clear-rack", title: "Clear route beside bike racks", image: "/demo/campus-clear-bike-rack.png", locationLabel: "Student Union · courtyard", regionId: "student-union", buildingId: "student-union", latitude: 37.33656, longitude: -121.88046, studentDescription: "", synthetic: true },
];
