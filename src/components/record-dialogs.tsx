"use client";

import { AppDialog } from "@/components/ui/dialog";
import type { PersonAddressRecord, PersonRecord, SelectedItem, SoldPropertyRecord } from "@/types/location";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { personFormSchema, personInputSchema, soldPropertyInputSchema } from "@/lib/validation";

type FormStatus = { type: "success" | "error"; message: string } | null;

const inputClass =
  "min-h-11 w-full rounded-md border border-[#cbd5e1] bg-white px-3 py-2 text-[#111827] outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20";
const labelClass = "text-sm font-medium text-[#334155]";
const errorClass = "mt-1 text-sm text-[#b42318]";

type DialogActions = {
  refresh: () => void;
};

type PersonCoordinateAuditResult = {
  personId: number;
  addressId: number;
  streetAddress: string;
  suburb: string;
  status: "ok" | "mismatch" | "unverified";
  matchedAddress: string | null;
  distanceKm: number | null;
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className={errorClass}>{message}</p> : null;
}

type SoldPropertyForm = z.input<typeof soldPropertyInputSchema>;
type RecordKind = "person" | "soldProperty";
type ManagedRecord = PersonRecord | SoldPropertyRecord;

export function AddPersonDialog({
  open,
  onOpenChange,
  refresh,
}: DialogActions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = useState<FormStatus>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(personFormSchema),
    defaultValues: {
      purchasingPowerMin: "",
      purchasingPowerMax: "",
      addresses: [
        {
          streetAddress: "",
          suburb: "",
          latitude: "",
          longitude: "",
        },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "addresses",
  });

  async function onSubmit(values: z.output<typeof personInputSchema>) {
    setStatus(null);
    const response = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      setStatus({ type: "error", message: "Person could not be saved. Check the fields." });
      return;
    }

    reset();
    refresh();
    setStatus({ type: "success", message: "Person saved." });
  }

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title="Add person">
      <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Name
            <input className={inputClass} {...register("name")} />
            <FieldError message={errors.name?.message} />
          </label>
          <label className={labelClass}>
            Phone (required if no email)
            <input className={inputClass} {...register("phone")} />
            <FieldError message={errors.phone?.message} />
          </label>
          <label className={labelClass}>
            Email (required if no phone)
            <input className={inputClass} type="email" {...register("email")} />
            <FieldError message={errors.email?.message} />
          </label>
          <label className={labelClass}>
            Purchasing power min
            <input className={inputClass} inputMode="numeric" {...register("purchasingPowerMin")} />
            <FieldError message={errors.purchasingPowerMin?.message} />
          </label>
          <label className={labelClass}>
            Purchasing power max
            <input className={inputClass} inputMode="numeric" {...register("purchasingPowerMax")} />
            <FieldError message={errors.purchasingPowerMax?.message} />
          </label>
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className={labelClass}>Addresses</p>
              <button
                type="button"
                onClick={() =>
                  append({
                    streetAddress: "",
                    suburb: "",
                    latitude: "",
                    longitude: "",
                  })
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
              >
                <Plus aria-hidden="true" size={18} />
                Add address
              </button>
            </div>
            <div className="grid gap-4">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-md border border-[#e2e8f0] p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#111827]">Address {index + 1}</p>
                    {fields.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#fecdca] px-3 py-2 text-sm font-semibold text-[#b42318] hover:bg-[#fff1f0] focus:outline-none focus:ring-2 focus:ring-[#b42318]"
                      >
                        <Trash2 aria-hidden="true" size={18} />
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={`${labelClass} sm:col-span-2`}>
                      Street address
                      <input className={inputClass} {...register(`addresses.${index}.streetAddress`)} />
                      <FieldError message={errors.addresses?.[index]?.streetAddress?.message} />
                    </label>
                    <label className={labelClass}>
                      Suburb
                      <input className={inputClass} {...register(`addresses.${index}.suburb`)} />
                      <FieldError message={errors.addresses?.[index]?.suburb?.message} />
                    </label>
                    <div />
                    <label className={labelClass}>
                      Latitude fallback
                      <input className={inputClass} inputMode="decimal" {...register(`addresses.${index}.latitude`)} />
                      <FieldError message={errors.addresses?.[index]?.latitude?.message} />
                    </label>
                    <label className={labelClass}>
                      Longitude fallback
                      <input className={inputClass} inputMode="decimal" {...register(`addresses.${index}.longitude`)} />
                      <FieldError message={errors.addresses?.[index]?.longitude?.message} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <FieldError message={errors.addresses?.message as string | undefined} />
          </div>
        </div>
        {status ? (
          <p className={status.type === "error" ? errorClass : "text-sm text-[#166534]"}>
            {status.message}
          </p>
        ) : null}
        <button
          disabled={isSubmitting}
          className="min-h-11 rounded-md bg-[#0056a7] px-4 py-2 font-semibold text-white hover:bg-[#004780] disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save person"}
        </button>
      </form>
    </AppDialog>
  );
}

