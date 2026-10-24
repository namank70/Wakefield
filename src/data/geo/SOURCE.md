# Geographic sources

Retrieved: 2026-10-24

Geometry is from OpenStreetMap, licensed under the Open Database License (ODbL) 1.0.
© OpenStreetMap contributors. https://www.openstreetmap.org/copyright

Query endpoint: Overpass API. The app reads the files in this folder and does not query Overpass at runtime.

## What was saved

- Campus building footprints and pathway centerlines are clipped to the reporting boundary.
- The one-block margin keeps the buildings whose centroids fall between the reporting boundary and the movement boundary, plus the named street centerlines, so the surrounding block stays readable.
- Perimeter labels: San Fernando, San Salvador, 4th, 10th, and the outer streets Santa Clara, William, 3rd, and 11th.
- Engineering region from the OpenStreetMap relation for the Charles W. Davidson College of Engineering (relation 22601).
- Pathway centerlines tagged footway, path, pedestrian, steps, or cycleway.
- Mapped entrances: 49. Mapped bicycle parking features: 12.

## Boundaries

The reporting boundary is the polygon formed by the nearest OpenStreetMap intersections of:

- South 4th Street and East San Fernando Street
- South 10th Street and East San Fernando Street
- South 10th Street and East San Salvador Street
- South 4th Street and East San Salvador Street

The movement boundary is the next surrounding street, not a meter buffer around campus:

- North: East Santa Clara Street, from South 3rd Street to the closest approach of South 11th Street
- West: the South 3rd Street bearing, from East Santa Clara Street through the mapped west end of East William Street
- South: East William Street between its mapped west and east ends
- East: South 11th Street from East Santa Clara Street to East San Salvador Street, then a short jog to the mapped east end of East William Street

Recorded data gaps, left as gaps instead of invented corners:

- South 11th Street and East Santa Clara Street do not share a node. Their centerlines approach within about 34 meters. The northeast corner is the midpoint of that approach.
- Named South 11th Street geometry ends at East San Salvador Street. Named East William Street ends near South 10th Street, about 27 meters from 10th and about 213 meters from 11th. The southeast block between 11th and William is not closed with a shared intersection, so the boundary follows 11th to San Salvador and then William's mapped east end.
- Named South 3rd Street ends at East San Salvador Street. East William Street's west end sits on the same bearing as 3rd, one block south of San Salvador. The southwest edge uses that mapped William endpoint.

## Gaps

Accessible routes are not included. OpenStreetMap entrance and bicycle-parking features are shown only where the extract contained them. Missing facility classes stay off the map. Nothing in this folder is a verified safe route.
