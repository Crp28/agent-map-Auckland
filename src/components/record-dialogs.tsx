"use client";

import { AppDialog } from "@/components/ui/dialog";
import type { PersonRecord, SelectedItem, SoldPropertyRecord } from "@/types/location";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { personInputSchema, soldPropertyInputSchema } from "@/lib/validation";

type FormStatus = { type: "success" | "error"; message: string } | null;

const inputClass =
  "min-h-11 w-full rounded-md border border-[#cbd5e1] bg-white px-3 py-2 text-[#111827] outline-none focus:border-[#0056a7] focus:ring-2 focus:ring-[#0056a7]/20";
const labelClass = "text-sm font-medium text-[#334155]";
const errorClass = "mt-1 text-sm text-[#b42318]";

type DialogActions = {
  refresh: () => void;
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className={errorClass}>{message}</p> : null;
}

type PersonForm = z.input<typeof personInputSchema>;
type SoldPropertyForm = z.input<typeof soldPropertyInputSchema>;

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
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PersonForm>({
    resolver: zodResolver(personInputSchema),
    defaultValues: {
      purchasingPowerMin: "",
      purchasingPowerMax: "",
      latitude: "",
      longitude: "",
    },
  });

  async function onSubmit(values: PersonForm) {
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
            Phone
            <input className={inputClass} {...register("phone")} />
            <FieldError message={errors.phone?.message} />
          </label>
          <label className={labelClass}>
            Email
            <input className={inputClass} type="email" {...register("email")} />
            <FieldError message={errors.email?.message} />
          </label>
          <label className={labelClass}>
            Suburb
            <input className={inputClass} {...register("suburb")} />
            <FieldError message={errors.suburb?.message} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Street address
            <input className={inputClass} {...register("streetAddress")} />
            <FieldError message={errors.streetAddress?.message} />
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

export function DetailsDialog({
  selected,
  onOpenChange,
}: {
  selected: SelectedItem;
  onOpenChange: (open: boolean) => void;
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
      {selected?.type === "person" ? <PersonDetails person={selected.item} /> : null}
      {selected?.type === "soldProperty" ? (
        <SoldPropertyDetails soldProperty={selected.item} />
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

function PersonDetails({ person }: { person: PersonRecord }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <DetailRow label="Street address" value={person.streetAddress} />
      <DetailRow label="Suburb" value={person.suburb} />
      <DetailRow label="Phone" value={person.phone} />
      <DetailRow label="Email" value={person.email} />
      <DetailRow label="Power min" value={person.purchasingPowerMin} />
      <DetailRow label="Power max" value={person.purchasingPowerMax} />
      <DetailRow label="Latitude" value={person.latitude} />
      <DetailRow label="Longitude" value={person.longitude} />
      <DetailRow label="Last update" value={new Date(person.lastUpdatedAt).toLocaleString()} />
    </dl>
  );
}

function SoldPropertyDetails({ soldProperty }: { soldProperty: SoldPropertyRecord }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <DetailRow label="Street address" value={soldProperty.streetAddress} />
      <DetailRow label="Suburb" value={soldProperty.suburb} />
      <DetailRow label="Last sold date" value={soldProperty.lastSoldDate} />
      <DetailRow label="Sold price" value={`$${soldProperty.soldPrice.toLocaleString()}`} />
      <DetailRow label="Latitude" value={soldProperty.latitude} />
      <DetailRow label="Longitude" value={soldProperty.longitude} />
      <DetailRow label="Updated" value={new Date(soldProperty.updatedAt).toLocaleString()} />
    </dl>
  );
}
