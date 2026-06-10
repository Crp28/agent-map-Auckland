export const PERSON_NOTE_TYPES = ["General Note", "Inspection", "Living"] as const;
export type PersonNoteType = (typeof PERSON_NOTE_TYPES)[number];

export type PersonAddressRecord = {
  id: number;
  personId: number;
  identityKey: string;
  streetAddress: string;
  suburb: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PersonNoteRecord = {
  id: number;
  personId: number;
  type: PersonNoteType;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type PersonRecord = {
  id: number;
  personKey: string;
  name: string;
  preferredName: string | null;
  addressId: number | null;
  streetAddress: string;
  suburb: string;
  phone: string;
  email: string;
  purchasingPowerMin: number | null;
  purchasingPowerMax: number | null;
  latitude: number | null;
  longitude: number | null;
  addresses: PersonAddressRecord[];
  notes: PersonNoteRecord[];
  lastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PersonCoordinateAuditResult = {
  personId: number;
  addressId: number;
  streetAddress: string;
  suburb: string;
  status: "ok" | "mismatch" | "unverified";
  matchedAddress: string | null;
  distanceKm: number | null;
};

export type PersonGoogleGeocodeResult = {
  personId: number;
  addressId: number;
  streetAddress: string;
  suburb: string;
  status: "mapped" | "not_found" | "failed" | "already_mapped";
  matchedAddress: string | null;
  error: string | null;
};

export type PersonOwnerAuditResult = {
  personId: number;
  addressId: number;
  streetAddress: string;
  suburb: string;
  status: "match" | "incomplete_name_match" | "mismatch" | "not_found" | "unverified" | "auth_expired";
  propertySmartsOwners: string[];
  matchedOwner: string | null;
};

export type SoldPropertyRecord = {
  id: number;
  streetAddress: string;
  suburb: string;
  lastSoldDate: string;
  soldPrice: number;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BoundaryRecord = {
  id: number;
  sourceObjectId: number;
  ward: string | null;
  board: string | null;
  subdivision: string;
  syncedAt: string;
  geometry: {
    rings?: number[][][];
  };
};

export type SuburbRegion = {
  key: string;
  name: string;
  area: string;
  boundarySubdivision: string;
  boundaryId?: number;
  center: [number, number];
};

export type SuburbMapTarget = {
  key: string;
  boundaryId?: number;
  center?: [number, number];
};

export type PointMapTarget = {
  key: string;
  center: [number, number];
  zoom: number;
};

export type SyncRecord = {
  sourceName: string;
  sourceUrl: string;
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  status: string;
  error: string | null;
};

export type MapData = {
  soldProperties: SoldPropertyRecord[];
  people: PersonRecord[];
  boundaries: BoundaryRecord[];
  sync: SyncRecord | null;
};

export type SearchResult =
  | {
      type: "person";
      id: number;
      title: string;
      subtitle: string;
      item: PersonRecord;
    }
  | {
      type: "soldProperty";
      id: number;
      title: string;
      subtitle: string;
      item: SoldPropertyRecord;
    };

export type SelectedItem =
  | { type: "person"; item: PersonRecord; source: "manager" | "map" }
  | { type: "soldProperty"; item: SoldPropertyRecord }
  | null;
