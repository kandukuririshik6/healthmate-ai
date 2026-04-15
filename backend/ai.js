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

// --- Enhanced Chatbot Logic: Fully Trained HealthMate AI ---

// Simple Levenshtein Distance for fuzzy matching
function getLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

function isFuzzyMatch(query, keyword) {
  query = query.toLowerCase().trim();
  keyword = keyword.toLowerCase().trim();
  if (query.includes(keyword)) return true;
  const distance = getLevenshteinDistance(query, keyword);
  const tolerance = keyword.length > 5 ? 2 : 1;
  return distance <= tolerance;
}

function generateChatResponse(message) {
  const lowerMsg = message.toLowerCase().trim();
  const words = lowerMsg.split(/\s+/);
  
  // Intent-Response Mapping covering Global Health & Website features
  const intents = [
    {
      keywords: ["hello", "hi", "hey", "greetings", "good morning", "good evening"],
      responses: [
        "Welcome to HealthMate AI! I am your personal health companion. How can I help you achieve your wellness goals today?",
        "Hi! I'm here to support your journey toward a healthier lifestyle. What questions do you have for me today?",
        "Greetings! Ready to work on your vitality? I'm here for diet, exercise, or mental wellness tips!"
      ]
    },
    {
      keywords: ["headache", "migraine", "head pain"],
      responses: [
        "Headaches are often signals of dehydration, stress, or poor posture. Try a large glass of water and some deep breathing in a dark room. If it's chronic or severe, please see a healthcare provider.",
        "I'm sorry you have a headache. Have you been staring at screens for a long time? A 10-minute digital break and some gentle neck stretches might help."
      ]
    },
    {
      keywords: ["assessment", "test", "measure", "predict", "checkup", "how to use", "start"],
      responses: [
        "Our Health Assessment uses advanced ML patterns to predict potential risks based on your habits. Just head to the 'Assessment' page to get your personalized report!",
        "To get started, take our Health Assessment! It analyzes your sleep, diet, and water intake to give you actionable advice for a healthier future.",
        "The Assessment tool is the heart of HealthMate AI. It helps identify 'Serious case' vs 'Low case' risks so you can take proactive steps today."
      ]
    },
    {
      keywords: ["dashboard", "stats", "history", "tracking", "progress"],
      responses: [
        "Once you take an assessment, your 'Dashboard' will show your health history and risk trends. It's a great way to see how your lifestyle changes are paying off!",
        "The Dashboard is where you can monitor your progress over time. It stores your past assessments so you can track improvements in your sleep and hydration habits."
      ]
    },
    {
      keywords: ["tips", "advice", "science", "read", "articles"],
      responses: [
        "Looking for more knowledge? Check out our 'Health Tips' section! We have science-backed advice on everything from superfoods to advanced sleep hygiene.",
        "The Tips page is a great resource for learning about longevity and hormonal health. It’s perfect for picking up new healthy habits."
      ]
    },
    {
      keywords: ["diet", "food", "nutrition", "eating", "superfood", "carbs", "protein", "keto", "balanced"],
      responses: [
        "A 'Rainbow Plate' is the secret to longevity! Try to include 5 colors of vegetables, lean proteins, and whole grains. Healthy fats from olive oil and avocados are also vital.",
        "Focus on nutrient density. Superfoods like blueberries, salmon, spinach, and quinoa provide massive benefits for your heart and brain.",
        "Balanced nutrition means avoiding hidden sugars and processed oils. Try cooking at home more often to control your ingredients for better metabolic health!"
      ]
    },
    {
      keywords: ["exercise", "workout", "fitness", "gym", "cardio", "strength", "weights", "yoga", "swimming"],
      responses: [
        "For heart health, cardio is king! Aim for 150 minutes of moderate activity per week. Even a brisk walk daily makes a huge difference.",
        "Strength training builds muscle, which boosts your metabolism. Try bodyweight exercises like squats and planks if you're a beginner. What level of fitness are you currently at?",
        "Flexibility is often overlooked. Yoga or daily stretching improves circulation and prevents muscle stiffness as we age. It's the perfect way to finish a workout."
      ]
    },
    {
      keywords: ["habit", "routine", "morning", "night", "posture", "screen", "digital detox"],
      responses: [
        "The 'First Hour' rule is life-changing: hydrate, move for 5 minutes, and breathe deeply before checking any screens in the morning.",
        "Digital health is real health! Try to stop using screens 30 minutes before sleep to allow your brain to produce melatonin naturally.",
        "Check your posture right now! Are your shoulders back and spine straight? Good posture prevents back pain and even improves your confidence and breathing."
      ]
    },
    {
      keywords: ["sleep", "insomnia", "tired", "fatigue", "rest", "circadian"],
      responses: [
        "Sleep is the foundation of all health. Try to keep your room temperature around 65°F (18°C) for deep, restorative sleep cycles. Aim for consistent wake-times every day.",
        "Feeling tired? It might be 'Social Jetlag' from inconsistent sleep schedules. Try grounding yourself in morning sunlight for 5 minutes to reset your circadian rhythm.",
        "Avoid caffeine after 2 PM to ensure it doesn't interfere with your deep sleep. Quality of sleep is just as important as the quantity!"
      ]
    },
    {
      keywords: ["stress", "anxiety", "mindful", "mental", "meditation", "breathing"],
      responses: [
        "Mental health is physical health. Try '4-7-8' breathing: Inhale for 4, hold for 7, exhale for 8. It instantly calms your nervous system.",
        "If you're feeling overwhelmed, try a 'Mindful Walk'. Focus entirely on the sensation of your feet hitting the ground and the sounds around you. It lowers cortisol levels fast.",
        "Remember to be kind to yourself. High stress is a major risk factor for many diseases. Take 5 minutes today just for you—no phone, no work, just peace."
      ]
    },
    {
      keywords: ["water", "hydration", "thirst", "drink"],
      responses: [
        "Hydration is the easiest health win! Your cells need water for energy. Carry a reusable bottle and aim for 8-12 cups a day depending on your activity level.",
        "If you feel hungry, try drinking a glass of water first. Often, our bodies confuse thirst with hunger. Hydrated skin also stays youthful longer!"
      ]
    },
    {
      keywords: ["thank", "thanks", "helpful", "appreciate"],
      responses: [
        "You are most welcome! I'm here whenever you need health advice. Stay healthy!",
        "Happy to help! Keep making those small, positive changes—they really add up over time.",
        "My pleasure! Is there anything else about your health or our website you'd like to explore?"
      ]
    },
    {
      keywords: ["bye", "goodbye", "see you"],
      responses: [
        "Goodbye! Take care of yourself and remember: your health is your greatest wealth.",
        "Farewell! Wishing you a vibrant and energetic day. Come back anytime!",
        "Bye for now! Stay active, stay hydrated, and stay healthy."
      ]
    },
    {
      keywords: ["help", "what can you do", "features", "how to", "who are you"],
      responses: [
        "I am HealthMate AI! I can provide professional health advice on diet, sleep, and exercise. I can also help you use our Assessment Tool, view your Dashboard, or find Tips.",
        "I'm here to guide you toward better health. You can ask me medical questions, lifestyle tips, or how to navigate our platform. What's your top health goal right now?"
      ]
    }
  ];

  // Match Intent with Robustness
  let bestIntent = null;
  let highestScore = 0;

  for (const intent of intents) {
    let score = 0;
    for (const keyword of intent.keywords) {
      if (lowerMsg.includes(keyword)) {
        score += 2; 
      } else {
        for (const word of words) {
          if (word.length > 3 && isFuzzyMatch(word, keyword)) {
            score += 1;
          }
        }
      }
    }
    
    if (score > highestScore) {
      highestScore = score;
      bestIntent = intent;
    }
  }

  if (bestIntent && highestScore > 0) {
    const randomIndex = Math.floor(Math.random() * bestIntent.responses.length);
    return bestIntent.responses[randomIndex];
  }

  // Fallback Response
  const fallbacks = [
    "That's a great question! While I'm still learning more about every health aspect, I suggest using our 'Health Assessment' tool to get a detailed profile of your own risks.",
    "I'm continuously expanding my knowledge! For now, try asking me about diet, exercise, habits, or how to use our Dashboard.",
    "Interesting point! To give you the best advice, have you completed your health assessment yet? It’s the best way for me to understand your unique needs."
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

module.exports = { predictRisk, generateAdvice, generateChatResponse };
