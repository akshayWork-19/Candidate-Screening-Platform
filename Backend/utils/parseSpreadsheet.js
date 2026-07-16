import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

/**
 * Parses either a .csv or .xlsx buffer into an array of row objects.
 * XLSX is handled natively via SheetJS rather than converting to CSV first -
 * this avoids the exact bug we hit where multi-line cell text (project
 * descriptions with embedded newlines/commas) breaks a naive CSV round-trip.
 */
export function parseSpreadsheet(buffer, filename = "") {
    const isXlsx = /\.xlsx?$/i.test(filename);

    if (isXlsx) {
        const workbook = XLSX.read(buffer, { type: "buffer", cellFormula: false });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // raw: true keeps numbers as numbers; formulas resolve to their last
        // cached calculated value (SheetJS reads the <v> tag, not the formula text)
        return XLSX.utils.sheet_to_json(sheet, { raw: true, defval: "" });
    }

    return parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,
    });
}

/**
 * Normalizes a row's keys against known aliases, since real-world datasets
 * don't reliably match the assignment brief's exact field names (e.g. the
 * sample uses snake_case: "best_ai_project", "github", "resume" rather than
 * "Best AI Project", "GitHub Profile", "Resume Link").
 */
const FIELD_ALIASES = {
    name: ["name", "Name"],
    email: ["email", "Email"],
    college: ["college", "College"],
    branch: ["branch", "Branch"],
    cgpa: ["cgpa", "CGPA"],
    bestAiProject: ["best_ai_project", "Best AI Project", "bestAiProject"],
    researchWork: ["research_work", "Research Work", "researchWork"],
    githubProfile: ["github", "GitHub Profile", "githubProfile", "GitHub"],
    resumeLink: ["resume", "Resume Link", "resumeLink", "Resume"],
    testLa: ["test_la", "testLa", "Logical Aptitude Score"],
    testCode: ["test_code", "testCode", "Coding Test Score"],
};

export function normalizeRow(row) {
    const normalized = {};
    for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
        for (const alias of aliases) {
            if (row[alias] !== undefined && row[alias] !== "") {
                normalized[canonical] = row[alias];
                break;
            }
        }
    }
    return normalized;
}