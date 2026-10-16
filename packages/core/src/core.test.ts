import { describe, expect, it } from "vitest";
import { classifyHost, normalizeHostname } from "./tenant";
import { brandPalette, contrastRatio, parseHex } from "./color";
import { BASIC_SCALE, WAEC_SCALE, gradeFor, validateScale } from "./curriculum";
import { displayLogin, generatePassword, loginCandidates, phoneLoginEmail, studentLoginEmail } from "./identity";
import { can } from "./roles";

const ROOT = "kmfschools.ng";

describe("school detection from the address", () => {
  it("strips ports, case and trailing dots", () => {
    expect(normalizeHostname("Portal.Brightfield.com.ng:443")).toBe("portal.brightfield.com.ng");
    expect(normalizeHostname("brightfield.kmfschools.ng.")).toBe("brightfield.kmfschools.ng");
  });

  it("reads the slug from a platform subdomain", () => {
    expect(classifyHost("brightfield.kmfschools.ng", ROOT)).toEqual({
      kind: "slug",
      slug: "brightfield",
      hostname: "brightfield.kmfschools.ng",
    });
  });

  it("reads the slug from a local development subdomain", () => {
    expect(classifyHost("brightfield.localhost:3000", ROOT)).toMatchObject({ kind: "slug", slug: "brightfield" });
  });

  it("treats a school's own domain as a domain lookup", () => {
    expect(classifyHost("portal.brightfield.com.ng", ROOT)).toEqual({
      kind: "domain",
      hostname: "portal.brightfield.com.ng",
    });
  });

  it("treats the bare platform, reserved names and deep subdomains as the platform", () => {
    expect(classifyHost("kmfschools.ng", ROOT).kind).toBe("platform");
    expect(classifyHost("www.kmfschools.ng", ROOT).kind).toBe("platform");
    expect(classifyHost("admin.kmfschools.ng", ROOT).kind).toBe("platform");
    expect(classifyHost("a.b.kmfschools.ng", ROOT).kind).toBe("platform");
    expect(classifyHost("localhost:3000", ROOT).kind).toBe("platform");
    expect(classifyHost("kmf-schools-git-main.vercel.app", ROOT).kind).toBe("platform");
  });
});

describe("brand colours", () => {
  const white = parseHex("#ffffff")!;

  it("keeps buttons readable with white text for any colour", () => {
    for (const hex of ["#1a8754", "#ffeb3b", "#a7d8ff", "#ffffff", "#000000", "#e91e63"]) {
      const p = brandPalette(hex);
      expect(contrastRatio(parseHex(p.solid)!, white)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(parseHex(p.strong)!, white)).toBeGreaterThanOrEqual(7);
    }
  });

  it("falls back to the default green for invalid input", () => {
    expect(brandPalette("not-a-colour").base).toBe("#1a8754");
  });
});

describe("grading scales", () => {
  it("ships valid default scales", () => {
    expect(validateScale(WAEC_SCALE)).toEqual([]);
    expect(validateScale(BASIC_SCALE)).toEqual([]);
  });

  it("finds gaps", () => {
    const broken = [
      { min: 0, max: 39, grade: "F", remark: "" },
      { min: 41, max: 100, grade: "A", remark: "" },
    ];
    expect(validateScale(broken).length).toBeGreaterThan(0);
  });

  it("grades scores, rounding to the nearest whole mark", () => {
    expect(gradeFor(74.6, WAEC_SCALE)?.grade).toBe("A1");
    expect(gradeFor(39.4, WAEC_SCALE)?.grade).toBe("F9");
  });
});

describe("login identifiers", () => {
  const schoolId = "11111111-2222-3333-4444-555555555555";

  it("maps admission numbers to a private school-scoped address", () => {
    expect(studentLoginEmail(" KMF/2024/017 ", schoolId)).toBe(`s-kmf-2024-017@${schoolId}.accounts.kmfschools.ng`);
  });

  it("keeps the same admission number separate across schools", () => {
    expect(studentLoginEmail("001", schoolId)).not.toBe(studentLoginEmail("001", "another-school"));
  });

  it("treats every way of writing a Nigerian phone number as one login", () => {
    const a = phoneLoginEmail("08031234567", schoolId);
    for (const p of ["+234 803 123 4567", "2348031234567", "0803-123-4567", "8031234567"]) expect(phoneLoginEmail(p, schoolId)).toBe(a);
  });

  it("tries the right accounts for what someone typed", () => {
    expect(loginCandidates("Head@School.ng", schoolId)).toEqual(["head@school.ng"]);
    expect(loginCandidates("BFA/2026/014", schoolId)).toEqual([studentLoginEmail("BFA/2026/014", schoolId)]);
    // Looks like a phone, but could also be an all-digit admission number: try both.
    expect(loginCandidates("0803 123 4567", schoolId)).toEqual([studentLoginEmail("0803 123 4567", schoolId), phoneLoginEmail("08031234567", schoolId)]);
  });

  it("shows people what to type, not the private address", () => {
    expect(displayLogin(studentLoginEmail("BFA/2026/014", schoolId))).toBe("bfa-2026-014");
    expect(displayLogin(phoneLoginEmail("08031234567", schoolId))).toBe("08031234567");
    expect(displayLogin("head@school.ng")).toBe("head@school.ng");
  });

  it("makes readable passwords without look-alike characters", () => {
    const pw = generatePassword();
    expect(pw).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
    expect(new Set(Array.from({ length: 50 }, () => generatePassword())).size).toBe(50);
  });
});

describe("roles", () => {
  it("only lets managers publish results", () => {
    expect(can("admin", "results.publish")).toBe(true);
    expect(can("teacher", "results.publish")).toBe(false);
    expect(can("parent", "results.enter")).toBe(false);
  });
});
