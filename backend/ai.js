const brain = require('brain.js');

// Initialize Neural Network
const net = new brain.NeuralNetwork({
  hiddenLayers: [5, 5],
  activation: 'sigmoid'
});

// Normalization functions for inputs
// Sleep: 0-12+, Exercise: 0-120+, Stress: 1-10, Water: 0-5000ml (in cups/liters simplified here mapping 0-10 cups)
const normalize = (data) => ({
  sleep_hours: data.sleep_hours / 12,
  exercise_minutes: Math.min(data.exercise_minutes / 120, 1),
  stress_level: data.stress_level / 10,
  water_intake: Math.min(data.water_intake / 10, 1), // assuming 10 cups is '1'
  age: Math.min(data.age / 100, 1),
  symptoms_score: data.symptoms.length / 5 // 5 possible symptoms
});

// Example training data
const trainingData = [
  // Low Risk: good sleep, high exercise, low stress, high water, no symptoms
  { input: normalize({ sleep_hours: 8, exercise_minutes: 60, stress_level: 2, water_intake: 8, age: 25, symptoms: [] }), output: { lowRisk: 1 } },
  { input: normalize({ sleep_hours: 7, exercise_minutes: 45, stress_level: 3, water_intake: 6, age: 30, symptoms: [] }), output: { lowRisk: 1 } },

  // Moderate Risk: less sleep, less exercise, higher stress, some symptoms
  { input: normalize({ sleep_hours: 5, exercise_minutes: 20, stress_level: 7, water_intake: 4, age: 40, symptoms: ['Headache'] }), output: { moderateRisk: 1 } },
  { input: normalize({ sleep_hours: 6, exercise_minutes: 10, stress_level: 6, water_intake: 5, age: 35, symptoms: ['Fatigue'] }), output: { moderateRisk: 1 } },

  // High Risk: poor sleep, no exercise, high stress, low water, multiple symptoms
  { input: normalize({ sleep_hours: 4, exercise_minutes: 0, stress_level: 9, water_intake: 2, age: 50, symptoms: ['Headache', 'Fever', 'Fatigue'] }), output: { highRisk: 1 } },
  { input: normalize({ sleep_hours: 3, exercise_minutes: 5, stress_level: 10, water_intake: 3, age: 60, symptoms: ['Body Pain', 'Cough', 'Fatigue'] }), output: { highRisk: 1 } },
];

console.log("Training Neural Network...");
net.train(trainingData, {
  iterations: 20000,
  errorThresh: 0.005,
});
console.log("Neural Network Trained!");

function predictRisk(assessmentData) {
  const normInput = normalize(assessmentData);
  const result = net.run(normInput);
  
  // Find highest probability class
  let highest = 'Low Risk';
  let maxVal = result.lowRisk || 0;
  
  if ((result.moderateRisk || 0) > maxVal) {
    highest = 'Moderate Risk';
    maxVal = result.moderateRisk;
  }
  if ((result.highRisk || 0) > maxVal) {
    highest = 'High Risk';
  }
  
  return highest;
}

function generateAdvice(riskLevel, assessmentData) {
  let explanation = "";
  let recommendations = [];

  if (riskLevel === 'Low Risk') {
    explanation = "Your current lifestyle patterns indicate a low health risk. Keep up the excellent work!";
    recommendations = [
      "Maintain your current balanced diet.",
      "Continue your regular exercise routine.",
      "Ensure you keep getting sufficient sleep."
    ];
  } else if (riskLevel === 'Moderate Risk') {
    let factors = [];
    if (assessmentData.sleep_hours < 7) factors.push("reduced sleep duration");
    if (assessmentData.stress_level > 5) factors.push("moderate stress levels");
    if (assessmentData.exercise_minutes < 30) factors.push("lack of physical activity");
    if (assessmentData.water_intake < 6) factors.push("insufficient hydration");
    
    explanation = `Your current lifestyle patterns indicate moderate health risk primarily due to ${factors.join(" and ") || "sub-optimal lifestyle factors"}.`;
    
    if (assessmentData.sleep_hours < 7) recommendations.push("Improve sleep schedule to at least 7 hours per night.");
    if (assessmentData.exercise_minutes < 30) recommendations.push("Increase physical activity to 30 mins daily.");
    if (assessmentData.water_intake < 6) recommendations.push("Drink sufficient water (at least 8 cups a day).");
    if (assessmentData.stress_level > 5) recommendations.push("Practice stress management techniques like meditation.");
    if (recommendations.length === 0) recommendations.push("Focus on a balanced diet and monitor any symptoms.");
  } else {
    explanation = "Your profile indicates a high health risk due to a combination of concerning symptoms and poor lifestyle habits. Immediate adjustments are recommended.";
    recommendations = [
      "Consult a healthcare professional for a checkup.",
      "Drastically improve sleep and hydration routines.",
      "Take time off for stress recovery and relaxation.",
      "Start with light physical activities."
    ];
  }

  return { explanation, recommendations };
}

function generateChatResponse(message) {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes("hello") || lowerMsg.includes("hi")) {
    return "Hello there! I am HealthMate AI. How can I assist you with your health today?";
  } else if (lowerMsg.includes("headache")) {
    return "Headaches can be caused by dehydration, lack of sleep, or stress. Try drinking a glass of water, resting in a quiet dark room, and taking a screen break. If it persists, consult a doctor.";
  } else if (lowerMsg.includes("sleep")) {
    return "Adults usually need 7-9 hours of sleep. Try to maintain a consistent sleep schedule and limit screen time 1 hour before bed.";
  } else if (lowerMsg.includes("diet") || lowerMsg.includes("food")) {
    return "A balanced diet with plenty of fruits, vegetables, lean proteins, and whole grains is essential. Reducing processed foods and sugar can significantly improve your risk profile.";
  } else if (lowerMsg.includes("fever")) {
    return "A fever is usually a sign that your body is fighting off an infection. Rest, stay hydrated, and monitor your temperature. If it goes above 103°F (39.4°C) or lasts more than a few days, please seek medical attention immediately.";
  } else {
    return "That's an interesting question. While I'm an AI still in training, I recommend you try taking the comprehensive Health Assessment on our platform for a more accurate personalized risk profile!";
  }
}

module.exports = { predictRisk, generateAdvice, generateChatResponse };
