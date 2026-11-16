import { test, expect } from "@playwright/test";
import {
  readRegisterFile,
  registerExcelTemplate,
  canonicalRegisterCsv,
} from "../src/lib/official-register-file";
import { strToU8, zipSync, unzipSync } from "fflate";
test("XLSX and CSV templates round-trip canonical identities", () => {
  const rows = readRegisterFile(registerExcelTemplate(), "voters.xlsx");
  expect(rows).toHaveLength(1);
  expect(rows[0].registrationNumber).toBe("UCSA/2026/001");
  expect(
    readRegisterFile(strToU8(canonicalRegisterCsv(rows)), "voters.csv"),
  ).toEqual(rows);
});
test("5,000 rows parse without loss and excess records are rejected", () => {
  const rows = Array.from({ length: 5000 }, (_, i) => ({
    fullName: `Fictional Student ${i}`,
    registrationNumber: `REG-${i}`,
    email: `student-${i}@example.test`,
  }));
  const started = Date.now();
  expect(
    readRegisterFile(strToU8(canonicalRegisterCsv(rows)), "voters.csv"),
  ).toEqual(rows);
  expect(Date.now() - started).toBeLessThan(5000);
  expect(() =>
    readRegisterFile(
      strToU8(canonicalRegisterCsv([...rows, rows[0]])),
      "voters.csv",
    ),
  ).toThrow(/5,000/);
});
test("reject malformed identity headers, formulas, entities and unbounded archives", () => {
  expect(() =>
    readRegisterFile(strToU8("email\nstudent@example.test"), "voters.csv"),
  ).toThrow(/Required columns/);
  const files = unzipSync(registerExcelTemplate());
  const name = "xl/worksheets/sheet1.xml";
  files[name] = strToU8(
    new TextDecoder()
      .decode(files[name])
      .replace('<c r="A2"', '<c r="A2"')
      .replace("<is><t>Fictional", '<f>HYPERLINK("bad")</f><is><t>Fictional'),
  );
  expect(() => readRegisterFile(zipSync(files), "voters.xlsx")).toThrow(
    /formulas/,
  );
  files[name] = strToU8('<!DOCTYPE x [<!ENTITY attack "bad">]><worksheet/>');
  expect(() => readRegisterFile(zipSync(files), "voters.xlsx")).toThrow(/XML/);
  expect(() =>
    readRegisterFile(new Uint8Array(5 * 1024 * 1024 + 1), "voters.xlsx"),
  ).toThrow(/5 MiB/);
});
