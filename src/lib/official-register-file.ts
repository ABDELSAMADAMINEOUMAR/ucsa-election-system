import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { csvRows } from "./roster-import";

export const REGISTER_BYTES = 5 * 1024 * 1024;
export const REGISTER_ROWS = 5000;
export type OfficialRow = {
  fullName: string;
  registrationNumber: string;
  email: string;
};
const array = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = (value: unknown): string => {
  const raw =
    typeof value === "object" && value !== null
      ? String((value as Record<string, unknown>)["#text"] ?? "")
      : String(value ?? "");
  return raw.replace(
    /&(amp|lt|gt|quot|apos|#(?:x[0-9a-f]+|[0-9]+));/gi,
    (_, entity: string) => {
      const predefined: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
      };
      if (predefined[entity]) return predefined[entity];
      const point =
        entity[1]?.toLowerCase() === "x"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      if (
        point < 32 ||
        point > 0x10ffff ||
        (point >= 0xd800 && point <= 0xdfff)
      )
        throw new Error("Invalid XML text character.");
      return String.fromCodePoint(point);
    },
  );
};
const xmlEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function canonicalRegisterCsv(rows: OfficialRow[]) {
  return [
    ["full_name", "registration_number", "email"],
    ...rows.map((row) => [row.fullName, row.registrationNumber, row.email]),
  ]
    .map((row) =>
      row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
}

/** Bounded OOXML reader: no macros, entities, external links, formulas or rich objects. */
export function readRegisterFile(
  bytes: Uint8Array,
  name: string,
): OfficialRow[] {
  if (!bytes.length || bytes.length > REGISTER_BYTES)
    throw new Error("Choose a CSV or XLSX file up to 5 MiB.");
  let matrix: string[][];
  if (name.toLowerCase().endsWith(".csv")) {
    // Existing CSV lexer enforces its stricter 1 MiB bound and 5,000-row limit.
    matrix = csvRows(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } else if (name.toLowerCase().endsWith(".xlsx")) {
    let expanded = 0,
      entries = 0;
    const names = new Set<string>();
    const files = unzipSync(bytes, {
      filter(file) {
        expanded += file.originalSize;
        entries++;
        if (
          expanded > 20 * 1024 * 1024 ||
          entries > 100 ||
          file.originalSize > 10 * 1024 * 1024 ||
          file.size > REGISTER_BYTES ||
          names.has(file.name) ||
          file.name.includes("..") ||
          /externalLinks|vbaProject|embeddings|\.bin$/.test(file.name)
        )
          throw new Error(
            "Workbook exceeds safe limits or contains unsupported content.",
          );
        names.add(file.name);
        return /\.xml$|\.rels$/.test(file.name);
      },
    });
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      parseTagValue: false,
      parseAttributeValue: false,
      processEntities: false,
      isArray: (name) => ["row", "c", "si", "r", "sheet"].includes(name),
    });
    const xml = (path: string) => {
      if (!files[path])
        throw new Error("Use one standard XLSX worksheet named Voters.");
      const value = strFromU8(files[path]);
      if (
        /<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External/i.test(value) ||
        XMLValidator.validate(value) !== true
      )
        throw new Error("Unsupported workbook XML.");
      return parser.parse(value);
    };
    // Check relationships for external references even when not otherwise used.
    for (const path of Object.keys(files))
      if (path.endsWith(".rels")) xml(path);
    const sheets = array(
      xml("xl/workbook.xml").workbook?.sheets?.sheet,
    ) as Record<string, unknown>[];
    if (sheets.length !== 1)
      throw new Error(
        "Include exactly one worksheet. Remove other sheets before uploading.",
      );
    const strings = files["xl/sharedStrings.xml"]
      ? array(xml("xl/sharedStrings.xml").sst?.si).map((item: unknown) => {
          const obj = item as { t?: unknown; r?: { t: unknown }[] };
          return obj.r
            ? array(obj.r)
                .map((run) => text(run.t))
                .join("")
            : text(obj.t);
        })
      : [];
    if (strings.length > 50020 || strings.some((value) => value.length > 1000))
      throw new Error("Workbook strings exceed limits.");
    const sheetPaths = Object.keys(files).filter((path) =>
      /^xl\/worksheets\/sheet\d+\.xml$/.test(path),
    );
    if (sheetPaths.length !== 1)
      throw new Error("Include exactly one worksheet.");
    const rows = array(xml(sheetPaths[0]).worksheet?.sheetData?.row) as {
      c?: Record<string, unknown>[];
    }[];
    if (rows.length > REGISTER_ROWS + 1)
      throw new Error("At most 5,000 students per file.");
    matrix = rows
      .map((row) => {
        const cells: string[] = [];
        for (const cell of array(row.c)) {
          const ref = String(cell["@_r"] ?? "");
          if (!/^[A-J][1-9][0-9]{0,4}$/.test(ref) || "f" in cell)
            throw new Error(
              "Use text cells in columns A–J; formulas are not accepted.",
            );
          const type = cell["@_t"];
          if (cell.v !== undefined && type !== "s" && type !== "inlineStr")
            throw new Error(
              "Use text cells for names, registration numbers and emails.",
            );
          if (cells[ref.charCodeAt(0) - 65] !== undefined)
            throw new Error("Duplicate workbook cell reference.");
          const value =
            type === "s"
              ? strings[Number(text(cell.v))]
              : type === "inlineStr"
                ? text((cell.is as { t?: unknown })?.t)
                : text(cell.v);
          if (value === undefined || value.length > 1000)
            throw new Error("Invalid or oversized workbook cell.");
          cells[ref.charCodeAt(0) - 65] = value;
        }
        return Array.from({ length: cells.length }, (_, i) => cells[i] ?? "");
      })
      .filter((row) => row.some((value) => value.trim()));
  } else throw new Error("Supported files: CSV or XLSX.");
  if (matrix.length < 2 || matrix.length > REGISTER_ROWS + 1)
    throw new Error("Include headers and 1–5,000 students.");
  const aliases: Record<string, keyof OfficialRow> = {
    fullname: "fullName",
    registrationnumber: "registrationNumber",
    unilakregistrationnumber: "registrationNumber",
    email: "email",
    emailaddress: "email",
  };
  const header = matrix[0].map(
    (value) => aliases[value.trim().toLowerCase().replace(/[ _-]/g, "")],
  );
  if (
    !["fullName", "registrationNumber", "email"].every((key) =>
      header.includes(key as keyof OfficialRow),
    ) ||
    new Set(header.filter(Boolean)).size !== header.filter(Boolean).length ||
    header.length > 10
  )
    throw new Error(
      "Required columns: full_name, registration_number, email. Do not repeat headers.",
    );
  return matrix.slice(1).map((values) => {
    if (values.length > header.length)
      throw new Error("A row has more cells than the header.");
    const row: OfficialRow = {
      fullName: "",
      registrationNumber: "",
      email: "",
    };
    header.forEach((key, i) => {
      if (key) row[key] = (values[i] ?? "").trim();
    });
    row.registrationNumber = row.registrationNumber.toUpperCase();
    row.email = row.email.toLowerCase();
    return row;
  });
}

/** Small standard OOXML template, text cells preserve leading zeroes. */
export function registerExcelTemplate() {
  const rows = [
    ["full_name", "registration_number", "email"],
    [
      "Fictional Student — replace before import",
      "UCSA/2026/001",
      "student@example.test",
    ],
  ];
  const sheet = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, i) => `<row r="${i + 1}">${row.map((value, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const documents: Record<string, string> = {
    "[Content_Types].xml":
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Voters" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": sheet,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(documents).map(([name, content]) => [
        name,
        strToU8(content),
      ]),
    ),
    { level: 6 },
  );
}