export function AddSoldPropertyDialog({
  open,
  onOpenChange,
  refresh,
}: DialogActions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = useState<FormStatus>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SoldPropertyForm>({
    resolver: zodResolver(soldPropertyInputSchema),
    defaultValues: {
      latitude: "",
      longitude: "",
    },
  });

  async function onSubmit(values: SoldPropertyForm) {
    setStatus(null);
    const response = await fetch("/api/sold-properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      setStatus({ type: "error", message: "Sold property could not be saved." });
      return;
    }

    reset();
    refresh();
    setStatus({ type: "success", message: "Sold property saved." });
  }

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title="Add sold property">
      <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={`${labelClass} sm:col-span-2`}>
            Street address
            <input className={inputClass} {...register("streetAddress")} />
            <FieldError message={errors.streetAddress?.message} />
          </label>
          <label className={labelClass}>
            Suburb
            <input className={inputClass} {...register("suburb")} />
            <FieldError message={errors.suburb?.message} />
          </label>
          <label className={labelClass}>
            Last sold date
            <input className={inputClass} type="date" {...register("lastSoldDate")} />
            <FieldError message={errors.lastSoldDate?.message} />
          </label>
          <label className={labelClass}>
            Sold price
            <input className={inputClass} inputMode="numeric" {...register("soldPrice")} />
            <FieldError message={errors.soldPrice?.message} />
          </label>
          <label className={labelClass}>
            Latitude fallback
            <input className={inputClass} inputMode="decimal" {...register("latitude")} />
            <FieldError message={errors.latitude?.message} />
          </label>
          <label className={labelClass}>
            Longitude fallback
            <input className={inputClass} inputMode="decimal" {...register("longitude")} />
            <FieldError message={errors.longitude?.message} />
          </label>
        </div>
        {status ? (
          <p className={status.type === "error" ? errorClass : "text-sm text-[#166534]"}>
            {status.message}
          </p>
        ) : null}
        <button
          disabled={isSubmitting}
          className="min-h-11 rounded-md bg-[#0056a7] px-4 py-2 font-semibold text-white hover:bg-[#004780] disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save sold property"}
        </button>
      </form>
    </AppDialog>
  );
}

export function ImportPeopleDialog({
  open,
  onOpenChange,
  refresh,
}: DialogActions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = useState<FormStatus>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setIsUploading(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/import/people", { method: "POST", body: formData });
    const payload = await response.json();
    setIsUploading(false);

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error ?? "Import failed." });
      return;
    }

    const summary = payload.summary as {
      imported: number;
      updated: number;
      duplicates: number;
      failed: number;
    };
    setStatus({
      type: "success",
      message: `Imported ${summary.imported}, updated ${summary.updated}, skipped ${summary.duplicates}, failed ${summary.failed}.`,
    });
    refresh();
  }

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title="Import people">
      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className={labelClass}>
          CSV file
          <input className={inputClass} type="file" name="file" accept=".csv" required />
        </label>
        {status ? (
          <p className={status.type === "error" ? errorClass : "text-sm text-[#166534]"}>
            {status.message}
          </p>
        ) : null}
        <button
          disabled={isUploading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#0056a7] px-4 py-2 font-semibold text-white hover:bg-[#004780] disabled:opacity-50"
        >
          <Upload aria-hidden="true" size={18} />
          {isUploading ? "Importing..." : "Import CSV"}
        </button>
      </form>
    </AppDialog>
  );
}

