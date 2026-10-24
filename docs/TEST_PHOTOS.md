# Campus test photos

Eight images were created with the built-in image-generation tool in photorealistic-natural mode and copied into `public/demo/` alongside the four original JPEGs. They depict synthetic maintenance scenarios, not actual SJSU incidents. The original photos were preserved. Suggested locations are editable testing pins.

| Image | Suggested map location | Test purpose |
| --- | --- | --- |
| `library-ramp-blocked.png` | MLK Library access ramp | Accessibility obstruction |
| `library-water-leak.png` | MLK Library corridor | Significant leak |
| `library-overflowing-bin.png` | MLK Library study area | Routine custodial issue |
| `engineering-electrical-leak.png` | Engineering lab | Immediate water/electrical hazard |
| `engineering-broken-door.png` | Engineering corridor | Damaged door/access loss |
| `campus-cracked-walkway.png` | Engineering outside walkway | Pavement/trip hazard |
| `union-blocked-aisle.png` | Student Union common room | Furniture blocking a route |
| `campus-clear-bike-rack.png` | Student Union courtyard | No-issue control |

These test purposes are not sent to the vision model. It receives image pixels and the general classification rubric. Its category, severity and suggested team can differ from the intended scene; the reporter reviews them. The clear-route image should be rejected as an issue by the integration check.

## Original generation prompts

### library-ramp-blocked.png

A photorealistic candid smartphone test photograph of a university library exterior wheelchair access ramp. Two large gray wheeled recycling bins and a folded maintenance barrier sit completely across the narrow ramp between metal handrails; the ramp is visibly unusable while nearby stairs remain open. Concrete institutional campus architecture, daylight, natural imperfect phone framing. The obstruction and accessibility ramp must both be unmistakable. No people, no injury, no logos, no captions or overlaid text. One single square photograph, not a collage. This is a synthetic campus maintenance test image.

### library-water-leak.png

A photorealistic candid smartphone test photograph inside a generic university library corridor. A visibly broken overhead water pipe is dripping a strong stream onto a broad puddle spreading across the tiled walkway beside a wall-mounted electrical outlet low on the wall. Water droplets and puddle reflections clearly visible, empty corridor, fluorescent indoor light, documentary phone-photo realism. Make the maintenance problem unambiguous without fire or injured people. No logos, no captions, no overlaid text. One single square photograph, not a collage. Synthetic campus maintenance test image.

### engineering-electrical-leak.png

A photorealistic candid smartphone test photograph of a generic university engineering lab utility corner. A split plumbing connector leaks a clear stream of water onto the floor immediately beside a plugged-in black multi-outlet electrical power strip with cables trailing along the wet floor. Visible pooling water and leak source, metal workbench and simple lab furniture in background, no people, no fire, no injury. Natural fluorescent light and realistic imperfect phone framing. No branding, no caption, no overlaid text. One square photograph, not a collage. Synthetic campus maintenance test image.

### engineering-broken-door.png

A photorealistic candid smartphone test photograph of a generic university classroom corridor showing a visibly damaged exit door: upper hinge detached from the frame, door sagging and jammed partly shut against the floor, bent latch plate clearly visible. Focus on physical damage and obstructed passage. Institutional brick and painted metal, daylight through adjacent window, realistic phone-camera image, no people, no injury. No logos, no captions or overlaid text. One single square photograph, not a collage. Synthetic campus maintenance test image.

### library-overflowing-bin.png

Photorealistic candid smartphone test photograph in a generic university library study corridor: a small overflowing waste bin beside the wall, several paper cups and crumpled papers on the floor around it. The wide main corridor is still completely passable and there is no water, sharp debris, blocked exit, or immediate danger. Ordinary daylight from tall windows, realistic phone framing. No people, no branding, no caption or overlaid text. One single square photograph, not a collage. Synthetic campus maintenance test image.

### union-blocked-aisle.png

Photorealistic candid smartphone test photograph inside a generic university student union common room. Several empty chairs and stacked folded tables have been left directly across a narrow main pedestrian aisle, making passage between the seating groups impossible for a wheelchair. The obstruction and the otherwise clear aisle behind it are visibly obvious. Neutral institutional interior, daylight, authentic phone camera style. No people, no injuries, no logos, no captions or overlaid text. One single square photograph, not a collage. Synthetic campus maintenance test image.

### campus-cracked-walkway.png

Photorealistic candid smartphone test photograph of a university campus pedestrian walkway between landscaped planters. A badly cracked concrete slab is raised several centimeters with an uneven jagged edge directly across the walking route, showing a clear trip hazard. Dry weather, daylight, eye-level phone photo angled slightly down, surrounding intact pavement visible for scale, no people. No logos, captions, text overlays, caution signs, or watermarks. One single square photograph, not a collage. Synthetic campus maintenance test image.

### campus-clear-bike-rack.png

Photorealistic candid smartphone test photograph of a clean generic university courtyard bicycle parking area. Four bicycles are correctly parked entirely inside individual metal rack bays, with a broad clearly unobstructed pedestrian walkway next to the racks. All pavement intact and dry, tidy bins, nothing broken or obstructed, no maintenance issue visible. Soft daylight and realistic ordinary phone-camera framing, no people, no logos, no caption or overlaid text. One single square photograph, not a collage. Synthetic negative-control test image for a campus maintenance classifier; it must depict a normal safe-looking scene with no issue.
