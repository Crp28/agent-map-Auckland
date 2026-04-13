export type PersonRecord = {
  id: number;
  name: string;
  streetAddress: string;
  suburb: string;
  phone: string;
  email: string;
  purchasingPowerMin: number | null;
  purchasingPowerMax: number | null;
  latitude: number | null;
  longitude: number | null;
  lastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
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
  | { type: "person"; item: PersonRecord }
  | { type: "soldProperty"; item: SoldPropertyRecord }
  | null;
