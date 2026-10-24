import type { AnalysisResult } from "@/lib/types";

export type DemoScenario = {
  id: string;
  title: string;
  image: string;
  locationLabel: string;
  regionId: string;
  buildingId: string;
  latitude: number;
  longitude: number;
  studentDescription: string;
  analysis: AnalysisResult;
};

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
