import { beforeEach, describe, expect, it, vi } from "vitest";
import { importPeopleCsv } from "./csv-import";
import { createOrUpdatePerson, getRawPeopleByIdentity, getRawPersonByContactAndAddress } from "@/lib/repository";

vi.mock("@/lib/repository", () => ({
  createOrUpdatePerson: vi.fn(async () => undefined),
  getRawPeopleByIdentity: vi.fn(() => undefined),
  getRawPersonByContactAndAddress: vi.fn(() => undefined),
}));

beforeEach(() => {
  vi.mocked(createOrUpdatePerson).mockClear();
  vi.mocked(getRawPeopleByIdentity).mockClear();
  vi.mocked(getRawPersonByContactAndAddress).mockClear();
});

describe("importPeopleCsv", () => {
  it("normalizes contact-export person rows", async () => {
    const csv = [
      '"Contact Type","First Name","Last Name","Preferred Name","Legal Name",Email,Mobile,Phone,"Work Phone",Address,Suburb,"Postal Address","Postal Suburb"',
      'Person,Ana,Buyer,Ana,"Ana Buyer",ana@example.com,"021 000 000",,,"1 Queen Street","Auckland Central",,',
    ].join("\n");

    const summary = await importPeopleCsv(csv);

    expect(summary).toMatchObject({
      imported: 1,
      updated: 0,
      duplicates: 0,
      failed: 0,
    });
    expect(vi.mocked(createOrUpdatePerson)).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ana Buyer",
        preferredName: "Ana",
      }),
      { geocode: undefined },
    );
  });

  it("rejects non-person contact-export rows", async () => {
    const csv = [
      '"Contact Type","First Name","Last Name","Preferred Name","Legal Name",Email,Mobile,Phone,"Work Phone",Address,Suburb,"Postal Address","Postal Suburb"',
      'Business,Ana,Buyer,Ana,"Ana Buyer",ana@example.com,"021 000 000",,,"1 Queen Street","Auckland Central",,',
    ].join("\n");

    const summary = await importPeopleCsv(csv);

    expect(summary.failed).toBe(1);
    expect(summary.errors[0].message).toContain("Contact Type = Person");
  });
});
