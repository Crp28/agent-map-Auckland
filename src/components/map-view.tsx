"use client";

import { GEOMAPS, PERSON_COLOR, SOLD_PROPERTY_COLOR } from "@/lib/constants";
import type {
  BoundaryRecord,
  PersonRecord,
  PointMapTarget,
  SoldPropertyRecord,
  SuburbMapTarget,
} from "@/types/location";
import Graphic from "@arcgis/core/Graphic";
import Map from "@arcgis/core/Map";
import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import TileLayer from "@arcgis/core/layers/TileLayer";
import MapView from "@arcgis/core/views/MapView";
import { useEffect, useRef } from "react";

type AucklandMapProps = {
  people: PersonRecord[];
  soldProperties: SoldPropertyRecord[];
  boundaries: BoundaryRecord[];
  highlightedPersonIds: number[];
  selectedSoldPropertyId?: number;
  selectedSuburbTarget?: SuburbMapTarget;
  selectedPropertyTarget?: PointMapTarget;
  onSelectPerson: (person: PersonRecord) => void;
  onSelectSoldProperty: (soldProperty: SoldPropertyRecord) => void;
};

function makePoint(longitude: number, latitude: number) {
  return new Point({
    longitude,
    latitude,
    spatialReference: { wkid: 4326 },
  });
}

const aucklandOverviewCenter: [number, number] = [174.90935, -36.89934];
const aucklandMinZoom = 0;
const selectedBoundaryZoom = 8;

