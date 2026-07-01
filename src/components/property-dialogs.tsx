"use client";

import { AppDialog } from "@/components/ui/dialog";
import type { PropertyDetailRecord, PropertyRecord } from "@/types/location";
import { ArrowLeft, Building2, History, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const fieldClass = "rounded-md border border-[#e2e8f0] p-3";
const PROPERTY_PAGE_SIZE = 100;

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function DetailField({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className={fieldClass}>
      <dt className="text-xs font-semibold uppercase text-[#64748b]">{label}</dt>
      <dd className="mt-1 break-words text-sm text-[#111827]">{value ?? "Not set"}</dd>
    </div>
  );
}

function PropertyDetail({ property }: { property: PropertyDetailRecord }) {
  const currentOwners = property.relations
    .filter((relation) => relation.relationshipType === "owner")
    .map((relation) => relation.personName);

  return (
    <div className="grid gap-5">
      <section aria-labelledby="property-current-heading" className="grid gap-3">
        <div>
          <h3 id="property-current-heading" className="text-base font-semibold text-[#111827]">
            Current information
          </h3>
          <p className="mt-1 text-sm text-[#64748b]">Property #{property.id}</p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <DetailField label="Street address" value={property.streetAddress} />
          <DetailField label="Suburb" value={property.suburb} />
          <DetailField label="Type" value={property.type} />
          <DetailField label="Current owners" value={currentOwners.length > 0 ? currentOwners.join(", ") : "None recorded"} />
          <DetailField label="Latitude" value={property.latitude} />
          <DetailField label="Longitude" value={property.longitude} />
          <DetailField label="Created" value={formatDate(property.createdAt)} />
          <DetailField label="Updated" value={formatDate(property.updatedAt)} />
        </dl>

        <div className="grid gap-2">
          <h4 className="text-sm font-semibold text-[#111827]">
            Relationships ({property.relations.length})
          </h4>
          {property.relations.length > 0 ? (
            <div className="divide-y divide-[#e2e8f0] rounded-md border border-[#e2e8f0]">
              {property.relations.map((relation) => (
                <div key={relation.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-medium text-[#111827]">{relation.personName}</span>
                  <span className="text-[#475569]">
                    {relation.relationshipType.replaceAll("_", " ")} · {formatDate(relation.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#64748b]">No People relationships recorded.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="property-timeline-heading" className="grid gap-3">
        <div className="flex items-center gap-2">
          <History aria-hidden="true" size={18} className="text-[#0056a7]" />
          <h3 id="property-timeline-heading" className="text-base font-semibold text-[#111827]">
            Timeline
          </h3>
        </div>
        {property.timeline.length > 0 ? (
          <ol className="relative ml-2 border-l border-[#cbd5e1] pl-5">
            {property.timeline.map((event) => (
              <li key={event.id} className="relative pb-5 last:pb-0">
                <span className="absolute -left-[1.55rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#0056a7]" />
                <p className="text-sm font-semibold text-[#111827]">{event.title}</p>
                <p className="mt-1 text-sm text-[#475569]">{event.description}</p>
                <time className="mt-1 block text-xs text-[#64748b]">{formatDate(event.date)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[#64748b]">No timeline events recorded.</p>
        )}
      </section>
    </div>
  );
}

export function PropertiesManagerDialog({
  open,
  onOpenChange,
  onSwitchToSold,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToSold: () => void;
}) {
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [selected, setSelected] = useState<PropertyDetailRecord | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    fetch("/api/properties", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Properties could not be loaded.");
        }
        return response.json() as Promise<{ properties: PropertyRecord[] }>;
      })
      .then((payload) => {
        setProperties(payload.properties);
        setPage(0);
        setError(null);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Properties could not be loaded.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open]);

  const visibleProperties = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return properties;
    }
    return properties.filter(
      (property) =>
        property.streetAddress.toLowerCase().includes(normalized) ||
        property.suburb.toLowerCase().includes(normalized) ||
        property.type?.toLowerCase().includes(normalized),
    );
  }, [properties, query]);
  const pageCount = Math.max(1, Math.ceil(visibleProperties.length / PROPERTY_PAGE_SIZE));
  const pagedProperties = visibleProperties.slice(
    page * PROPERTY_PAGE_SIZE,
    (page + 1) * PROPERTY_PAGE_SIZE,
  );

  async function openProperty(property: PropertyRecord) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/properties?id=${property.id}`);
      const payload = (await response.json()) as { property?: PropertyDetailRecord; error?: string };
      if (!response.ok || !payload.property) {
        throw new Error(payload.error ?? "Property details could not be loaded.");
      }
      setSelected(payload.property);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Property details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelected(null);
      setQuery("");
      setPage(0);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={selected ? selected.streetAddress : "Properties"}
    >
      <div className="grid gap-4">
        {selected ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            All properties
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="relative block max-w-md">
              <span className="sr-only">Search properties</span>
              <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                className="min-h-11 w-full rounded-md border border-[#cbd5e1] pl-10 pr-3 outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20"
                placeholder="Search address, suburb, or type"
              />
            </label>
            <p className="text-sm text-[#64748b] sm:text-right">
              {visibleProperties.length} of {properties.length} records
            </p>
          </div>
        )}

        {error ? <p role="alert" className="text-sm text-[#b42318]">{error}</p> : null}
        {loading ? <p className="text-sm text-[#64748b]">Loading...</p> : null}

        {selected ? (
          <PropertyDetail property={selected} />
        ) : (
          <div className="h-[min(520px,62dvh)] overflow-auto rounded-md border border-[#e2e8f0]">
            {pagedProperties.map((property) => (
              <button
                key={property.id}
                type="button"
                onClick={() => void openProperty(property)}
                className="flex min-h-14 w-full items-center gap-3 border-b border-[#e2e8f0] px-3 py-2 text-left last:border-b-0 hover:bg-[#eef3f8] focus:bg-[#eef3f8] focus:outline-none [content-visibility:auto]"
              >
                <Building2 aria-hidden="true" size={18} className="shrink-0 text-[#0056a7]" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#111827]">{property.streetAddress}</span>
                  <span className="block truncate text-xs text-[#64748b]">
                    {property.suburb}{property.type ? ` · ${property.type}` : ""}
                  </span>
                </span>
              </button>
            ))}
            {!loading && visibleProperties.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[#64748b]">No properties match this search.</p>
            ) : null}
          </div>
        )}

        {!selected && visibleProperties.length > PROPERTY_PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#475569]">
            <span>
              Page {page + 1} of {pageCount}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                className="min-h-11 rounded-md border border-[#cbd5e1] px-3 font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7] disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                className="min-h-11 rounded-md border border-[#cbd5e1] px-3 font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end border-t border-[#e2e8f0] pt-3">
          <div className="inline-flex rounded-md border border-[#cbd5e1] bg-[#f8fafc] p-1" aria-label="Property record view">
            <button type="button" aria-pressed="true" className="min-h-10 rounded-md bg-[#111827] px-3 text-sm font-semibold text-white">
              Properties
            </button>
            <button
              type="button"
              onClick={onSwitchToSold}
              className="min-h-10 rounded-md px-3 text-sm font-semibold text-[#334155] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
            >
              Sold properties
            </button>
          </div>
        </div>
      </div>
    </AppDialog>
  );
}