export function RecordManagerDialog({
  type,
  open,
  onOpenChange,
  onAdd,
  onSelect,
  refresh,
}: DialogActions & {
  type: RecordKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  onSelect: (record: ManagedRecord) => void;
}) {
  const [records, setRecords] = useState<ManagedRecord[]>([]);
  const [status, setStatus] = useState<FormStatus>(null);
  const endpoint = type === "person" ? "/api/people" : "/api/sold-properties";
  const title = type === "person" ? "People" : "Sold properties";
  const addLabel = type === "person" ? "Add person" : "Add sold property";

  const fetchRecords = useCallback(async () => {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`${title} could not be loaded.`);
    }

    const payload = await response.json();
    return (type === "person" ? payload.people : payload.soldProperties) as ManagedRecord[];
  }, [endpoint, title, type]);

  const loadRecords = useCallback(async () => {
    try {
      setRecords(await fetchRecords());
      setStatus(null);
    } catch (error) {
      setRecords([]);
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : `${title} could not be loaded.`,
      });
    }
  }, [fetchRecords, title]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    fetchRecords()
      .then((nextRecords) => {
        if (!cancelled) {
          setRecords(nextRecords);
          setStatus(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRecords([]);
          setStatus({
            type: "error",
            message: error instanceof Error ? error.message : `${title} could not be loaded.`,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchRecords, open, title]);

  async function deleteRecord(record: ManagedRecord) {
    const label = "name" in record ? record.name : record.streetAddress;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
      return;
    }

    const response = await fetch(`${endpoint}?id=${record.id}`, { method: "DELETE" });
    if (!response.ok) {
      setStatus({ type: "error", message: `${label} could not be deleted.` });
      return;
    }

    setStatus({ type: "success", message: `${label} deleted.` });
    refresh();
    await loadRecords();
  }

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title={title}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#475569]">{records.length} records</p>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#0056a7] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004780] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
          >
            <Plus aria-hidden="true" size={18} />
            {addLabel}
          </button>
        </div>
        {status ? (
          <p className={status.type === "error" ? errorClass : "text-sm text-[#166534]"}>
            {status.message}
          </p>
        ) : null}
        <div className="max-h-[56dvh] overflow-auto rounded-md border border-[#e2e8f0]">
          {records.map((record) => {
            const isPerson = "name" in record;
            const titleText = isPerson ? record.name : record.streetAddress;
            const subtitle = isPerson
              ? `${record.streetAddress}, ${record.suburb}`
              : `${record.suburb} - $${record.soldPrice.toLocaleString()}`;

            return (
              <div
                key={`${type}-${record.id}`}
                className="flex min-h-14 items-center justify-between gap-3 border-b border-[#e2e8f0] px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111827]">{titleText}</p>
                  <p className="truncate text-xs text-[#64748b]">{subtitle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelect(record)}
                    className="grid min-h-11 min-w-11 place-items-center rounded-md border border-[#cbd5e1] text-[#334155] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
                  >
                    <Eye aria-hidden="true" size={18} />
                    <span className="sr-only">See details for {titleText}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteRecord(record)}
                    className="grid min-h-11 min-w-11 place-items-center rounded-md border border-[#fecdca] text-[#b42318] hover:bg-[#fff1f0] focus:outline-none focus:ring-2 focus:ring-[#b42318]"
                  >
                    <Trash2 aria-hidden="true" size={18} />
                    <span className="sr-only">Delete {titleText}</span>
                  </button>
                </div>
              </div>
            );
          })}
          {records.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[#64748b]">No records yet.</p>
          ) : null}
        </div>
      </div>
    </AppDialog>
  );
}

