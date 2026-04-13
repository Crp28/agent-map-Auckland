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

export const personInputSchema = z
  .object({
    name: requiredText("Name"),
    streetAddress: requiredText("Street address"),
    suburb: requiredText("Suburb"),
    phone: requiredText("Phone"),
    email: requiredText("Email").email("Enter a valid email address"),
    purchasingPowerMin: optionalInteger,
    purchasingPowerMax: optionalInteger,
    latitude: optionalLatitude,
    longitude: optionalLongitude,
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
  )
  .refine((data) => (data.latitude === null) === (data.longitude === null), {
    message: "Latitude and longitude must be supplied together",
    path: ["latitude"],
  });

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

export type PersonInput = z.infer<typeof personInputSchema>;
export type SoldPropertyInput = z.infer<typeof soldPropertyInputSchema>;
