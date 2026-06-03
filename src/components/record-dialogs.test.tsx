import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditableCoordinatePairRow } from "./record-dialogs";

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
