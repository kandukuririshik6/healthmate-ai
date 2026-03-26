const API_URL = 'http://localhost:3000';

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
window.togglePassword = function(inputId, iconElement) {
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
    initMagneticButtons();

    // Register Form Handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = registerForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = "Registering...";
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
                btn.innerText = originalText;
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
            btn.innerText = "Logging in...";
            btn.disabled = true;

            const data = {
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
            };
            console.log("Attempting login for:", data.email);


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
                    alert('Invalid credentials! Please register first if you do not have an account.');
                }
            } finally {
                btn.innerText = originalText;
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
            btn.innerText = "Analyzing...";
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
                    alert('Assessment failed');
                }
            } catch (err) {
                console.warn("Prediction Backend offline, using Proactive Analysis Engine:", err);
                let riskScore = 0;
                
                // Add points for lifestyle factors
                if (data.stress_level > 7) riskScore += 2;
                if (data.sleep_hours < 6) riskScore += 1;
                if (data.exercise_minutes < 30) riskScore += 1;
                if (data.water_intake < 4) riskScore += 1;
                if (data.diet_quality.toLowerCase() === 'poor') riskScore += 2;
                
                // Add points for symptoms
                riskScore += data.symptoms.length; // 1 point per selected symptom
                
                let riskLevel = 'Low Risk';
                
                // Determine risk level based on cumulative score and critical symptoms
                if (data.symptoms.includes('chest_pain') || data.symptoms.includes('shortness_breath') || riskScore >= 6) {
                    riskLevel = 'High Risk';
                } else if (riskScore >= 3) {
                    riskLevel = 'Moderate Risk';
                }
                
                let dynamicRecommendations = [];
                let predictedConditions = [];
                
                const diet = data.diet_quality.toLowerCase();
                
                // Disease Prediction Logic
                if (data.symptoms.includes('chest_pain') || data.symptoms.includes('shortness_breath')) {
                    predictedConditions.push("Cardiovascular Issues / Heart Disease");
                    dynamicRecommendations.push("URGENT: Your symptoms (chest pain/shortness of breath) require immediate medical evaluation.");
                    dynamicRecommendations.push("Diet: Adopt a heart-healthy diet rich in omega-3s (salmon, walnuts), oats, and leafy greens. Avoid high-sodium and fried foods immediately.");
                    dynamicRecommendations.push("Exercise: Pause strenuous activities until cleared by a physician. Very light walking may be okay if approved.");
                } else {
                    if (data.exercise_minutes < 30 || diet === 'poor') {
                        dynamicRecommendations.push("Exercise: Incorporate at least 30-45 minutes of moderate aerobic activity daily. Try brisk walking, cycling, swimming, or bodyweight exercises (squats/lunges) to lower your risk profile.");
                        if (diet === 'poor') predictedConditions.push("Metabolic Syndrome / Cardiovascular Risk");
                    } else {
                        dynamicRecommendations.push("Exercise: Maintain your excellent workout routine! Consider mixing in some HIIT or strength training (like push-ups and planks) for extra benefits.");
                    }
                }
                
                if (data.symptoms.includes('frequent_urination') || data.symptoms.includes('increased_thirst')) {
                    predictedConditions.push("Type 2 Diabetes / Pre-Diabetes");
                    dynamicRecommendations.push("Medical: Schedule a blood glucose test as your symptoms strongly correlate with blood sugar issues.");
                    dynamicRecommendations.push("Diet: Focus on low-glycemic foods like quinoa, lentils, berries, and non-starchy vegetables. Strictly avoid sugary drinks, candies, and white bread.");
                }
                
                if (data.symptoms.includes('fever') && (data.symptoms.includes('cough') || data.symptoms.includes('body_pain') || data.symptoms.includes('fatigue'))) {
                    predictedConditions.push("Viral Infection / Influenza");
                    dynamicRecommendations.push("Action: Rest immediately. Monitor your temperature and isolate to prevent spreading a potential viral infection.");
                }
                
                if (data.stress_level >= 8 && data.sleep_hours <= 5 && data.symptoms.includes('fatigue')) {
                    predictedConditions.push("Burnout / Chronic Stress Syndrome");
                }
                
                if (data.symptoms.includes('headache') && data.water_intake < 5) {
                    predictedConditions.push("Chronic Dehydration");
                }
                
                // General lifestyle recommendations fallback
                if (data.symptoms.includes('fatigue') || data.sleep_hours < 6) {
                    dynamicRecommendations.push("Habits: Focus heavily on sleep hygiene. Aim for 8 hours. Try a 10-minute relaxing wind-down routine, like light stretching or reading, before bed.");
                }
                if (data.symptoms.includes('headache') && data.water_intake >= 5) {
                    dynamicRecommendations.push("Habits: Monitor triggers for your headaches, such as screen time or caffeine withdrawal.");
                }
                if (data.water_intake < 5) {
                    dynamicRecommendations.push("Diet: Increase your hydration aggressively to at least 8 glasses of water a day.");
                }
                if (diet === 'average' || diet === 'poor' || data.symptoms.includes('nausea')) {
                    dynamicRecommendations.push("Diet: Shift to a balanced diet. Include lean proteins (chicken breast, tofu, beans), whole grains (brown rice, oats), and healthy fats (avocados, olive oil) to maximize your vitality.");
                }
                if (data.stress_level > 6) {
                    dynamicRecommendations.push("Habits: Your stress levels are concerning. Implement daily relaxing activities like yoga (child's pose, downward dog), meditation, or a 15-minute nature walk to reduce cortisol levels.");
                }
                
                if (dynamicRecommendations.length === 0) {
                    dynamicRecommendations.push("Diet & Exercise: Continue your current balanced lifestyle, you are doing great!");
                }
                if (predictedConditions.length === 0) {
                    if (data.symptoms.length === 0 && riskLevel === 'Low Risk') {
                        predictedConditions.push("None detected (Healthy Profile)");
                    } else {
                        predictedConditions.push("General Mild Inflammation / Stress");
                    }
                }
                
                const conditionString = "Based on your current habits, you might have an elevated future risk for: " + predictedConditions.join(', ') + ". Please remember this is just a preventative forecast, not a diagnosis! ";
                const baseExplanation = "The great news is that your daily habits hold incredible power! By proactively following the personalized diet, hydration, and exercise recommendations below, you can dramatically lower these risks and build a stronger, healthier future. You've got this!";
                
                showAssessmentResult({
                    riskLevel: riskLevel,
                    explanation: conditionString + baseExplanation,
                    recommendations: dynamicRecommendations
                });
                
                // Track history in offline DB
                let userHistory = JSON.parse(localStorage.getItem('healthmate_history_' + user.email) || '[]');
                userHistory.unshift({
                    date: new Date().toISOString(),
                    risk_level: riskLevel,
                    sleep_hours: data.sleep_hours,
                    exercise_minutes: data.exercise_minutes,
                    stress_level: data.stress_level,
                    water_intake: data.water_intake
                });
                localStorage.setItem('healthmate_history_' + user.email, JSON.stringify(userHistory));
            } finally {
                btn.innerText = originalText;
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
    const path = window.location.pathname;
    if (!user && path.endsWith('dashboard.html')) {
        window.location.href = 'login.html';
        return;
    }
    if (user && (path.endsWith('login.html') || path.endsWith('register.html'))) {
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
    try {
        const userId = user.id || generateUserId(user.email);
        const res = await fetch(`${API_URL}/history?userId=${userId}`);
        const result = await res.json();

        const tbody = document.getElementById('historyTableBody');

        if (result.history && result.history.length > 0) {
            tbody.innerHTML = '';
            
            // Set latest risk with badge
            const latest = result.history[0];
            updateDashboardRiskBadge(latest.risk_level);

            // Populate table and prepare chart data
            const activityData = [];
            const sleepData = [];

            result.history.slice(0, 7).reverse().forEach(item => {
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

                activityData.push(item.exercise_minutes);
                sleepData.push(item.sleep_hours);
            });

            renderChart('activityChart', activityData, 120); // max 120 mins
            renderChart('sleepChart', sleepData, 12); // max 12 hours
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">No assessments taken yet.</td></tr>';
            updateDashboardRiskBadge('No Data');
        }

    } catch (err) {
        console.warn("Dashboard API error, using local fallback:", err);
        const tbody = document.getElementById('historyTableBody');
        
        let userHistory = JSON.parse(localStorage.getItem('healthmate_history_' + user.email) || '[]');
        
        if (userHistory.length > 0) {
            tbody.innerHTML = '';
            
            const latest = userHistory[0];
            updateDashboardRiskBadge(latest.risk_level);

            const activityData = [];
            const sleepData = [];

            userHistory.slice(0, 7).reverse().forEach(item => {
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

                activityData.push(item.exercise_minutes);
                sleepData.push(item.sleep_hours);
            });

            renderChart('activityChart', activityData, 120);
            renderChart('sleepChart', sleepData, 12);
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">No assessments taken yet. Take your first assessment to start tracking!</td></tr>';
            updateDashboardRiskBadge('No Data');
        }
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
                    <button id="chatbot-send" class="btn btn-primary" style="padding: 0.6rem 1.2rem; min-width: auto; border-radius: 12px;">Send</button>
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
        
        // Add User Message
        messages.innerHTML += `<div class="message user">${text}</div>`;
        input.value = '';
        messages.scrollTop = messages.scrollHeight;
        
        // Add loading Indicator
        const loadingId = 'loading-' + Date.now();
        messages.innerHTML += `<div class="message bot loading" id="${loadingId}">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        </div>`;
        messages.scrollTop = messages.scrollHeight;

        try {
            const res = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await res.json();
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();
            
            if (res.ok) {
                messages.innerHTML += `<div class="message bot">${data.response}</div>`;
            } else {
                messages.innerHTML += `<div class="message bot error">Error: Couldn't connect.</div>`;
            }
        } catch(e) {
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();
            
            // Fallback AI logic
            const lowerMsg = text.toLowerCase();
            let fallbackResponse = "";
             
            if (lowerMsg.includes("hello") || lowerMsg.includes("hi")) {
                fallbackResponse = "Hello there! I am HealthMate AI. How can I assist you with your health today?";
            } else if (lowerMsg.includes("headache")) {
                fallbackResponse = "Headaches can be caused by dehydration, lack of sleep, or stress. Try drinking a glass of water, resting in a quiet room, and taking a screen break. If it persists, consult a doctor.";
            } else if (lowerMsg.includes("sleep")) {
                fallbackResponse = "Adults usually need 7-9 hours of sleep. Try to maintain a consistent sleep schedule and limit screen time 1 hour before bed.";
            } else if (lowerMsg.includes("diet") || lowerMsg.includes("food")) {
                fallbackResponse = "A balanced diet with plenty of fruits, vegetables, lean proteins, and whole grains is essential. Reducing processed foods and sugar can significantly improve your risk profile.";
            } else if (lowerMsg.includes("fever")) {
                fallbackResponse = "A fever is usually a sign that your body is fighting off an infection. Rest, stay hydrated, and monitor your temperature. If it goes above 101°F, consult a provider.";
            } else if (lowerMsg.includes("exercise") || lowerMsg.includes("workout")) {
                fallbackResponse = "Regular activity is key! Aim for 150 mins of moderate activity per week. Even brisk walking makes a huge difference.";
            } else if (lowerMsg.includes("thank")) {
                fallbackResponse = "You're very welcome! I am always here to help.";
            } else {
                fallbackResponse = "That's an excellent question. For the most accurate advice, I recommend completing the Health Assessment on our platform!";
            }
             
            messages.innerHTML += `<div class="message bot">${fallbackResponse}</div>`;
        }
        messages.scrollTop = messages.scrollHeight;
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
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

function initMagneticButtons() {
    const buttons = document.querySelectorAll('.btn');
    
    buttons.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            btn.style.transform = `translate(${x * 0.2}px, ${y * 0.3}px) scale(1.03)`;
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });
}
