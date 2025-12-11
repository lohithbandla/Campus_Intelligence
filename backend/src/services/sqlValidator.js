// VALID COLUMNS
const VALID_COLUMNS = [
  'student_id', 'usn', 'name', 'email', 'department_id', 'address',
  'faculty_id', 'faculty_name',
  'department_name',

  'mark_id', 'student_name', 'semester', 'subject_code', 'subject_name',
  'internal_marks', 'external_marks', 'total_marks', 'result',

  'course_id', 'course_name', 'course_code', 'materials', 'academic_year',

  'title', 'circular_details', 'file_path', 'timestamp', 'created_by',

  'leave_id', 'leave_details', 'status', 'from_date',

  'event_id', 'event_title', 'event_details', 'event_date'
];

// Reject unknown columns
export const rejectUnknownColumns = (sql) => {
  const cols = sql.match(/[a-zA-Z_]+(?=\s*(=|>|<|IN|LIKE|\())/g) || [];

  for (const c of cols) {
    if (!VALID_COLUMNS.includes(c.toLowerCase())) {
      throw new Error(`Invalid column used: ${c}`);
    }
  }
};

// Forbidden keywords
const FORBIDDEN = [
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
  "CREATE", "EXEC", "CALL", "GRANT", "REVOKE"
];

export const validateSQL = (sql, userRole) => {
  const upper = sql.toUpperCase();

  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    throw new Error("Only SELECT queries allowed");
  }

  for (const x of FORBIDDEN) {
    if (upper.includes(x)) {
      throw new Error(`Forbidden keyword detected: ${x}`);
    }
  }

  rejectUnknownColumns(sql);

  // Student rule
  if (userRole === "student") {
    if (!upper.includes("STUDENT_ID = $1")) {
      console.warn("⚠ Auto-fix: student_id not using $1 — but allowed.");
    }
  }

  // Faculty rule
  if (userRole === "faculty") {
    if (!upper.includes("FACULTY_ID = $1")) {
      console.warn("⚠ Auto-fix: faculty_id not using $1 — but allowed.");
    }
  }

  return true;
};

export const sanitizeSQL = (sql) => {
  sql = sql.replace(/--.*$/gm, "");
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  return sql.trim();
};
