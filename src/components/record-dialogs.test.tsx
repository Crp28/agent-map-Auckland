import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddPersonDialog, EditableCoordinatePairRow } from "./record-dialogs";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function personPayload(googleMapsFallbackAvailable: boolean) {
  return {
    person: {
      id: 1,
      personKey: "ana-buyer",
      name: "Ana Buyer",
      preferredName: null,
      addressId: 10,
      streetAddress: "2/5 Keys Street",
      suburb: "Belmont",
      phone: "021 000 000",
      email: "",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      latitude: null,
      longitude: null,
      notes: [],
      addresses: [
        {
          id: 10,
          personId: 1,
          identityKey: "ana-buyer-keys",
          streetAddress: "2/5 Keys Street",
          suburb: "Belmont",
          latitude: null,
          longitude: null,
          createdAt: "2026-06-04T00:00:00.000Z",
          updatedAt: "2026-06-04T00:00:00.000Z",
        },
      ],
      lastUpdatedAt: "2026-06-04T00:00:00.000Z",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
    },
    geocodeFailures: [
      {
        addressId: 10,
        streetAddress: "2/5 Keys Street",
        suburb: "Belmont",
      },
    ],
    googleMapsFallbackAvailable,
  };
}

function fillPersonForm() {
  fireEvent.change(screen.getByLabelText("Legal name"), { target: { value: "Ana Buyer" } });
  fireEvent.change(screen.getByLabelText("Phone (required if no email)"), { target: { value: "021 000 000" } });
  fireEvent.change(screen.getByLabelText("Street address"), { target: { value: "2/5 Keys Street" } });
  fireEvent.change(screen.getByLabelText("Suburb"), { target: { value: "Belmont" } });
}

describe("EditableCoordinatePairRow", () => {
  it("requires manual coordinates to be supplied as a pair", async () => {
    const onSave = vi.fn(async () => undefined);

    render(
      <dl>
        <EditableCoordinatePairRow latitude={null} longitude={null} onSave={onSave} />
      </dl>,
    );

    fireEvent.doubleClick(screen.getByTitle("Double click to edit"));
    fireEvent.change(screen.getAllByRole("textbox")[0]!, { target: { value: "-36.8" } });
    fireEvent.click(screen.getByRole("button", { name: "Save coordinates" }));

    await waitFor(() => {
      expect(screen.getByText("Latitude and longitude must be supplied together.")).toBeInTheDocument();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves manual coordinates together", async () => {
    const onSave = vi.fn(async () => undefined);

    render(
      <dl>
        <EditableCoordinatePairRow latitude={null} longitude={null} onSave={onSave} />
      </dl>,
    );

    fireEvent.doubleClick(screen.getByTitle("Double click to edit"));
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0]!, { target: { value: "-36.807894859646595" } });
    fireEvent.change(inputs[1]!, { target: { value: "174.78164046441768" } });
    fireEvent.click(screen.getByRole("button", { name: "Save coordinates" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        latitude: -36.807894859646595,
        longitude: 174.78164046441768,
      });
    });
  });
});

describe("AddPersonDialog Google fallback prompt", () => {
  it("uses an in-app prompt instead of window.confirm when Google fallback is available", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(personPayload(true), 201));
    vi.stubGlobal("fetch", fetchMock);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<AddPersonDialog open onOpenChange={() => undefined} refresh={() => undefined} />);

    fillPersonForm();
    fireEvent.click(screen.getByRole("button", { name: "Save person" }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("GeoMaps could not find coordinates for 2/5 Keys Street, Belmont. Try Google Maps fallback?")).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    await waitFor(() => {
      expect(screen.getByText("Person saved without some coordinates. Manual coordinate entry is still available.")).toBeInTheDocument();
    });
  });

  it("does not show the fallback prompt when Google fallback is unavailable", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(personPayload(false), 201));
    vi.stubGlobal("fetch", fetchMock);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<AddPersonDialog open onOpenChange={() => undefined} refresh={() => undefined} />);

    fillPersonForm();
    fireEvent.click(screen.getByRole("button", { name: "Save person" }));

    await waitFor(() => {
      expect(screen.getByText("Person saved without some coordinates. Manual coordinate entry is still available.")).toBeInTheDocument();
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
