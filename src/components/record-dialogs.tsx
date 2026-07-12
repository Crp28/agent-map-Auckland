"use client";

import { AppDialog } from "@/components/ui/dialog";
import { PropertyViewSwitch } from "@/components/property-view-switch";
import { displayPersonName } from "@/lib/person-display";
import {
  INTERACTION_TYPES,
  PERSON_NOTE_TYPES,
  type InteractionType,
  type PersonAddressRecord,
  type PersonInteractionRecord,
  type PersonNoteRecord,
  type PersonRecord,
  type PropertyRecord,
  type SelectedItem,
  type SoldPropertyRecord,
} from "@/types/location";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Plus, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { personFormSchema, personInputSchema, soldPropertyInputSchema } from "@/lib/validation";

type FormStatus = { type: "success" | "error"; message: string } | null;

const inputClass =
  "min-h-11 w-full rounded-md border border-[#cbd5e1] bg-white px-3 py-2 text-[#111827] outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20";
const labelClass = "text-sm font-medium text-[#334155]";
const errorClass = "mt-1 text-sm text-[#b42318]";

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultInteractionDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 6);
  return { from: dateInputValue(from), to: dateInputValue(to) };
}

function propertyOptionLabel(property: PropertyRecord) {
  return `${property.streetAddress}, ${property.suburb}`;
}

function propertyOptionSearchText(property: PropertyRecord) {
  return [property.streetAddress, property.suburb, property.type ?? "", String(property.id)].join(" ").toLowerCase();
}

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

type GeocodeFailureAddress = {
  addressId: number | null;
  streetAddress: string;
  suburb: string;
};

type PersonSaveResponse = {
  person: PersonRecord;
  geocodeFailures: GeocodeFailureAddress[];
  googleMapsFallbackAvailable: boolean;
};

type SoldPropertySaveResponse = {
  soldProperty: SoldPropertyRecord;
  geocodeFailure: GeocodeFailureAddress | null;
  googleMapsFallbackAvailable: boolean;
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className={errorClass}>{message}</p> : null;
}

