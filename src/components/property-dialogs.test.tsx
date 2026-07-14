import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PropertiesManagerDialog } from "./property-dialogs";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const property = {
  id: 4,
  propertyKey: "50 market road|remuera",
  streetAddress: "50 Market Road",
  suburb: "Remuera",
  type: "house" as const,
  latitude: -36.87,
  longitude: 174.78,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z",
};

describe("PropertiesManagerDialog", () => {
  it("opens property details, shows timeline, and switches to Sold Properties", async () => {
    const onSwitchToSold = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("?id=4")) {
          return jsonResponse({
            property: {
              ...property,
              relations: [
                {
                  id: 1,
                  personId: 2,
                  propertyId: 4,
                  relationshipType: "owner",
                  createdAt: "2026-06-01T00:00:00.000Z",
                  personName: "Ana Buyer",
                },
              ],
              interactions: [],
              soldProperties: [],
              timeline: [
                {
                  id: "relationship-1",
                  eventType: "relationship",
                  date: "2026-06-01T00:00:00.000Z",
                  title: "Ana Buyer: owner",
                  description: "Contact relationship recorded",
                },
              ],
            },
          });
        }
        return jsonResponse({ properties: [property] });
      }),
    );

    render(
      <PropertiesManagerDialog
        open
        onOpenChange={() => undefined}
        onSwitchToSold={onSwitchToSold}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /50 Market Road/ }));
    expect(await screen.findByText("Current information")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByText("Ana Buyer: owner")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sold properties" }));
    await waitFor(() => expect(onSwitchToSold).toHaveBeenCalledOnce());
  });

  it("finds expanded suburb names using an abbreviated search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          properties: [{ ...property, id: 5, suburb: "Mount Eden" }],
        }),
      ),
    );

    render(
      <PropertiesManagerDialog
        open
        onOpenChange={() => undefined}
        onSwitchToSold={() => undefined}
      />,
    );

    fireEvent.change(await screen.findByPlaceholderText("Search address, suburb, or type"), {
      target: { value: "Mt Eden" },
    });

    expect(screen.getByText(/Mount Eden/)).toBeInTheDocument();
    expect(screen.getByText("1 of 1 records")).toBeInTheDocument();
  });

  it("deletes a selected property after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("?id=4") && init?.method === "DELETE") {
        return jsonResponse({
          deleted: true,
          deletedAddressIds: [],
          deletedPersonIds: [],
          deletedSoldPropertyIds: [],
        });
      }
      if (url.includes("?id=4")) {
        return jsonResponse({
          property: {
            ...property,
            relations: [],
            interactions: [],
            soldProperties: [],
            timeline: [],
          },
        });
      }
      return jsonResponse({ properties: [property] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PropertiesManagerDialog
        open
        onOpenChange={() => undefined}
        onSwitchToSold={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /50 Market Road/ }));
    expect(await screen.findByText("Current information")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete property" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/properties?id=4", { method: "DELETE" });
    });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("matching People address rows"));
    expect(await screen.findByPlaceholderText("Search address, suburb, or type")).toBeInTheDocument();
    expect(screen.getByText("0 of 0 records")).toBeInTheDocument();
  });
});
