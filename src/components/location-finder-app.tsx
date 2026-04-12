"use client";

export function LocationFinderApp() {
  return (
    <main className="min-h-dvh bg-[#f6f8fb] text-[#111827]">
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="max-w-xl rounded-md border border-[#cbd5e1] bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase text-[#0056a7]">Location Finder</p>
          <h1 className="mt-3 text-3xl font-semibold">Auckland property map scaffold</h1>
          <p className="mt-3 leading-7 text-[#334155]">
            The app scaffold is ready. The database, GeoMaps sync, search, forms, CSV import, and
            map graphics will be layered into this shell in the next feature slices.
          </p>
        </div>
      </div>
    </main>
  );
}