export function AucklandMap({
  people,
  soldProperties,
  boundaries,
  highlightedPersonIds,
  selectedSoldPropertyId,
  selectedSuburbTarget,
  selectedPropertyTarget,
  onSelectPerson,
  onSelectSoldProperty,
}: AucklandMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const peopleLayerRef = useRef<GraphicsLayer | null>(null);
  const propertyLayerRef = useRef<GraphicsLayer | null>(null);
  const boundaryLayerRef = useRef<GraphicsLayer | null>(null);
  const peopleRef = useRef(people);
  const soldPropertiesRef = useRef(soldProperties);
  const onSelectPersonRef = useRef(onSelectPerson);
  const onSelectSoldPropertyRef = useRef(onSelectSoldProperty);

  useEffect(() => {
    peopleRef.current = people;
    soldPropertiesRef.current = soldProperties;
  }, [people, soldProperties]);

  useEffect(() => {
    onSelectPersonRef.current = onSelectPerson;
    onSelectSoldPropertyRef.current = onSelectSoldProperty;
  }, [onSelectPerson, onSelectSoldProperty]);

  useEffect(() => {
    if (!containerRef.current || viewRef.current) {
      return;
    }

    const basemapLayer = new TileLayer({ url: GEOMAPS.greyCanvasBasemap });
    const boundaryLayer = new GraphicsLayer({ title: "Auckland subdivision outlines" });
    const propertyLayer = new GraphicsLayer({ title: "Sold properties" });
    const peopleLayer = new GraphicsLayer({ title: "People" });

    const map = new Map({
      layers: [basemapLayer, boundaryLayer, peopleLayer, propertyLayer],
    });

    const view = new MapView({
      container: containerRef.current,
      map,
      center: aucklandOverviewCenter,
      zoom: 8,
      constraints: {
        minZoom: aucklandMinZoom,
        maxZoom: 19,
      },
    });

    view.ui.move("zoom", "bottom-left");
    containerRef.current.tabIndex = 0;

    const clickHandle = view.on("click", async (event) => {
      const hit = await view.hitTest(event);
      const graphic = hit.results
        .map((result) => ("graphic" in result ? result.graphic : null))
        .find((candidate) => candidate?.attributes?.recordType);

      if (!graphic) {
        return;
      }

      const { recordType, id, addressId } = graphic.attributes as {
        recordType: string;
        id: number;
        addressId?: number;
      };
      if (recordType === "person") {
        const person = peopleRef.current.find((item) => item.addressId === addressId || item.id === id);
        if (person) {
          onSelectPersonRef.current(person);
        }
      }

      if (recordType === "soldProperty") {
        const property = soldPropertiesRef.current.find((item) => item.id === id);
        if (property) {
          onSelectSoldPropertyRef.current(property);
        }
      }
    });

    const keyHandle = view.on("key-down", (event) => {
      const key = event.key.toLowerCase();
      const panFactor = 0.25;
      const extent = view.extent;
      const center = view.center;
      if (
        !extent ||
        !center ||
        typeof center.longitude !== "number" ||
        typeof center.latitude !== "number"
      ) {
        return;
      }

      const xShift = extent.width * panFactor;
      const yShift = extent.height * panFactor;
      const longitude = center.longitude;
      const latitude = center.latitude;

      if (key === "arrowup" || key === "w") {
        event.stopPropagation();
        void view.goTo({ center: [longitude, latitude + yShift / 111000] });
      }
      if (key === "arrowdown" || key === "s") {
        event.stopPropagation();
        void view.goTo({ center: [longitude, latitude - yShift / 111000] });
      }
      if (key === "arrowleft" || key === "a") {
        event.stopPropagation();
        void view.goTo({ center: [longitude - xShift / 85000, latitude] });
      }
      if (key === "arrowright" || key === "d") {
        event.stopPropagation();
        void view.goTo({ center: [longitude + xShift / 85000, latitude] });
      }
      if (key === "+" || key === "=") {
        event.stopPropagation();
        void view.goTo({ zoom: view.zoom + 1 });
      }
      if (key === "-" || key === "_") {
        event.stopPropagation();
        void view.goTo({ zoom: view.zoom - 1 });
      }
    });

    viewRef.current = view;
    peopleLayerRef.current = peopleLayer;
    propertyLayerRef.current = propertyLayer;
    boundaryLayerRef.current = boundaryLayer;

    return () => {
      clickHandle.remove();
      keyHandle.remove();
      view.destroy();
      viewRef.current = null;
      peopleLayerRef.current = null;
      propertyLayerRef.current = null;
      boundaryLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const boundaryLayer = boundaryLayerRef.current;
    if (!boundaryLayer) {
      return;
    }

    boundaryLayer.removeAll();
    boundaryLayer.addMany(
      boundaries
        .filter((boundary) => boundary.geometry.rings)
        .map(
          (boundary) =>
            new Graphic({
              geometry: new Polygon({
                rings: boundary.geometry.rings,
                spatialReference: { wkid: 4326 },
              }),
              attributes: {
                id: boundary.id,
                subdivision: boundary.subdivision,
              },
              symbol: {
                type: "simple-fill",
                color: [0, 86, 167, 0.04],
                outline: {
                  color: [0, 86, 167, 0.8],
                  width: 1,
                },
              },
            }),
        ),
    );
  }, [boundaries]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !selectedSuburbTarget) {
      return;
    }

    const boundary = boundaries.find((item) => item.id === selectedSuburbTarget.boundaryId);
    if (!selectedSuburbTarget.center && !boundary?.geometry.rings) {
      return;
    }

    const polygon = boundary?.geometry.rings
      ? new Polygon({
          rings: boundary.geometry.rings,
          spatialReference: { wkid: 4326 },
        })
      : null;
    const fallbackCenter = polygon?.extent?.center;
    const targetCenter = selectedSuburbTarget.center
      ? makePoint(selectedSuburbTarget.center[0], selectedSuburbTarget.center[1])
      : fallbackCenter ?? null;
    if (!targetCenter) {
      return;
    }

    void view.goTo(
      {
        center: targetCenter,
        zoom: selectedBoundaryZoom,
      },
      { duration: 450 },
    );
  }, [boundaries, selectedSuburbTarget]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !selectedPropertyTarget) {
      return;
    }

    void view.goTo(
      {
        center: makePoint(selectedPropertyTarget.center[0], selectedPropertyTarget.center[1]),
        zoom: selectedPropertyTarget.zoom,
      },
      { duration: 450 },
    );
  }, [selectedPropertyTarget]);

  useEffect(() => {
    const propertyLayer = propertyLayerRef.current;
    if (!propertyLayer) {
      return;
    }

    propertyLayer.removeAll();
    propertyLayer.addMany(
      soldProperties
        .filter((property) => property.latitude !== null && property.longitude !== null)
        .map((property) => {
          const selected = property.id === selectedSoldPropertyId;
          return new Graphic({
            geometry: makePoint(property.longitude ?? 0, property.latitude ?? 0),
            attributes: {
              recordType: "soldProperty",
              id: property.id,
            },
            symbol: {
              type: "simple-marker",
              style: "path",
              path: "M0,-18 C-7,-18 -12,-13 -12,-6 C-12,4 0,18 0,18 C0,18 12,4 12,-6 C12,-13 7,-18 0,-18 Z",
              color: SOLD_PROPERTY_COLOR,
              size: selected ? 19 : 15,
              outline: {
                color: [255, 255, 255, 1],
                width: selected ? 2 : 1,
              },
            },
          });
        }),
    );
  }, [selectedSoldPropertyId, soldProperties]);

  useEffect(() => {
    const peopleLayer = peopleLayerRef.current;
    if (!peopleLayer) {
      return;
    }

    const highlighted = new Set(highlightedPersonIds);
    peopleLayer.removeAll();
    peopleLayer.addMany(
      people
        .filter((person) => person.latitude !== null && person.longitude !== null)
        .map((person) => {
          const isHighlighted = highlighted.has(person.addressId ?? person.id);
          return new Graphic({
            geometry: makePoint(person.longitude ?? 0, person.latitude ?? 0),
            attributes: {
              recordType: "person",
              id: person.id,
              addressId: person.addressId,
            },
            symbol: {
              type: "simple-marker",
              style: "circle",
              color: PERSON_COLOR,
              size: isHighlighted ? 13 : 9,
              outline: {
                color: isHighlighted ? [17, 24, 39, 1] : [255, 255, 255, 1],
                width: isHighlighted ? 2 : 1,
              },
            },
          });
        }),
    );
  }, [highlightedPersonIds, people]);

  return (
    <div
      ref={containerRef}
      aria-label="Auckland map"
      className="h-full min-h-[420px] w-full outline-none focus:ring-2 focus:ring-[#0056a7]"
    />
  );
}
