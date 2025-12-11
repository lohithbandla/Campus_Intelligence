import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { generateSQL, formatResponse } from '../services/geminiService.js';
import { generateExcel } from '../services/excelService.js';
import { validateSQL, sanitizeSQL } from '../services/sqlValidator.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

// ------------------ Gemini Ask Route ------------------
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in .env');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

router.post("/ask", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const result = await model.generateContent(userMessage);

    res.json({
      success: true,
      reply: result.response.text(),
    });

  } catch (err) {
    console.error("Gemini Error:", err);
    res.status(500).json({
      success: false,
      reply: "Error generating response",
    });
  }
});

// ------------------ Helper: Extract SQL Params ------------------
const getQueryParams = (sql, userRole, userId) => {
  const matches = sql.match(/\$\d+/g) || [];
  const paramCount = matches.length > 0
    ? Math.max(...matches.map(p => parseInt(p.replace('$', ''))))
    : 0;

  if (paramCount === 0) return [];

  // Students & faculty MUST have $1 bound to their ID
  if (['student', 'faculty'].includes(userRole)) {
    return Array(paramCount).fill(userId);
  }

  // For admin/department (rare case of $1 appearing)
  return Array(paramCount).fill(userId);
};

// ------------------ MAIN LLM SQL Route ------------------
router.post(
  '/query',
  authenticate,
  authorizeRoles('student', 'faculty', 'admin', 'department'),
  body('query').notEmpty().withMessage('Query is required'),
  async (req, res) => {

    // Validate input body
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { query } = req.body;
    const { id: userId, role: userRole } = req.user;

    try {
      // 1️⃣ Generate SQL using Gemini
      let sql = await generateSQL(query, userRole, userId);

      // Handle non-SQL messages cleanly
      if (sql === "NON_SQL_INTENT") {
        return res.json({
          success: true,
          query,
          sql: null,
          response: "Hello! Ask me about students, faculty, marks, courses, or activities.",
          data: [],
          count: 0
        });
      }

      // 2️⃣ Clean SQL (remove comments, safety)
      sql = sanitizeSQL(sql);

      // ❗ IMPORTANT: We DO NOT replace ANY column names anymore.
      // GeminiService + Validator now handle correct mappings.

      // 3️⃣ Validate SQL safely based on role
      validateSQL(sql, userRole);

      // 4️⃣ Prepare params ($1, $2, etc.)
      const queryParams = getQueryParams(sql, userRole, userId);

      // 5️⃣ Execute query
      const result = await pool.query(sql, queryParams);
      const rows = result.rows || [];

      // 6️⃣ Get formatted explanation from Gemini
      const botResponse = await formatResponse(query, sql, rows, userRole);

      // 7️⃣ Save history (non-blocking)
      pool.query(
        `INSERT INTO chat_history
        (user_id, user_type, user_query, generated_sql, bot_response, result_data)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, userRole, query, sql, botResponse, JSON.stringify(rows)]
      ).catch(err => console.error("History Save Error:", err.message));

      // 8️⃣ Send result to frontend
      res.json({
        success: true,
        query,
        sql,
        response: botResponse,
        data: rows,
        count: rows.length
      });

    } catch (error) {
      console.error("Chat Error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ------------------ Get Chat History ------------------
router.get('/history', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '10', 10);
    const result = await pool.query(
      `SELECT * FROM chat_history
       WHERE user_id = $1 AND user_type = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [req.user.id, req.user.role, limit]
    );

    res.json({ success: true, history: result.rows });

  } catch (err) {
    console.error('Chat history error:', err);
    res.status(500).json({ success: false, message: 'Failed to load chat history' });
  }
});

// ------------------ Excel Download Route ------------------
router.post('/download', authenticate, async (req, res) => {
  const { query, sql } = req.body;
  const { id: userId, role: userRole } = req.user;

  try {
    validateSQL(sql, userRole);
    const queryParams = getQueryParams(sql, userRole, userId);
    const result = await pool.query(sql, queryParams);

    const { buffer, filename } = await generateExcel(result.rows || [], query, userRole);

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(buffer);

  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ success: false, message: 'Download failed' });
  }
});

export default router;
