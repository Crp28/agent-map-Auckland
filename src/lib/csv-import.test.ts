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
  it("imports explicit SMS opt-outs and rejects invalid SMS values", async () => {
    const csv = [
      "name,streetAddress,suburb,phone,email,allowSms",
      "Ana Buyer,1 Queen Street,Auckland Central,021 000 000,,false",
      "Bob Buyer,2 Queen Street,Auckland Central,021 000 001,,maybe",
    ].join("\n");
    const summary = await importPeopleCsv(csv);
    expect(summary).toMatchObject({ imported: 1, failed: 1 });
    expect(createOrUpdatePerson).toHaveBeenCalledWith(expect.objectContaining({ allowSms: false }), { geocode: undefined });
  });

  it("does not replace an existing SMS opt-out when a CSV omits the field", async () => {
    vi.mocked(getRawPeopleByIdentity).mockReturnValueOnce({
      name: "Ana Buyer", preferred_name: null, phone: "021 000 000", email: "",
      street_address: "1 Queen Street", suburb: "Auckland Central", allow_sms: 0,
    });
    const summary = await importPeopleCsv([
      "name,streetAddress,suburb,phone,email",
      "Ana Buyer,1 Queen Street,Auckland Central,021 000 000,",
    ].join("\n"));
    expect(summary.duplicates).toBe(1);
    expect(createOrUpdatePerson).not.toHaveBeenCalled();
  });

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

  it("stores only the preferred first name from contact-export rows", async () => {
    const csv = [
      '"Contact Type","First Name","Last Name","Preferred Name","Legal Name",Email,Mobile,Phone,"Work Phone",Address,Suburb,"Postal Address","Postal Suburb"',
      'Person,Zishu,Li,"Russell Li","Zishu Li",li@example.com,"021 000 000",,,"82 Picnic Point Road","Hobsonville",,',
    ].join("\n");

    await importPeopleCsv(csv);

    expect(vi.mocked(createOrUpdatePerson)).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Zishu Li",
        preferredName: "Russell",
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
