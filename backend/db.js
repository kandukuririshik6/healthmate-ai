const mongoose = require('mongoose');

// Fallback to local MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/healthmate';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connection established.'))
  .catch(err => console.error('MongoDB connection error. Make sure MongoDB is running!', err));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true }
});

const assessmentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sleep_hours: Number,
  exercise_minutes: Number,
  stress_level: Number,
  water_intake: Number,
  risk_level: String,
  date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Assessment = mongoose.model('Assessment', assessmentSchema);

module.exports = { User, Assessment };