function useGoogleFallbackPrompt() {
  const [prompt, setPrompt] = useState<{
    message: string;
    resolve: (accepted: boolean) => void;
  } | null>(null);

  const askGoogleFallback = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setPrompt({ message, resolve });
    });
  }, []);

  function closePrompt(accepted: boolean) {
    const currentPrompt = prompt;
    if (!currentPrompt) {
      return;
    }

    setPrompt(null);
    currentPrompt.resolve(accepted);
  }

  return {
    askGoogleFallback,
    googleFallbackPrompt: prompt ? (
      <div className="fixed inset-0 z-[80] grid place-items-center bg-black/30 p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="google-fallback-title"
          aria-describedby="google-fallback-description"
          className="w-[min(92vw,420px)] rounded-md border border-[#cbd5e1] bg-white p-4 shadow-xl"
        >
          <h3 id="google-fallback-title" className="text-base font-semibold text-[#111827]">
            Try Google Maps
          </h3>
          <p id="google-fallback-description" className="mt-2 text-sm leading-6 text-[#475569]">
            {prompt.message}
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => closePrompt(false)}
              className="inline-flex min-h-11 items-center rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
            >
              Skip
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => closePrompt(true)}
              className="inline-flex min-h-11 items-center rounded-md bg-[#0056a7] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004780] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
            >
              Try Google Maps
            </button>
          </div>
        </div>
      </div>
    ) : null,
  };
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
  const { askGoogleFallback, googleFallbackPrompt } = useGoogleFallbackPrompt();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<z.input<typeof personFormSchema>, unknown, z.output<typeof personFormSchema>>({
    resolver: zodResolver(personFormSchema),
    defaultValues: {
      name: "",
      preferredName: "",
      phone: "",
      email: "",
      purchasingPowerMin: "",
      purchasingPowerMax: "",
      notes: [],
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
  const {
    fields: noteFields,
    append: appendNote,
    remove: removeNote,
  } = useFieldArray({
    control,
    name: "notes",
  });

  async function onSubmit(values: z.output<typeof personInputSchema>) {
    setStatus(null);
    try {
      const payload = await requestJson<PersonSaveResponse>("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      let statusMessage = "Person saved.";
      if (payload.geocodeFailures.length > 0) {
        const fallbackResult = await applyGoogleFallbackToPerson(
          payload.person,
          payload.geocodeFailures,
          payload.googleMapsFallbackAvailable,
          askGoogleFallback,
          () => undefined,
          refresh,
        );
        if (fallbackResult.updatedCount > 0) {
          statusMessage = `Person saved. Google Maps supplied coordinates for ${fallbackResult.updatedCount} address${fallbackResult.updatedCount === 1 ? "" : "es"}.`;
        } else if (fallbackResult.declinedCount > 0) {
          statusMessage = "Person saved without some coordinates. Manual coordinate entry is still available.";
        } else if (fallbackResult.skippedCount > 0 || fallbackResult.failedCount > 0) {
          statusMessage = "Person saved without some coordinates. Manual coordinate entry is still available.";
        }
      }

      reset();
      refresh();
      setStatus({ type: "success", message: statusMessage });
    } catch {
      setStatus({ type: "error", message: "Person could not be saved. Check the fields." });
    }
  }

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title="Add person">
      {googleFallbackPrompt}
      <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Legal name
            <input className={inputClass} {...register("name")} />
            <FieldError message={errors.name?.message} />
          </label>
          <label className={labelClass}>
            Preferred first name (optional)
            <input className={inputClass} {...register("preferredName")} />
            <FieldError message={errors.preferredName?.message} />
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
            {fields.length === 0 ? (
              <div className="rounded-md border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3 text-sm text-[#475569]">
                No addresses saved. Add one now or save this person without an address.
              </div>
            ) : null}
            <div className="grid gap-4">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-md border border-[#e2e8f0] p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#111827]">Address {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#fecdca] px-3 py-2 text-sm font-semibold text-[#b42318] hover:bg-[#fff1f0] focus:outline-none focus:ring-2 focus:ring-[#b42318]"
                    >
                      <Trash2 aria-hidden="true" size={18} />
                      Remove
                    </button>
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
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className={labelClass}>Notes</p>
              <button
                type="button"
                onClick={() =>
                  appendNote({
                    type: "General Note",
                    content: "",
                  })
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
              >
                <Plus aria-hidden="true" size={18} />
                Add note
              </button>
            </div>
            <div className="grid gap-3">
              {noteFields.map((field, index) => (
                <div key={field.id} className="rounded-md border border-[#d0d5dd] bg-[#f8fafc] p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase text-[#475467]">Note {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeNote(index)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#fecdca] px-3 py-2 text-sm font-semibold text-[#b42318] hover:bg-[#fff1f0] focus:outline-none focus:ring-2 focus:ring-[#b42318]"
                    >
                      <Trash2 aria-hidden="true" size={18} />
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-3">
                    <label className={labelClass}>
                      Type
                      <select className={inputClass} {...register(`notes.${index}.type`)}>
                        {PERSON_NOTE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <FieldError message={errors.notes?.[index]?.type?.message} />
                    </label>
                    <label className={labelClass}>
                      Note
                      <textarea
                        rows={3}
                        className={`${inputClass} min-h-24 py-3`}
                        {...register(`notes.${index}.content`)}
                      />
                      <FieldError message={errors.notes?.[index]?.content?.message} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <FieldError message={errors.notes?.message as string | undefined} />
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
  const { askGoogleFallback, googleFallbackPrompt } = useGoogleFallbackPrompt();
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
    try {
      const payload = await requestJson<SoldPropertySaveResponse>("/api/sold-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      let statusMessage = "Sold property saved.";
      if (payload.geocodeFailure) {
        const fallbackResult = await applyGoogleFallbackToSoldProperty(
          payload.soldProperty,
          payload.geocodeFailure,
          payload.googleMapsFallbackAvailable,
          askGoogleFallback,
          () => undefined,
          refresh,
        );
        if (fallbackResult.updated) {
          statusMessage = "Sold property saved. Google Maps supplied coordinates.";
        } else if (fallbackResult.declined) {
          statusMessage = "Sold property saved without coordinates. Manual coordinate entry is still available.";
        } else if (fallbackResult.skipped || fallbackResult.failed) {
          statusMessage = "Sold property saved without coordinates. Manual coordinate entry is still available.";
        }
      }

      reset();
      refresh();
      setStatus({ type: "success", message: statusMessage });
    } catch {
      setStatus({ type: "error", message: "Sold property could not be saved." });
    }
  }

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title="Add sold property">
      {googleFallbackPrompt}
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
  onSwitchToProperties,
  refresh,
}: DialogActions & {
  type: RecordKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  onSelect: (record: ManagedRecord) => void;
  onSwitchToProperties?: () => void;
}) {
  const [records, setRecords] = useState<ManagedRecord[]>([]);
  const [status, setStatus] = useState<FormStatus>(null);
  const [personSearch, setPersonSearch] = useState("");
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

  const visibleRecords = useMemo(() => {
    if (type !== "person") {
      return records;
    }

    const normalizedQuery = personSearch.trim().toLowerCase();
    if (!normalizedQuery) {
      return records;
    }

    return records.filter((record) => {
      if (!("name" in record)) {
        return false;
      }

      return (
        record.name.toLowerCase().includes(normalizedQuery) ||
        displayPersonName(record).toLowerCase().includes(normalizedQuery)
      );
    });
  }, [personSearch, records, type]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setPersonSearch("");
    }
    onOpenChange(nextOpen);
  }

  async function deleteRecord(record: ManagedRecord) {
    const recordLabel = "name" in record ? displayPersonName(record) : record.streetAddress;
    if (!window.confirm(`Delete ${recordLabel}? This cannot be undone.`)) {
      return;
    }

    const response = await fetch(`${endpoint}?id=${record.id}`, { method: "DELETE" });
    if (!response.ok) {
      setStatus({ type: "error", message: `${recordLabel} could not be deleted.` });
      return;
    }

    setStatus({ type: "success", message: `${recordLabel} deleted.` });
    refresh();
    await loadRecords();
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      contentClassName={type === "soldProperty" ? "flex h-[min(88dvh,760px)] flex-col overflow-hidden" : ""}
      bodyClassName={type === "soldProperty" ? "min-h-0 flex-1 overflow-hidden" : ""}
    >
      <div className={type === "soldProperty" ? "flex h-full min-h-0 flex-col gap-4" : "grid gap-4"}>
        {type === "soldProperty" && onSwitchToProperties ? (
          <PropertyViewSwitch active="soldProperties" onShowProperties={onSwitchToProperties} />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <p className="text-sm text-[#475569]">
              {type === "person" && personSearch.trim()
                ? `${visibleRecords.length} of ${records.length} records`
                : `${records.length} records`}
            </p>
            {type === "person" ? (
              <label className="relative block max-w-sm">
                <span className="sr-only">Search people by name</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]"
                  size={18}
                />
                <input
                  value={personSearch}
                  onChange={(event) => setPersonSearch(event.target.value)}
                  className="min-h-11 w-full rounded-md border border-[#cbd5e1] bg-white pl-10 pr-3 text-sm text-[#111827] outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20"
                  placeholder="Search by name"
                />
              </label>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#0056a7] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004780] focus:outline-none focus:ring-2 focus:ring-[#0056a7] sm:justify-self-end"
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
        <div
          className={
            type === "person"
              ? "h-[min(448px,56dvh)] overflow-auto rounded-md border border-[#e2e8f0]"
              : "min-h-0 flex-1 overflow-auto overscroll-contain rounded-md border border-[#e2e8f0]"
          }
        >
          {visibleRecords.map((record) => {
            const isPerson = "name" in record;
            const titleText = isPerson ? displayPersonName(record) : record.streetAddress;
            const subtitle = isPerson
              ? record.streetAddress && record.suburb
                ? `${record.streetAddress}, ${record.suburb}`
                : "No address saved"
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
          {visibleRecords.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[#64748b]">
              {records.length === 0 ? "No records yet." : "No people match that name."}
            </p>
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
      ? displayPersonName(selected.item)
      : selected?.type === "soldProperty"
        ? selected.item.streetAddress
        : "";

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title={title}>
      {selected ? (
        <p className="mb-4 text-sm text-[#64748b]">Double click a field to edit it. Most changes save when the field loses focus. Coordinate pairs use Save.</p>
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

export function EditableCoordinatePairRow({
  latitude,
  longitude,
  onSave,
}: {
  latitude: number | null;
  longitude: number | null;
  onSave: (coordinates: { latitude: number | null; longitude: number | null }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftLatitude, setDraftLatitude] = useState(latitude?.toString() ?? "");
  const [draftLongitude, setDraftLongitude] = useState(longitude?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraftLatitude(latitude?.toString() ?? "");
      setDraftLongitude(longitude?.toString() ?? "");
    }
  }, [editing, latitude, longitude]);

  async function save() {
    const nextLatitude = optionalNumberFromDraft(draftLatitude);
    const nextLongitude = optionalNumberFromDraft(draftLongitude);

    if ((nextLatitude === null) !== (nextLongitude === null)) {
      setError("Latitude and longitude must be supplied together.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        latitude: nextLatitude,
        longitude: nextLongitude,
      });
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Change could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-md border border-[#e2e8f0] p-3 sm:col-span-2"
      onDoubleClick={() => setEditing(true)}
      title="Double click to edit"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-[#64748b]">Coordinates</p>
        {editing ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftLatitude(latitude?.toString() ?? "");
                setDraftLongitude(longitude?.toString() ?? "");
                setError(null);
                setEditing(false);
              }}
              className="inline-flex min-h-11 items-center rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex min-h-11 items-center rounded-md bg-[#0056a7] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004780] focus:outline-none focus:ring-2 focus:ring-[#0056a7] disabled:opacity-60"
            >
              Save coordinates
            </button>
          </div>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase text-[#64748b]">Latitude</dt>
          {editing ? (
            <input
              autoFocus
              inputMode="decimal"
              value={draftLatitude}
              disabled={saving}
              onChange={(event) => setDraftLatitude(event.target.value)}
              className={`${inputClass} mt-1`}
            />
          ) : (
            <dd className="mt-1 break-words text-sm text-[#111827]">{latitude ?? "Not set"}</dd>
          )}
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#64748b]">Longitude</dt>
          {editing ? (
            <input
              inputMode="decimal"
              value={draftLongitude}
              disabled={saving}
              onChange={(event) => setDraftLongitude(event.target.value)}
              className={`${inputClass} mt-1`}
            />
          ) : (
            <dd className="mt-1 break-words text-sm text-[#111827]">{longitude ?? "Not set"}</dd>
          )}
        </div>
      </div>
      {error ? <p className={errorClass}>{error}</p> : null}
    </div>
  );
}

function notePayload(note: PersonNoteRecord) {
  return {
    id: note.id > 0 ? note.id : undefined,
    type: note.type,
    content: note.content,
  };
}

function personPayload(person: PersonRecord) {
  return {
    name: person.name,
    preferredName: person.preferredName ?? "",
    phone: person.phone,
    email: person.email,
    purchasingPowerMin: person.purchasingPowerMin,
    purchasingPowerMax: person.purchasingPowerMax,
    notes: person.notes.map(notePayload),
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

function persistedAddressId(addressId: number | null | undefined) {
  return typeof addressId === "number" && addressId > 0 ? addressId : null;
}

async function requestGoogleFallbackCoordinates(streetAddress: string, suburb: string) {
  const payload = await requestJson<{
    result: { latitude: number; longitude: number; matchedAddress: string | null };
  }>("/api/geocode/google-fallback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ streetAddress, suburb }),
  });

  return payload.result;
}

async function applyGoogleFallbackToPerson(
  person: PersonRecord,
  geocodeFailures: GeocodeFailureAddress[],
  googleMapsFallbackAvailable: boolean,
  askGoogleFallback: (message: string) => Promise<boolean>,
  onPersonChange: (person: PersonRecord) => void,
  refresh: () => void,
) {
  let currentPerson = person;
  let updatedCount = 0;
  let declinedCount = 0;
  let failedCount = 0;
  const skippedCount = 0;

  if (!googleMapsFallbackAvailable) {
    return {
      person: currentPerson,
      updatedCount,
      declinedCount,
      failedCount,
      skippedCount: geocodeFailures.length,
    };
  }

  for (const failure of geocodeFailures) {
    const shouldTryGoogle = await askGoogleFallback(
      `GeoMaps could not find coordinates for ${failure.streetAddress}, ${failure.suburb}. Try Google Maps fallback?`,
    );
    if (!shouldTryGoogle) {
      declinedCount += 1;
      continue;
    }

    try {
      const fallback = await requestGoogleFallbackCoordinates(failure.streetAddress, failure.suburb);
      const nextPerson: PersonRecord = {
        ...currentPerson,
        addresses: currentPerson.addresses.map((address) =>
          address.id === failure.addressId
            ? {
                ...address,
                latitude: fallback.latitude,
                longitude: fallback.longitude,
              }
            : address,
        ),
      };

      const payload = await requestJson<PersonSaveResponse>("/api/people", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentPerson.id,
          selectedAddressId: persistedAddressId(nextPerson.addressId),
          ...personPayload(nextPerson),
        }),
      });
      currentPerson = payload.person;
      onPersonChange(currentPerson);
      refresh();
      updatedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return { person: currentPerson, updatedCount, declinedCount, failedCount, skippedCount };
}

async function applyGoogleFallbackToSoldProperty(
  soldProperty: SoldPropertyRecord,
  geocodeFailure: GeocodeFailureAddress | null,
  googleMapsFallbackAvailable: boolean,
  askGoogleFallback: (message: string) => Promise<boolean>,
  onSoldPropertyChange: (soldProperty: SoldPropertyRecord) => void,
  refresh: () => void,
) {
  if (!geocodeFailure) {
    return { soldProperty, updated: false, declined: false, failed: false, skipped: false };
  }

  if (!googleMapsFallbackAvailable) {
    return { soldProperty, updated: false, declined: false, failed: false, skipped: true };
  }

  const shouldTryGoogle = await askGoogleFallback(
    `GeoMaps could not find coordinates for ${geocodeFailure.streetAddress}, ${geocodeFailure.suburb}. Try Google Maps fallback?`,
  );
  if (!shouldTryGoogle) {
    return { soldProperty, updated: false, declined: true, failed: false, skipped: false };
  }

  try {
    const fallback = await requestGoogleFallbackCoordinates(geocodeFailure.streetAddress, geocodeFailure.suburb);
    const nextSoldProperty = {
      ...soldProperty,
      latitude: fallback.latitude,
      longitude: fallback.longitude,
    };

    const payload = await requestJson<SoldPropertySaveResponse>("/api/sold-properties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: soldProperty.id, ...soldPropertyPayload(nextSoldProperty) }),
    });
    onSoldPropertyChange(payload.soldProperty);
    refresh();
    return { soldProperty: payload.soldProperty, updated: true, declined: false, failed: false, skipped: false };
  } catch {
    return { soldProperty, updated: false, declined: false, failed: true, skipped: false };
  }
}

async function requestJson<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Change could not be saved.");
  }
  return payload as T;
}

function EditablePersonNote({
  note,
  onSave,
  onDelete,
}: {
  note: PersonNoteRecord;
  onSave: (nextNote: PersonNoteRecord) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftType, setDraftType] = useState(note.type);
  const [draftContent, setDraftContent] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftType(note.type);
    setDraftContent(note.content);
  }, [note.content, note.type]);

  async function save() {
    const content = draftContent.trim();
    if (!content) {
      setError("Note is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...note,
        type: draftType,
        content,
      });
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Note could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      await onDelete();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Note could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-[#d0d5dd] bg-[#f5f5f7] p-3">
      {editing ? (
        <div className="grid gap-3">
          <label className={labelClass}>
            Type
            <select
              className={inputClass}
              value={draftType}
              disabled={saving}
              onChange={(event) => setDraftType(event.target.value as PersonNoteRecord["type"])}
            >
              {PERSON_NOTE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Note
            <textarea
              rows={3}
              className={`${inputClass} min-h-24 py-3`}
              value={draftContent}
              disabled={saving}
              onChange={(event) => setDraftContent(event.target.value)}
            />
          </label>
          {error ? <p className={errorClass}>{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftType(note.type);
                setDraftContent(note.content);
                setError(null);
                setEditing(false);
              }}
              className="inline-flex min-h-11 items-center rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex min-h-11 items-center rounded-md bg-[#0056a7] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004780] focus:outline-none focus:ring-2 focus:ring-[#0056a7] disabled:opacity-60"
            >
              Save note
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#344054]">{note.type}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#1f2937]">{note.content}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex min-h-11 items-center rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void remove()}
                className="inline-flex min-h-11 items-center rounded-md border border-[#fecdca] px-3 py-2 text-sm font-semibold text-[#b42318] hover:bg-[#fff1f0] focus:outline-none focus:ring-2 focus:ring-[#b42318] disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </div>
          {error ? <p className={errorClass}>{error}</p> : null}
        </div>
      )}
    </div>
  );
}

function InteractionPropertyPicker({
  properties,
  selectedPropertyId,
  query,
  disabled,
  onQueryChange,
  onSelect,
}: {
  properties: PropertyRecord[];
  selectedPropertyId: string;
  query: string;
  disabled: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (propertyId: string, query: string) => void;
}) {
  const searchQuery = query.trim().toLowerCase();
  const selectedProperty =
    selectedPropertyId.trim() === ""
      ? null
      : properties.find((property) => String(property.id) === selectedPropertyId) ?? null;
  const filteredProperties = useMemo(() => {
    if (!searchQuery) {
      return [];
    }

    const terms = searchQuery.split(/\s+/).filter(Boolean);
    return properties
      .filter((property) => {
        const searchText = propertyOptionSearchText(property);
        return terms.every((term) => searchText.includes(term));
      })
      .slice(0, 12);
  }, [properties, searchQuery]);

  return (
    <div className="grid gap-2 sm:col-span-3">
      <label className={labelClass} htmlFor="interaction-property-search">
        Property (optional)
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]"
        />
        <input
          id="interaction-property-search"
          type="search"
          autoComplete="off"
          disabled={disabled}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search address, suburb, type, or property id"
          className={`${inputClass} pl-10`}
        />
      </div>
      <div className="flex min-h-8 flex-wrap items-center gap-2 text-xs text-[#64748b]">
        {selectedProperty ? (
          <>
            <span className="rounded-md bg-[#e0f2fe] px-2 py-1 font-medium text-[#0c4a6e]">
              Linked: {propertyOptionLabel(selectedProperty)}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect("", "")}
              className="rounded-md border border-[#cbd5e1] px-2 py-1 font-semibold text-[#334155] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#0056a7] disabled:opacity-60"
            >
              Clear
            </button>
          </>
        ) : query.trim() ? (
          <span>Select a matching row below to link a Property.</span>
        ) : (
          <span>Leave blank for no linked Property.</span>
        )}
      </div>
      {searchQuery ? (
        <div className="max-h-56 overflow-auto rounded-md border border-[#dbe3ed] bg-white shadow-sm">
          {filteredProperties.length > 0 ? (
            <div className="divide-y divide-[#e2e8f0]">
              {filteredProperties.map((property) => (
                <button
                  key={property.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(String(property.id), propertyOptionLabel(property))}
                  className="block min-h-11 w-full px-3 py-2 text-left hover:bg-[#eef3f8] focus:bg-[#eef3f8] focus:outline-none disabled:opacity-60"
                >
                  <span className="block text-sm font-semibold text-[#111827]">
                    {property.streetAddress}
                  </span>
                  <span className="block text-xs text-[#64748b]">
                    {property.suburb}
                    {property.type ? ` · ${property.type}` : ""} · Property #{property.id}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-3 text-sm text-[#64748b]">No matching properties.</p>
          )}
        </div>
      ) : null}
      {searchQuery && filteredProperties.length === 12 ? (
        <p className="text-xs text-[#64748b]">Showing the first 12 matches. Type more to narrow the list.</p>
      ) : null}
    </div>
  );
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
  const [interactionRange, setInteractionRange] = useState(defaultInteractionDateRange);
  const [interactions, setInteractions] = useState<PersonInteractionRecord[] | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [interactionRefreshKey, setInteractionRefreshKey] = useState(0);
  const [interactionProperties, setInteractionProperties] = useState<PropertyRecord[]>([]);
  const [draftInteraction, setDraftInteraction] = useState<{
    interactionType: InteractionType;
    interactionDate: string;
    propertyId: string;
  } | null>(null);
  const [interactionPropertyQuery, setInteractionPropertyQuery] = useState("");
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [retryingGeocode, setRetryingGeocode] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<string | null>(null);
  const { askGoogleFallback, googleFallbackPrompt } = useGoogleFallbackPrompt();
  const [draftAddress, setDraftAddress] = useState<{
    streetAddress: string;
    suburb: string;
    latitude: string;
    longitude: string;
  } | null>(null);
  const [draftAddressError, setDraftAddressError] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<{
    type: PersonNoteRecord["type"];
    content: string;
  } | null>(null);
  const [draftNoteError, setDraftNoteError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      personId: String(person.id),
      from: interactionRange.from,
      to: interactionRange.to,
    });

    fetch(`/api/interactions?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { interactions?: PersonInteractionRecord[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Interactions could not be loaded.");
        }
        return payload.interactions ?? [];
      })
      .then((nextInteractions) => {
        setInteractions(nextInteractions);
        setInteractionError(null);
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setInteractions([]);
        setInteractionError(loadError instanceof Error ? loadError.message : "Interactions could not be loaded.");
      });

    return () => controller.abort();
  }, [interactionRange.from, interactionRange.to, interactionRefreshKey, person.id]);

  async function openInteractionDraft() {
    setInteractionError(null);
    if (interactionProperties.length === 0) {
      try {
        const response = await fetch("/api/properties");
        const payload = (await response.json()) as { properties?: PropertyRecord[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Properties could not be loaded.");
        }
        setInteractionProperties(payload.properties ?? []);
      } catch (loadError) {
        setInteractionError(loadError instanceof Error ? loadError.message : "Properties could not be loaded.");
        return;
      }
    }

    setDraftInteraction({
      interactionType: "enquiry",
      interactionDate: dateInputValue(new Date()),
      propertyId: "",
    });
    setInteractionPropertyQuery("");
  }

  async function saveDraftInteraction() {
    if (!draftInteraction) {
      return;
    }

    setSavingInteraction(true);
    setInteractionError(null);
    try {
      await requestJson<{ interaction: PersonInteractionRecord }>("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: person.id,
          propertyId: draftInteraction.propertyId || null,
          interactionType: draftInteraction.interactionType,
          interactionDate: draftInteraction.interactionDate,
        }),
      });
      setDraftInteraction(null);
      setInteractionPropertyQuery("");
      setInteractionRefreshKey((value) => value + 1);
      refresh();
    } catch (saveError) {
      setInteractionError(saveError instanceof Error ? saveError.message : "Interaction could not be saved.");
    } finally {
      setSavingInteraction(false);
    }
  }

  async function savePerson(next: PersonRecord) {
    const payload = await requestJson<PersonSaveResponse>("/api/people", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: person.id,
        selectedAddressId: persistedAddressId(next.addressId),
        ...personPayload(next),
      }),
    });
    onChange(payload.person);
    refresh();
    if (payload.geocodeFailures.length > 0) {
      const fallbackResult = await applyGoogleFallbackToPerson(
        payload.person,
        payload.geocodeFailures,
        payload.googleMapsFallbackAvailable,
        askGoogleFallback,
        onChange,
        refresh,
      );
      if (fallbackResult.updatedCount > 0) {
        setGeocodeStatus(
          `GeoMaps missed ${fallbackResult.updatedCount} address${fallbackResult.updatedCount === 1 ? "" : "es"}. Google Maps supplied the coordinates.`,
        );
      } else if (fallbackResult.declinedCount > 0) {
        setGeocodeStatus("GeoMaps could not place this address. You can still enter coordinates manually.");
      } else if (fallbackResult.skippedCount > 0) {
        setGeocodeStatus("GeoMaps could not place this address. You can still enter coordinates manually.");
      } else if (fallbackResult.failedCount > 0) {
        setGeocodeStatus("Google Maps could not place this address. You can still enter coordinates manually.");
      } else {
        setGeocodeStatus(null);
      }
      return;
    }
    setGeocodeStatus(null);
  }

  async function deletePerson() {
    if (!window.confirm(`Delete ${displayPersonName(person)}? This cannot be undone.`)) {
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
    const persistedNextAddressId =
      persistedAddressId(nextAddressId) ?? nextAddresses.find((address) => address.id > 0)?.id ?? null;

    return savePerson({
      ...person,
      addressId: persistedNextAddressId,
      addresses: nextAddresses,
    });
  }

  function updateNotes(nextNotes: PersonNoteRecord[]) {
    return savePerson({
      ...person,
      notes: nextNotes,
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

  async function saveDraftNote() {
    if (!draftNote) {
      return;
    }

    const content = draftNote.content.trim();
    if (!content) {
      setDraftNoteError("Note is required.");
      return;
    }

    setDraftNoteError(null);
    try {
      await updateNotes([
        ...person.notes,
        {
          id: 0,
          personId: person.id,
          type: draftNote.type,
          content,
          createdAt: person.createdAt,
          updatedAt: person.updatedAt,
        },
      ]);
      setDraftNote(null);
    } catch (error) {
      setDraftNoteError(error instanceof Error ? error.message : "Note could not be saved.");
    }
  }

  return (
    <div className="grid gap-4">
      {googleFallbackPrompt}
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
        <EditableDetailRow label="Legal name" value={person.name} onSave={(value) => savePerson({ ...person, name: value })} />
        <EditableDetailRow label="Preferred first name" value={person.preferredName} onSave={(value) => savePerson({ ...person, preferredName: value.trim() || null })} />
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
              {source === "manager" ? (
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
              <EditableCoordinatePairRow
                latitude={address.latitude}
                longitude={address.longitude}
                onSave={(coordinates) =>
                  updateAddresses(
                    person.addresses.map((item) =>
                      item.id === address.id ? { ...item, ...coordinates } : item,
                    ),
                  )
                }
              />
            </dl>
          </div>
        ))}
        {visibleAddresses.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3 text-sm text-[#475569]">
            No addresses saved. Add an address when one is available.
          </div>
        ) : null}
      </div>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="pb-2 text-sm font-semibold text-[#111827]">
            Interactions ({interactions?.length ?? 0})
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-[#475569]">
              From
              <input
                type="date"
                value={interactionRange.from}
                onChange={(event) =>
                  setInteractionRange((current) => ({ ...current, from: event.target.value }))
                }
                className="mt-1 min-h-11 rounded-md border border-[#cbd5e1] px-2 text-sm outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20"
              />
            </label>
            <label className="text-xs font-medium text-[#475569]">
              To
              <input
                type="date"
                value={interactionRange.to}
                onChange={(event) =>
                  setInteractionRange((current) => ({ ...current, to: event.target.value }))
                }
                className="mt-1 min-h-11 rounded-md border border-[#cbd5e1] px-2 text-sm outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20"
              />
            </label>
            <button
              type="button"
              onClick={() => void openInteractionDraft()}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
            >
              <Plus aria-hidden="true" size={18} />
              Add interaction
            </button>
          </div>
        </div>

        {draftInteraction ? (
          <div className="rounded-md border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#111827]">New interaction</p>
              <button
                type="button"
                disabled={savingInteraction}
                onClick={() => {
                  setDraftInteraction(null);
                  setInteractionPropertyQuery("");
                }}
                className="min-h-11 rounded-md border border-[#cbd5e1] px-3 text-sm font-semibold text-[#111827] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#0056a7] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={labelClass}>
                Type
                <select
                  value={draftInteraction.interactionType}
                  onChange={(event) =>
                    setDraftInteraction((current) =>
                      current ? { ...current, interactionType: event.target.value as InteractionType } : current,
                    )
                  }
                  className={inputClass}
                >
                  {INTERACTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Date
                <input
                  type="date"
                  required
                  value={draftInteraction.interactionDate}
                  onChange={(event) =>
                    setDraftInteraction((current) =>
                      current ? { ...current, interactionDate: event.target.value } : current,
                    )
                  }
                  className={inputClass}
                />
              </label>
              <InteractionPropertyPicker
                properties={interactionProperties}
                selectedPropertyId={draftInteraction.propertyId}
                query={interactionPropertyQuery}
                disabled={savingInteraction}
                onQueryChange={(query) => {
                  setInteractionPropertyQuery(query);
                  setDraftInteraction((current) => (current ? { ...current, propertyId: "" } : current));
                }}
                onSelect={(propertyId, query) => {
                  setInteractionPropertyQuery(query);
                  setDraftInteraction((current) => (current ? { ...current, propertyId } : current));
                }}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={savingInteraction || !draftInteraction.interactionDate}
                onClick={() => void saveDraftInteraction()}
                className="min-h-11 rounded-md bg-[#0056a7] px-3 text-sm font-semibold text-white hover:bg-[#004780] focus:outline-none focus:ring-2 focus:ring-[#0056a7] disabled:opacity-60"
              >
                {savingInteraction ? "Saving..." : "Save interaction"}
              </button>
            </div>
          </div>
        ) : null}

        {interactionError ? <p role="alert" className={errorClass}>{interactionError}</p> : null}
        {interactions === null ? (
          <p className="text-sm text-[#64748b]">Loading interactions...</p>
        ) : interactions.length > 0 ? (
          <div className="divide-y divide-[#e2e8f0] rounded-md border border-[#e2e8f0]">
            {interactions.map((interaction) => (
              <div key={interaction.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-3">
                <div>
                  <p className="text-sm font-semibold capitalize text-[#111827]">
                    {interaction.interactionType.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-[#64748b]">
                    {interaction.property
                      ? `${interaction.property.streetAddress}, ${interaction.property.suburb}`
                      : "No property linked"}
                  </p>
                </div>
                <time className="text-sm text-[#475569]">{interaction.interactionDate}</time>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#64748b]">No interactions in this date range.</p>
        )}
      </div>
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#111827]">Notes ({person.notes.length})</p>
          <button
            type="button"
            onClick={() => {
              setDraftNote({ type: "General Note", content: "" });
              setDraftNoteError(null);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
          >
            <Plus aria-hidden="true" size={18} />
            Add note
          </button>
        </div>
        {draftNote ? (
          <div className="rounded-md border border-dashed border-[#d0d5dd] bg-[#f5f5f7] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase text-[#475467]">New note</p>
              <button
                type="button"
                onClick={() => {
                  setDraftNote(null);
                  setDraftNoteError(null);
                }}
                className="inline-flex min-h-11 items-center rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
              >
                Cancel
              </button>
            </div>
            <div className="grid gap-3">
              <label className={labelClass}>
                Type
                <select
                  className={inputClass}
                  value={draftNote.type}
                  onChange={(event) =>
                    setDraftNote((current) =>
                      current ? { ...current, type: event.target.value as PersonNoteRecord["type"] } : current,
                    )
                  }
                >
                  {PERSON_NOTE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Note
                <textarea
                  rows={3}
                  className={`${inputClass} min-h-24 py-3`}
                  value={draftNote.content}
                  onChange={(event) =>
                    setDraftNote((current) =>
                      current ? { ...current, content: event.target.value } : current,
                    )
                  }
                />
              </label>
            </div>
            {draftNoteError ? <p className={errorClass}>{draftNoteError}</p> : null}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void saveDraftNote()}
                className="inline-flex min-h-11 items-center rounded-md bg-[#0056a7] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004780] focus:outline-none focus:ring-2 focus:ring-[#0056a7]"
              >
                Save note
              </button>
            </div>
          </div>
        ) : null}
        {person.notes.length > 0 ? (
          <div className="grid gap-3">
            {person.notes.map((note) => (
              <EditablePersonNote
                key={note.id}
                note={note}
                onSave={(nextNote) =>
                  updateNotes(person.notes.map((item) => (item.id === note.id ? nextNote : item)))
                }
                onDelete={() => updateNotes(person.notes.filter((item) => item.id !== note.id))}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#4b5563]">No notes saved.</p>
        )}
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
  const { askGoogleFallback, googleFallbackPrompt } = useGoogleFallbackPrompt();

  async function saveSoldProperty(next: SoldPropertyRecord) {
    const payload = await requestJson<SoldPropertySaveResponse>("/api/sold-properties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: soldProperty.id, ...soldPropertyPayload(next) }),
    });
    onChange(payload.soldProperty);
    refresh();
    if (payload.geocodeFailure) {
      await applyGoogleFallbackToSoldProperty(
        payload.soldProperty,
        payload.geocodeFailure,
        payload.googleMapsFallbackAvailable,
        askGoogleFallback,
        onChange,
        refresh,
      );
    }
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
      {googleFallbackPrompt}
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
        <EditableCoordinatePairRow
          latitude={soldProperty.latitude}
          longitude={soldProperty.longitude}
          onSave={(coordinates) => saveSoldProperty({ ...soldProperty, ...coordinates })}
        />
        <DetailRow label="Updated" value={new Date(soldProperty.updatedAt).toLocaleString()} />
      </dl>
    </div>
  );
}
