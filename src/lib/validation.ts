import { z } from "zod";
import { toOptionalInteger, toOptionalNumber } from "./normalize";

const requiredText = (field: string) => z.string().trim().min(1, `${field} is required`);

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
    phone: requiredText("Phone"),
    email: requiredText("Email").email("Enter a valid email address"),
    purchasingPowerMin: optionalInteger,
    purchasingPowerMax: optionalInteger,
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
    streetAddress: requiredText("Street address"),
    suburb: requiredText("Suburb"),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
  })
  .refine((data) => (data.latitude === null) === (data.longitude === null), {
    message: "Latitude and longitude must be supplied together",
    path: ["latitude"],
  });

export const personFormSchema = personBaseSchema.extend({
  addresses: z.array(personAddressInputSchema).min(1, "At least one address is required"),
});

export const personInputSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  if (Array.isArray(candidate.addresses)) {
    return candidate;
  }

  return {
    name: candidate.name,
    phone: candidate.phone,
    email: candidate.email,
    purchasingPowerMin: candidate.purchasingPowerMin,
    purchasingPowerMax: candidate.purchasingPowerMax,
    addresses: [
      {
        streetAddress: candidate.streetAddress,
        suburb: candidate.suburb,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
      },
    ],
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
export type PersonInput = z.output<typeof personInputSchema>;
export type SoldPropertyInput = z.infer<typeof soldPropertyInputSchema>;
