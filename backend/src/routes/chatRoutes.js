import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { generateSQL, formatResponse } from '../services/geminiService.js';
import { generateExcel } from '../services/excelService.js';
import { validateSQL, sanitizeSQL } from '../services/sqlValidator.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

// Initialize Gemini using API Key from .env
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set. Please define it in your .env file.');
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



const getQueryParams = (sql, userRole, userId) => {
  const paramMatches = sql.match(/\$\d+/g) || [];
  const paramCount = paramMatches.length > 0 
    ? Math.max(...paramMatches.map(p => parseInt(p.replace('$', ''))))
    : 0;

  if (paramCount === 0) return [];

  // STRICT RESTRICTION: Students and Faculty MUST use parameters for their ID
  if (['student', 'faculty'].includes(userRole)) {
    return Array(paramCount).fill(userId);
  }

  // RELAXED: Admin and Department usually don't need params.
  // But if the AI hallucinated a '$1' in the SQL, we fill it to prevent a crash.
  return Array(paramCount).fill(userId);
};

router.post(
  '/query',
  authenticate,
  authorizeRoles('student', 'faculty', 'admin', 'department'),
  body('query').notEmpty().withMessage('Query is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { query } = req.body;
    const { id: userId, role: userRole } = req.user;

    try {
      let sql = await generateSQL(query, userRole, userId);

      if (sql === 'NON_SQL_INTENT') {
        return res.json({
          success: true,
          query,
          sql: null,
          response: "Hello! Ask me about students, faculty, marks, or circulars.",
          data: [],
          count: 0
        });
      }

      sql = sanitizeSQL(sql);
      
      // Fix Gemini SQL column name mismatches
      sql = sql.replace(/subject_code/gi, 'course_code');
      sql = sql.replace(/\bsubject\b/gi, 'course_name');
      sql = sql.replace(/fc\.subject_code/gi, 'fc.course_code');
      
      // Pass role to validator to enforce strictness only for Student/Faculty
      validateSQL(sql, userRole);

      const queryParams = getQueryParams(sql, userRole, userId);

      const result = await pool.query(sql, queryParams);
      const rows = result.rows || [];
      const botResponse = await formatResponse(query, sql, rows);

      // Save History (Non-blocking)
      pool.query(
        `INSERT INTO chat_history (user_id, user_type, user_query, generated_sql, bot_response, result_data)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, userRole, query, sql, botResponse, JSON.stringify(rows)]
      ).catch(err => console.error("History Error:", err.message));

      res.json({
        success: true,
        query,
        sql,
        response: botResponse,
        data: rows,
        count: rows.length
      });

    } catch (error) {
      console.error('Chat Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// GET /api/chat/history - Get chat history for authenticated user
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
    res.status(500).json({ success: false, message: 'Failed to load chat history', error: err.message });
  }
});

// Download Route (Simplified for brevity, logic matches above)
router.post('/download', authenticate, async (req, res) => {
    const { query, sql } = req.body;
    const { id: userId, role: userRole } = req.user;
    try {
      validateSQL(sql, userRole); // Validate again
      const queryParams = getQueryParams(sql, userRole, userId);
      const result = await pool.query(sql, queryParams);
      const { buffer, filename } = await generateExcel(result.rows || [], query, userRole);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Download failed' });
    }
});

export default router;