const API_URL = 'http://localhost:3000';
const STANDALONE_MODE = true; // Set to true to bypass backend and use LocalStorage/Client-side logic only

// Helper to generate a unique, deterministic ID from email
function generateUserId(email) {
    if (!email) return 'guest_' + Date.now();
    try {
        return 'hm_' + btoa(email.toLowerCase().trim()).substring(0, 15);
    } catch (e) {
        return 'u_' + email.replace(/[^a-zA-Z0-9]/g, '_');
    }
}

// Global Password Visibility Toggle
window.togglePassword = function (inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconElement.innerText = '🙈';
    } else {
        input.type = 'password';
        iconElement.innerText = '👁️';
    }
};

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    initChatbot();
    initReveal();
    initTheme();

    // Register Form Handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = registerForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerHTML = `<span>Registering...</span>`;
            btn.disabled = true;

            const data = {
                name: document.getElementById('regName').value,
                email: document.getElementById('regEmail').value,
                age: parseInt(document.getElementById('regAge').value),
                gender: document.getElementById('regGender').value,
                password: document.getElementById('regPassword').value,
                userId: generateUserId(document.getElementById('regEmail').value)
            };

            // Password validation for special characters
            const specialCharPattern = /[!@#$%^&*(),.?":{}|<>]/g;
            if (!specialCharPattern.test(data.password)) {
                alert("For your security, your password must be strong and contain at least one special character (e.g., ! @ # $ %).");
                btn.innerText = originalText;
                btn.disabled = false;
                return;
            }

            if (STANDALONE_MODE) {
                // STANDALONE MODE: Bypass server and use local storage directly
                let users = JSON.parse(localStorage.getItem('healthmate_db') || '[]');
                if (users.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
                    alert('Email already registered! Please head to the login page.');
                } else {
                    const newUser = { id: Date.now(), name: data.name, email: data.email, age: data.age, gender: data.gender, password: data.password };
                    users.push(newUser);
                    localStorage.setItem('healthmate_db', JSON.stringify(users));
                    alert('Registration successful! Please login.');
                    window.location.href = 'login.html';
                }
                btn.innerHTML = `<span>${originalText}</span>`;
                btn.disabled = false;
                return;
            }

            try {
                const res = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();

                if (res.ok) {
                    // Always backup to local storage even if server registration succeeds
                    let users = JSON.parse(localStorage.getItem('healthmate_db') || '[]');
                    const existing = users.find(u => u.email === data.email);
                    if (!existing) {
                        users.push({ ...data, id: result.userId || Date.now() });
                        localStorage.setItem('healthmate_db', JSON.stringify(users));
                    }
                    alert('Registration successful! Please login.');
                    window.location.href = 'login.html';
                } else {
                    alert(result.error || 'Registration failed');
                }
            } catch (err) {
                // FALLBACK
                let users = JSON.parse(localStorage.getItem('healthmate_db') || '[]');
                if (users.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
                    alert('Email already registered! Please head to the login page.');
                } else {
                    const newUser = { id: Date.now(), name: data.name, email: data.email, age: data.age, gender: data.gender, password: data.password };
                    users.push(newUser);
                    localStorage.setItem('healthmate_db', JSON.stringify(users));
                    alert('Registration successful! Please login.');
                    window.location.href = 'login.html';
                }
            } finally {
                btn.innerHTML = `<span>${originalText}</span>`;
                btn.disabled = false;
            }
        });
    }

    // Login Form Handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log("Login form detected, attaching listener...");
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Login form submitted");
            const btn = loginForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerHTML = `<span>Logging in...</span>`;
            btn.disabled = true;

            const data = {
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
            };
            console.log("Attempting login for:", data.email);


            if (STANDALONE_MODE) {
                // STANDALONE MODE: Bypass server and use local storage fallback
                let users = JSON.parse(localStorage.getItem('healthmate_db') || '[]');
                const foundUser = users.find(u => u.email.toLowerCase() === data.email.toLowerCase() && u.password === data.password);

                if (foundUser) {
                    const sessionUser = { ...foundUser };
                    delete sessionUser.password;
                    localStorage.setItem('healthmate_user', JSON.stringify(sessionUser));
                    window.location.href = 'dashboard.html';
                } else {
                    showNotification('Invalid credentials! Please register first.', 'error');
                }
                btn.innerHTML = `<span>${originalText}</span>`;
                btn.disabled = false;
                return;
            }

            try {
                const res = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();

                if (res.ok && result.user) {
                    localStorage.setItem('healthmate_user', JSON.stringify(result.user));
                    window.location.href = 'dashboard.html';
                } else {
                    // Try frontend fallback even if server returned 401 (user might have registered while server was down)
                    console.warn("Server login failed, attempting local storage fallback...");
                    let users = JSON.parse(localStorage.getItem('healthmate_db') || '[]');
                    const foundUser = users.find(u => u.email.toLowerCase() === data.email.toLowerCase() && u.password === data.password);

                    if (foundUser) {
                        const sessionUser = { ...foundUser };
                        delete sessionUser.password;
                        localStorage.setItem('healthmate_user', JSON.stringify(sessionUser));
                        window.location.href = 'dashboard.html';
                    } else {
                        alert(result.error || 'Invalid credentials');
                    }
                }
            } catch (err) {
                console.warn("Login API error, using frontend fallback:", err);
                // FALLBACK
                let users = JSON.parse(localStorage.getItem('healthmate_db') || '[]');
                const foundUser = users.find(u => u.email.toLowerCase() === data.email.toLowerCase() && u.password === data.password);

                if (foundUser) {
                    const sessionUser = { ...foundUser };
                    delete sessionUser.password;
                    localStorage.setItem('healthmate_user', JSON.stringify(sessionUser));
                    window.location.href = 'dashboard.html';
                } else {
                    showNotification('Invalid credentials! Please register first.', 'error');
                }
            } finally {
                btn.innerHTML = `<span>${originalText}</span>`;
                btn.disabled = false;
            }
        });
    }

    // Assessment Form Handler
    const assessmentForm = document.getElementById('assessmentForm');
    if (assessmentForm) {
        // Enforce user authentication for assessment
        const user = JSON.parse(localStorage.getItem('healthmate_user'));
        if (!user) {
            alert('Please login to perform a health assessment.');
            window.location.href = 'login.html';
            return;
        }

        assessmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = assessmentForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerHTML = `<span>Analyzing...</span>`;
            btn.disabled = true;

            const symptomsNodes = document.querySelectorAll('#symptomsGroup input:checked');
            const symptoms = Array.from(symptomsNodes).map(n => n.value);

            const data = {
                userId: user.id || generateUserId(user.email),
                sleep_hours: parseFloat(document.getElementById('sleepHours').value),
                exercise_minutes: parseInt(document.getElementById('exerciseMinutes').value),
                water_intake: parseInt(document.getElementById('waterIntake').value),
                stress_level: parseInt(document.getElementById('stressLevel').value),
                diet_quality: document.getElementById('dietQuality').value,
                symptoms: symptoms
            };

            if (STANDALONE_MODE) {
                handleStandaloneAssessment(data, btn, originalText);
                return;
            }

            try {
                const res = await fetch(`${API_URL}/predict`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();

                if (res.ok) {
                    showAssessmentResult(result);
                } else {
                    showNotification('Assessment failed. Please check your inputs.', 'error');
                }
            } catch (err) {
                console.warn("Prediction Backend offline, using Proactive Analysis Engine:", err);
                const result = runProactiveAnalysis(data);
                showAssessmentResult(result);

                // Track history in offline DB
                let userHistory = JSON.parse(localStorage.getItem('healthmate_history_' + user.email) || '[]');
                userHistory.unshift({
                    date: new Date().toISOString(),
                    risk_level: result.riskLevel,
                    sleep_hours: data.sleep_hours,
                    exercise_minutes: data.exercise_minutes,
                    stress_level: data.stress_level,
                    water_intake: data.water_intake
                });
                localStorage.setItem('healthmate_history_' + user.email, JSON.stringify(userHistory));
            } finally {
                btn.innerHTML = `<span>${originalText}</span>`;
                btn.disabled = false;
            }
        });
    }

    // Dashboard Handler
    if (window.location.pathname.endsWith('dashboard.html')) {
        loadDashboard();
    }

    // Logout Handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('healthmate_user');
            window.location.href = 'index.html';
        });
    }
});

