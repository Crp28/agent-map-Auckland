"use client";

import {
  GEOMAPS,
  PERSON_AUDIT_COLOR,
  PERSON_COLOR,
  PERSON_INCOMPLETE_NAME_COLOR,
  PERSON_SELECTED_COLOR,
  SOLD_PROPERTY_COLOR,
} from "@/lib/constants";
import { resolveSelectedPerson } from "@/lib/person-selection";
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
  mismatchedPersonIds: number[];
  incompleteNamePersonIds: number[];
  selectedPersonIds: number[];
  selectionModeActive: boolean;
  selectedSoldPropertyId?: number;
  selectedSuburbTarget?: SuburbMapTarget;
  selectedPropertyTarget?: PointMapTarget;
  onSelectPerson: (person: PersonRecord) => void;
  onSelectSoldProperty: (soldProperty: SoldPropertyRecord) => void;
  onSelectionClickPerson: (person: PersonRecord, options: { ctrlKey: boolean }) => void;
  onSelectionBoxPeople: (people: PersonRecord[], options: { mode: SelectionBoxMode }) => void;
};

type SelectionBoxMode = "add" | "remove";

function selectionBoxModeFromEvent(event: { native?: unknown }) {
  const native = event.native as MouseEvent | undefined;
  return native?.ctrlKey || native?.metaKey || native?.button === 2 || Boolean(native?.buttons && native.buttons & 2)
    ? "remove"
    : "add";
}

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
  mismatchedPersonIds,
  incompleteNamePersonIds,
  selectedPersonIds,
  selectionModeActive,
  selectedSoldPropertyId,
  selectedSuburbTarget,
  selectedPropertyTarget,
  onSelectPerson,
  onSelectSoldProperty,
  onSelectionClickPerson,
  onSelectionBoxPeople,
}: AucklandMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectionBoxRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const peopleLayerRef = useRef<GraphicsLayer | null>(null);
  const propertyLayerRef = useRef<GraphicsLayer | null>(null);
  const boundaryLayerRef = useRef<GraphicsLayer | null>(null);
  const peopleRef = useRef(people);
  const soldPropertiesRef = useRef(soldProperties);
  const selectionModeActiveRef = useRef(selectionModeActive);
  const onSelectPersonRef = useRef(onSelectPerson);
  const onSelectSoldPropertyRef = useRef(onSelectSoldProperty);
  const onSelectionClickPersonRef = useRef(onSelectionClickPerson);
  const onSelectionBoxPeopleRef = useRef(onSelectionBoxPeople);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragSelectionModeRef = useRef<SelectionBoxMode>("add");
  const pointerSelectionModeRef = useRef<SelectionBoxMode>("add");

  useEffect(() => {
    peopleRef.current = people;
    soldPropertiesRef.current = soldProperties;
    selectionModeActiveRef.current = selectionModeActive;
  }, [people, selectionModeActive, soldProperties]);

  useEffect(() => {
    onSelectPersonRef.current = onSelectPerson;
    onSelectSoldPropertyRef.current = onSelectSoldProperty;
    onSelectionClickPersonRef.current = onSelectionClickPerson;
    onSelectionBoxPeopleRef.current = onSelectionBoxPeople;
  }, [onSelectPerson, onSelectSoldProperty, onSelectionBoxPeople, onSelectionClickPerson]);

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

    const updateSelectionBox = (
      start: { x: number; y: number },
      end: { x: number; y: number },
      mode: SelectionBoxMode,
    ) => {
      const box = selectionBoxRef.current;
      if (!box) {
        return;
      }

      const left = Math.min(start.x, end.x);
      const top = Math.min(start.y, end.y);
      box.style.display = "block";
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${Math.abs(end.x - start.x)}px`;
      box.style.height = `${Math.abs(end.y - start.y)}px`;
      box.style.borderColor = mode === "remove" ? "#d92d20" : "#16a34a";
      box.style.backgroundColor = mode === "remove" ? "rgb(217 45 32 / 0.15)" : "rgb(22 163 74 / 0.15)";
    };

    const hideSelectionBox = () => {
      const box = selectionBoxRef.current;
      if (!box) {
        return;
      }
      box.style.display = "none";
      box.style.width = "0px";
      box.style.height = "0px";
    };

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
        const person = resolveSelectedPerson(peopleRef.current, id, addressId);
        if (person) {
          if (selectionModeActiveRef.current) {
            const native = event.native as MouseEvent | undefined;
            onSelectionClickPersonRef.current(person, {
              ctrlKey: Boolean(native?.ctrlKey || native?.metaKey),
            });
          } else {
            onSelectPersonRef.current(person);
          }
        }
      }

      if (selectionModeActiveRef.current) {
        return;
      }

      if (recordType === "soldProperty") {
        const property = soldPropertiesRef.current.find((item) => item.id === id);
        if (property) {
          onSelectSoldPropertyRef.current(property);
        }
      }
    });

    const dragHandle = view.on("drag", (event) => {
      if (!selectionModeActiveRef.current) {
        return;
      }

      event.stopPropagation();
      const point = { x: event.x, y: event.y };
      if (event.action === "start") {
        dragStartRef.current = point;
        const eventMode = selectionBoxModeFromEvent(event);
        dragSelectionModeRef.current = pointerSelectionModeRef.current === "remove" ? "remove" : eventMode;
        updateSelectionBox(point, point, dragSelectionModeRef.current);
        return;
      }

      const start = dragStartRef.current;
      if (!start) {
        return;
      }

      if (event.action === "update") {
        updateSelectionBox(start, point, dragSelectionModeRef.current);
        return;
      }

      if (event.action === "end") {
        hideSelectionBox();
        dragStartRef.current = null;
        const minX = Math.min(start.x, point.x);
        const maxX = Math.max(start.x, point.x);
        const minY = Math.min(start.y, point.y);
        const maxY = Math.max(start.y, point.y);
        if (maxX - minX < 6 || maxY - minY < 6) {
          return;
        }

        const selectedPeople = peopleRef.current.filter((person) => {
          if (person.latitude === null || person.longitude === null) {
            return false;
          }
          const screenPoint = view.toScreen(makePoint(person.longitude, person.latitude));
          return (
            screenPoint !== null &&
            screenPoint !== undefined &&
            screenPoint.x >= minX &&
            screenPoint.x <= maxX &&
            screenPoint.y >= minY &&
            screenPoint.y <= maxY
          );
        });
        if (selectedPeople.length > 0) {
          onSelectionBoxPeopleRef.current(selectedPeople, { mode: dragSelectionModeRef.current });
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
      dragHandle.remove();
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
    const mismatched = new Set(mismatchedPersonIds);
    const incompleteName = new Set(incompleteNamePersonIds);
    const selected = new Set(selectedPersonIds);
    peopleLayer.removeAll();
    peopleLayer.addMany(
      people
        .filter((person) => person.latitude !== null && person.longitude !== null)
        .map((person) => {
          const isHighlighted = highlighted.has(person.addressId ?? person.id);
          const isMismatched = mismatched.has(person.addressId ?? person.id);
          const isIncompleteName = incompleteName.has(person.addressId ?? person.id);
          const isSelected = selected.has(person.addressId ?? person.id);
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
              color: isSelected
                ? PERSON_SELECTED_COLOR
                : isMismatched
                ? PERSON_AUDIT_COLOR
                : isIncompleteName
                  ? PERSON_INCOMPLETE_NAME_COLOR
                  : PERSON_COLOR,
              size: isSelected ? 13 : isHighlighted ? 13 : 9,
              outline: {
                color: isSelected || isHighlighted ? [17, 24, 39, 1] : [255, 255, 255, 1],
                width: isSelected || isHighlighted ? 2 : 1,
              },
            },
          });
        }),
    );
  }, [highlightedPersonIds, incompleteNamePersonIds, mismatchedPersonIds, people, selectedPersonIds]);

  return (
    <div
      className="relative h-full min-h-[420px] w-full"
      onPointerDownCapture={(event) => {
        if (!selectionModeActive) {
          return;
        }

        pointerSelectionModeRef.current =
          event.ctrlKey || event.metaKey || event.button === 2 || Boolean(event.buttons & 2)
            ? "remove"
            : "add";
      }}
      onContextMenu={(event) => {
        if (selectionModeActive) {
          event.preventDefault();
        }
      }}
    >
      <div
        ref={containerRef}
        aria-label="Auckland map"
        className={`h-full min-h-[420px] w-full outline-none focus:ring-2 focus:ring-[#0056a7] ${
          selectionModeActive ? "cursor-crosshair" : ""
        }`}
      />
      <div
        ref={selectionBoxRef}
        className="pointer-events-none absolute hidden border border-[#16a34a] bg-[#16a34a]/15"
      />
    </div>
  );
}