export function DetailsDialog({
  selected,
  onOpenChange,
  onSelectedChange,
  onPersonAuditResult,
  refresh,
}: {
  selected: SelectedItem;
  onOpenChange: (open: boolean) => void;
  onSelectedChange: (selected: SelectedItem) => void;
  onPersonAuditResult: (result: PersonCoordinateAuditResult) => void;
  refresh: () => void;
}) {
  const open = selected !== null;
  const title =
    selected?.type === "person"
      ? selected.item.name
      : selected?.type === "soldProperty"
        ? selected.item.streetAddress
        : "";

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title={title}>
      {selected ? (
        <p className="mb-4 text-sm text-[#64748b]">Double click a field to edit it. Changes save when the field loses focus.</p>
      ) : null}
      {selected?.type === "person" ? (
        <PersonDetails
          person={selected.item}
          source={selected.source}
          onChange={(person) => onSelectedChange({ type: "person", item: person, source: selected.source })}
          onAuditResult={onPersonAuditResult}
          onDeleted={() => {
            onSelectedChange(null);
            refresh();
          }}
          refresh={refresh}
        />
      ) : null}
      {selected?.type === "soldProperty" ? (
        <SoldPropertyDetails
          soldProperty={selected.item}
          onChange={(soldProperty) => onSelectedChange({ type: "soldProperty", item: soldProperty })}
          onDeleted={() => {
            onSelectedChange(null);
            refresh();
          }}
          refresh={refresh}
        />
      ) : null}
    </AppDialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-md border border-[#e2e8f0] p-3">
      <dt className="text-xs font-semibold uppercase text-[#64748b]">{label}</dt>
      <dd className="mt-1 break-words text-sm text-[#111827]">{value ?? "Not set"}</dd>
    </div>
  );
}

function EditableDetailRow({
  label,
  value,
  inputType = "text",
  onSave,
}: {
  label: string;
  value: string | number | null;
  inputType?: "text" | "email" | "number" | "date";
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value?.toString() ?? "");
    }
  }, [editing, value]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Change could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-md border border-[#e2e8f0] p-3"
      onDoubleClick={() => setEditing(true)}
      title="Double click to edit"
    >
      <dt className="text-xs font-semibold uppercase text-[#64748b]">{label}</dt>
      <dd className="mt-1 break-words text-sm text-[#111827]">
        {editing ? (
          <input
            autoFocus
            type={inputType}
            value={draft}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void save()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setDraft(value?.toString() ?? "");
                setEditing(false);
              }
            }}
            className={inputClass}
          />
        ) : (
          value ?? "Not set"
        )}
      </dd>
      {error ? <p className={errorClass}>{error}</p> : null}
    </div>
  );
}

function optionalNumberFromDraft(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function personPayload(person: PersonRecord) {
  return {
    name: person.name,
    phone: person.phone,
    email: person.email,
    purchasingPowerMin: person.purchasingPowerMin,
    purchasingPowerMax: person.purchasingPowerMax,
    addresses: person.addresses.map((address) => ({
      id: address.id > 0 ? address.id : undefined,
      streetAddress: address.streetAddress,
      suburb: address.suburb,
      latitude: address.latitude,
      longitude: address.longitude,
    })),
  };
}

function soldPropertyPayload(soldProperty: SoldPropertyRecord) {
  return {
    streetAddress: soldProperty.streetAddress,
    suburb: soldProperty.suburb,
    lastSoldDate: soldProperty.lastSoldDate,
    soldPrice: soldProperty.soldPrice,
    latitude: soldProperty.latitude,
    longitude: soldProperty.longitude,
  };
}

async function requestJson<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Change could not be saved.");
  }
  return payload as T;
}