function updateAuthUI() {
    const user = JSON.parse(localStorage.getItem('healthmate_user'));

    // Auth redirect rules
    const path = window.location.pathname.toLowerCase();
    const isDashboard = path.includes('dashboard.html');
    const isLogin = path.includes('login.html');
    const isRegister = path.includes('register.html');

    if (!user && isDashboard) {
        window.location.href = 'login.html';
        return;
    }
    if (user && (isLogin || isRegister)) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Show/hide nav links
    const guestLinks = document.querySelectorAll('.guest-only');
    const userLinks = document.querySelectorAll('.user-only');

    if (user) {
        guestLinks.forEach(el => el.style.display = 'none');
        userLinks.forEach(el => el.style.display = 'block');
    } else {
        guestLinks.forEach(el => el.style.display = 'block');
        userLinks.forEach(el => el.style.display = 'none');
    }
}

function showAssessmentResult(result) {
    const card = document.getElementById('resultCard');
    const levelDisplay = document.getElementById('riskLevelDisplay');
    const explanationText = document.getElementById('explanationText');
    const recsList = document.getElementById('recommendationsList');

    card.style.display = 'block';

    // Update risk level UI
    levelDisplay.textContent = result.riskLevel;
    levelDisplay.className = 'risk-level'; // reset
    if (result.riskLevel === 'Low Risk') levelDisplay.classList.add('risk-Low');
    else if (result.riskLevel === 'Moderate Risk') levelDisplay.classList.add('risk-Moderate');
    else if (result.riskLevel === 'High Risk') levelDisplay.classList.add('risk-High');

    // Update explanation
    explanationText.textContent = result.explanation;

    // Update recommendations
    recsList.innerHTML = '';
    result.recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;
        recsList.appendChild(li);
    });

    // Scroll to results
    card.scrollIntoView({ behavior: 'smooth' });
}

async function loadDashboard() {
    const user = JSON.parse(localStorage.getItem('healthmate_user'));
    if (!user) return;

    // Set profile info
    document.getElementById('profileInitials').textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    document.getElementById('profileName').textContent = user.name || 'User Name';
    document.getElementById('profileEmail').textContent = user.email || 'user@example.com';
    document.getElementById('profileAge').textContent = user.age || '--';
    document.getElementById('profileGender').textContent = user.gender || '--';

    // Fetch history
    if (STANDALONE_MODE) {
        handleStandaloneDashboard(user);
        return;
    }

    try {
        const userId = user.id || generateUserId(user.email);
        const res = await fetch(`${API_URL}/history?userId=${userId}`);
        const result = await res.json();

        const tbody = document.getElementById('historyTableBody');

        if (result.history) {
            renderDashboardData(result.history);
        } else {
            renderDashboardData([]);
        }

    } catch (err) {
        console.warn("Dashboard API error, using local fallback:", err);
        let userHistory = JSON.parse(localStorage.getItem('healthmate_history_' + user.email) || '[]');
        renderDashboardData(userHistory);
    }
}

