import { z } from "zod";
import { normalizeSuburbKey, normalizeText, toOptionalInteger, toOptionalNumber } from "./normalize";
import { INTERACTION_TYPES, PERSON_NOTE_TYPES } from "@/types/location";

const requiredText = (field: string) => z.string().trim().min(1, `${field} is required`);
const optionalText = z.preprocess(
  (value) => (value === undefined || value === null ? "" : value),
  z.string().trim(),
);
const emailFormatSchema = z.string().email("Enter a valid email address");
const optionalEmail = z.preprocess(
  (value) => (value === undefined || value === null ? "" : value),
  z
    .string()
    .trim()
    .refine((value) => value === "" || emailFormatSchema.safeParse(value).success, {
      message: "Enter a valid email address",
    }),
);

const optionalInteger = z.preprocess(
  toOptionalInteger,
  z.number().int().nonnegative("Enter a zero or positive integer").nullable(),
);

const optionalLatitude = z.preprocess(
  toOptionalNumber,
  z.number().min(-90, "Latitude must be at least -90").max(90, "Latitude must be at most 90").nullable(),
);

const optionalLongitude = z.preprocess(
  toOptionalNumber,
  z
    .number()
    .min(-180, "Longitude must be at least -180")
    .max(180, "Longitude must be at most 180")
    .nullable(),
);

const personBaseSchema = z
  .object({
    name: requiredText("Name"),
    preferredName: optionalText,
    phone: optionalText,
    email: optionalEmail,
    purchasingPowerMin: optionalInteger,
    purchasingPowerMax: optionalInteger,
  })
  .refine((data) => data.phone !== "" || data.email !== "", {
    message: "Enter phone or email",
    path: ["phone"],
  })
  .refine(
    (data) =>
      data.purchasingPowerMin === null ||
      data.purchasingPowerMax === null ||
      data.purchasingPowerMin <= data.purchasingPowerMax,
    {
      message: "Minimum power must be less than or equal to maximum power",
      path: ["purchasingPowerMin"],
    },
  );

export const personAddressInputSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    streetAddress: requiredText("Street address"),
    suburb: requiredText("Suburb"),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
  })
  .refine((data) => (data.latitude === null) === (data.longitude === null), {
    message: "Latitude and longitude must be supplied together",
    path: ["latitude"],
  });

export const personNoteInputSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  type: z.enum(PERSON_NOTE_TYPES),
  content: requiredText("Note"),
});

export const personFormSchema = personBaseSchema.extend({
  addresses: z.array(personAddressInputSchema).default([]),
  notes: z.array(personNoteInputSchema).default([]),
}).refine((data) => {
  const seen = new Set<string>();
  for (const address of data.addresses) {
    const key = `${normalizeText(address.streetAddress).toLowerCase()}|${normalizeSuburbKey(address.suburb)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
  }
  return true;
}, {
  message: "Duplicate addresses are not allowed",
  path: ["addresses"],
});

export const personInputSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  if (Array.isArray(candidate.addresses)) {
    return candidate;
  }

  const hasLegacyAddress =
    typeof candidate.streetAddress === "string" ||
    typeof candidate.suburb === "string" ||
    candidate.latitude !== undefined ||
    candidate.longitude !== undefined;

  return {
    name: candidate.name,
    preferredName: candidate.preferredName,
    phone: candidate.phone,
    email: candidate.email,
    purchasingPowerMin: candidate.purchasingPowerMin,
    purchasingPowerMax: candidate.purchasingPowerMax,
    notes: candidate.notes,
    addresses: hasLegacyAddress
      ? [
          {
            streetAddress: candidate.streetAddress,
            suburb: candidate.suburb,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
          },
        ]
      : [],
  };
}, personFormSchema);

export const soldPropertyInputSchema = z
  .object({
    streetAddress: requiredText("Street address"),
    suburb: requiredText("Suburb"),
    lastSoldDate: requiredText("Last sold date").refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Enter a valid last sold date",
    }),
    soldPrice: z.preprocess(
      (value) => Number(value),
      z.number().int().positive("Sold price must be greater than zero"),
    ),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
  })
  .refine((data) => (data.latitude === null) === (data.longitude === null), {
    message: "Latitude and longitude must be supplied together",
    path: ["latitude"],
  });

export const mapFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  price: z.preprocess(toOptionalInteger, z.number().int().nonnegative().nullable()).optional(),
});

export const searchSchema = z.object({
  q: z.string().trim().min(1),
  scope: z.enum(["people", "properties", "soldProperties"]).default("people"),
});

export const interactionInputSchema = z.object({
  personId: z.coerce.number().int().positive(),
  propertyId: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? null : value),
    z.coerce.number().int().positive().nullable(),
  ),
  interactionType: z.enum(INTERACTION_TYPES),
  interactionDate: requiredText("Interaction date").refine(
    (value) => !Number.isNaN(Date.parse(value)),
    { message: "Enter a valid interaction date" },
  ),
});

export const interactionFilterSchema = z.object({
  personId: z.coerce.number().int().positive(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const nearbySchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  distanceKm: z.coerce.number().positive().max(100).default(2),
  sameSuburb: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === "") {
        return true;
      }
      if (typeof value === "string") {
        return value === "true";
      }
      return value;
    }, z.boolean())
    .default(true),
});

export type PersonAddressInput = z.output<typeof personAddressInputSchema>;
export type PersonNoteInput = z.output<typeof personNoteInputSchema>;
export type PersonInput = z.output<typeof personInputSchema>;
export type SoldPropertyInput = z.infer<typeof soldPropertyInputSchema>;
export type InteractionInput = z.infer<typeof interactionInputSchema>;
