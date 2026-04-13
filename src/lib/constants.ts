export const SOLD_PROPERTY_COLOR = "#0056A7";
export const PERSON_COLOR = "#F8C00B";

export const GEOMAPS = {
  greyCanvasBasemap:
    "https://mapspublic.aklc.govt.nz/arcgis/rest/services/Basemap/GreyCanvasBasemap/MapServer",
  addressLookup: "https://mapspublic.aklc.govt.nz/arcgis/rest/services/Address/MapServer/0",
  areaOutlines:
    "https://mapspublic.aklc.govt.nz/arcgis/rest/services/LiveMaps/AucklandCouncilBoundaries/MapServer/1",
} as const;

export const GEOMAPS_BOUNDARY_SOURCE_NAME = "auckland-council-subdivision-outlines";
export const GEOMAPS_REFRESH_DAYS = 30;
