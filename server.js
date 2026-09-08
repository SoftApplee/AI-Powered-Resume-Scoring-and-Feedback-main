// server.js - Main entry point
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    console.log('Creating uploads directory...');
    fs.mkdirSync(uploadsDir, { recursive: true });
} else {
    console.log('Uploads directory already exists.');
}

// Database config (from environment variables)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'resume_portal'
};

// DB connection pool
let pool;
async function initDB() {
  try {
    pool = mysql.createPool(dbConfig);
    console.log('Connected to MySQL database');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

// Session store
const sessionStore = new MySQLStore({ ...dbConfig, tableName: 'sessions' });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session config
app.use(session({
  key: 'session_cookie_name',
  secret: 'session_cookie_secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/'); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
  }
});

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  res.status(401).json({ message: 'Unauthorized' });
};

// --------- RESUME PROCESSING HELPERS ---------
async function extractText(filePath, mimeType) {
  if (mimeType === 'application/pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } else {
    throw new Error('Unsupported file type');
  }
}


async function scoreResumeWithML(text) {
  const inputData = {
    skills: text,
    experience: 2,
    education: "B.Tech",
    certifications: "AWS Certified",
    projects: 3,
    salary: 60000
  };

  try {
    const response = await axios.post('http://localhost:5000/predict', inputData);
    const score = Math.round(response.data.score);

    let feedback = '';

    if (score >= 90) {
      feedback = "Outstanding resume! Ready for top opportunities. You have a strong combination of technical and soft skills. Keep your resume updated with the latest experiences.";
    } else if (score >= 80) {
      feedback = "Very strong resume! Add minor improvements to reach excellence. Consider adding measurable achievements (e.g., 'Improved system performance by 20%') to further strengthen it.";
    } else if (score >= 70) {
      feedback = "Good resume! Try refining a few more skills or experiences. Adding contributions to open-source projects or leadership activities could boost your profile.";
    } else if (score >= 60) {
      feedback = "Decent resume. Add a few more relevant skills and projects. Highlight any internships, freelance work, or certifications to make it more competitive.";
    } else if (score >= 50) {
      feedback = "Average resume. Try to add technical certifications, achievements. Focus on demonstrating problem-solving skills and real-world project experience.";
    } else if (score >= 40) {
      feedback = "Weak resume. Focus on adding more technical and leadership skills. Include academic projects, hackathons, coding competitions, and teamwork examples.";
    } else if (score >= 30) {
      feedback = "Poor resume. Include more projects, internships, and certifications. Consider completing online courses and gaining practical experience through internships.";
    } else {
      feedback = "Very poor. Strongly recommend rebuilding your resume from scratch. Focus on learning in-demand skills and gaining hands-on experience through internships and personal projects.";
    }

    return { score, feedback };
  } catch (err) {
    console.error('ML API error:', err.message);
    return { score: 0, feedback: 'Resume scoring failed. Please try again.' };
  }
}


// -----------------------------------------------

// Routes
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: 'All fields are required' });

  try {
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUsers.length > 0) return res.status(409).json({ message: 'Username or email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, passwordHash]);
    await pool.query('INSERT INTO profiles (user_id) VALUES (?)', [result.insertId]);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ message: 'Invalid credentials' });

    req.session.user = { id: user.user_id, username: user.username, email: user.email };
    res.json({ message: 'Login successful', user: req.session.user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: 'Logout failed' });
    res.clearCookie('session_cookie_name');
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/user', isAuthenticated, (req, res) => {
  res.json({ user: req.session.user });
});

app.post('/api/upload-resume', isAuthenticated, upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const { id: userId } = req.session.user;

    const extractedText = await extractText(req.file.path, req.file.mimetype);
    const { score, feedback } = await scoreResumeWithML(extractedText);

    const [existingResumes] = await pool.query('SELECT * FROM resumes WHERE user_id = ?', [userId]);
    if (existingResumes.length > 0) {
      await pool.query(
        `UPDATE resumes 
         SET file_name = ?, original_name = ?, file_path = ?, file_size = ?, mime_type = ?, upload_date = CURRENT_TIMESTAMP, score = ?, feedback = ?
         WHERE user_id = ?`,
        [req.file.filename, req.file.originalname, req.file.path, req.file.size, req.file.mimetype, score, feedback, userId]
      );
    } else {
      await pool.query(
        `INSERT INTO resumes (user_id, file_name, original_name, file_path, file_size, mime_type, score, feedback)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, req.file.filename, req.file.originalname, req.file.path, req.file.size, req.file.mimetype, score, feedback]
      );
    }

    res.status(201).json({
      message: 'Resume uploaded successfully',
      score,
      feedback,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ message: 'Resume upload failed' });
  }
});

app.get('/api/resume', isAuthenticated, async (req, res) => {
  try {
    const { id: userId } = req.session.user;
    const [resumes] = await pool.query('SELECT * FROM resumes WHERE user_id = ?', [userId]);
    if (resumes.length === 0) return res.status(404).json({ message: 'No resume found' });

    res.json({ resume: resumes[0] });
  } catch (error) {
    console.error('Get resume error:', error);
    res.status(500).json({ message: 'Failed to fetch resume' });
  }
});

app.get('/api/profile', isAuthenticated, async (req, res) => {
  try {
    const { id: userId } = req.session.user;
    const [profiles] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    if (profiles.length === 0) return res.status(404).json({ message: 'Profile not found' });

    res.json({ profile: profiles[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

app.put('/api/profile', isAuthenticated, async (req, res) => {
  try {
    const { id: userId } = req.session.user;
    const { firstName, lastName, phone, headline, summary } = req.body;

    await pool.query(
      `UPDATE profiles 
       SET first_name = ?, last_name = ?, phone = ?, headline = ?, summary = ?
       WHERE user_id = ?`,
      [firstName, lastName, phone, headline, summary, userId]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

app.get('/api/admin/resumes', isAuthenticated, async (req, res) => {
  try {
    const [resumes] = await pool.query(`
      SELECT r.resume_id, r.file_name, r.original_name, r.upload_date, r.score, r.feedback, 
             u.username, u.email, p.first_name, p.last_name
      FROM resumes r
      JOIN users u ON r.user_id = u.user_id
      JOIN profiles p ON u.user_id = p.user_id
      ORDER BY r.upload_date DESC
    `);
    res.json({ resumes });
  } catch (error) {
    console.error('Admin resumes error:', error);
    res.status(500).json({ message: 'Failed to fetch resumes' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  await initDB();
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
