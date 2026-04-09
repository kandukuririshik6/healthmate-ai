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
  let predictedConditions = [];

  if (riskLevel === 'Low Risk') {
    predictedConditions.push("General Mild Inflammation / Stress");
    if (assessmentData.sleep_hours < 7) {
      recommendations.push("Habits: Focus heavily on sleep hygiene. Aim for 8 hours. Try a 10-minute relaxing wind-down routine, like light stretching or reading, before bed.");
    }
    if (assessmentData.exercise_minutes < 30) {
      recommendations.push("Exercise: Incorporate at least 30-45 minutes of moderate aerobic activity daily. Try brisk walking, cycling, swimming, or bodyweight exercises (squats/lunges) to lower your risk profile.");
    }
  } else if (riskLevel === 'Moderate Risk') {
    predictedConditions.push("Metabolic Stress / Viral Susceptibility");
    if (assessmentData.sleep_hours < 7) recommendations.push("Habits: Focus heavily on sleep hygiene. Aim for 8 hours. Try a 10-minute relaxing wind-down routine, like light stretching or reading, before bed.");
    if (assessmentData.exercise_minutes < 30) recommendations.push("Exercise: Incorporate at least 30-45 minutes of moderate aerobic activity daily. Try brisk walking, cycling, swimming, or bodyweight exercises (squats/lunges) to lower your risk profile.");
    if (assessmentData.stress_level > 5) recommendations.push("Habits: Your stress levels are concerning. Implement daily relaxing activities like yoga (child's pose, downward dog), meditation, or a 15-minute nature walk to reduce cortisol levels.");
  } else {
    predictedConditions.push("Cardiovascular Risk / Chronic Burnout");
    recommendations.push("Medical: Consult a healthcare professional for a comprehensive checkup immediately.");
    recommendations.push("Habits: Focus heavily on sleep hygiene and stress management to prevent further health deterioration.");
  }

  if (assessmentData.symptoms.includes('chest_pain') || assessmentData.symptoms.includes('shortness_breath')) {
    predictedConditions.push("Cardiovascular Issues / Heart Disease");
    recommendations.push("URGENT: Your symptoms (chest pain/shortness of breath) require immediate medical evaluation.");
  }

  if (assessmentData.symptoms.includes('fever') || assessmentData.symptoms.includes('cough') || assessmentData.symptoms.includes('body_pain')) {
    predictedConditions.push("Viral Infection / Common Cold");
    recommendations.push("Habits: Prioritize rest and hydration. Monitor your temperature and consult a doctor if fever persists beyond 48 hours.");
  }

  if (assessmentData.symptoms.includes('fatigue')) {
    predictedConditions.push("Potential Anemia / Chronic Fatigue");
    recommendations.push("Diet: Ensure adequate iron and B12 intake. Consider a blood test if fatigue is persistent.");
  }

  if (assessmentData.symptoms.includes('nausea')) {
    predictedConditions.push("Gastrointestinal Sensitivity");
    recommendations.push("Diet: Stick to bland foods (BRAT diet) and stay hydrated with electrolytes until nausea subsides.");
  }

  if (assessmentData.symptoms.includes('frequent_urination') || assessmentData.symptoms.includes('increased_thirst')) {
    predictedConditions.push("Potential Early-stage Diabetes / Hyperglycemia");
    recommendations.push("Medical: These symptoms can be indicators of blood sugar issues. We strongly recommend a glucose screening.");
  }

  if (assessmentData.symptoms.includes('headache')) {
    predictedConditions.push("Tension Headaches / Dehydration");
    recommendations.push("Habits: Monitor triggers for your headaches, such as screen time or caffeine withdrawal.");
  }

  if (assessmentData.diet_quality.toLowerCase() === 'poor' || assessmentData.diet_quality.toLowerCase() === 'average') {
    recommendations.push("Diet: Shift to a balanced diet. Include lean proteins (chicken breast, tofu, beans), whole grains (brown rice, oats), and healthy fats (avocados, olive oil) to maximize your vitality.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Status: Your current habits are excellent! Continue maintaining this balanced lifestyle to ensure long-term vitality.");
  }

  explanation = `It takes courage to prioritize your health, and by completing this assessment, you've already taken the most important first step! Based on your current habits, you might have an elevated future risk for: ${predictedConditions.length > 0 ? predictedConditions.join(', ') : "General Mild Inflammation / Stress"}. Please remember this is just a preventative forecast, not a medical diagnosis! The great news is that your daily habits hold incredible power, and you are in the driver's seat. By proactively following the personalized diet, hydration, and exercise recommendations below, you can dramatically lower these risks and build a stronger, more resilient future. Every small, positive change you make today is a powerful investment in a more vibrant, energetic you. You've got this!`;

  return { explanation, recommendations };
}

