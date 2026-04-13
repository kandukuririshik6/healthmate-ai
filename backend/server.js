const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { User, Assessment } = require('./db');
const { predictRisk, generateAdvice, generateChatResponse } = require('./ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const fs = require('fs');
const path = require('path');

// Persistent Mock DB File
const MOCK_DB_PATH = path.join(__dirname, 'mock_db.json');

// Helper to load/save mock data
function loadMockData() {
  if (fs.existsSync(MOCK_DB_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(MOCK_DB_PATH, 'utf8'));
    } catch (e) {
      console.error("Error reading mock DB:", e);
    }
  }
  return { users: [], assessments: [] };
}

function saveMockData(data) {
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error("Error saving mock DB:", e);
  }
}

// Initial load
let mockData = loadMockData();

// Helper to generate ID on backend (matching frontend)
function generateUserId(email) {
  if (!email) return 'guest_' + Date.now();
  try {
    return 'hm_' + Buffer.from(email.toLowerCase().trim()).toString('base64').substring(0, 15);
  } catch (e) {
    return 'u_' + email.replace(/[^a-zA-Z0-9]/g, '_');
  }
}

// Helper to check DB connection
const isDbConnected = () => require('mongoose').connection.readyState === 1;

// POST /register
app.post('/register', async (req, res) => {
  const { name, email, password, age, gender } = req.body;
  const normalizedEmail = email.toLowerCase().trim();
  const cleanPassword = password.trim();

  try {
    if (isDbConnected()) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) return res.status(400).json({ error: "Email already registered" });

      const newUser = new User({ 
        name: name.trim(), 
        email: normalizedEmail, 
        password: cleanPassword, 
        age, 
        gender 
      });
      await newUser.save();
      return res.json({ message: "Registration successful", userId: newUser._id });
    } else {
      console.warn("MongoDB not connected, using Mock Fallback for registration.");
      const mockId = req.body.userId || generateUserId(normalizedEmail);
      if (mockData.users.find(u => u.email.toLowerCase().trim() === normalizedEmail)) {
        return res.status(400).json({ error: "Email already registered (Mock)" });
      }
      const mockUser = { id: mockId, name: name.trim(), email: normalizedEmail, password: cleanPassword, age, gender };
      mockData.users.push(mockUser);
      saveMockData(mockData);
      res.json({ message: "Registration successful (Mock Data)", userId: mockUser.id });
    }
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// POST /login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();
  const cleanPassword = password.trim();

  try {
    if (isDbConnected()) {
      const user = await User.findOne({ email: normalizedEmail, password: cleanPassword });
      if (user) {
        const userObj = user.toObject();
        userObj.id = userObj._id;
        return res.json({ message: "Login successful", user: userObj });
      }
      return res.status(401).json({ error: "Invalid credentials" });
    } else {
      console.warn("MongoDB not connected, using Mock Fallback for login.");
      const finalUserId = req.body.userId || generateUserId(normalizedEmail);
      const user = mockData.users.find(u => 
        (u.email.toLowerCase().trim() === normalizedEmail && u.password === cleanPassword) || 
        (u.id === finalUserId && u.password === cleanPassword)
      );
      if (user) {
        res.json({ message: "Login successful (Mock Data)", user });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    }
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// POST /predict
app.post('/predict', async (req, res) => {
  const {
    userId,
    sleep_hours,
    exercise_minutes,
    stress_level,
    water_intake,
    diet_quality,
    symptoms,
    age
  } = req.body;

  const assessmentData = { sleep_hours, exercise_minutes, stress_level, water_intake, age: age || 30, symptoms: symptoms || [] };
  
  const riskLevel = predictRisk(assessmentData);
  const advice = generateAdvice(riskLevel, assessmentData);

  try {
    if (isDbConnected() && typeof userId === 'string' && userId.length > 10) {
      const newAssessment = new Assessment({
        user_id: userId, sleep_hours, exercise_minutes, stress_level, water_intake, risk_level: riskLevel
      });
      await newAssessment.save();
    } else {
      throw new Error("DB not connected or invalid mocked ID");
    }
    res.json({ riskLevel, explanation: advice.explanation, recommendations: advice.recommendations });
  } catch (err) {
    console.warn("MongoDB Error, falling back to mock storage:", err.message);
    const finalUserId = userId || 'mock_1';
    const mockEntry = { userId: finalUserId, riskLevel, sleep_hours, exercise_minutes, stress_level, water_intake, date: new Date() };
    mockData.assessments.push(mockEntry);
    saveMockData(mockData);
    res.json({ riskLevel, explanation: advice.explanation, recommendations: advice.recommendations });
  }
});

// GET /history
app.get('/history', async (req, res) => {
  const userId = req.query.userId || 'mock_1';
  try {
    if (isDbConnected() && typeof userId === 'string' && userId.length > 10) {
      const history = await Assessment.find({ user_id: userId }).sort({ date: -1 });
      return res.json({ history });
    } else {
      throw new Error("DB not connected or invalid mocked ID");
    }
  } catch (err) {
    console.warn("MongoDB Error, falling back to mock storage:", err.message);
    const finalUserId = req.query.userId || 'mock_1';
    res.json({ history: mockData.assessments.filter(a => a.userId == finalUserId) });
  }
});

// POST /chat
app.post('/chat', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });
  
  // Simulate network delay for realism
  setTimeout(() => {
    const response = generateChatResponse(message);
    res.json({ response });
  }, 1000);
});

app.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});