function initChatbot() {
    const chatHTML = `
        <div id="ai-chatbot" class="chatbot-widget">
            <div class="chatbot-header" id="chatbot-toggle">
                <span>HealthMate AI Assistant</span>
                <span id="chatbot-icon">▲</span>
            </div>
            <div class="chatbot-body" id="chatbot-body" style="display: none;">
                <div class="chatbot-messages" id="chatbot-messages">
                    <div class="message bot">Hi there! I'm your AI health companion. How can I help you today?</div>
                </div>
                <div class="quick-replies" id="quick-replies">
                    <button class="qr-btn" data-query="How to sleep better?">💤 Sleep Tips</button>
                    <button class="qr-btn" data-query="Heart health advice">❤️ Heart Health</button>
                    <button class="qr-btn" data-query="Stress management">🧘 Stress Relief</button>
                    <button class="qr-btn" data-query="Analyze my risk">📊 Risk Analysis</button>
                </div>
                <div class="chatbot-inputArea">
                    <input type="text" id="chatbot-input" placeholder="Ask about symptoms, diet, or lifestyle..." autocomplete="off">
                    <button id="chatbot-send" class="btn btn-primary" style="padding: 0.6rem 1.2rem; min-width: auto; border-radius: 12px;"><span>Send</span></button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatHTML);

    const toggleBtn = document.getElementById('chatbot-toggle');
    const body = document.getElementById('chatbot-body');
    const icon = document.getElementById('chatbot-icon');

    toggleBtn.addEventListener('click', () => {
        if (body.style.display === 'none') {
            body.style.display = 'flex';
            icon.textContent = '▼';
        } else {
            body.style.display = 'none';
            icon.textContent = '▲';
        }
    });

    const sendBtn = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');
    const messages = document.getElementById('chatbot-messages');

    // Quick Reply Click Handlers
    document.getElementById('quick-replies').addEventListener('click', (e) => {
        if (e.target.classList.contains('qr-btn')) {
            const query = e.target.getAttribute('data-query');
            input.value = query;
            sendMessage();
        }
    });

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        appendMessage(messages, 'user', text);

        if (STANDALONE_MODE) {
            handleStandaloneChat(text, messages, input);
            return;
        }

        const loadingId = 'loading-' + Date.now();
        const loadingEl = appendMessage(messages, 'bot loading', '<span class="dot"></span><span class="dot"></span><span class="dot"></span>', loadingId);

        try {
            const res = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await res.json();
            if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);

            if (res.ok) {
                appendMessage(messages, 'bot', data.response);
            } else {
                appendMessage(messages, 'bot error', "Error: Couldn't connect.");
            }
        } catch (e) {
            if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
            const fallbackResponse = getChatbotResponse(text);
            appendMessage(messages, 'bot', fallbackResponse);
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

    function appendMessage(messages, type, content, id = null) {
        const div = document.createElement('div');
        div.className = `message ${type}`;
        if (id) div.id = id;
        div.innerHTML = content;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        return div;
    }

    function handleStandaloneChat(text, messages, input) {
        const loadingId = 'loading-' + Date.now();
        const loadingEl = appendMessage(messages, 'bot loading', '<span class="dot"></span><span class="dot"></span><span class="dot"></span>', loadingId);

        setTimeout(() => {
            const response = getChatbotResponse(text);
            
            // Safe removal
            if (loadingEl && loadingEl.parentNode) {
                loadingEl.parentNode.removeChild(loadingEl);
            }

            appendMessage(messages, 'bot', response);
        }, 800);
    }

    function getChatbotResponse(message) {
        const lowerMsg = message.toLowerCase().trim();
        if (!lowerMsg) return "I'm listening! Please feel free to ask me anything about your health or how to use this platform.";

        const intents = [
            {
                keywords: ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening", "how are you", "what's up", "yo"],
                responses: [
                    "Hello! I am HealthMate AI, your dedicated wellness companion. How can I help you improve your life today?",
                    "Hi there! I'm ready to dive into your health goals with you. What's on your mind?",
                    "Greetings! I'm here to support your journey toward a healthier, more vibrant life. How are you feeling?",
                    "Hi! It's a great day to work on your health. What can I assist you with right now?",
                    "Hello! I'm HealthMate AI. Whether it's fitness, diet, or symptoms, I'm here to listen."
                ]
            },
            {
                keywords: ["analyze", "risk", "check my status", "how am i doing", "evaluate", "am i healthy", "risk level", "analysis", "assessment result"],
                responses: [
                    "To analyze your risk, I look at your latest assessment data (sleep, exercise, stress, and symptoms). Take a 'New Assessment' if you haven't already, then check your Dashboard for the final score!",
                    "I evaluate your health risk using a neural network model. Your risk level changes based on your daily habits. Have you completed today's assessment yet?",
                    "You can see your real-time risk analysis on the Dashboard. If you're feeling a bit off, try taking a new assessment so I can update your status immediately.",
                    "My analysis thrives on data. The more consistently you track your habits in the assessment section, the more accurately I can predict your health risks."
                ]
            },
            {
                keywords: ["who are you", "what is this", "about you", "what do you do", "introduce"],
                responses: [
                    "I am HealthMate AI, an advanced wellness assistant designed to help you track habits, analyze symptoms, and predict health risks using science-backed patterns.",
                    "Think of me as your 24/7 health companion. I can help you understand your body, stay motivated, and navigate your wellness journey with data-driven insights.",
                    "I am a specialized AI engine built to empower you with proactive health advice. I analyze your assessments to give you a clear picture of your vitality.",
                    "I'm here to bridge the gap between your health data and your daily habits. I provide tips, symptom analysis, and risk tracking to keep you at your best."
                ]
            },
            {
                keywords: ["doctor", "are you a doctor", "medical professional", "physician", "medical advice"],
                responses: [
                    "No, I am an Artificial Intelligence, not a licensed medical professional. My advice is for educational and preventive purposes only. Always consult a doctor for diagnosis.",
                    "I am an AI wellness assistant. While I can provide health suggestions based on data, I am not a substitute for professional medical advice, diagnosis, or treatment.",
                    "Important: I do not provide medical diagnoses. My role is to help you track and understand wellness patterns. Please see a physician for any specific health concerns.",
                    "I'm an AI, not a doctor. My responses are based on general health guidelines and your provided data. Always prioritize a consultation with a real medical expert."
                ]
            },
            {
                keywords: ["emergency", "severe", "chest pain", "can't breathe", "shortness of breath", "bleeding", "stroke", "heart attack", "unconscious"],
                responses: [
                    "⚠️ **IMMEDIATE ACTION REQUIRED**: If you are experiencing a medical emergency like severe chest pain or difficulty breathing, please call your local emergency services (like 911) or visit the nearest ER immediately.",
                    "I am detecting symptoms that could be life-threatening. Please stop using this app and seek immediate professional medical attention. Seconds count in an emergency.",
                    "⚠️ This sounds like an emergency. Do not wait for an AI response. Call emergency services right now.",
                    "Your symptoms indicate a possible critical emergency. Please contact emergency medical services immediately."
                ]
            },
            {
                keywords: ["heart", "palpitation", "heart racing", "fluttering", "irregular heartbeat", "pounding chest"],
                responses: [
                    "Heart palpitations can be caused by stress, caffeine, or dehydration, but they can also signal underlying issues. If you have chest pain or faintness, seek medical help immediately.",
                    "An irregular or racing heart should always be evaluated by a cardiologist. Try to track when they happen—is it after coffee, during stress, or at rest? This info helps your doctor.",
                    "If your heart feels like it's skipping beats or racing, try to stay calm and sit down. If it lasts more than a few minutes or returns often, please schedule a check-up.",
                    "Caffeine and nicotine are common triggers for palpitations. However, persistent 'fluttering' in the chest needs a professional EKG to rule out serious conditions."
                ]
            },
            {
                keywords: ["blood pressure", "hypertension", "hypotension", "bp"],
                responses: [
                    "Blood pressure is a key vital. Hypertension (high BP) is often 'silent'. Aim for 120/80 mmHg. Reducing sodium and increasing potassium can help, but medication must be managed by a doctor.",
                    "If your BP is low (hypotension), you might feel dizzy when standing up. Increasing salt and fluids can help, but you should discuss the cause with a physician.",
                    "Consistent tracking of your blood pressure is vital for long-term heart health. Our assessment helps identify if your lifestyle is increasing your risk.",
                    "High blood pressure is a leading risk factor for stroke. Regular cardio and managing stress through mindfulness are scientifically proven ways to support healthy levels."
                ]
            },
            {
                keywords: ["cholesterol", "ldl", "hdl", "triglycerides"],
                responses: [
                    "Cholesterol management is about the balance between HDL (good) and LDL (bad). Increasing fiber and healthy fats like Omega-3s can significantly improve your profile.",
                    "High LDL cholesterol can lead to arterial plaque. Regular exercise and avoiding trans fats are the best natural ways to keep your heart healthy.",
                    "If your triglycerides are high, consider reducing refined sugars and alcohol. A Mediterranean-style diet is often recommended for better cholesterol levels.",
                    "Always discuss your blood panel results with a doctor. My data analysis can help identify lifestyle habits that might be influencing your cholesterol numbers."
                ]
            },
            {
                keywords: ["asthma", "wheezing", "tight chest", "bronchitis"],
                responses: [
                    "Asthma is a chronic condition that requires a proper management plan from a doctor. Ensure you have your rescue inhaler available and try to identify triggers like pollen or pet dander.",
                    "Wheezing or a tight chest can indicate airway inflammation. If you find yourself using your rescue inhaler more than twice a week, your asthma might not be well-controlled.",
                    "Managing air quality and humidity in your home can help with respiratory comfort. However, please consult a pulmonologist for a personalized treatment plan.",
                    "Asthma triggers vary. Some people react to cold air, others to exercise. Tracking these events can help you and your doctor manage the condition better."
                ]
            },
            {
                keywords: ["acid reflux", "gerd", "heartburn", "indigestion"],
                responses: [
                    "Heartburn is often caused by stomach acid backing up into the esophagus. Avoiding large meals before bed and reducing spicy/acidic foods can offer significant relief.",
                    "GERD can be serious if left untreated. Try 'propped up' sleeping and small, frequent meals. If you have persistent trouble swallowing, see a doctor immediately.",
                    "Common triggers for acid reflux include caffeine, alcohol, and chocolate. Losing a bit of weight if you're overweight can also reduce the pressure on your stomach.",
                    "Ginger tea is a great natural aid for mild indigestion. If you're using antacids every day, it's time to speak with a professional about long-term management."
                ]
            },
            {
                keywords: ["bloating", "gas", "constipation", "diarrhea", "ibs", "gut", "stomach pain", "tummy ache", "digestion"],
                responses: [
                    "Digestive issues are often linked to fiber intake and hydration. For constipation, ensure you're getting enough soluble fiber and water. For diarrhea, focus on electrolytes.",
                    "IBS (Irritable Bowel Syndrome) is complex. A 'Low FODMAP' diet is often used to identify triggers. Stress also plays a huge role in gut health due to the brain-gut axis.",
                    "Persistent bloating can be a sign of food intolerances or small intestinal bacterial overgrowth. Try keeping a food diary to find out what's causing your discomfort.",
                    "Probiotics and prebiotics support a healthy gut microbiome. Fiber-rich foods like oats, beans, and berries are essential for keeping your digestion regular."
                ]
            },
            {
                keywords: ["sleep", "sleeping", "insomnia", "tired", "rest", "night", "can't sleep", "sleepy", "bedtime"],
                responses: [
                    "Sleep is the ultimate high-performance drug! Aim for 7-9 hours. A 'digital detox' 30 minutes before bed can significantly improve your REM sleep quality. Check your Sleep Consistency chart on the Dashboard!",
                    "Quality matters! Try to keep your room cool (around 18°C/65°F) and dark. Avoid caffeine after 2 PM to ensure your adenosine levels are ready for rest by bedtime.",
                    "If you're having trouble falling asleep, try 'progressive muscle relaxation' or a white noise machine. Consistent sleep/wake times are the foundation of a healthy circadian rhythm.",
                    "Struggling with insomnia? It might be related to stress or blue light exposure. Our 'Health Tips' section has a guide on building the perfect wind-down routine.",
                    "Sleep deprivation can mimic ADHD symptoms and raise your risk for heart issues. Prioritizing rest is the single best thing you can do for your health today."
                ]
            },
            {
                keywords: ["fatigue", "tiredness", "exhaustion", "no energy", "anemia", "weak", "lethargic", "always tired"],
                responses: [
                    "Persistent fatigue can be a sign of many things, from simple dehydration to iron-deficiency anemia. Ensure you're getting enough protein and iron-rich foods like spinach and lentils.",
                    "Feeling weak or lethargic? Check your B12 and Vitamin D levels. If you're also experiencing shortness of breath or paleness, please consult a doctor for a blood panel.",
                    "Fatigue is often the result of cumulative stress. Are you taking enough 'micro-breaks' during the day? Sometimes just 5 minutes of deep breathing can restore your energy.",
                    "Low energy can also be linked to your blood sugar. Avoid the 'sugar crash' by choosing complex carbs like oats or quinoa over refined sweets.",
                    "If you're 'always tired' despite getting 8 hours of sleep, it's worth discussing with a professional to rule out conditions like sleep apnea or thyroid issues."
                ]
            },
            {
                keywords: ["joint pain", "arthritis", "stiff joints", "knee pain", "hip pain", "aching bones", "joint stiffness", "painful joints"],
                responses: [
                    "Joint pain can be inflammatory (like Rheumatoid Arthritis) or wear-and-tear (Osteoarthritis). Low-impact movement like swimming or cycling helps keep joints mobile without extra stress.",
                    "Stiffness in the morning that lasts more than 30 minutes should be evaluated by a rheumatologist. Omega-3 supplements and turmeric are often used for natural inflammation support.",
                    "Protect your joints by maintaining a healthy weight. Extra kilos put significant pressure on your knees and hips. Strength training also supports the muscles around the joints.",
                    "Warm compresses can help with stiffness, while ice is better for acute inflammation. If a joint is hot, red, and swollen, seek medical attention to rule out infection."
                ]
            },
            {
                keywords: ["muscle cramp", "spasm", "charlie horse", "tight muscle", "muscle pain", "sore muscle", "aching muscles"],
                responses: [
                    "Muscle cramps are usually caused by dehydration or electrolyte imbalances (Magnesium, Potassium, Calcium). Ensure you're drinking enough water during and after exercise.",
                    "If you get frequent night cramps, try gentle stretching before bed and check your magnesium levels. A warm bath with Epsom salts can also relax the muscles.",
                    "Acute spasms can sometimes be a sign of muscle strain. Rest, ice, and gentle stretching are the standard recovery steps. If the pain is severe, see a professional.",
                    "Ensure you're warming up properly before intense activity. Cramps are often your body's way of saying the muscle is fatigued or under-fueled."
                ]
            },
            {
                keywords: ["headache", "migraine", "head pain", "tension"],
                responses: [
                    "Headaches are often signals—check hydration, stress, and sleep first. Tension headaches feel like a tight band around the head, while migraines are usually throbbing and one-sided.",
                    "Migraines can be debilitating. Dark rooms, cold compresses, and avoiding triggers like aged cheeses or nitrates can help. Track your migraines in your assessment history!",
                    "If your headache comes on suddenly and is the most severe you've ever felt ('thunderclap'), call emergency services immediately. It could be serious.",
                    "Screen time and poor neck posture are leading causes of tension headaches. Try the 'chin tuck' stretch and take regular breaks from your device."
                ]
            },
            {
                keywords: ["dizzy", "dizziness", "lightheaded", "faint", "vertigo"],
                responses: [
                    "Dizziness can be caused by low blood sugar, dehydration, or inner ear issues. Sit down immediately if you feel faint to avoid a fall. Drink some water or have a small snack.",
                    "Vertigo (the feeling that the room is spinning) often stems from the inner ear. If it's accompanied by vision changes or slurred speech, seek emergency care immediately.",
                    "Standing up too quickly can cause a drop in blood pressure (orthostatic hypotension), leading to dizziness. Take your time when getting out of bed.",
                    "Persistent dizziness requires a medical check-up to rule out heart issues or anemia. Keep track of when it happens to help your doctor diagnose the cause."
                ]
            },
            {
                keywords: ["nausea", "vomiting", "sick to stomach", "feel sick", "puking", "upset stomach", "queasy"],
                responses: [
                    "Nausea is a common symptom of everything from food poisoning to stress. Peppermint or ginger tea can be very effective natural remedies.",
                    "If you're vomiting frequently, the biggest risk is dehydration. Sip small amounts of clear fluids or electrolyte drinks. Seek help if you can't keep water down for 24 hours.",
                    "Rest and avoiding strong odors are key when you feel nauseous. The BRAT diet (Bananas, Rice, Applesauce, Toast) is gentle on the stomach as you recover.",
                    "Chronic nausea might be related to acid reflux or gastroparesis. It's important to discuss persistent stomach issues with a gastroenterologist."
                ]
            },
            {
                keywords: ["fever", "temperature", "chills", "hot", "sweating"],
                responses: [
                    "A fever is usually your body's immune system fighting an infection. Rest, hydration, and light clothing are recommended. Monitor it closely—especially if it hits 103°F (39.4°C).",
                    "Stay hydrated! Fevers cause you to lose fluids through sweating. Water, broth, and herbal teas are excellent. If the fever lasts more than 3 days, see a doctor.",
                    "A fever accompanied by a stiff neck or a rash is an emergency—please seek immediate medical attention. Otherwise, focus on comfort and rest.",
                    "Listen to your body. If you have a fever plus a new cough or body aches, you may have a virus. Isolate if necessary and prioritize recovery."
                ]
            },
            {
                keywords: ["eye strain", "dry eyes", "blurry vision", "screen fatigue"],
                responses: [
                    "The 20-20-20 rule is vital for digital life: every 20 minutes, look 20 feet away for 20 seconds. This relaxes the focusing muscles in your eyes.",
                    "Dry eyes are common in air-conditioned or screen-heavy environments. Try to blink more often or use artificial tears. Ensure your workstation lighting is balanced.",
                    "If your vision is suddenly blurry or you see 'floaters' or flashes of light, seek an urgent eye exam. These can be signs of serious retinal issues.",
                    "Reduce blue light exposure in the evening to help your eyes relax and improve your sleep quality. Many devices have a 'night mode' for this exact reason."
                ]
            },
            {
                keywords: ["rash", "skin", "itchy", "eczema", "hives", "acne"],
                responses: [
                    "Skin rashes often signal an allergic reaction or irritation. Avoid scratching, use mild soaps, and try a cool compress. If the rash is painful or blistering, see a doctor.",
                    "Hives are usually an allergic response. If you have hives along with swelling of the face or trouble breathing, use an EpiPen (if prescribed) and call 911 immediately.",
                    "Eczema or dry skin requires constant moisturization. Natural oils or unscented creams are best. Stay hydrated, as your skin health reflects your internal hydration.",
                    "Acne is often tied to hormonal changes or diet. Focus on a low-sugar diet and gentle cleansing. If it's persistent and inflammatory, a dermatologist can provide medical treatments."
                ]
            },
            {
                keywords: ["panic attack", "cant breathe", "anxiety attack"],
                responses: [
                    "A panic attack can feel like it will never end, but it will. Try 'square breathing': inhale for 4, hold for 4, exhale for 4, hold for 4. Focus on your surroundings.",
                    "If you feel a panic attack coming, try the 5-4-3-2-1 technique: identify 5 things you see, 4 you feel, 3 you hear, 2 you smell, and 1 you taste. This ground you in the present.",
                    "Panic attacks can mimic heart attacks. If you have crushing chest pain or pain radiating to your arm, call 911 immediately just to be safe. Otherwise, focus on slow, deep breaths.",
                    "Anxiety is your brain's 'alarm system' going off too early. It's uncomfortable but not dangerous. Remind yourself: 'I am safe, and this will pass'."
                ]
            },
            {
                keywords: ["lonely", "loneliness", "depressed", "sad", "unhappy"],
                responses: [
                    "I'm sorry you're feeling this way. Connection is a basic human need. Even a small interaction, like saying hello to a neighbor, can start to shift the feeling of loneliness.",
                    "Isolation can take a toll on physical health too. If you've been feeling low for more than two weeks, please reach out to a mental health professional or a support line.",
                    "You're not alone in feeling this way. Many people go through periods of sadness or isolation. Try to find one small activity today that brings you even a tiny bit of joy.",
                    "Focus on 'micro-connections'. A text to a friend or a short walk in a public place can help. Your mental health matters—don't be afraid to ask for help from those you trust."
                ]
            },
            {
                keywords: ["burnout", "exhausted", "stressed", "overwhelmed"],
                responses: [
                    "Burnout is your body's way of demanding rest. You cannot pour from an empty cup. Prioritize sleep, say 'no' to new commitments, and take a true break if possible.",
                    "Stress management is a skill. Try mindfulness or light exercise. If your stress is chronic, it can lead to physical issues, so it's important to find balance.",
                    "Feeling overwhelmed? Break your day into tiny tasks. Focus only on the 'next right thing'. And remember, it's okay to ask for support from colleagues or family.",
                    "Recovery from burnout takes time. Be patient with yourself. Focus on basic needs: hydration, nutritious food, and movement. Your productivity is not your worth."
                ]
            },
            {
                keywords: ["social anxiety", "shy", "nervous around people"],
                responses: [
                    "Social anxiety is common. Try to focus outward on the conversation rather than inward on your own feelings. Small, low-pressure social exposures can help build confidence.",
                    "If you feel nervous in crowds, try to 'find your exit' or have a 'safe person' with you. Deep breathing before an event can also calm your social jitters.",
                    "Remember that most people are more focused on themselves than on you! Be kind to yourself as you navigate social situations.",
                    "Therapy, especially Cognitive Behavioral Therapy, is highly effective for social anxiety. You don't have to face your fears alone."
                ]
            },
            {
                keywords: ["adhd", "focus", "concentration", "distracted", "productive"],
                responses: [
                    "Struggling to focus? Try the 'Pomodoro Technique': work for 25 minutes, then take a 5-minute break. This keeps your brain fresh and managed.",
                    "Eliminate digital distractions! Put your phone in another room. A clear workspace often leads to a clear mind. Try to do your most demanding task first thing in the morning.",
                    "ADHD brains often thrive on 'interest-based' tasks. If a task is boring, try to find a way to make it novel or challenging. Exercise before work can also boost dopamine and focus.",
                    "Ensure you're sleeping enough. Sleep deprivation mimics ADHD symptoms and makes focusing almost impossible. A consistent routine is your best tool for productivity."
                ]
            },
            {
                keywords: ["keto", "ketogenic", "low carb", "high fat", "no sugar diet"],
                responses: [
                    "The Keto diet shifts your body to burn fat for fuel. It's effective for some but can cause the 'Keto Flu' (fatigue, headaches) initially. Ensure you're getting enough electrolytes!",
                    "Keto is very restrictive. It can be great for blood sugar control, but may be hard on the kidneys if not done correctly. Consult a nutritionist before going long-term.",
                    "Don't forget the fiber! Keto can lead to constipation if you don't eat enough leafy greens. Avocado, nuts, and seeds are your best friends here.",
                    "Is Keto right for you? It depends on your metabolic goals. Our assessment can help you track your energy levels as you experiment with different dietary patterns."
                ]
            },
            {
                keywords: ["vegan", "plant based", "no meat", "vegetarian"],
                responses: [
                    "A plant-based diet is linked to lower risks of heart disease and diabetes. Be sure to supplement Vitamin B12 and monitor your Iron and Zinc levels.",
                    "Going vegan is a big transition. Focus on whole foods (legumes, grains, veggies) rather than highly processed mock meats for the best health outcomes.",
                    "Plant proteins like lentils, tofu, and quinoa are excellent. Pairing iron-rich plants with Vitamin C (like lemon on spinach) boosts absorption significantly.",
                    "Whether for ethics or health, a vegan lifestyle requires planning. Use our 'Health Tips' section to find guides on balanced plant-based nutrition."
                ]
            },
            {
                keywords: ["intermittent fasting", "if", "fasting window", "16:8"],
                responses: [
                    "Intermittent Fasting (IF) can support metabolic health and weight loss. The 16:8 method is the most popular. Remember, it's about *timing*, but *quality* of food still matters.",
                    "Fasting isn't about starving; it's about giving your digestive system and insulin levels a break. Stay hydrated with water, black coffee, or tea during fasting hours.",
                    "Some people find IF helps with mental clarity and energy. However, if you have a history of eating disorders or are pregnant, it's not recommended.",
                    "Start slow—try 12 hours of fasting first. Listen to your body's hunger cues. If you feel dizzy or weak, break your fast and try a different approach."
                ]
            },
            {
                keywords: ["mediterranean diet", "healthy fats", "olive oil", "dash diet"],
                responses: [
                    "The Mediterranean and DASH diets are heart-healthy gold standards. They emphasize olive oil, fish, nuts, and a colorful array of fruits and vegetables.",
                    "Focus on 'good' fats (Omega-3s) and whole grains. These diets are proven to reduce the risk of stroke, heart disease, and cognitive decline as you age.",
                    "The DASH diet is specifically designed to lower blood pressure. It's rich in potassium, calcium, and magnesium. Check our tips for heart-healthy shopping lists!",
                    "Think of it as a lifestyle, not a diet. Enjoying meals with others and staying active are key components of the Mediterranean approach to wellness."
                ]
            },
            {
                keywords: ["vitamin d", "sun vitamin", "summer vitamin"],
                responses: [
                    "Vitamin D is vital for bone health and immune function. Most people find they are deficient in the winter. 15 minutes of sun exposure daily can help, but many need supplements.",
                    "Low Vitamin D is linked to mood drops ('Seasonal Affective Disorder'). If you feel low in winter, get your levels checked by a doctor.",
                    "Fatty fish, egg yolks, and fortified foods are dietary sources, but the sun is the most efficient. Don't forget your SPF if you're out for longer periods!",
                    "Vitamin D works with Calcium to keep your bones strong. It's especially important for those living in northern latitudes or who spend most time indoors."
                ]
            },
            {
                keywords: ["protein", "whey", "amino acids", "muscle building"],
                responses: [
                    "Protein is the building block of muscle and skin. Aim for 0.8g to 1.6g per kilo of body weight depending on your activity level. Variety is key!",
                    "Plant proteins (beans, soy) are just as effective as animal proteins when you get a wide variety of amino acids. Don't skip your legumes!",
                    "Consuming protein after a workout helps with muscle repair. You don't need a massive shake—a balanced meal with ~20-30g of protein is usually enough.",
                    "As you age, protein becomes even more important to prevent muscle loss (sarcopenia). Ensure every meal has a quality protein source."
                ]
            },
            {
                keywords: ["sugar", "sweet", "carbs", "diabetes basics"],
                responses: [
                    "Refined sugar is a leading cause of inflammation and weight gain. Try to swap sugary snacks for whole fruits, which contain fiber to slow down sugar absorption.",
                    "Diabetes involves issues with insulin—the hormone that manages blood sugar. If you're constantly thirsty or urinating often, get your A1C levels checked.",
                    "Total carbs aren't always the enemy, but 'simple' carbs (white bread, soda) cause blood sugar spikes. Choose complex carbs like sweet potatoes and brown rice.",
                    "Reducing sugar can improve your skin, energy levels, and heart health. Our 'Health Tips' have a great guide on hidden sugars in processed foods."
                ]
            },
            {
                keywords: ["water", "hydration", "drink", "thirsty", "electrolytes"],
                responses: [
                    "Hydration is the simplest way to boost your health. Aim for 2-3 liters a day. If your urine is pale yellow, you're doing great!",
                    "Thirst is a late signal—you're already slightly dehydrated by the time you feel it. Keep a reusable bottle on your desk as a visual reminder.",
                    "If you're exercising intensely or sweating a lot, you need electrolytes (Salt, Potassium, Magnesium) alongside water. Plain water isn't always enough to rehydrate.",
                    "Proper hydration improves focus, digestion, and skin health. It even helps your body regulate its temperature. Drink up!"
                ]
            },
            {
                keywords: ["caffeine", "coffee", "tea", "energy drink", "jitters"],
                responses: [
                    "Caffeine is a powerful stimulant. While 1-2 cups of coffee have health benefits, too much can lead to anxiety, jitters, and poor sleep. Know your limit!",
                    "Caffeine has a half-life of 5-6 hours. If you drink a cup at 4 PM, half of it is still in your system at 10 PM. Try to have your last cup before 2 PM.",
                    "Green tea provides a more 'gentle' energy boost thanks to L-Theanine, which calms the caffeine jitters. It's also packed with antioxidants.",
                    "If you're relying on energy drinks to get through the day, you might be masking chronic sleep deprivation. Focus on quality rest first!"
                ]
            },
            {
                keywords: ["exercise", "workout", "fitness", "active", "walking", "gym", "hiit", "cardio"],
                responses: [
                    "Exercise is the closest thing we have to a miracle cure. Aim for at least 150 minutes of moderate activity per week. Even walking counts!",
                    "HIIT (High-Intensity Interval Training) is great for heart health and time efficiency. 20 minutes can be more effective than an hour of slow walking.",
                    "Strength training is vital for longevity. It protects your joints, boosts metabolism, and keeps your bones strong. Try to lift weights twice a week.",
                    "Consistency > Intensity. If you can only do 10 minutes today, do 10 minutes. It's about building the habit of daily movement."
                ]
            },
            {
                keywords: ["lazy", "no motivation", "unmotivated", "hard to start"],
                responses: [
                    "Motivation is often the *result* of action, not the cause. Use the '2-minute rule': just put on your gym shoes. Usually, that's enough to get you moving.",
                    "Don't wait for the 'perfect' time. It doesn't exist. Start where you are, with what you have. One small win today is better than a perfect plan tomorrow.",
                    "Feeling lazy might just be a sign your body needs rest or better nutrition. If it's mental, try a quick change of environment—go outside for 5 minutes.",
                    "Reward yourself! Celebrate the small wins, like choosing a salad or finishing a walk. Positive reinforcement builds long-term habits."
                ]
            },
            {
                keywords: ["recovery", "rest days", "stretching", "cool down"],
                responses: [
                    "Recovery is when your muscles actually grow and your body heals. Don't skip your rest days! Overtraining can lead to injury and burnout.",
                    "Dynamic stretching is best *before* exercise, while static stretching (holding a pose) is better *after* to help with flexibility and cooling down.",
                    "Sleep is the #1 recovery tool. No supplement or massage can replace 8 hours of quality rest. Your Dashboard tracks your sleep consistency—check it out!",
                    "Active recovery—like a slow walk or gentle yoga—can help reduce muscle soreness after a hard workout by increasing blood flow to the tissues."
                ]
            },
            {
                keywords: ["how to use", "dashboard", "assessment", "new test", "start", "instruction", "help me", "what can i do", "show me"],
                responses: [
                    "Start with a 'New Assessment'—this is where our AI learns about you. Based on your inputs, your Dashboard will update with risk levels and health metrics.",
                    "Your Dashboard is your command center. Check your 'Daily Activity Trend' and 'Sleep Consistency' bars to see how you're progressing over the week.",
                    "The 'Health Tips' page has specialized guides. If you're stuck, try taking an assessment to see which area of your health needs the most attention.",
                    "Every assessment you take is saved in your history. You can see your past risk scores in the History table at the bottom of the Dashboard."
                ]
            },
            {
                keywords: ["who built this", "developer", "contact", "creators"],
                responses: [
                    "HealthMate AI was built by a passionate team of developers dedicated to making proactive health tracking accessible to everyone. Our mission is wellness through data.",
                    "This platform is part of a final project aimed at demonstrating the power of edge-based AI in health. We use modern web tech to deliver high-end wellness tools.",
                    "Interested in the tech? We used HTML5, CSS3, and JavaScript, with Brain.js for our underlying predictive neural network models.",
                    "We'd love to hear your feedback! While this is a demo version, we are constantly refining the AI's 'brain' to be more helpful and accurate."
                ]
            },
            {
                keywords: ["mobile", "app", "phone", "iphone", "android"],
                responses: [
                    "While we don't have a native app on the Store yet, our website is fully responsive! You can 'Add to Home Screen' in your mobile browser for an app-like experience.",
                    "We've optimized every page for mobile use. You can take assessments and check your dashboard charts right from your smartphone.",
                    "A native mobile app is in our future roadmap! For now, our PWA-ready website gives you the fastest access to your HealthMate data.",
                    "The dashboard looks great on tablets and phones. We believe health tracking should be available wherever you are."
                ]
            },
            {
                keywords: ["free", "cost", "price", "premium", "pay"],
                responses: [
                    "HealthMate AI is currently 100% free to use! We believe everyone should have access to tools that help them live healthier lives.",
                    "There are no hidden costs or 'premium' tiers. All features—from the chatbot to the data-driven dashboard—are available to all registered users.",
                    "This is an open platform designed for wellness empowerment. We don't charge for health insights or history tracking.",
                    "Our goal is to provide value, not to sell subscriptions. Enjoy the full suite of HealthMate tools for free!"
                ]
            },
            {
                keywords: ["privacy", "data", "safe", "local storage", "security"],
                responses: [
                    "Privacy is our priority. In standalone mode, your data is stored ONLY in your local browser (LocalStorage). We don't see it, and we don't sell it.",
                    "We use encrypted storage logic when in standalone mode to keep your health details secure on your own device. You hold the keys to your data.",
                    "Your assessment history is between you and your computer. No central server handles your personal health information in this version of the app.",
                    "Feel safe using HealthMate! We've built this with a 'privacy-first' architecture, ensuring your health journey remains yours alone."
                ]
            },
            {
                keywords: ["thank", "thanks", "helpful", "appreciate", "good job"],
                responses: [
                    "You're very welcome! I'm honored to be part of your health journey. What else is on your mind?",
                    "Happy to help! Remember, small daily habits are the key to big health transformations.",
                    "I'm glad you found that useful! I'm here 24/7 whenever you have more questions.",
                    "No problem! Stay healthy and keep those activity bars moving upward!",
                    "You're the one doing the hard work—I'm just here to provide the data!"
                ]
            },
            {
                keywords: ["bye", "goodbye", "see you", "exit"],
                responses: [
                    "Goodbye! Take care of yourself and don't forget to stay hydrated today.",
                    "Have a wonderful, healthy day! Come back anytime you need a check-in.",
                    "Farewell! Remember: you're just one small choice away from a better you.",
                    "See you soon! Keep working toward those health goals.",
                    "Good luck with your wellness journey today! Until next time."
                ]
            }
        ];

        // Sanitize input: Remove common punctuation that might break keyword matching
        const cleanMsg = lowerMsg.replace(/[.,?!]/g, ' ').replace(/\s+/g, ' ').trim();

        // Improved matching logic using regex for more accurate word-boundary detection
        for (const intent of intents) {
            for (const keyword of intent.keywords) {
                let matches = false;
                // Normalize keyword as well
                const cleanKeyword = keyword.toLowerCase().trim();
                
                if (cleanKeyword.length <= 3) {
                    const regex = new RegExp(`\\b${cleanKeyword}\\b`, 'i');
                    matches = regex.test(cleanMsg);
                } else {
                    matches = cleanMsg.includes(cleanKeyword);
                }

                if (matches) {
                    const randomIndex = Math.floor(Math.random() * intent.responses.length);
                    return intent.responses[randomIndex];
                }
            }
        }

        const fallbacks = [
            "That's a great question! While I'm still expanding my knowledge, I recommend taking our personalized Health Assessment to get a detailed risk profile based on your unique habits.",
            "Interesting! I'm continuously learning. In the meantime, have you checked the 'Health Tips' page for some science-backed wellness advice?",
            "I'm not quite sure about that specific topic yet, but I'm here to support your general wellness! Try asking me about sleep, diet, or how to use the Dashboard.",
            "I'm learning more every day! For now, I can help you with symptoms, lifestyle tips, or navigating the platform. What else can I help you with?"
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

function showNotification(message, type = 'info') {
    const existing = document.getElementById('hn-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'hn-toast';
    toast.className = `hn-toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${type === 'error' ? '❌' : (type === 'success' ? '✅' : 'ℹ️')}</span>
            <span class="toast-message">${message}</span>
        </div>
    `;
    document.body.appendChild(toast);

    // Initial state
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    
    // Animation
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function initReveal() {
    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');

    const revealCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Once revealed, we can stop observing this element
                observer.unobserve(entry.target);
            }
        });
    };

    const revealObserver = new IntersectionObserver(revealCallback, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));
}


function renderChart(containerId, data, maxValue, barColor = 'var(--primary)', options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    container.style.position = 'relative';

    // Add Goal Line
    if (options.goalValue) {
        const goalLine = document.createElement('div');
        goalLine.className = 'goal-line';
        const goalHeight = (options.goalValue / maxValue) * 100;
        goalLine.style.bottom = `${goalHeight}%`;
        goalLine.setAttribute('title', `Health Goal: ${options.goalValue}`);
        container.appendChild(goalLine);
    }

    const barsContainer = document.createElement('div');
    barsContainer.style.display = 'flex';
    barsContainer.style.alignItems = 'flex-end';
    barsContainer.style.gap = '12px';
    barsContainer.style.height = '100%';
    barsContainer.style.width = '100%';

    data.forEach((val, index) => {
        const itemContainer = document.createElement('div');
        itemContainer.className = 'chart-item';
        
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        const height = (val / maxValue) * 100;
        
        // Start from 0 for animation
        bar.style.height = '0%';
        bar.style.background = barColor;
        bar.setAttribute('title', `Date: ${options.labels ? options.labels[index] : ''}\nValue: ${val}`);
        
        // Staggered animation
        setTimeout(() => {
            bar.style.height = `${Math.max(5, Math.min(height, 100))}%`;
        }, 100 + (index * 100)); // 100ms stagger
        
        const label = document.createElement('div');
        label.className = 'chart-label';
        label.textContent = options.labels ? options.labels[index] : '';
        label.style.opacity = '0';
        setTimeout(() => { label.style.opacity = '0.6'; }, 200 + (index * 100));
        
        itemContainer.appendChild(bar);
        itemContainer.appendChild(label);
        barsContainer.appendChild(itemContainer);
    });
    
    container.appendChild(barsContainer);
}

function updateDashboardRiskBadge(riskLevel) {
    const container = document.getElementById('dashboardRiskBadgeContainer');
    if (!container) return;

    // Create badge if it doesn't exist or find it
    let badge = document.getElementById('dashboardRiskLevel');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'dashboardRiskLevel';
        container.appendChild(badge);
    }

    badge.textContent = riskLevel;

    // Clean up classes
    badge.className = 'risk-level';
    if (riskLevel === 'Low Risk') badge.classList.add('risk-Low');
    else if (riskLevel === 'Moderate Risk') badge.classList.add('risk-Moderate');
    else if (riskLevel === 'High Risk') badge.classList.add('risk-High');
}

async function handleStandaloneAssessment(data, btn, originalText) {
    console.log("Standalone Mode: Using Proactive Analysis Engine");
    const result = runProactiveAnalysis(data);
    showAssessmentResult(result);
    
    const user = JSON.parse(localStorage.getItem('healthmate_user'));
    if (user) {
        let userHistory = JSON.parse(localStorage.getItem('healthmate_history_' + user.email) || '[]');
        userHistory.unshift({
            date: new Date().toISOString(),
            risk_level: result.riskLevel,
            sleep_hours: data.sleep_hours,
            exercise_minutes: data.exercise_minutes,
            stress_level: data.stress_level,
            water_intake: data.water_intake
        });
        localStorage.setItem('healthmate_history_' + user.email, JSON.stringify(userHistory));
    }
    
    btn.innerHTML = `<span>${originalText}</span>`;
    btn.disabled = false;
}

function runProactiveAnalysis(data) {
    let riskScore = 0;
    if (data.stress_level > 7) riskScore += 2;
    if (data.sleep_hours < 6) riskScore += 1;
    if (data.exercise_minutes < 30) riskScore += 1;
    if (data.water_intake < 4) riskScore += 1;
    if (data.diet_quality.toLowerCase() === 'poor') riskScore += 2;
    riskScore += (data.symptoms || []).length;

    let riskLevel = 'Low Risk';
    if (data.symptoms.includes('chest_pain') || data.symptoms.includes('shortness_breath') || riskScore >= 6) {
        riskLevel = 'High Risk';
    } else if (riskScore >= 3) {
        riskLevel = 'Moderate Risk';
    }

    let dynamicRecommendations = [];
    let predictedConditions = [];
    const diet = data.diet_quality.toLowerCase();
    const symptoms = data.symptoms || [];

    if (symptoms.includes('chest_pain') || symptoms.includes('shortness_breath')) {
        predictedConditions.push("Cardiovascular Issues / Heart Disease");
        dynamicRecommendations.push("URGENT: Your symptoms (chest pain/shortness of breath) require immediate medical evaluation.");
        dynamicRecommendations.push("Diet: Adopt a heart-healthy diet rich in omega-3s (salmon, walnuts), oats, and leafy greens. Avoid high-sodium and fried foods.");
    }

    if (symptoms.includes('fever') || symptoms.includes('cough') || symptoms.includes('body_pain')) {
        predictedConditions.push("Viral Infection / Common Cold");
        dynamicRecommendations.push("Habits: Prioritize rest and hydration. Monitor your temperature and consult a doctor if fever persists beyond 48 hours.");
    }

    if (symptoms.includes('fatigue')) {
        predictedConditions.push("Potential Anemia / Chronic Fatigue");
        dynamicRecommendations.push("Diet: Ensure adequate iron and B12 intake. Consider a blood test if fatigue is persistent.");
    }

    if (symptoms.includes('nausea')) {
        predictedConditions.push("Gastrointestinal Sensitivity");
        dynamicRecommendations.push("Diet: Stick to bland foods (BRAT diet) and stay hydrated with electrolytes.");
    }

    if (symptoms.includes('frequent_urination') || symptoms.includes('increased_thirst')) {
        predictedConditions.push("Potential Early-stage Diabetes / Hyperglycemia");
        dynamicRecommendations.push("Medical: These symptoms can be indicators of blood sugar issues. We strongly recommend a glucose screening.");
    }

    if (data.exercise_minutes < 30) {
        dynamicRecommendations.push("Exercise: Incorporate at least 30-45 minutes of moderate aerobic activity daily to lower your risk profile.");
    }

    if (data.sleep_hours < 7) {
        dynamicRecommendations.push("Habits: Focus on sleep hygiene. Aim for 8 hours. Try a 10-minute wind-down routine before bed.");
    }

    if (symptoms.includes('headache')) {
        predictedConditions.push("Tension Headaches / Dehydration");
        dynamicRecommendations.push("Habits: Monitor triggers for your headaches, such as screen time or caffeine withdrawal.");
    }

    if (diet === 'poor' || diet === 'average') {
        dynamicRecommendations.push("Diet: Shift to a balanced diet. Include lean proteins, whole grains, and healthy fats to maximize your vitality.");
    }

    if (data.stress_level > 6) {
        dynamicRecommendations.push("Habits: Your stress levels are concerning. Implement daily relaxing activities like yoga or meditation to reduce cortisol.");
    }

    if (dynamicRecommendations.length === 0) {
        dynamicRecommendations.push("Status: Your current habits are excellent! Continue maintaining this balanced lifestyle.");
    }

    if (predictedConditions.length === 0) {
        predictedConditions.push(riskLevel === 'Low Risk' ? "None detected (Healthy Profile)" : "General Mild Inflammation / Stress");
    }

    const explanation = `It takes courage to prioritize your health! Based on your habits and symptoms, you might have an elevated future risk for: ${predictedConditions.join(', ')}. Please remember this is a preventative forecast, not a diagnosis. Your daily habits are your superpower—by following these recommendations, you can build a stronger future!`;

    return {
        riskLevel: riskLevel,
        explanation: explanation,
        recommendations: dynamicRecommendations
    };
}

function initTheme() {
    const savedTheme = localStorage.getItem('healthmate_theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }

    // Inject Theme Toggle Button
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'theme-toggle';
    toggleBtn.setAttribute('title', 'Switch Theme');
    toggleBtn.innerHTML = savedTheme === 'light' ? '🌙' : '☀️';
    document.body.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-mode');
        const newTheme = isLight ? 'light' : 'dark';
        localStorage.setItem('healthmate_theme', newTheme);
        toggleBtn.innerHTML = isLight ? '🌙' : '☀️';
        
        // Optional: Add a quick scale animation
        toggleBtn.style.transform = 'scale(0.8)';
        setTimeout(() => {
            toggleBtn.style.transform = '';
        }, 150);
    });
}

function handleStandaloneDashboard(user) {
    console.log("Standalone Mode: Loading local history");
    let userHistory = JSON.parse(localStorage.getItem('healthmate_history_' + user.email) || '[]');
    renderDashboardData(userHistory);
}

function renderDashboardData(history) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (history && history.length > 0) {
        tbody.innerHTML = '';
        
        // Show Latest Risk Badge
        updateDashboardRiskBadge(history[0].risk_level);

        const activityData = [];
        const sleepData = [];

        // Show last 7 assessments in table, and reverse them for chronological chart
        const recentHistory = history.slice(0, 7);
        
        recentHistory.forEach(item => {
            const tr = document.createElement('tr');
            const date = new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            
            let riskClass = "badge-low";
            if (item.risk_level === 'Moderate Risk') riskClass = "badge-moderate";
            if (item.risk_level === 'High Risk') riskClass = "badge-high";

            tr.innerHTML = `
                <td>${date}</td>
                <td><span class="badge ${riskClass}">${item.risk_level}</span></td>
                <td>${item.sleep_hours} h</td>
                <td>${item.exercise_minutes} m</td>
                <td>${item.stress_level} / 10</td>
                <td>${item.water_intake} c</td>
            `;
            tbody.appendChild(tr);
        });

        const activityLabels = [];
        const sleepLabels = [];

        // Charts should be chronological (Oldest to Newest)
        recentHistory.reverse().forEach(item => {
            const dateObj = new Date(item.date);
            const shortDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
            activityData.push(item.exercise_minutes);
            activityLabels.push(shortDate);
            sleepData.push(item.sleep_hours);
            sleepLabels.push(shortDate);
        });

        // Dynamic Scaling: Find max in data or use sensible default
        const maxActivity = Math.max(...activityData, 60);
        const maxSleep = Math.max(...sleepData, 8);

        renderChart('activityChart', activityData, maxActivity, 'linear-gradient(to top, #2ecc71, #27ae60)', { 
            labels: activityLabels, 
            goalValue: 30 
        });
        renderChart('sleepChart', sleepData, maxSleep, 'linear-gradient(to top, #3498db, #2980b9)', { 
            labels: sleepLabels, 
            goalValue: 8 
        });

        // --- NEW: Calculate Weekly Activity Trend ---
        const activityTrendEl = document.getElementById('activityTrendValue');
        if (activityTrendEl) {
            if (history.length >= 2) {
                const latestAvg = history.slice(0, 3).reduce((acc, curr) => acc + curr.exercise_minutes, 0) / Math.min(history.length, 3);
                const prevAvg = history.slice(3, 6).reduce((acc, curr) => acc + curr.exercise_minutes, 0) / Math.min(Math.max(history.length - 3, 0), 3) || latestAvg;
                
                const diff = latestAvg - prevAvg;
                const percent = prevAvg === 0 ? 0 : Math.round((diff / prevAvg) * 100);
                
                if (diff > 5) { // Substantial increase
                    activityTrendEl.textContent = `+${percent}% ↑`;
                    activityTrendEl.className = 'trend-badge trend-up';
                } else if (diff < -5) { // Substantial decrease
                    activityTrendEl.textContent = `${percent}% ↓`;
                    activityTrendEl.className = 'trend-badge trend-down';
                } else {
                    activityTrendEl.textContent = 'Steady';
                    activityTrendEl.className = 'trend-badge';
                }
            } else {
                activityTrendEl.textContent = 'New';
            }
        }

        // --- NEW: Calculate Sleep Consistency ---
        const sleepConsistencyEl = document.getElementById('sleepConsistencyValue');
        if (sleepConsistencyEl) {
            if (history.length >= 3) {
                const sleepHours = history.slice(0, 7).map(h => h.sleep_hours);
                const avg = sleepHours.reduce((a, b) => a + b) / sleepHours.length;
                const variance = sleepHours.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / sleepHours.length;
                const stdDev = Math.sqrt(variance);

                // Refined consistency logic
                if (stdDev < 0.4) {
                    sleepConsistencyEl.textContent = 'Perfect';
                    sleepConsistencyEl.className = 'trend-badge status-excellent';
                } else if (stdDev < 0.8) {
                    sleepConsistencyEl.textContent = 'Consistent';
                    sleepConsistencyEl.className = 'trend-badge status-excellent';
                } else if (stdDev < 1.3) {
                    sleepConsistencyEl.textContent = 'Good';
                    sleepConsistencyEl.className = 'trend-badge status-good';
                } else if (stdDev < 2.0) {
                    sleepConsistencyEl.textContent = 'Fairly Consistent';
                    sleepConsistencyEl.className = 'trend-badge status-good';
                } else {
                    sleepConsistencyEl.textContent = 'Variable';
                    sleepConsistencyEl.className = 'trend-badge status-variable';
                }
            } else {
                sleepConsistencyEl.textContent = 'Gathering Data';
            }
        }

    } else {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">No assessments taken yet. Take your first assessment to start tracking!</td></tr>';
        updateDashboardRiskBadge('No Data');
    }
}
