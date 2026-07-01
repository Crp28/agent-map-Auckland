import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddPersonDialog, DetailsDialog, EditableCoordinatePairRow, RecordManagerDialog } from "./record-dialogs";

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

function personRecord(id: number, name: string, streetAddress: string) {
  return {
    id,
    personKey: `person-${id}`,
    name,
    preferredName: null,
    addressId: id * 10,
    streetAddress,
    suburb: "Remuera",
    phone: "021 000 000",
    email: "",
    purchasingPowerMin: null,
    purchasingPowerMax: null,
    latitude: null,
    longitude: null,
    notes: [],
    addresses: [
      {
        id: id * 10,
        personId: id,
        identityKey: `person-${id}-address`,
        streetAddress,
        suburb: "Remuera",
        latitude: null,
        longitude: null,
        createdAt: "2026-06-16T00:00:00.000Z",
        updatedAt: "2026-06-16T00:00:00.000Z",
      },
    ],
    lastUpdatedAt: "2026-06-16T00:00:00.000Z",
    createdAt: "2026-06-16T00:00:00.000Z",
    updatedAt: "2026-06-16T00:00:00.000Z",
  };
}

function addresslessPersonRecord(id: number, name: string) {
  return {
    id,
    personKey: `person-${id}`,
    name,
    preferredName: null,
    addressId: null,
    streetAddress: "",
    suburb: "",
    phone: "021 000 000",
    email: "",
    purchasingPowerMin: null,
    purchasingPowerMax: null,
    latitude: null,
    longitude: null,
    notes: [],
    addresses: [],
    lastUpdatedAt: "2026-06-16T00:00:00.000Z",
    createdAt: "2026-06-16T00:00:00.000Z",
    updatedAt: "2026-06-16T00:00:00.000Z",
  };
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
  it("saves a person without addresses", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        person: {
          ...personPayload(false).person,
          addressId: null,
          streetAddress: "",
          suburb: "",
          latitude: null,
          longitude: null,
          addresses: [],
        },
        geocodeFailures: [],
        googleMapsFallbackAvailable: false,
      }, 201),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AddPersonDialog open onOpenChange={() => undefined} refresh={() => undefined} />);

    expect(screen.getByLabelText("Street address")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("No addresses saved. Add one now or save this person without an address.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Legal name"), { target: { value: "Ana Buyer" } });
    fireEvent.change(screen.getByLabelText("Phone (required if no email)"), { target: { value: "021 000 000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save person" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.addresses).toEqual([]);
  });

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

describe("RecordManagerDialog", () => {
  it("filters people by name in the manager modal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          people: [
            personRecord(1, "Meena Balaguru", "34 Liddesdale Place"),
            personRecord(2, "David Bainbridge-Smith", "49 Parker Ave"),
          ],
        }),
      ),
    );

    render(
      <RecordManagerDialog
        type="person"
        open
        onOpenChange={() => undefined}
        onAdd={() => undefined}
        onSelect={() => undefined}
        refresh={() => undefined}
      />,
    );

    expect(await screen.findByText("Meena Balaguru")).toBeInTheDocument();
    expect(screen.getByText("David Bainbridge-Smith")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search people by name"), { target: { value: "david" } });

    expect(screen.queryByText("Meena Balaguru")).not.toBeInTheDocument();
    expect(screen.getByText("David Bainbridge-Smith")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 records")).toBeInTheDocument();
  });
});

describe("DetailsDialog", () => {
  it("adds an address to a person with no addresses without sending a temporary selected address id", async () => {
    const addresslessPerson = addresslessPersonRecord(7, "Addressless Buyer");
    const updatedPerson = {
      ...addresslessPerson,
      addressId: 70,
      streetAddress: "21 Gibbston Crescent",
      suburb: "Flat Bush",
      addresses: [
        {
          id: 70,
          personId: 7,
          identityKey: "addressless-buyer-gibbston",
          streetAddress: "21 Gibbston Crescent",
          suburb: "Flat Bush",
          latitude: null,
          longitude: null,
          createdAt: "2026-06-16T00:00:00.000Z",
          updatedAt: "2026-06-16T00:00:00.000Z",
        },
      ],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/interactions") && !init?.method) {
        return jsonResponse({ interactions: [] });
      }
      return jsonResponse({
        person: updatedPerson,
        geocodeFailures: [],
        googleMapsFallbackAvailable: false,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DetailsDialog
        selected={{ type: "person", item: addresslessPerson, source: "manager" }}
        onOpenChange={() => undefined}
        onSelectedChange={() => undefined}
        onPersonAuditResult={() => undefined}
        refresh={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add address" }));
    fireEvent.change(screen.getByLabelText("Street address"), { target: { value: "21 Gibbston Crescent" } });
    fireEvent.change(screen.getByLabelText("Suburb"), { target: { value: "Flat Bush" } });
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const patchCall = fetchMock.mock.calls.find((call) => call[1]?.method === "PATCH");
    const request = JSON.parse(String(patchCall?.[1]?.body));
    expect(request.selectedAddressId).toBeNull();
    expect(request.addresses).toEqual([
      {
        streetAddress: "21 Gibbston Crescent",
        suburb: "Flat Bush",
        latitude: null,
        longitude: null,
      },
    ]);
  });

  it("filters and adds person interactions above notes", async () => {
    const person = personRecord(8, "Interaction Person", "50 Market Road");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/interactions") && !init?.method) {
        return jsonResponse({
          interactions: [
            {
              id: 1,
              personId: 8,
              propertyId: 4,
              interactionType: "inspection",
              interactionDate: "2026-06-20",
              createdAt: "2026-06-20T00:00:00.000Z",
              updatedAt: "2026-06-20T00:00:00.000Z",
              property: {
                id: 4,
                propertyKey: "50 market road|remuera",
                streetAddress: "50 Market Road",
                suburb: "Remuera",
                type: null,
                latitude: null,
                longitude: null,
                createdAt: "2026-06-01T00:00:00.000Z",
                updatedAt: "2026-06-01T00:00:00.000Z",
              },
            },
          ],
        });
      }
      if (url === "/api/properties") {
        return jsonResponse({
          properties: [
            {
              id: 4,
              propertyKey: "50 market road|remuera",
              streetAddress: "50 Market Road",
              suburb: "Remuera",
              type: null,
              latitude: null,
              longitude: null,
              createdAt: "2026-06-01T00:00:00.000Z",
              updatedAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        });
      }
      if (url === "/api/interactions" && init?.method === "POST") {
        return jsonResponse({ interaction: { id: 2 } }, 201);
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DetailsDialog
        selected={{ type: "person", item: person, source: "manager" }}
        onOpenChange={() => undefined}
        onSelectedChange={() => undefined}
        onPersonAuditResult={() => undefined}
        refresh={() => undefined}
      />,
    );

    expect(await screen.findByText("inspection")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(screen.getByText("Notes (0)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add interaction" }));
    expect(await screen.findByText("New interaction")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "buy" } });
    fireEvent.change(screen.getByLabelText("Property (optional)"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save interaction" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => call[1]?.method === "POST")).toBe(true);
    });
    const postCall = fetchMock.mock.calls.find((call) => call[1]?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      personId: 8,
      propertyId: "4",
      interactionType: "buy",
    });
  });
});
