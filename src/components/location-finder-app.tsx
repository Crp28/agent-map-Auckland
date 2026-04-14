"use client";

import { AucklandMap } from "@/components/map-view";
import {
  AddPersonDialog,
  AddSoldPropertyDialog,
  DetailsDialog,
  ImportPeopleDialog,
  RecordManagerDialog,
} from "@/components/record-dialogs";
import { AUCKLAND_SUBURBS } from "@/lib/auckland-suburbs";
import type {
  MapData,
  PersonRecord,
  PointMapTarget,
  SearchResult,
  SelectedItem,
  SoldPropertyRecord,
  SuburbMapTarget,
  SuburbRegion,
} from "@/types/location";
import { ChevronLeft, ChevronRight, Database, FileUp, LocateFixed, Plus, Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const emptyMapData: MapData = {
  soldProperties: [],
  people: [],
  boundaries: [],
  sync: null,
};

export function LocationFinderApp() {
  const [mapData, setMapData] = useState<MapData>(emptyMapData);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [price, setPrice] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [selectedSoldPropertyId, setSelectedSoldPropertyId] = useState<number | undefined>();
  const [nearbyPeople, setNearbyPeople] = useState<Array<PersonRecord & { distanceKm: number }>>([]);
  const [nearbyFilterActive, setNearbyFilterActive] = useState(false);
  const [selectedPropertyTarget, setSelectedPropertyTarget] = useState<PointMapTarget | undefined>();
  const [distanceKm, setDistanceKm] = useState("2");
  const [sameSuburb, setSameSuburb] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
  const [personManagerOpen, setPersonManagerOpen] = useState(false);
  const [propertyManagerOpen, setPropertyManagerOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [suburbListOpen, setSuburbListOpen] = useState(false);
  const [suburbQuery, setSuburbQuery] = useState("");
  const [selectedSuburbKey, setSelectedSuburbKey] = useState<string | undefined>();
  const [selectedSuburbTarget, setSelectedSuburbTarget] = useState<SuburbMapTarget | undefined>();
  const suburbButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const suburbTargetKeyRef = useRef(0);
  const distanceKmRef = useRef(distanceKm);
  const sameSuburbRef = useRef(sameSuburb);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    distanceKmRef.current = distanceKm;
    sameSuburbRef.current = sameSuburb;
  }, [distanceKm, sameSuburb]);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams();
    if (fromDate) {
      params.set("from", fromDate);
    }
    if (toDate) {
      params.set("to", toDate);
    }
    if (price.trim()) {
      params.set("price", price.trim());
    }

    fetch(`/api/map-data?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Map data could not be loaded.");
        }
        return response.json() as Promise<MapData>;
      })
      .then((payload) => {
        setMapData(payload);
        setNotice(null);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setNotice(error instanceof Error ? error.message : "Map data could not be loaded.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [fromDate, price, refreshKey, toDate]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => response.json() as Promise<{ results: SearchResult[] }>)
        .then((payload) => setSearchResults(payload.results))
        .catch(() => setSearchResults([]));
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const loadNearby = useCallback(
    async (
      property: SoldPropertyRecord,
      overrides?: { distanceKm?: string; sameSuburb?: boolean },
    ) => {
      setSelectedSoldPropertyId(property.id);
      const effectiveDistanceKm = overrides?.distanceKm ?? distanceKmRef.current ?? "2";
      const params = new URLSearchParams({
        propertyId: String(property.id),
        distanceKm: effectiveDistanceKm,
        sameSuburb: String(overrides?.sameSuburb ?? sameSuburbRef.current),
      });
      const response = await fetch(`/api/nearby?${params.toString()}`);
      if (!response.ok) {
        setNearbyPeople([]);
        return;
      }
      const payload = (await response.json()) as {
        people: Array<PersonRecord & { distanceKm: number }>;
      };
      setNearbyPeople(payload.people);
    },
    [],
  );

  const selectPerson = useCallback((person: PersonRecord) => {
    setSelected({ type: "person", item: person, source: "map" });
  }, []);

  const selectSoldProperty = useCallback(
    (
      soldProperty: SoldPropertyRecord,
      options?: { focus?: boolean; zoom?: number },
    ) => {
      setSelected({ type: "soldProperty", item: soldProperty });
      if (
        options?.focus &&
        soldProperty.longitude !== null &&
        soldProperty.latitude !== null
      ) {
        setSelectedPropertyTarget({
          key: `${soldProperty.id}-${options.zoom ?? 8}-${Date.now()}`,
          center: [soldProperty.longitude, soldProperty.latitude],
          zoom: options.zoom ?? 8,
        });
      }
      void loadNearby(soldProperty);
    },
    [loadNearby],
  );

  const visiblePeople = nearbyFilterActive ? nearbyPeople : mapData.people;
  const highlightedPersonIds = useMemo(
    () => (nearbyFilterActive ? nearbyPeople.map((person) => person.addressId ?? person.id) : []),
    [nearbyFilterActive, nearbyPeople],
  );
  const suburbRegions = useMemo<SuburbRegion[]>(
    () => {
      const boundariesBySubdivision = new Map(
        mapData.boundaries.map((boundary) => [boundary.subdivision.toLowerCase(), boundary.id]),
      );
      const normalizedQuery = suburbQuery.trim().toLowerCase();

      return AUCKLAND_SUBURBS.filter(
        (suburb) =>
          !normalizedQuery ||
          suburb.name.toLowerCase().includes(normalizedQuery) ||
          suburb.area.toLowerCase().includes(normalizedQuery) ||
          suburb.boundarySubdivision.toLowerCase().includes(normalizedQuery),
      ).map((suburb) => ({
        key: `${suburb.area}-${suburb.name}`,
        name: suburb.name,
        area: suburb.area,
        boundarySubdivision: suburb.boundarySubdivision,
        boundaryId: boundariesBySubdivision.get(suburb.boundarySubdivision.toLowerCase()),
        center: suburb.center,
      }));
    },
    [mapData.boundaries, suburbQuery],
  );

  useEffect(() => {
    if (!suburbListOpen || !selectedSuburbKey) {
      return;
    }

    suburbButtonRefs.current.get(selectedSuburbKey)?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [selectedSuburbKey, suburbListOpen, suburbRegions]);

  function onSearchResultClick(result: SearchResult) {
    setQuery(result.title);
    setSearchResults([]);
    if (result.type === "person") {
      selectPerson(result.item);
    } else {
      selectSoldProperty(result.item, { focus: true, zoom: 6 });
    }
  }

  async function syncGeomaps() {
    setNotice("Syncing GeoMaps...");
    const response = await fetch("/api/sync/geomaps", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setNotice(payload.error ?? "GeoMaps sync failed.");
      return;
    }
    setNotice(`GeoMaps synced: ${payload.count} areas.`);
    refresh();
  }

  function selectSuburb(region: SuburbRegion) {
    const targetKey = suburbTargetKeyRef.current + 1;
    suburbTargetKeyRef.current = targetKey;
    setSelectedSuburbKey(region.key);
    setSuburbListOpen(false);
    setSelectedSuburbTarget({
      key: `${region.key}-${targetKey}`,
      boundaryId: region.boundaryId,
      center: region.center,
    });
  }

  async function applyNearbyFilter() {
    const property =
      mapData.soldProperties.find((item) => item.id === selectedSoldPropertyId) ??
      (selected?.type === "soldProperty" ? selected.item : undefined);
    if (!property) {
      return;
    }

    await loadNearby(property);
    setNearbyFilterActive(true);
  }

  function cancelNearbyFilter() {
    setNearbyFilterActive(false);
  }

  return (
    <main className="relative h-dvh min-h-[720px] overflow-hidden bg-[#e9eef5] text-[#111827]">
      <AucklandMap
        people={visiblePeople}
        soldProperties={mapData.soldProperties}
        boundaries={mapData.boundaries}
        highlightedPersonIds={highlightedPersonIds}
        selectedSoldPropertyId={selectedSoldPropertyId}
        selectedSuburbTarget={selectedSuburbTarget}
        selectedPropertyTarget={selectedPropertyTarget}
        onSelectPerson={selectPerson}
        onSelectSoldProperty={selectSoldProperty}
      />

      <section className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-3 p-3 md:items-end">
        <div className="pointer-events-auto w-full max-w-xl rounded-md border border-[#cbd5e1] bg-white p-3 shadow-lg">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]"
              size={18}
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (!event.target.value.trim()) {
                  setSearchResults([]);
                }
              }}
              className="min-h-11 w-full rounded-md border border-[#cbd5e1] pl-10 pr-3 outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20"
              placeholder="Search people or sold properties"
              aria-label="Search people or sold properties"
            />
            {searchResults.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-auto rounded-md border border-[#cbd5e1] bg-white shadow-xl">
                {searchResults.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    type="button"
                    onClick={() => onSearchResultClick(result)}
                    className="block min-h-11 w-full border-b border-[#e2e8f0] px-3 py-2 text-left last:border-b-0 hover:bg-[#eef3f8] focus:bg-[#eef3f8] focus:outline-none"
                  >
                    <span className="block text-sm font-semibold text-[#111827]">{result.title}</span>
                    <span className="block text-sm text-[#475569]">{result.subtitle}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-[#334155]">
              Sold from
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-[#cbd5e1] px-3 outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20"
              />
            </label>
            <label className="text-sm font-medium text-[#334155]">
              Sold to
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-[#cbd5e1] px-3 outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20"
              />
            </label>
            <label className="text-sm font-medium text-[#334155]">
              Buyer price
              <input
                inputMode="numeric"
                value={price}
                onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))}
                className="mt-1 min-h-11 w-full rounded-md border border-[#cbd5e1] px-3 outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20"
                placeholder="1200000"
              />
            </label>
          </div>
        </div>

        <div className="pointer-events-auto flex w-full max-w-xl flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPropertyManagerOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#0056a7] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004780] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
          >
            <Plus aria-hidden="true" size={18} />
            Sold property
          </button>
          <button
            type="button"
            onClick={() => setPersonManagerOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#111827] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1f2937] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
          >
            <Users aria-hidden="true" size={18} />
            Person
          </button>
          <button
            type="button"
            onClick={() => setImportDialogOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
          >
            <FileUp aria-hidden="true" size={18} />
            Import
          </button>
          <button
            type="button"
            onClick={() => void syncGeomaps()}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
          >
            <Database aria-hidden="true" size={18} />
            Sync GeoMaps
          </button>
        </div>

      </section>

      <aside className="absolute bottom-3 left-3 right-3 top-56 z-20 flex min-h-0 flex-col justify-end gap-3 md:left-auto md:w-[380px]">
        <div
          className={`pointer-events-none relative w-full min-h-0 overflow-visible transition-[height] duration-200 ${
            suburbListOpen ? "flex-1" : "h-11 shrink-0"
          }`}
        >
          <section
            className={`pointer-events-auto absolute inset-y-0 right-0 flex max-h-full w-[min(86vw,340px)] overflow-hidden rounded-md border border-[#cbd5e1] bg-white shadow-lg transition-transform duration-200 ${
              suburbListOpen ? "translate-x-0" : "translate-x-[calc(100%-44px)]"
            }`}
            aria-label="Auckland suburb navigation"
          >
            <button
              type="button"
              onClick={() => setSuburbListOpen((open) => !open)}
              aria-expanded={suburbListOpen}
              className="grid min-h-11 min-w-11 place-items-center border-r border-[#e2e8f0] bg-[#f8fafc] text-[#334155] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
            >
              {suburbListOpen ? (
                <ChevronRight aria-hidden="true" size={20} />
              ) : (
                <ChevronLeft aria-hidden="true" size={20} />
              )}
              <span className="sr-only">{suburbListOpen ? "Collapse suburb list" : "Open suburb list"}</span>
            </button>
            {suburbListOpen ? (
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-[#e2e8f0] px-3 py-3">
                  <p className="text-sm font-semibold text-[#111827]">Auckland suburbs</p>
                  <label className="mt-2 block text-xs font-medium text-[#475569]">
                    Filter suburbs
                    <input
                      value={suburbQuery}
                      onChange={(event) => setSuburbQuery(event.target.value)}
                      className="mt-1 min-h-10 w-full rounded-md border border-[#cbd5e1] px-3 text-sm text-[#111827] outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20"
                      placeholder="Search central, north, east"
                    />
                  </label>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {suburbRegions.map((region) => (
                    <button
                      key={region.key}
                      ref={(node) => {
                        if (node) {
                          suburbButtonRefs.current.set(region.key, node);
                        } else {
                          suburbButtonRefs.current.delete(region.key);
                        }
                      }}
                      type="button"
                      onClick={() => selectSuburb(region)}
                      className="block min-h-11 w-full border-b border-[#e2e8f0] px-3 py-2 text-left text-sm text-[#111827] last:border-b-0 hover:bg-[#eef3f8] focus:bg-[#eef3f8] focus:outline-none"
                    >
                      <span className="block font-semibold">{region.name}</span>
                      <span className="block text-xs text-[#64748b]">
                        {region.area} - {region.boundarySubdivision}
                      </span>
                    </button>
                  ))}
                  {suburbRegions.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-[#64748b]">No suburbs match this filter.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <div className="shrink-0 rounded-md border border-[#cbd5e1] bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#111827]">Nearby people</p>
              <p className="text-xs text-[#64748b]">
                {selectedSoldPropertyId ? `${nearbyPeople.length} matches` : "Select a sold property"}
              </p>
            </div>
            <LocateFixed aria-hidden="true" className="text-[#0056a7]" size={20} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-sm font-medium text-[#334155]">
              Distance km
              <input
                inputMode="decimal"
                value={distanceKm}
                onChange={(event) => setDistanceKm(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-[#cbd5e1] px-3 outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20"
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium text-[#334155]">
              <input
                type="checkbox"
                checked={sameSuburb}
                onChange={(event) => setSameSuburb(event.target.checked)}
                className="h-5 w-5 accent-[#0056a7]"
              />
              Same suburb
            </label>
          </div>
          {selectedSoldPropertyId ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void applyNearbyFilter()}
                className="min-h-11 flex-1 rounded-md border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
              >
                Apply nearby filter
              </button>
              {nearbyFilterActive ? (
                <button
                  type="button"
                  onClick={cancelNearbyFilter}
                  className="min-h-11 rounded-md bg-[#111827] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1f2937] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 max-h-44 overflow-auto">
            {nearbyPeople.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => selectPerson(person)}
                className="block min-h-11 w-full border-b border-[#e2e8f0] px-2 py-2 text-left last:border-b-0 hover:bg-[#eef3f8]"
              >
                <span className="block text-sm font-semibold text-[#111827]">{person.name}</span>
                <span className="block text-xs text-[#475569]">
                  {person.suburb} - {person.distanceKm.toFixed(2)} km
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-[#cbd5e1] bg-white p-3 text-xs text-[#475569] shadow-lg">
          {loading ? "Loading map data..." : `${mapData.soldProperties.length} sold properties`}
          {" | "}
          {nearbyFilterActive ? `${visiblePeople.length} visible people` : `${mapData.people.length} people`}
          {" | "}
          Last GeoMaps sync:{" "}
          {mapData.sync?.lastSuccessfulSyncAt
            ? new Date(mapData.sync.lastSuccessfulSyncAt).toLocaleString()
            : "Not synced"}
          {notice ? <p className="mt-1 text-[#111827]">{notice}</p> : null}
        </div>
      </aside>

      <RecordManagerDialog
        type="person"
        open={personManagerOpen}
        onOpenChange={setPersonManagerOpen}
        onAdd={() => {
          setPersonManagerOpen(false);
          setPersonDialogOpen(true);
        }}
        onSelect={(record) => {
          setPersonManagerOpen(false);
          if ("name" in record) {
            setSelected({ type: "person", item: record, source: "manager" });
          }
        }}
        refresh={refresh}
      />
      <RecordManagerDialog
        type="soldProperty"
        open={propertyManagerOpen}
        onOpenChange={setPropertyManagerOpen}
        onAdd={() => {
          setPropertyManagerOpen(false);
          setPropertyDialogOpen(true);
        }}
        onSelect={(record) => {
          setPropertyManagerOpen(false);
          if (!("name" in record)) {
            selectSoldProperty(record);
          }
        }}
        refresh={refresh}
      />
      <AddPersonDialog open={personDialogOpen} onOpenChange={setPersonDialogOpen} refresh={refresh} />
      <AddSoldPropertyDialog
        open={propertyDialogOpen}
        onOpenChange={setPropertyDialogOpen}
        refresh={refresh}
      />
      <ImportPeopleDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        refresh={refresh}
      />
      <DetailsDialog
        selected={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onSelectedChange={setSelected}
        refresh={refresh}
      />
    </main>
  );
}