function generateChatResponse(message) {
  const lowerMsg = message.toLowerCase();
  
  // Define Intent-Response Mapping
  const intents = [
    {
      keywords: ["hello", "hi", "hey", "greetings"],
      responses: [
        "Hello! I am HealthMate AI, your personal wellness companion. How are you feeling today?",
        "Hi there! I'm here to help you with any health or lifestyle questions. What's on your mind?",
        "Greetings! I'm HealthMate AI. Ready to work on your health goals together?"
      ]
    },
    {
      keywords: ["headache", "migraine"],
      responses: [
        "I'm sorry to hear you have a headache. It's often caused by dehydration, stress, or lack of sleep. Try drinking some water and resting in a quiet, dark room. if it's severe or persistent, please consult a professional.",
        "Headaches can be really tough. Have you been getting enough water today? Sometimes a quick break from screens can also help. Take care of yourself!"
      ]
    },
    {
      keywords: ["fever", "temperature", "chills"],
      responses: [
        "A fever is usually your body's way of fighting off an infection. Please make sure to stay hydrated and get plenty of rest. If your temperature goes above 103°F (39.4°C), seek medical attention immediately.",
        "I'm concerned to hear about your fever. It's important to monitor it closely. Rest and fluids are key right now. Do you have any other symptoms like a cough or body aches?"
      ]
    },
    {
      keywords: ["cough", "cold", "flu", "sore throat"],
      responses: [
        "Coughs and colds are very common. Warm fluids, honey, and plenty of rest can help soothe your symptoms. If you experience difficulty breathing, please see a doctor right away.",
        "That sounds uncomfortable. Make sure you're keeping warm and resting. Saltwater gargles can sometimes help with a sore throat. I hope you feel better soon!"
      ]
    },
    {
      keywords: ["sleep", "insomnia", "tired", "fatigue"],
      responses: [
        "Consistent sleep is vital for health! Try to aim for 7-9 hours. A regular wind-down routine—like reading or light stretching instead of scrolling—can really improve your sleep quality.",
        "Feeling tired? Your body might be asking for more rest or better hydration. Creating a dark, cool environment for sleep often helps. How many hours did you manage to get last night?"
      ]
    },
    {
      keywords: ["diet", "food", "nutrition", "eating", "weight"],
      responses: [
        "Nutrition is the foundation of health. Focus on whole foods like colorful vegetables, lean proteins, and healthy fats. Small, consistent changes in your diet can lead to big improvements in how you feel!",
        "A balanced diet is key. Try to minimize processed sugars and stay hydrated. Have you tried the 'Tips' section on our platform? It has some great nutritional advice!"
      ]
    },
    {
      keywords: ["exercise", "workout", "fitness", "active", "running", "gym"],
      responses: [
        "Movement is medicine! Even a 20-minute brisk walk daily has incredible benefits for your heart and mood. What kind of activities do you usually enjoy?",
        "Regular physical activity is one of the best things you can do for your health. Aim for about 150 minutes of moderate activity per week. You've got this!"
      ]
    },
    {
      keywords: ["stress", "anxiety", "overwhelmed", "mental"],
      responses: [
        "I'm sorry you're feeling stressed. Mental well-being is just as important as physical health. Deep breathing exercises or a short walk in nature can sometimes help lower cortisol levels.",
        "It's okay to feel overwhelmed sometimes. Please remember to be kind to yourself. Have you tried meditation or talking to someone you trust? Your mental health matters deeply."
      ]
    },
    {
      keywords: ["water", "hydration", "drink"],
      responses: [
        "Hydration is crucial! Aim for about 8-10 cups of water a day. It helps with energy, skin health, and even digestion. Keep a water bottle nearby as a reminder!",
        "Are you drinking enough water? It's the simplest way to boost your vitality. Try adding a slice of lemon or cucumber if you want some variety!"
      ]
    },
    {
      keywords: ["thank", "thanks", "appreciate"],
      responses: [
        "You're very welcome! I'm always here to support your health journey.",
        "Happy to help! Is there anything else you'd like to talk about?",
        "No problem at all! Stay healthy and take care."
      ]
    },
    {
      keywords: ["bye", "goodbye", "see you"],
      responses: [
        "Goodbye! Take care of yourself and see you soon.",
        "Have a wonderful, healthy day! Come back anytime you have questions.",
        "Farewell! Remember, small steps lead to big health changes. See you!"
      ]
    },
    {
      keywords: ["help", "what can you do", "features", "how to use"],
      responses: [
        "I can help you understand symptoms, provide lifestyle tips, or guide you through the Health Assessment. Speaking of which—have you taken your personalized assessment yet? It's a great way to see where you stand!",
        "I'm your HealthMate assistant! You can ask me about diet, sleep, stress, or specific symptoms. For a deeper look, check out our Assessment and Dashboard pages."
      ]
    }
  ];

  // Match Intent
  for (const intent of intents) {
    if (intent.keywords.some(k => lowerMsg.includes(k))) {
      const randomIndex = Math.floor(Math.random() * intent.responses.length);
      return intent.responses[randomIndex];
    }
  }

  // Fallback Response
  const fallbacks = [
    "That's a great question! While I'm still learning, I recommend taking our personalized Health Assessment to get a detailed risk profile based on your unique habits.",
    "Interesting! I'm continuously expanding my health knowledge. In the meantime, have you checked the 'Health Tips' page for some science-backed wellness advice?",
    "I'm not quite sure about that one yet, but I'm here to support your general wellness! Try asking me about sleep, diet, or stress management."
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

module.exports = { predictRisk, generateAdvice, generateChatResponse };