function PersonDetails({
  person,
  source,
  onChange,
  onAuditResult,
  onDeleted,
  refresh,
}: {
  person: PersonRecord;
  source: "manager" | "map";
  onChange: (person: PersonRecord) => void;
  onAuditResult: (result: PersonCoordinateAuditResult) => void;
  onDeleted: () => void;
  refresh: () => void;
}) {
  const [retryingGeocode, setRetryingGeocode] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<string | null>(null);
  const [draftAddress, setDraftAddress] = useState<{
    streetAddress: string;
    suburb: string;
    latitude: string;
    longitude: string;
  } | null>(null);
  const [draftAddressError, setDraftAddressError] = useState<string | null>(null);

  async function savePerson(next: PersonRecord) {
    const payload = await requestJson<{ person: PersonRecord }>("/api/people", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: person.id, selectedAddressId: next.addressId, ...personPayload(next) }),
    });
    onChange(payload.person);
    refresh();
  }

  async function deletePerson() {
    if (!window.confirm(`Delete ${person.name}? This cannot be undone.`)) {
      return;
    }
    await requestJson<{ deleted: boolean }>(`/api/people?id=${person.id}`, { method: "DELETE" });
    onDeleted();
  }

  async function retrySelectedAddressGeocode() {
    if (!person.addressId) {
      return;
    }

    setRetryingGeocode(true);
    setGeocodeStatus(null);

    try {
      const payload = await requestJson<{ person: PersonRecord; audit: PersonCoordinateAuditResult }>(
        "/api/people/coordinates",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry", addressId: person.addressId }),
        },
      );
      onChange(payload.person);
      onAuditResult(payload.audit);
      refresh();
      setGeocodeStatus(
        payload.audit.status === "unverified"
          ? "GeoMaps could not confidently place this address."
          : "Coordinates refreshed from GeoMaps.",
      );
    } catch (error) {
      setGeocodeStatus(error instanceof Error ? error.message : "Coordinates could not be refreshed.");
    } finally {
      setRetryingGeocode(false);
    }
  }

  const selectedAddress =
    person.addresses.find((address) => address.id === person.addressId) ?? person.addresses[0] ?? null;
  const visibleAddresses =
    source === "manager" ? person.addresses : selectedAddress ? [selectedAddress] : [];

  function updateAddresses(
    nextAddresses: PersonAddressRecord[],
    nextAddressId: number | null = person.addressId,
  ) {
    return savePerson({
      ...person,
      addressId: nextAddressId ?? nextAddresses[0]?.id ?? null,
      addresses: nextAddresses,
    });
  }

  async function saveDraftAddress() {
    if (!draftAddress) {
      return;
    }

    const streetAddress = draftAddress.streetAddress.trim();
    const suburb = draftAddress.suburb.trim();
    if (!streetAddress || !suburb) {
      setDraftAddressError("Street address and suburb are required.");
      return;
    }

    const latitude = draftAddress.latitude.trim() ? Number(draftAddress.latitude.trim()) : null;
    const longitude = draftAddress.longitude.trim() ? Number(draftAddress.longitude.trim()) : null;
    if ((latitude === null) !== (longitude === null)) {
      setDraftAddressError("Latitude and longitude must be supplied together.");
      return;
    }
    if (latitude !== null && Number.isNaN(latitude)) {
      setDraftAddressError("Latitude must be a valid number.");
      return;
    }
    if (longitude !== null && Number.isNaN(longitude)) {
      setDraftAddressError("Longitude must be a valid number.");
      return;
    }

    setDraftAddressError(null);
    try {
      await updateAddresses(
        [
          ...person.addresses,
          {
            id: 0,
            personId: person.id,
            identityKey: "",
            streetAddress,
            suburb,
            latitude,
            longitude,
            createdAt: person.createdAt,
            updatedAt: person.updatedAt,
          },
        ],
        person.addressId,
      );
      setDraftAddress(null);
    } catch (error) {
      setDraftAddressError(error instanceof Error ? error.message : "Address could not be saved.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end gap-2">
        {source === "map" && person.addressId ? (
          <button
            type="button"
            onClick={() => void retrySelectedAddressGeocode()}
            disabled={retryingGeocode}
            className="grid h-10 w-10 place-items-center rounded-md border border-[#cbd5e1] text-[#334155] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7] disabled:cursor-wait disabled:opacity-60"
            title="Retry GeoMaps coordinates for this address"
          >
            <RefreshCw aria-hidden="true" size={16} className={retryingGeocode ? "animate-spin" : ""} />
            <span className="sr-only">Retry GeoMaps coordinates</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void deletePerson()}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#fecdca] px-3 py-2 text-sm font-semibold text-[#b42318] hover:bg-[#fff1f0] focus:outline-none focus:ring-2 focus:ring-[#b42318]"
        >
          <Trash2 aria-hidden="true" size={18} />
          Delete record
        </button>
      </div>
      {geocodeStatus ? <p className="text-sm text-[#475569]">{geocodeStatus}</p> : null}
      <dl className="grid gap-3 sm:grid-cols-2">
        <EditableDetailRow label="Name" value={person.name} onSave={(value) => savePerson({ ...person, name: value })} />
        <EditableDetailRow label="Phone" value={person.phone} onSave={(value) => savePerson({ ...person, phone: value })} />
        <EditableDetailRow label="Email" value={person.email} inputType="email" onSave={(value) => savePerson({ ...person, email: value })} />
        <EditableDetailRow
          label="Purchasing power min"
          value={person.purchasingPowerMin}
          inputType="number"
          onSave={(value) => savePerson({ ...person, purchasingPowerMin: optionalNumberFromDraft(value) })}
        />
        <EditableDetailRow
          label="Purchasing power max"
          value={person.purchasingPowerMax}
          inputType="number"
          onSave={(value) => savePerson({ ...person, purchasingPowerMax: optionalNumberFromDraft(value) })}
        />
        <DetailRow label="Last update" value={new Date(person.lastUpdatedAt).toLocaleString()} />
      </dl>
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#111827]">
            {source === "manager" ? `Addresses (${person.addresses.length})` : "Selected address"}
          </p>
          {source === "manager" ? (
            <button
              type="button"
              onClick={() => {
                setDraftAddress({ streetAddress: "", suburb: "", latitude: "", longitude: "" });
                setDraftAddressError(null);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
            >
              <Plus aria-hidden="true" size={18} />
              Add address
            </button>
          ) : null}
        </div>
        {source === "manager" && draftAddress ? (
          <div className="rounded-md border border-dashed border-[#cbd5e1] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#111827]">New address</p>
              <button
                type="button"
                onClick={() => {
                  setDraftAddress(null);
                  setDraftAddressError(null);
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
              >
                Cancel
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Street address
                <input
                  className={inputClass}
                  value={draftAddress.streetAddress}
                  onChange={(event) =>
                    setDraftAddress((current) => (current ? { ...current, streetAddress: event.target.value } : current))
                  }
                />
              </label>
              <label className={labelClass}>
                Suburb
                <input
                  className={inputClass}
                  value={draftAddress.suburb}
                  onChange={(event) =>
                    setDraftAddress((current) => (current ? { ...current, suburb: event.target.value } : current))
                  }
                />
              </label>
              <label className={labelClass}>
                Latitude
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={draftAddress.latitude}
                  onChange={(event) =>
                    setDraftAddress((current) => (current ? { ...current, latitude: event.target.value } : current))
                  }
                />
              </label>
              <label className={labelClass}>
                Longitude
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={draftAddress.longitude}
                  onChange={(event) =>
                    setDraftAddress((current) => (current ? { ...current, longitude: event.target.value } : current))
                  }
                />
              </label>
            </div>
            {draftAddressError ? <p className={errorClass}>{draftAddressError}</p> : null}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void saveDraftAddress()}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#0056a7] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004780] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
              >
                Save address
              </button>
            </div>
          </div>
        ) : null}
        {visibleAddresses.map((address) => (
          <div key={address.id} className="rounded-md border border-[#e2e8f0] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#111827]">{address.streetAddress || "Address"}</p>
              {source === "manager" && person.addresses.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    void updateAddresses(
                      person.addresses.filter((item) => item.id !== address.id),
                      person.addressId === address.id
                        ? person.addresses.find((item) => item.id !== address.id)?.id ?? null
                        : person.addressId,
                    )
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#fecdca] px-3 py-2 text-sm font-semibold text-[#b42318] hover:bg-[#fff1f0] focus:outline-none focus:ring-2 focus:ring-[#b42318]"
                >
                  <Trash2 aria-hidden="true" size={18} />
                  Remove
                </button>
              ) : null}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <EditableDetailRow
                label="Street address"
                value={address.streetAddress}
                onSave={(value) =>
                  updateAddresses(
                    person.addresses.map((item) =>
                      item.id === address.id ? { ...item, streetAddress: value } : item,
                    ),
                  )
                }
              />
              <EditableDetailRow
                label="Suburb"
                value={address.suburb}
                onSave={(value) =>
                  updateAddresses(
                    person.addresses.map((item) =>
                      item.id === address.id ? { ...item, suburb: value } : item,
                    ),
                  )
                }
              />
              <EditableDetailRow
                label="Latitude"
                value={address.latitude}
                inputType="number"
                onSave={(value) =>
                  updateAddresses(
                    person.addresses.map((item) =>
                      item.id === address.id ? { ...item, latitude: optionalNumberFromDraft(value) } : item,
                    ),
                  )
                }
              />
              <EditableDetailRow
                label="Longitude"
                value={address.longitude}
                inputType="number"
                onSave={(value) =>
                  updateAddresses(
                    person.addresses.map((item) =>
                      item.id === address.id ? { ...item, longitude: optionalNumberFromDraft(value) } : item,
                    ),
                  )
                }
              />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function SoldPropertyDetails({
  soldProperty,
  onChange,
  onDeleted,
  refresh,
}: {
  soldProperty: SoldPropertyRecord;
  onChange: (soldProperty: SoldPropertyRecord) => void;
  onDeleted: () => void;
  refresh: () => void;
}) {
  async function saveSoldProperty(next: SoldPropertyRecord) {
    const payload = await requestJson<{ soldProperty: SoldPropertyRecord }>("/api/sold-properties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: soldProperty.id, ...soldPropertyPayload(next) }),
    });
    onChange(payload.soldProperty);
    refresh();
  }

  async function deleteSoldProperty() {
    if (!window.confirm(`Delete ${soldProperty.streetAddress}? This cannot be undone.`)) {
      return;
    }
    await requestJson<{ deleted: boolean }>(`/api/sold-properties?id=${soldProperty.id}`, { method: "DELETE" });
    onDeleted();
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void deleteSoldProperty()}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#fecdca] px-3 py-2 text-sm font-semibold text-[#b42318] hover:bg-[#fff1f0] focus:outline-none focus:ring-2 focus:ring-[#b42318]"
        >
          <Trash2 aria-hidden="true" size={18} />
          Delete sold property
        </button>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <EditableDetailRow
          label="Street address"
          value={soldProperty.streetAddress}
          onSave={(value) => saveSoldProperty({ ...soldProperty, streetAddress: value })}
        />
        <EditableDetailRow
          label="Suburb"
          value={soldProperty.suburb}
          onSave={(value) => saveSoldProperty({ ...soldProperty, suburb: value })}
        />
        <EditableDetailRow
          label="Last sold date"
          value={soldProperty.lastSoldDate}
          inputType="date"
          onSave={(value) => saveSoldProperty({ ...soldProperty, lastSoldDate: value })}
        />
        <EditableDetailRow
          label="Sold price"
          value={`$${soldProperty.soldPrice?.toLocaleString()}`}
          inputType="number"
          onSave={(value) => saveSoldProperty({ ...soldProperty, soldPrice: Number(value.slice(1)) })}
        />
        <EditableDetailRow
          label="Latitude"
          value={soldProperty.latitude}
          inputType="number"
          onSave={(value) => saveSoldProperty({ ...soldProperty, latitude: optionalNumberFromDraft(value) })}
        />
        <EditableDetailRow
          label="Longitude"
          value={soldProperty.longitude}
          inputType="number"
          onSave={(value) => saveSoldProperty({ ...soldProperty, longitude: optionalNumberFromDraft(value) })}
        />
        <DetailRow label="Updated" value={new Date(soldProperty.updatedAt).toLocaleString()} />
      </dl>
    </div>
  );
}
