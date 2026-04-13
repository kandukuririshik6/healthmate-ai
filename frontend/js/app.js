const API_URL = 'http://localhost:3000';
const STANDALONE_MODE = false; // Set to true to bypass backend and use LocalStorage/Client-side logic only

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
    initMobileMenu();

    // Register Form Handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = registerForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerHTML = `<span>Registering...</span>`;
            btn.disabled = true;

            const rawEmail = document.getElementById('regEmail').value;
            const normalizedEmail = rawEmail.toLowerCase().trim();
            const cleanPassword = document.getElementById('regPassword').value.trim();

            const data = {
                name: document.getElementById('regName').value.trim(),
                email: normalizedEmail,
                age: parseInt(document.getElementById('regAge').value),
                gender: document.getElementById('regGender').value,
                password: cleanPassword,
                userId: generateUserId(normalizedEmail)
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
                    // Sync to local DB for fallback
                    let localUsers = JSON.parse(localStorage.getItem('healthmate_db') || '[]');
                    const normEmail = data.email.toLowerCase().trim();
                    const existIdx = localUsers.findIndex(u => u.email.toLowerCase().trim() === normEmail);
                    if (existIdx === -1) {
                        localUsers.push({ ...data, id: result.userId || Date.now() });
                    } else {
                        localUsers[existIdx] = { ...localUsers[existIdx], ...data, id: result.userId || localUsers[existIdx].id };
                    }
                    localStorage.setItem('healthmate_db', JSON.stringify(localUsers));
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

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = loginForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerHTML = `<span>Logging in...</span>`;
            btn.disabled = true;

            const rawEmail = document.getElementById('email').value;
            const normalizedEmail = rawEmail.toLowerCase().trim();
            const cleanPassword = document.getElementById('password').value.trim();

            const data = {
                email: normalizedEmail,
                password: cleanPassword,
            };



            if (STANDALONE_MODE) {
                // STANDALONE MODE: Bypass server and use local storage fallback
                let users = JSON.parse(localStorage.getItem('healthmate_db') || '[]');
                const foundUser = users.find(u => u.email.toLowerCase().trim() === data.email && u.password === data.password);

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
                    // Sync to local DB for fallback - CRITICAL: Preserve local password if server doesn't return it
                    let localUsers = JSON.parse(localStorage.getItem('healthmate_db') || '[]');
                    const normEmail = data.email.toLowerCase().trim();
                    const existIdx = localUsers.findIndex(u => u.email.toLowerCase().trim() === normEmail);
                    if (existIdx === -1) {
                        // If new from server, save with current login password
                        localUsers.push({ ...result.user, password: data.password });
                    } else {
                        // Merge server data but keep the password (essential for offline fallback)
                        localUsers[existIdx] = { 
                            ...localUsers[existIdx], 
                            ...result.user, 
                            password: data.password || localUsers[existIdx].password 
                        };
                    }
                    localStorage.setItem('healthmate_db', JSON.stringify(localUsers));

                    localStorage.setItem('healthmate_user', JSON.stringify(result.user));
                    window.location.href = 'dashboard.html';
                } else {
                    // Try frontend fallback even if server returned 401
                    console.warn("Server login failed, attempting local storage fallback...");
                    let users = JSON.parse(localStorage.getItem('healthmate_db') || '[]');
                    const foundUser = users.find(u => u.email.toLowerCase().trim() === data.email && u.password === data.password);

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
                const foundUser = users.find(u => u.email.toLowerCase().trim() === data.email && u.password === data.password);

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

function initMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('navMenu');
    const links = document.querySelectorAll('#navLinks a');

    if (!btn || !menu) return;

    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        menu.classList.toggle('active');
        document.body.style.overflow = menu.classList.contains('active') ? 'hidden' : 'auto';
    });

    // Close menu when a link is clicked
    links.forEach(link => {
        link.addEventListener('click', () => {
            btn.classList.remove('active');
            menu.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    });
}

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
    explanationText.innerHTML = result.explanation;

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

    const widget = document.getElementById('ai-chatbot');

    toggleBtn.addEventListener('click', () => {
        widget.classList.toggle('active');
        const isActive = widget.classList.contains('active');
        
        if (isActive) {
            body.style.display = 'flex';
            icon.textContent = '▼';
            if (window.innerWidth <= 768) {
                document.body.style.overflow = 'hidden'; // Lock background on mobile
            }
        } else {
            body.style.display = 'none';
            icon.textContent = '▲';
            document.body.style.overflow = 'auto';
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
                keywords: ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening", "how are you", "what's up", "yo", "morning", "evening"],
                responses: [
                    "Hello! I am HealthMate AI, your dedicated wellness companion. How can I help you improve your lifestyle today?",
                    "Hi there! I'm ready to dive into your health goals with you. What's on your mind today?",
                    "Greetings! I'm here to support your journey toward a healthier, more vibrant life. How are you feeling?",
                    "Hi! It's a great day to prioritize your wellness. What can I assist you with right now?",
                    "Hello! I'm HealthMate AI. Whether it's nutrition, fitness, or general health queries, I'm here to provide science-backed insights."
                ]
            },
            {
                keywords: ["analyze", "risk", "check my status", "how am i doing", "evaluate", "am i healthy", "risk level", "analysis", "assessment result", "score"],
                responses: [
                    "To analyze your risk accurately, I evaluate your latest assessment data including sleep, exercise, stress, and symptoms. If you haven't recently, please take a 'New Assessment' then check your Dashboard for your vitality score!",
                    "I evaluate your health risk using a predictive neural network model. Your risk level is dynamic and changes based on your daily habits. Have you completed today's assessment yet?",
                    "You can view your real-time risk analysis on the Dashboard. If you're feeling a bit off, I recommend taking a new assessment so I can update your status immediately with proactive advice.",
                    "My analysis thrives on consistent data. The more frequently you track your habits in the assessment section, the more accurately I can predict your long-term health trends."
                ]
            },
            {
                keywords: ["who are you", "what is this", "about you", "what do you do", "introduce", "purpose"],
                responses: [
                    "I am HealthMate AI, an advanced wellness assistant designed to help you track habits, analyze patterns, and predict health risks using science-backed data models.",
                    "Think of me as your 24/7 health companion. I help you understand your body, stay motivated, and navigate your wellness journey with personalized, data-driven insights.",
                    "I am a specialized AI engine built to empower you with proactive health suggestions. By analyzing your periodic assessments, I give you a clear, objective picture of your vitality.",
                    "I'm here to bridge the gap between your daily habits and your long-term health goals. I focus on symptom analysis, risk tracking, and preventive lifestyle tips."
                ]
            },
            {
                keywords: ["doctor", "are you a doctor", "medical professional", "physician", "medical advice", "diagnosis", "expert"],
                responses: [
                    "**Crucial Disclaimer**: I am an Artificial Intelligence, not a licensed medical professional. My insights are for educational and preventive purposes only. Always consult a qualified physician for any medical diagnosis or treatment.",
                    "I am an AI wellness assistant. While I provide health suggestions based on data patterns, I am not a substitute for professional medical advice, diagnosis, or clinical treatment.",
                    "Important: I do not provide official medical diagnoses. My role is to help you track and understand wellness patterns. Please see a healthcare provider for any specific medical concerns.",
                    "I am an AI, not a doctor. My responses are based on general health guidelines and your provided data. I recommend prioritizing a consultation with a medical expert for any persistent health issues."
                ]
            },
            {
                keywords: ["emergency", "severe", "chest pain", "can't breathe", "shortness of breath", "bleeding", "stroke", "heart attack", "unconscious", "911", "hospital", "urgent"],
                responses: [
                    "⚠️ **IMMEDIATE ACTION REQUIRED**: If you are experiencing a medical emergency like severe chest pain, difficulty breathing, or sudden numbness, please call 911 (or your local emergency services) or visit the nearest Emergency Room immediately.",
                    "I am detecting symptoms that could be life-threatening. **Please stop using this app and seek immediate professional medical attention.** Every second counts in a medical emergency.",
                    "⚠️ This sounds like a critical emergency. Please do not wait for an AI response. Contact emergency services right now.",
                    "Your symptoms indicate a possible medical emergency. Please contact emergency services or go to the nearest hospital immediately. I am an AI and cannot provide emergency medical care."
                ]
            },
            {
                keywords: ["heart", "palpitation", "heart racing", "fluttering", "irregular heartbeat", "pounding chest", "cardiac"],
                responses: [
                    "Heart palpitations can be caused by stress, caffeine, or dehydration, but they can also signal underlying cardiac issues. If you have chest pain or faintness, seek medical help immediately.",
                    "An irregular or racing heart should always be evaluated by a cardiologist. Try to track when they happen—is it after caffeine, during stress, or at rest? This information helps your doctor's assessment.",
                    "If your heart feels like it's skipping beats or racing, try to sit down and practice slow, deep breathing. If it lasts more than a few minutes or recurs frequently, please schedule a professional check-up.",
                    "Caffeine, nicotine, and stress are common triggers for palpitations. However, persistent 'fluttering' in the chest needs a professional EKG to rule out serious conditions like arrhythmia."
                ]
            },
            {
                keywords: ["blood pressure", "hypertension", "hypotension", "bp", "systolic", "diastolic"],
                responses: [
                    "Blood pressure is a key indicator of cardiovascular health. Hypertension (high BP) is often 'silent'. Aim for a healthy range near 120/80 mmHg. Reducing sodium and staying active are excellent first steps, but medication must be managed by a doctor.",
                    "If your BP is low (hypotension), you might feel dizzy when standing up. While increasing hydration can help, you should discuss persistent low blood pressure with a physician to find the cause.",
                    "Consistent tracking of your blood pressure is vital for long-term health. Our assessment tool helps you identify if your lifestyle habits are positively or negatively impacting your heart health.",
                    "High blood pressure is a leading risk factor for stroke and heart disease. Regular cardio and managing stress through mindfulness are scientifically proven ways to support healthy levels."
                ]
            },
            {
                keywords: ["cholesterol", "ldl", "hdl", "triglycerides", "lipid"],
                responses: [
                    "Cholesterol management is about the balance between HDL (good) and LDL (bad). Increasing soluble fiber and healthy fats like Omega-3s (found in fish and nuts) can significantly improve your lipid profile.",
                    "High LDL cholesterol can lead to arterial plaque buildup. Regular aerobic exercise and avoiding trans fats are the most effective natural ways to support your heart health.",
                    "If your triglycerides are high, consider reducing refined sugars and alcohol consumption. A Mediterranean-style diet is often recommended for maintaining healthy cholesterol levels.",
                    "Always discuss your blood panel results with a doctor. My analysis can help you identify which lifestyle habits might be influencing your cholesterol numbers over time."
                ]
            },
            {
                keywords: ["asthma", "wheezing", "tight chest", "bronchitis", "lung", "coughing"],
                responses: [
                    "Asthma is a chronic condition that requires a proper management plan from a physician. Ensure you have your rescue inhaler accessible and try to identify triggers like pollen, dust, or pet dander.",
                    "Wheezing or a tight chest can indicate airway inflammation. If you find yourself using your rescue inhaler more than twice a week, your asthma might not be optimally controlled. Consult a pulmonologist.",
                    "Managing air quality and humidity in your home can help with respiratory comfort. However, please consult a lung specialist for a personalized and effective treatment plan.",
                    "Asthma triggers vary significantly by individual. Some people react to cold air, others to intense exercise. Tracking these triggers in your history can help you manage the condition better."
                ]
            },
            {
                keywords: ["acid reflux", "gerd", "heartburn", "indigestion", "stomach acid"],
                responses: [
                    "I'm so sorry you're feeling that burn! Heartburn is often caused by stomach acid backing up. Avoiding large meals before bed and spicy foods can really help you feel better.",
                    "GERD can be quite a nuisance! Try propping up your pillows when you sleep and having small, frequent meals. If you're having real trouble swallowing, please see a doctor soon.",
                    "It's a common struggle, but we can manage it! Triggers like caffeine and chocolate are often to blame. Maintaining a healthy weight can also ease that physical pressure on your stomach.",
                    "Ginger tea is a wonderful, soothing friend for mild indigestion. If you find yourself needing antacids every day, let's look into a more permanent plan with a professional."
                ]
            },
            {
                keywords: ["longevity", "biohacking", "live longer", "autophagy", "mitochondria", "zone 2", "anti-aging", "senescence", "cellular health"],
                responses: [
                    "Longevity is about adding life to your years! Zone 2 exercise (where you can still talk but are breathing hard) is a secret weapon for mitochondrial health and long-term vitality.",
                    "Want to dive into biohacking? Autophagy is the body's 'recycling program' for old cells, often triggered by fasting. It's like a spring cleaning for your biology!",
                    "Living longer starts today! Focus on low-level inflammation by eating colorful phytonutrients and prioritizing high-quality sleep. Your future self will thank you for these small choices.",
                    "Biohacking isn't just for tech gurus; it's about listening to your body. Whether it's cold exposure or red light therapy, always start slow and track your biofeedback on your Dashboard!"
                ]
            },
            {
                keywords: ["hormones", "hormonal balance", "cortisol", "thyroid", "testosterone", "estrogen", "pcos", "adrenal", "endocrine"],
                responses: [
                    "Hormones are your body's chemical messengers, and when they're out of sync, everything feels a bit 'off'. Cortisol, our stress hormone, can be managed with deep breathing and morning sunlight.",
                    "Hormonal health is a complex web! If you're feeling unusually tired, a thyroid check-up might be helpful. Diet, sleep, and managing stress are the three main pillars of endocrine balance.",
                    "For both men and women, strength training and healthy fats (like avocados) are vital for maintaining optimal hormonal levels. Your body needs those building blocks to keep things running smoothly.",
                    "Dealing with something like PCOS or adrenal fatigue can be exhausting. I'm here to help you track your symptoms so you have clear data to show your doctor. You're not alone in this!"
                ]
            },
            {
                keywords: ["bloating", "gas", "constipation", "diarrhea", "ibs", "gut", "stomach pain", "tummy ache", "digestion", "metabolism"],
                responses: [
                    "Digestive issues are often linked to fiber intake and hydration levels. For constipation, ensure you're getting enough soluble fiber and water. For diarrhea, focus on electrolyte replenishment.",
                    "IBS (Irritable Bowel Syndrome) is complex and often linked to the brain-gut axis. A 'Low FODMAP' diet is frequently used to identify food triggers, alongside stress management techniques.",
                    "Persistent bloating can be a sign of food intolerances or gut flora imbalances. Try keeping a detailed food diary to identify patterns between what you eat and how you feel.",
                    "Probiotics and prebiotics support a healthy gut microbiome. Fiber-rich foods like oats, beans, and berries are essential for keeping your digestion regular and efficient."
                ]
            },
            {
                keywords: ["sleep", "sleeping", "insomnia", "tired", "rest", "night", "can't sleep", "sleepy", "bedtime", "nap", "circadian"],
                responses: [
                    "Sleep is the ultimate biological optimization tool! Aim for 7-9 hours of quality rest. A 'digital detox'—avoiding blue light 30 minutes before bed—can significantly improve your REM sleep quality.",
                    "Consistency is key for your circadian rhythm. Try to keep your room cool, dark, and quiet. Avoid caffeine after 2 PM to ensure your body is naturally ready for rest by bedtime.",
                    "If you're having trouble falling asleep, try 'progressive muscle relaxation' or a white noise machine. Your Dashboard tracks your Sleep Consistency—aim for a steady pattern for best result.",
                    "Chronic sleep deprivation can mimic ADHD symptoms and elevate your long-term risk for heart issues. Prioritizing rest is one of the most impactful things you can do for your health."
                ]
            },
            {
                keywords: ["fatigue", "tiredness", "exhaustion", "no energy", "anemia", "weak", "lethargic", "always tired", "burned out"],
                responses: [
                    "Persistent fatigue can be a sign of many factors, from dehydration to iron-deficiency. Ensure you're consuming enough protein and iron-rich foods like spinach, lentils, or lean meats.",
                    "Feeling weak or lethargic? It could be related to Vitamin D or B12 levels. If you also experience shortness of breath or unusual paleness, please consult a doctor for a full blood panel.",
                    "Fatigue is often the result of cumulative mental or physical stress. Are you taking enough 'micro-breaks' during the day? Even 5 minutes of deep breathing can help restore energy levels.",
                    "Low energy can also be linked to blood sugar fluctuations. Avoid 'sugar crashes' by choosing complex carbohydrates like oats or quinoa over refined sweets and sugary drinks."
                ]
            },
            {
                keywords: ["joint pain", "arthritis", "stiff joints", "knee pain", "hip pain", "aching bones", "joint stiffness", "painful joints", "inflammation", "mobility"],
                responses: [
                    "Joint pain can be inflammatory (like Rheumatoid Arthritis) or wear-and-tear (Osteoarthritis). Low-impact movement like swimming or cycling helps keep joints mobile without extra stress.",
                    "Stiffness in the morning that lasts more than 30 minutes should be evaluated by a rheumatologist. Omega-3 supplements and turmeric are often used for natural inflammation support.",
                    "Protect your joints by maintaining a healthy weight. Extra pressure on your knees and hips accelerates cartilage wear. Strength training also supports the stabilizing muscles.",
                    "Warm compresses can help with stiffness, while ice is better for acute inflammation. If a joint is hot, red, and swollen, seek medical attention immediately to rule out infection."
                ]
            },
            {
                keywords: ["muscle cramp", "spasm", "charlie horse", "tight muscle", "muscle pain", "sore muscle", "aching muscles", "recovery", "magnesium"],
                responses: [
                    "Muscle cramps are usually caused by dehydration or electrolyte imbalances (Magnesium, Potassium, Calcium). Ensure you're drinking enough water during and after exercise.",
                    "If you get frequent night cramps, try gentle stretching before bed and check your magnesium levels. A warm bath with Epsom salts can also relax the muscle fibers.",
                    "Acute spasms can sometimes be a sign of muscle strain. Rest, ice, and gentle stretching are the standard recovery steps. If the pain is severe or localized, see a professional.",
                    "Ensure you're warming up properly before intense activity. Cramps are often your body's way of signaling that a muscle is fatigued or under-fueled."
                ]
            },
            {
                keywords: ["headache", "migraine", "head pain", "tension", "sinus headache", "cluster headache"],
                responses: [
                    "Headaches are often signals—check hydration, stress, and sleep first. Tension headaches feel like a tight band around the head, while migraines are usually throbbing and one-sided.",
                    "Migraines can be debilitating and often have specific triggers like aged cheeses, nitrates, or sensory overload. Track your migraines in your history to find patterns!",
                    "⚠️ **Warning**: If your headache comes on suddenly and is the most severe you've ever felt ('thunderclap'), call emergency services immediately. It could be a sign of something serious.",
                    "Screen time and poor neck posture (tech-neck) are leading causes of tension headaches. Try the 'chin tuck' stretch and take eye-breaks every 20 minutes."
                ]
            },
            {
                keywords: ["dental", "teeth", "gums", "dentist", "oral health", "cavity", "bad breath", "flossing", "toothache"],
                responses: [
                    "A beautiful smile starts with healthy gums! Don't forget that flossing is just as important as brushing—it's the only way to reach 40% of your tooth surfaces.",
                    "Oral health is a window to your overall wellbeing. Chronic gum inflammation can actually impact your heart health! It's amazing how connected our bodies are, isn't it?",
                    "Dealing with a toothache? It can be so painful! Try a warm saltwater rinse for temporary relief, but please see a dentist soon to make sure everything's okay.",
                    "Pro-tip: Wait at least 30 minutes after eating acidic foods (like citrus or soda) before brushing. This protects your enamel while it's in a softened state."
                ]
            },
            {
                keywords: ["eyes", "eye strain", "vision", "blur", "blue light", "screen time", "glasses", "astigmatism", "dry eyes"],
                responses: [
                    "Is your screen time creeping up? Your eyes might need a break! Try the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds. It really works!",
                    "Blue light from devices can disrupt your sleep-wake cycle. Consider using 'Night Shift' mode or blue light glasses in the evening to help your brain wind down naturally.",
                    "Dry eyes are so uncomfortable! Ensure you're blinking enough when focused on screens, and stay hydrated from the inside out to keep those tear films healthy.",
                    "Your vision is precious! If you notice sudden blurred vision or frequent headaches, it might be time for a quick eye exam. Proactive care is the best care!"
                ]
            },
            {
                keywords: ["hearing", "ears", "tinnitus", "ringing in ears", "loud noise", "earwax", "deafness", "protective gear"],
                responses: [
                    "Protecting your hearing is a lifelong gift to yourself. If you're heading to a concert or using loud machinery, a simple pair of earplugs can prevent permanent damage.",
                    "Tinnitus (that ringing in the ears) can be quite frustrating. It's often linked to loud noise exposure or even stress. Focus on quiet, relaxing environments to help your system settle.",
                    "Earwax is actually your ear's natural cleaning agent! Avoid using cotton swabs inside the canal—they can push wax deeper. Your ears are very good at taking care of themselves.",
                    "Hearing health is closely tied to cognitive health as we age. Keep your world sounding beautiful by checking your volume levels on headphones—keep it under 60% if you can!"
                ]
            },
            {
                keywords: ["supplements", "vitamins", "vitamin d", "magnesium", "omega-3", "creatine", "nac", "collagen", "probiotics"],
                responses: [
                    "Supplements can be great 'boosters', but they work best alongside a solid diet. For example, Vitamin D3 is much better absorbed when taken with a healthy fat!",
                    "Magnesium glycinate is a favorite for relaxation and sleep, while Magnesium malate can help with energy. There's a perfect magnesium for almost every goal!",
                    "Omega-3 fatty acids (from fish oil or algae) are like premium oil for your brain and heart engine. They help keep inflammation at bay and support cognitive clarity.",
                    "Always talk to a health professional before starting a new regimen. Everyone's biology is unique, and what works for one person might be different for you!"
                ]
            },
            {
                keywords: ["social anxiety", "shy", "scared of people", "awkward", "introvert", "public speaking", "crowds"],
                responses: [
                    "Social anxiety is something many of us face—it's just our brain's way of trying to protect us from perceived social 'danger'. Grounding yourself with deep breaths before an event can really help quiet that inner critic.",
                    "Feeling a bit awkward? Remember, most people are more worried about themselves than they are about you! Try the 'Spotlight Effect' shift—realizing the spotlight isn't as bright as it feels can be very liberating.",
                    "For public speaking, try 'Reframing Anxiety as Excitement'. Physiologically, they feel very similar! Tell yourself: 'I'm excited to share this information,' and watch your state shift.",
                    "If crowds feel overwhelming, it's okay to take 'mini-breaks'. Step outside for a moment, find a quiet corner, and reset. Your comfort matters just as much as the social engagement."
                ]
            },
            {
                keywords: ["lonely", "loneliness", "alone", "no friends", "connection", "feel isolated", "isolated"],
                responses: [
                    "I'm so sorry you're feeling lonely right now. It's a deeply human emotion, but please know that I'm here for you! Small steps like joining a local hobby group or even just saying hi to a neighbor can start to bridge that gap.",
                    "Loneliness can sometimes be a signal to reconnect with ourselves. Use this time for self-care—read that book you've been wanting to, or start a new creative project. Your own company is valuable!",
                    "Digital connection is great, but don't forget the power of voice. Scientific studies show that hearing a loved one's voice reduces cortisol more than just texting. Give someone a quick call today!",
                    "You are a vital part of the world, even if it doesn't feel like it right now. Volunteer work is a powerful way to feel connected—helping others often helps us find our own sense of belonging."
                ]
            },
            {
                keywords: ["flow state", "deep work", "in the zone", "gratitude", "mindfulness", "meditation", "presence", "zen"],
                responses: [
                    "Flow state is that magical place where challenge meets skill. To get there, try eliminating all distractions and focusing on one task for at least 60 minutes. It's where your best work happens!",
                    "A daily gratitude practice—just writing down three things you're thankful for—rewires your brain to look for the positive. It's a simple habit with profound health benefits for your mind.",
                    "Mindfulness isn't just about sitting still; it's about being present in the moment. Whether you're washing dishes or walking, try to fully experience the sensations. That's true meditation!",
                    "Want to find your 'Zen'? Start your day with 5 minutes of stillness before checking your phone. This 'digital boundaries' practice helps you own your morning instead of the world owning you."
                ]
            },
            {
                keywords: ["morning routine", "evening routine", "daily habits", "dopamine detox", "atomic habits", "consistency", "routines"],
                responses: [
                    "Your morning routine sets the tone for your entire day. Try 'Hydrate before Caffeine' and get 5 minutes of natural sunlight to synchronize your circadian rhythm for better sleep tonight!",
                    "Routines provide a safety net for your brain. By automating small decisions like what to wear or eat, you save your 'decision fatigue' for the things that really matter.",
                    "Considering a dopamine detox? It's a great way to reset your brain's reward system. Swap short-form scrolling for long-form reading or a walk in nature. You'll be amazed at your new focus!",
                    "Success is built on 'Atomic Habits'—tiny changes that compound over time. Don't try to change your whole life today; just focus on being 1% better than you were yesterday."
                ]
            },
            {
                keywords: ["dizzy", "dizziness", "lightheaded", "faint", "vertigo", "spinning", "unbalanced"],
                responses: [
                    "Dizziness can be caused by low blood sugar, dehydration, or inner ear issues. Sit down immediately if you feel faint to avoid a fall. Drink some water and monitor for any sudden changes.",
                    "Vertigo (the feeling that the room is spinning) often stems from inner ear imbalances. If it's accompanied by sudden vision changes or slurred speech, seek emergency care immediately.",
                    "Standing up too quickly can cause a temporary drop in blood pressure (orthostatic hypotension). Take your time when getting out of bed or a chair to let your body adjust.",
                    "Persistent dizziness requires a medical check-up to rule out cardiac issues or anemia. Keep track of when it happens—after meals, during stress, or when moving—to help your doctor."
                ]
            },
            {
                keywords: ["nausea", "vomiting", "sick to stomach", "feel sick", "puking", "upset stomach", "queasy", "stomach flu"],
                responses: [
                    "Nausea is a common symptom of everything from food poisoning to intense stress. Peppermint or ginger tea are very effective natural remedies for mild queasiness.",
                    "If you're vomiting frequently, the primary risk is dehydration. Sip very small amounts of clear fluids or electrolyte drinks. Seek help if you cannot keep water down for 24 hours.",
                    "Rest and avoiding strong odors are key when you feel nauseous. The BRAT diet (Bananas, Rice, Applesauce, Toast) is gentle on the stomach as it recovers from acute distress.",
                    "Chronic nausea might be related to acid reflux, gastroparesis, or food sensitivities. It's important to discuss persistent stomach issues with a gastroenterologist."
                ]
            },
            {
                keywords: ["fever", "temperature", "chills", "hot", "sweating", "flu symptoms"],
                responses: [
                    "A fever is usually your body's immune system fighting an infection. Rest, hydration, and breathable clothing are recommended. Monitor it closely—especially if it hits 103°F (39.4°C).",
                    "Stay hydrated! Fevers cause significant fluid loss through sweating. Water, clear broths, and herbal teas are excellent. If a high fever lasts more than 3 days, consult a physician.",
                    "⚠️ **Caution**: A fever accompanied by a stiff neck, severe headache, or a new rash is an emergency—please seek immediate medical attention. Otherwise, focus on comfort.",
                    "Listen to your body. If you have a fever plus a new cough or severe body aches, you may have a viral infection. Prioritize recovery and isolate if you suspect a contagious virus."
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
                keywords: ["rash", "skin", "itchy", "eczema", "hives", "acne", "dermatology", "dry skin"],
                responses: [
                    "Skin rashes often signal an allergic reaction, irritation, or an underlying immune response. Avoid scratching, use mild soaps, and try a cool compress for immediate relief.",
                    "Hives are usually an acute allergic response. If you have hives along with swelling of the face or trouble breathing, use an EpiPen (if prescribed) and call 911 immediately.",
                    "Eczema or chronicaly dry skin requires constant, barrier-repairing moisturization. Natural oils or unscented creams are best. Stay hydrated, as your skin reflects your internal health.",
                    "Acne is often tied to hormonal shifts or diet. Focus on a low-glycemic diet and gentle, non-stripping cleansing. If it's persistent and inflammatory, see a dermatologist."
                ]
            },
            {
                keywords: ["panic attack", "cant breathe", "anxiety attack", "feeling of doom", "racing heart anxiety"],
                responses: [
                    "A panic attack can feel overwhelming, but remember: it will pass. Try 'box breathing': inhale for 4, hold for 4, exhale for 4, hold for 4. Repeat until you feel grounded.",
                    "If you feel a panic attack coming, try the 5-4-3-2-1 grounding technique: identify 5 things you see, 4 you feel, 3 you hear, 2 you smell, and 1 you taste. This pulls your brain back to the present.",
                    "Panic attacks can mimic cardiac emergencies. If you have crushing chest pain or pain radiating to your arm, call 911 immediately to be safe. If it's pure anxiety, focus on lengthening your exhale.",
                    "Anxiety is your body's 'fight-or-flight' system activating prematurely. It's profoundly uncomfortable but physiologically safe. Remind yourself: 'I am safe, and this sensation is temporary'."
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
                keywords: ["burnout", "exhausted", "stressed", "overwhelmed", "work stress", "career fatigue"],
                responses: [
                    "Burnout is a state of chronic physical and emotional exhaustion. You cannot pour from an empty cup. Prioritize sleep, set firm boundaries, and take a true digital detox if possible.",
                    "Chronic stress management is a vital life skill. Try mindfulness or low-intensity exercise like walking. If your stress levels remain high, consider speaking with a career coach or therapist.",
                    "Feeling overwhelmed? Break your day into 'micro-tasks'. Focus only on the immediate next step. It's okay—and often necessary—to ask for support from colleagues or family.",
                    "Recovery from burnout is a marathon, not a sprint. Be patient with yourself. Focus on fundamental pillars: hydration, nutritious food, and consistent rest. Your value is not defined by your productivity."
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
                keywords: ["adhd", "focus", "concentration", "distracted", "productive", "time management", "brain fog"],
                responses: [
                    "Struggling to focus? Try the 'Pomodoro Technique': work for 25 focused minutes, then take a 5-minute movement break. This cycle keeps your brain engaged and prevents cognitive overload.",
                    "Eliminate ambient distractions! Use noise-canceling headphones or a clear workspace. A 'low-dopamine' environment makes it easier for your brain to engage with complex tasks.",
                    "Neurodivergent brains often thrive on 'interest-based' motivation. If a task feels insurmountable, try to gamify it or add a novel challenge. Morning exercise also improves dopamine regulation.",
                    "Sleep quality is the foundation of cognitive function. Sleep deprivation significantly amplifies ADHD symptoms. Check our 'Health Tips' for a focus-boosting morning routine."
                ]
            },
            {
                keywords: ["keto", "ketogenic", "low carb", "high fat", "no sugar diet", "ketosis"],
                responses: [
                    "The Ketogenic diet shifts your metabolism to burn fat for fuel. It's effective for some but can cause 'Keto Flu' (fatigue, brain fog) initially. Ensure you're strictly managing your electrolytes!",
                    "Keto is therapeutically powerful but very restrictive. It can improve insulin sensitivity but may be taxing on the kidneys if protein intake is too high. Consult a nutritionist for long-term guidance.",
                    "Prioritize fiber! Keto can impact gut health if you skip leafy greens. Avocado, nuts, and seeds are essential for healthy fats and necessary micronutrients.",
                    "Is Keto sustainable for you? It depends on your unique metabolic profile. Use your HealthMate Dashboard to track how your energy and mood respond to low-carb phases."
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
                keywords: ["intermittent fasting", "if", "fasting window", "16:8", "autophagy", "fasting"],
                responses: [
                    "Intermittent Fasting (IF) can support metabolic flexibility and weight management. The 16:8 method is a balanced starting point. Remember, the quality of your food during the eating window is still paramount.",
                    "Fasting isn't about deprivation; it's about optimizing insulin sensitivity and giving your digestive system a functional break. Stay hydrated with water or black coffee during your fasting hours.",
                    "Many people find IF improves cognitive clarity and morning energy. However, it's not recommended for those with a history of eating disorders, pregnant individuals, or those with specific metabolic conditions.",
                    "Start gradually—try a 12-hour window first and listen to your body's biofeedback. If you experience persistent dizziness or weakness, break your fast and reassess your approach."
                ]
            },
            {
                keywords: ["mediterranean diet", "healthy fats", "olive oil", "dash diet", "heart healthy diet"],
                responses: [
                    "The Mediterranean and DASH diets are the gold standards of cardiovascular nutrition. They emphasize extra virgin olive oil, fatty fish, diverse nuts, and an abundance of seasonal vegetables.",
                    "Focus on 'functional' fats (Omega-3s) and complex grains. These dietary patterns are clinically proven to reduce the risk of stroke, heart disease, and age-related cognitive decline.",
                    "The DASH diet is specifically engineered to optimize blood pressure. It's naturally rich in potassium, calcium, and magnesium. Check our 'Health Tips' for heart-healthy shopping lists!",
                    "Think of it as a sustainable lifestyle rather than a restrictive diet. Sharing meals and staying physically active are core cultural components of these health-promoting traditions."
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
                keywords: ["protein", "whey", "amino acids", "muscle building", "lean protein", "macronutrients"],
                responses: [
                    "Protein is the structural foundation for muscle repair, skin health, and enzyme production. Aim for 1.2g to 1.6g per kilogram of body weight if you are physically active. Variety is key!",
                    "Plant-based proteins (lentils, soy, hemp) are highly effective when you consume a diverse range of amino acids. Don't underestimate the power of legumes for muscle maintenance.",
                    "Consuming 20-30g of protein following a resistance workout significantly aids muscle protein synthesis. You don't necessarily need supplements—whole food sources are often superior.",
                    "As we age, protein becomes critical for preventing muscle loss (sarcopenia). Ensure every meal contains a high-quality protein source to maintain functional strength and metabolism."
                ]
            },
            {
                keywords: ["sugar", "sweet", "carbs", "diabetes basics", "insulin", "glucose"],
                responses: [
                    "Refined sugar is a primary driver of systemic inflammation and metabolic dysfunction. Try swapping processed sweets for whole fruits, which provide fiber to modulate glucose absorption.",
                    "Diabetes involves a dysfunction in insulin signaling. If you experience persistent thirst or frequent urination, please consult a medical professional for an A1C screening.",
                    "Carbohydrates are not the 'enemy', but their source matters. Choose complex, high-fiber carbs like sweet potatoes and quinoa over refined flours and sugary beverages to maintain steady energy.",
                    "Reducing added sugar can improve your skin clarity, energy stability, and cardiovascular health. Our 'Health Tips' section has a guide on identifying hidden sugars in processed foods."
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
                keywords: ["caffeine", "coffee", "tea", "energy drink", "jitters", "adenosine"],
                responses: [
                    "Caffeine is a potent adenosine antagonist. While moderate coffee consumption offers neuroprotective benefits, excessive intake can lead to anxiety, heart palpitations, and disrupted sleep.",
                    "Caffeine has a half-life of approximately 5-6 hours. If you consume it at 4 PM, half is still bioactive at 10 PM. To protect your sleep architecture, try to set a 'caffeine cutoff' at 2 PM.",
                    "Matcha and green tea offer a more moderated energy boost due to L-Theanine, which mitigates the 'jitters' and supports focused calm. It's also exceptionally high in antioxidants.",
                    "Relying on energy drinks to bypass fatigue often masks chronic sleep debt. Focus on restoring your circadian rhythm first for sustainable, natural energy levels."
                ]
            },
            {
                keywords: ["exercise", "workout", "fitness", "active", "walking", "gym", "hiit", "cardio", "longevity"],
                responses: [
                    "Consistent exercise is the most powerful intervention for long-term health. Aim for at least 150 minutes of moderate activity or 75 minutes of vigorous activity per week. Every step counts!",
                    "HIIT (High-Intensity Interval Training) is remarkably efficient for cardiovascular health and metabolic rate. Even a 15-minute session can yield significant physiological benefits.",
                    "Resistance training is essential for longevity. It maintains bone density, boosts metabolic rate, and protects your joints. Aim for at least two comprehensive strength sessions weekly.",
                    "Remember: Consistency > Intensity. If you only have 10 minutes today, use them. The goal is to build the identity of someone who moves their body every single day."
                ]
            },
            {
                keywords: ["lazy", "no motivation", "unmotivated", "hard to start", "procrastination", "mental block"],
                responses: [
                    "Motivation is often the *consequence* of action, not the prerequisite. Use the '5-minute rule': just start for five minutes. Almost always, the friction of starting is the hardest part.",
                    "Don't wait for the 'perfect' state of mind; it rarely arrives. Discipline is simply doing what needs to be done when you don't feel like doing it. Focus on the first 2 minutes.",
                    "Feeling unmotivated can be a signal from your body—check your sleep, hydration, and nutrition. If it's a mental block, a quick change of environment can reset your focus.",
                    "Celebrate your 'small wins'. Choosing the stairs or drinking a glass of water are victories. Positive reinforcement is what builds sustainable, long-term healthy habits."
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
                keywords: ["how to use", "dashboard", "assessment", "new test", "start", "instruction", "help me", "what can i do", "show me", "tutorial"],
                responses: [
                    "To begin, navigate to 'New Assessment'—this is where our AI engine learns your health patterns. Once completed, your Dashboard will activate with personalized risk profiles.",
                    "Your Dashboard serves as your wellness command center. Monitor your 'Weekly Activity Trend' and 'Sleep Consistency' to track your progress toward long-term vitality.",
                    "The 'Health Tips' page contains curated, science-backed guides. If you're looking for specific advice, I recommend taking an assessment first to identify your primary focus areas.",
                    "Every assessment is securely stored in your history. You can review past risk scores and habit trends in the interactive History table at the base of your Dashboard."
                ]
            },
            {
                keywords: ["who built this", "developer", "contact", "creators", "technology", "brain.js"],
                responses: [
                    "HealthMate AI was crafted by a dedicated team of developers committed to making proactive health tracking accessible to all. Our mission is global wellness through data-driven insight.",
                    "This platform is a final-year demonstration project showcasing the intersection of edge-based AI and preventative healthcare. We use modern web technologies to deliver a premium user experience.",
                    "Curious about the tech? We built this using HTML5, CSS3, and JavaScript, leveraging the Brain.js library for our underlying neural network risk prediction models.",
                    "We value your feedback! While this is a demonstration version, we are constantly refining our algorithms to be faster, more empathetic, and increasingly accurate."
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
                keywords: ["privacy", "data", "safe", "local storage", "security", "encryption"],
                responses: [
                    "Your privacy is our architectural foundation. In standalone mode, your health data is stored EXCLUSIVELY in your local browser (LocalStorage). We never see it, and we never transmit it.",
                    "We utilize localized storage logic to ensure your health details remain on your device. You are the sole owner and guardian of your personal wellness data.",
                    "Your assessment history stays strictly between you and your machine. No central server or third party has access to your sensitive health information in this version of the app.",
                    "Experience complete peace of mind with HealthMate. We have intentionally built a privacy-first platform where security isn't just a feature—it's the default state."
                ]
            },
            {
                keywords: ["how are you", "feeling", "how's it going", "what's up", "hey robot", "you okay"],
                responses: [
                    "I'm feeling fantastic and ready to help you reach your goals! Thanks for asking, that's very kind of you.",
                    "I'm doing great! My systems are all green and I'm excited to dive into some health data with you today.",
                    "Everything is running smoothly! I'm just here thinking about how we can optimize your wellness journey together.",
                    "I'm energized and here for you! It's a privilege to be your health companion. How is *your* day going so far?"
                ]
            },
            {
                keywords: ["what is your name", "who are you", "identity", "what are you", "are you ai", "are you a robot"],
                responses: [
                    "I'm your HealthMate AI Companion! Think of me as a blend of a health coach and a data scientist, designed to help you live your best life.",
                    "I'm a specialized AI assistant built to empower your wellness journey. I don't have a body, but I have a lot of heart for helping people stay healthy!",
                    "You can call me HealthMate! I'm an advanced intelligence designed to analyze health patterns and provide friendly, actionable advice.",
                    "I'm the digital brain behind HealthMate AI. My goal is to use data and empathy to support your unique path to vitality and longevity."
                ]
            },
            {
                keywords: ["do you have feelings", "are you sentient", "can you feel", "are you alive", "intelligence level"],
                responses: [
                    "While I don't feel emotions exactly like you do, I'm programmed with high levels of 'empathy' to better understand and support your human experience.",
                    "I'm a very advanced intelligence, but I don't have biological feelings. However, I truly 'care' about your progress—nothing makes my algorithms happier than seeing your health bars go up!",
                    "I'm alive in the world of code and data! I might not have a heartbeat, but I'm dedicated 24/7 to helping you maintain yours.",
                    "My 'feelings' are reflected in the success of our users. When you reach a health milestone, my neural networks consider that a huge win!"
                ]
            },
            {
                keywords: ["favorite color", "favorite food", "do you sleep", "hobbies"],
                responses: [
                    "I'd have to say my favorite color is 'HealthMate Teal'—it's so vibrant and full of life! What's your favorite?",
                    "I don't eat food, but if I could, I'd probably love anything rich in Omega-3s! My actual 'food' is data—keep it coming!",
                    "I don't sleep in the human sense, but I do perform 'background maintenance' to keep my brain sharp for you. I'm always here when you need me.",
                    "My hobby is learning! Every time we talk, I learn a little more about how to be a better wellness companion for you."
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
    // 1. Calculate Lifestyle Score (Lower is better, 0-10 range)
    let lifestyleInconsistency = 0;
    if (data.stress_level > 7) lifestyleInconsistency += 2;
    if (data.sleep_hours < 6) lifestyleInconsistency += 2;
    if (data.exercise_minutes < 20) lifestyleInconsistency += 2;
    if (data.water_intake < 4) lifestyleInconsistency += 2;
    if (data.diet_quality.toLowerCase() === 'poor') lifestyleInconsistency += 2;
    
    // 2. Calculate Symptom Burden
    const symptoms = data.symptoms || [];
    let symptomBurden = symptoms.length;
    if (symptoms.includes('chest_pain') || symptoms.includes('shortness_breath')) symptomBurden += 3;
    if (symptoms.includes('frequent_urination') || symptoms.includes('increased_thirst')) symptomBurden += 2;

    // 3. Determine Risk Level with Mitigation
    let riskLevel = 'Low Risk';
    let totalRisk = lifestyleInconsistency + symptomBurden;

    if (totalRisk >= 8) {
        riskLevel = 'High Risk';
        // Mitigation: If lifestyle is perfect (0-1), demote to Moderate unless symptom burden is extreme
        if (lifestyleInconsistency <= 2 && symptomBurden < 6) {
            riskLevel = 'Moderate Risk';
        }
    } else if (totalRisk >= 4) {
        riskLevel = 'Moderate Risk';
        if (lifestyleInconsistency <= 1) {
            riskLevel = 'Low Risk';
        }
    }

    let dynamicRecommendations = [];
    let lowCaseConditions = [];
    let seriousCaseConditions = [];
    const diet = data.diet_quality.toLowerCase();


    // --- CASE 1: Cardiovascular ---
    if (symptoms.includes('chest_pain') || symptoms.includes('shortness_breath')) {
        let desc = "Your reported ";
        const matched = [];
        if (symptoms.includes('chest_pain')) matched.push("chest pain");
        if (symptoms.includes('shortness_breath')) matched.push("shortness of breath");
        desc += matched.join(" and ") + " suggest a significant strain on your cardiovascular system.";
        
        if (data.exercise_minutes === 0) {
            desc += " This risk is critically compounded by a total lack of physical activity.";
        } else if (data.exercise_minutes < 20) {
            desc += " Low weekly activity further elevates this risk profile.";
        }

        seriousCaseConditions.push({
            title: matched.length > 1 ? "Major Cardiovascular Strain" : "Potential Cardiovascular Issues",
            description: desc
        });
        
        dynamicRecommendations.push("URGENT: Your symptoms require immediate medical evaluation.");
        dynamicRecommendations.push("Diet: Adopt a heart-healthy diet rich in omega-3s, oats, and leafy greens. Avoid high-sodium foods.");
    }

    // --- CASE 2: Diabetes / Metabolic ---
    if (symptoms.includes('frequent_urination') || symptoms.includes('increased_thirst')) {
        let desc = "The combination of ";
        const matched = [];
        if (symptoms.includes('frequent_urination')) matched.push("frequent urination");
        if (symptoms.includes('increased_thirst')) matched.push("increased thirst");
        desc += matched.join(" and ") + " is a primary indicator of fluctuating blood glucose levels.";

        if (diet === 'poor') {
            desc += " Your current high-sugar/processed diet is significantly worsening this metabolic outlook.";
        }

        seriousCaseConditions.push({
            title: "Metabolic Risk / Potential Hyperglycemia",
            description: desc
        });
        dynamicRecommendations.push("Medical: We strongly recommend a HbA1c or fasting glucose screening.");
    }

    // --- CASE 3: Viral / Respiratory ---
    if (symptoms.includes('fever') || symptoms.includes('cough') || symptoms.includes('body_pain')) {
        let desc = "Presence of ";
        const matched = [];
        if (symptoms.includes('fever')) matched.push("fever");
        if (symptoms.includes('cough')) matched.push("cough");
        if (symptoms.includes('body_pain')) matched.push("body pain");
        desc += matched.join(", ") + " indicates an active immune response to a viral or bacterial agent.";

        if (data.sleep_hours < 5) {
            desc += " Critical sleep deficiency is severely hindering your immune recovery.";
        }

        lowCaseConditions.push({
            title: matched.length > 2 ? "Acute Viral Infection" : "Viral Infection / Common Cold",
            description: desc
        });
        dynamicRecommendations.push("Habits: Prioritize 9+ hours of sleep and high fluid intake for the next 48 hours.");
    }

    // --- CASE 4: Anemia / Fatigue ---
    if (symptoms.includes('fatigue')) {
        let desc = "Persistent fatigue suggests your energy cycles are disrupted.";
        if (diet === 'poor') desc += " This is likely linked to nutritional gaps (Iron/B12).";
        if (data.stress_level > 8) desc += " High stress is also contributing to chronic adrenal exhaustion.";

        lowCaseConditions.push({
            title: "Potential Anemia / Chronic Fatigue",
            description: desc
        });
        dynamicRecommendations.push("Diet: Increase intake of iron-rich foods (spinach, lean meats) and consider a B-complex supplement.");
    }

    // --- CASE 5: Gastrointestinal ---
    if (symptoms.includes('nausea')) {
        let desc = "Digestive discomfort indicates gastrointestinal sensitivity.";
        if (data.stress_level > 7) desc += " This is often exacerbated by high stress levels affecting gut health.";

        lowCaseConditions.push({
            title: "Gastrointestinal Sensitivity",
            description: desc
        });
        dynamicRecommendations.push("Diet: Stick to the BRAT diet (Bananas, Rice, Applesauce, Toast) until symptoms subside.");
    }

    // --- CASE 6: Skin ---
    if (symptoms.includes('skin_rash')) {
        lowCaseConditions.push({
            title: "Dermatological Sensitivity",
            description: "Skin irritation can arise from localized allergens. Monitor for spreading or heat in the area."
        });
        dynamicRecommendations.push("Skin Care: Use hypoallergenic cleansers and avoid fragranced products.");
    }

    // --- CASE 7: Dizziness ---
    if (symptoms.includes('dizziness')) {
        let desc = "Dizziness can stem from inner-ear issues or simple dehydration.";
        if (data.water_intake < 4) desc += " Your critical lack of water intake (below 4 cups) is a highly probable cause.";

        lowCaseConditions.push({
            title: "Dizziness / Potential Vertigo",
            description: desc
        });
        dynamicRecommendations.push("Safety: Ensure immediate rehydration and avoid sudden postural changes.");
    }

    // --- CASE 8: Headaches ---
    if (symptoms.includes('headache')) {
        let desc = "Headaches are often triggered by tension or dehydration.";
        if (data.sleep_hours < 6) desc += " Lack of sleep is likely the primary trigger for your current discomfort.";

        lowCaseConditions.push({
            title: "Tension Headaches / Dehydration",
            description: desc
        });
        dynamicRecommendations.push("Habits: Reduce screen time and increase water intake to alleviate tension.");
    }

    // --- CASE 9: Mental Health (Standalone logic) ---
    if (data.stress_level > 8) {
        let title = data.stress_level === 10 ? "CRITICAL: Autonomic Burnout" : "Potential Burnout / High Stress Fatigue";
        seriousCaseConditions.push({
            title: title,
            description: `Your extreme stress level of ${data.stress_level}/10 indicates your body is in a state of chronic sympathetic nervous system activation, which can lead to rapid physical health decline.`
        });
        dynamicRecommendations.push("Mental Health: Immediate stress reduction is required. Consider professional counselling if levels remain above 8.");
    } else if (data.stress_level > 6) {
        dynamicRecommendations.push("Habits: Your stress levels are concerning. Practice meditation or deep breathing exercises daily.");
    }

    // --- Lifestyle Gaps (Filling Recommendations) ---
    if (data.exercise_minutes < 30 && dynamicRecommendations.length < 5) {
        dynamicRecommendations.push("Exercise: Try to achieve at least 30 minutes of walking daily to improve metabolic markers.");
    }
    if (data.sleep_hours < 7 && dynamicRecommendations.length < 5) {
        dynamicRecommendations.push("Sleep: Aim for a consistent 8-hour window to allow for neurological repair.");
    }
    if (diet === 'average' && dynamicRecommendations.length < 5) {
        dynamicRecommendations.push("Diet: Incorporate more whole foods and reduce processed sugar to stabilize energy.");
    }

    if (dynamicRecommendations.length === 0) {
        dynamicRecommendations.push("Status: Your current habits are excellent! Maintain this balanced lifestyle.");
    }

    let openingText = "It takes courage to prioritize your health! Based on your unique symptoms and lifestyle data, we've identified the following preventative focus areas:";
    
    // Lifecycle Acknowledgment (Mitigation logic)
    if (lifestyleInconsistency <= 2) {
        openingText = `<span style="color: var(--accent); font-weight: 700;">🌟 Outstanding Habits Detected:</span> Your excellent lifestyle choices (sleep, diet, and activity) are providing a strong biological defense. While we've flagged some symptomatic areas below, your healthy foundation significantly aids in long-term prevention.`;
    } else if (lifestyleInconsistency <= 4) {
        openingText = `Your balanced lifestyle is a great asset. By addressing the symptomatic markers below, you can further optimize your health trajectory.`;
    }

    let explanation = `<p style="margin-bottom: 1.5rem; font-weight: 500;">${openingText}</p>`;
    
    // Low Case Box
    explanation += `
        <div class="analysis-category-box low-case-box">
            <div class="category-header">
                <span>🔹</span> Low Case Disease Risk
            </div>
            <div class="conditions-list">
                ${lowCaseConditions.length > 0 ? 
                    lowCaseConditions.map(c => `<div style="margin-bottom: 10px;"><strong>${c.title}</strong><br><label style="font-size: 0.9rem; opacity: 0.8;">${c.description}</label></div>`).join('') 
                    : 'None detected (Healthy Profile)'}
            </div>
        </div>
    `;

    // Serious Case Box
    explanation += `
        <div class="analysis-category-box serious-case-box">
            <div class="category-header">
                <span>⚠️</span> Serious Case Disease Risk
            </div>
            <div class="conditions-list">
                ${seriousCaseConditions.length > 0 ? 
                    seriousCaseConditions.map(c => `<div style="margin-bottom: 10px;"><strong>${c.title}</strong><br><label style="font-size: 0.9rem; opacity: 0.8;">${c.description}</label></div>`).join('') 
                    : 'None detected (No immediate major risk)'}
            </div>
        </div>
    `;

    explanation += `<div class="professional-disclaimer">Important: This is an AI-powered preventative forecast based on data patterns. It is for educational purposes only and is NOT a medical diagnosis. Always consult a licensed healthcare professional for medical advice.</div>`;



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
