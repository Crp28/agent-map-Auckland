"use client";

import dynamic from "next/dynamic";

const LocationFinderApp = dynamic(
  () => import("@/components/location-finder-app").then((mod) => mod.LocationFinderApp),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-dvh place-items-center bg-[#f6f8fb] text-[#111827]">
        <div className="rounded-md border border-[#cbd5e1] bg-white px-6 py-5 shadow-sm">
          Loading Auckland map...
        </div>
      </main>
    ),
  },
);

export function LocationFinderLoader() {
  return <LocationFinderApp />;
}
