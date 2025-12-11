import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) { 
  console.warn("Warning: GEMINI_API_KEY is missing in .env"); 
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ----------------------------------------------------------------------
// STRICT DATABASE SCHEMA CONTEXT (Corrected + Hallucination-Proof)
// ----------------------------------------------------------------------
const SCHEMA_CONTEXT = `
PostgreSQL Database Schema for college-management:

TABLES:
student(student_id, usn, name, email, department_id, address)
faculty(faculty_id, faculty_name, email, department_id)
department(department_id, department_name)

marks_student(
  mark_id, student_id, student_name, semester,
  subject_code, subject_name,
  internal_marks, external_marks, total_marks, result
)

faculty_courses(
  course_id, faculty_id,
  course_name, course_code, materials,
  semester, academic_year
)

department_circulars(circular_id, department_id, title, circular_details, file_path, timestamp, created_by)
student_leave_requests(leave_id, student_id, leave_details, status, from_date)
department_activities(event_id, department_id, event_title, event_details, event_date, timestamp, created_by)

RULES:
- marks_student uses subject_code.
- faculty_courses uses course_code.
- NEVER swap subject_code and course_code.
- Students ALWAYS must use: WHERE student_id = $1
- Faculty ALWAYS must use: WHERE faculty_id = $1
- NEVER use literal IDs like 1, 2, etc. Always placeholders.
`;

// ----------------------------------------------------------------------
// SQL GENERATOR WITH FULL LOGGING + AUTO PARAM FIX
// ----------------------------------------------------------------------
export const generateSQL = async (userQuery, userRole, userId) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const roleInstructions = {
      student: `
You are a student. You must ALWAYS filter your data using:
WHERE student_id = $1
Never use literal numbers like student_id = 1.
      `,
      faculty: `
You are a faculty member. You must ALWAYS filter using:
WHERE faculty_id = $1
Never use literal numbers.
      `,
      department: `You are a department head. You have full access.`,
      admin: `You are an admin. Full database access.`
    };

    const prompt = `
${SCHEMA_CONTEXT}

${roleInstructions[userRole]}

User Query: "${userQuery}"

TASK:
Convert the above into a PostgreSQL SELECT query.

RULES:
1. Output ONLY SQL.
2. Never output literal IDs (1, 2...). Always use $1 when needed.
3. Use correct columns per table.
4. If user says 'hi', return: NON_SQL_INTENT.

SQL:
`;

    // ---------------- DEBUG: Log Prompt ----------------
    console.log("\n================= GEMINI PROMPT =================");
    console.log(prompt);
    console.log("==================================================\n");

    const result = await model.generateContent(prompt);
    let sql = result.response.text().trim();

    // ---------------- DEBUG: RAW SQL ----------------
    console.log("🔍 RAW GEMINI SQL:", sql);

    // Remove markdown wrapping
    sql = sql.replace(/```sql|```/g, "").trim();

    // AUTO FIX: Convert literal student_id = 1 → $1
    if (userRole === "student") {
      sql = sql.replace(/student_id\s*=\s*\d+/i, "student_id = $1");
    }

    // AUTO FIX: Convert literal faculty_id = 1 → $1
    if (userRole === "faculty") {
      sql = sql.replace(/faculty_id\s*=\s*\d+/i, "faculty_id = $1");
    }

    // ---------------- DEBUG: FINAL FIXED SQL ----------------
    console.log("✅ FINAL SQL (AFTER FIXES):", sql);

    return sql;

  } catch (err) {
    console.error("❌ Gemini SQL Generation Error:", err);
    throw new Error("AI Service Failed: " + err.message);
  }
};

// ----------------------------------------------------------------------
// FORMAT RESPONSE — FULL LOGGING
// ----------------------------------------------------------------------
export const formatResponse = async (userQuery, sql, results, userRole) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
Summarize these database results for a ${userRole.toUpperCase()}.

User Query: "${userQuery}"
SQL: "${sql}"
Row Count: ${results.length}
Data: ${JSON.stringify(results.slice(0, 3))}

Rules:
- If unauthorized → "You do not have access to this data."
- If empty → "No data available for this request."
- Keep summary short.
`;

    // DEBUG
    console.log("\n========= GEMINI FORMAT RESPONSE PROMPT =========");
    console.log(prompt);
    console.log("=================================================\n");

    const result = await model.generateContent(prompt);

    // DEBUG
    console.log("📝 GEMINI SUMMARY:", result.response.text());

    return result.response.text();

  } catch (err) {
    console.error("❌ Gemini Response Error:", err);

    if (results.length === 0) return "No data available or access restricted.";
    return `Found ${results.length} record(s).`;
  }
};
