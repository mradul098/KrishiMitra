let currentLocation = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
        document.getElementById('location').value = savedLocation;
        currentLocation = savedLocation;
    }
});

// Handle Enter key
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Send message
async function sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    input.value = '';
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                message,
                location: currentLocation
            })
        });
        
        const data = await response.json();
        
        // Remove typing indicator
        removeTypingIndicator();
        
        if (data.success) {
            addMessage(data.message, 'bot');
            
            // Show context info if available
            if (data.context && data.context.weather) {
                addContextCard(data.context);
            }
        } else {
            addMessage('Sorry, I encountered an error. Please try again.', 'bot');
        }
    } catch (error) {
        removeTypingIndicator();
        addMessage('Sorry, I could not connect to the server. Please check your connection.', 'bot');
    }
}

// Send quick message
function sendQuickMessage(message) {
    document.getElementById('userInput').value = message;
    sendMessage();
}



// Add context card
function addContextCard(context) {
    const chatContainer = document.getElementById('chatContainer');
    const contextDiv = document.createElement('div');
    contextDiv.className = 'message mb-4';
    
    let weatherInfo = '';
    if (context.weather) {
        // Update weather background
        if (window.weatherBackground) {
            window.weatherBackground.updateBackground(context.weather);
        }
        
        // Update weather indicator
        updateWeatherIndicator(context.weather);
        
        weatherInfo = `
            <div class="bg-blue-50 p-3 rounded mb-2 backdrop-filter backdrop-blur-sm">
                <i class="fas fa-cloud-sun text-blue-600 mr-2"></i>
                <strong>Current Weather:</strong> ${context.weather.temp}°C, ${context.weather.description}
                <br>Humidity: ${context.weather.humidity}%
            </div>
        `;
    }
    
    let priceInfo = '';
    if (context.prices) {
        priceInfo = `
            <div class="bg-yellow-50 p-3 rounded backdrop-filter backdrop-blur-sm">
                <i class="fas fa-chart-line text-yellow-600 mr-2"></i>
                <strong>Market Prices:</strong>
                <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
                    ${Object.entries(context.prices).map(([crop, price]) => `
                        <div>${crop.charAt(0).toUpperCase() + crop.slice(1)}: ₹${price.min}-${price.max} ${price.unit}</div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    contextDiv.innerHTML = `
        <div class="flex items-start">
            <div class="bg-gray-600 text-white rounded-full p-2 mr-3">
                <i class="fas fa-info"></i>
            </div>
            <div class="max-w-2xl">
                ${weatherInfo}
                ${priceInfo}
            </div>
        </div>
    `;
    
    chatContainer.appendChild(contextDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    const chatContainer = document.getElementById('chatContainer');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'message mb-4';
    typingDiv.innerHTML = `
        <div class="flex items-start">
            <div class="bg-green-600 text-white rounded-full p-2 mr-3">
                <i class="fas fa-robot"></i>
            </div>
            <div class="bg-green-100 p-4 rounded-lg">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
    chatContainer.appendChild(typingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Update location
function updateLocation() {
    const locationInput = document.getElementById('location');
    currentLocation = locationInput.value;
    localStorage.setItem('userLocation', currentLocation);
    
    if (currentLocation) {
        addMessage(`Location updated to: ${currentLocation}`, 'bot');
        sendQuickMessage('What is the current weather?');
    }
}

// Modal functions
function showInsuranceModal() {
    document.getElementById('insuranceModal').classList.remove('hidden');
}

function showLoanModal() {
    document.getElementById('loanModal').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Calculate insurance
async function calculateInsurance() {
    const cropType = document.getElementById('cropType').value;
    const area = document.getElementById('area').value;
    const season = document.getElementById('season').value;
    
    if (!area) {
        alert('Please enter the area');
        return;
    }
    
    try {
        const response = await fetch('/api/insurance/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cropType, area: parseFloat(area), season })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const result = data.data;
            document.getElementById('insuranceResult').innerHTML = `
                <h4 class="font-bold mb-2">Insurance Details:</h4>
                <p><strong>Crop:</strong> ${result.cropType}</p>
                <p><strong>Area:</strong> ${result.area} hectares</p>
                <p><strong>Sum Insured:</strong> ₹${result.sumInsured.toLocaleString()}</p>
                <p><strong>Your Premium:</strong> ₹${result.farmerPremium.toLocaleString()}</p>
                <p><strong>Government Subsidy:</strong> ₹${result.govtSubsidy.toLocaleString()}</p>
                <p class="mt-2 text-sm text-gray-600">
                    Under PM Fasal Bima Yojana, you only pay ${season === 'kharif' ? '2%' : '1.5%'} of the sum insured!
                </p>
            `;
            document.getElementById('insuranceResult').classList.remove('hidden');
        }
    } catch (error) {
        alert('Error calculating insurance. Please try again.');
    }
}

// Calculate loan
async function calculateLoan() {
    const commodity = document.getElementById('commodity').value;
    const quantity = document.getElementById('quantity').value;
    const quality = document.getElementById('quality').value;
    
    if (!quantity) {
        alert('Please enter the quantity');
        return;
    }
    
    try {
        const response = await fetch('/api/loans/warehouse', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ commodity, quantity: parseFloat(quantity), quality })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const result = data.data;
            document.getElementById('loanResult').innerHTML = `
                <h4 class="font-bold mb-2">Loan Eligibility:</h4>
                <p><strong>Commodity:</strong> ${result.commodity}</p>
                <p><strong>Quantity:</strong> ${result.quantity} quintals</p>
                <p><strong>Quality:</strong> Grade ${result.quality}</p>
                <p><strong>Estimated Value:</strong> ₹${result.estimatedValue.toLocaleString()}</p>
                <p class="text-lg font-bold text-green-600 mt-2">
                    Eligible Loan Amount: ₹${result.eligibleLoanAmount.toLocaleString()}
                </p>
                <p><strong>Interest Rate:</strong> ${result.interestRate}</p>
                <p><strong>Tenure:</strong> ${result.tenure}</p>
                <p class="mt-2 text-sm text-gray-600">
                    You can get up to 70% of your commodity value as loan!
                </p>
            `;
            document.getElementById('loanResult').classList.remove('hidden');
            
            // Trigger celebration effect
            triggerCelebration();
        }
    } catch (error) {
        alert('Error calculating loan. Please try again.');
    }
}

// Weather indicator update
function updateWeatherIndicator(weather) {
    const indicator = document.getElementById('weatherIndicator');
    const text = document.getElementById('weatherText');
    
    if (weather) {
        text.textContent = `${weather.temp}°C, ${weather.description}`;
        indicator.classList.remove('hidden');
    }
}

// Celebration effect
function triggerCelebration() {
    if (window.particleSystem) {
        // Add burst effect at random positions
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const x = Math.random() * window.innerWidth;
                const y = Math.random() * window.innerHeight * 0.5;
                window.particleSystem.addBurst(x, y);
            }, i * 200);
        }
    }
    
    // Play success sound (if available)
    playSuccessSound();
}

// Success sound
function playSuccessSound() {
    // Create audio context for success sound
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        const audioContext = new (AudioContext || webkitAudioContext)();
        
        // Create success sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    }
}

// Enhanced message animations
function addMessage(message, sender) {
    const chatContainer = document.getElementById('chatContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender} mb-4`;
    
    if (sender === 'user') {
        messageDiv.innerHTML = `
            <div class="flex items-start justify-end">
                <div class="bg-blue-500 text-white p-4 rounded-lg max-w-2xl backdrop-filter backdrop-blur-sm">
                    <p>${message}</p>
                </div>
                <div class="bg-blue-500 text-white rounded-full p-2 ml-3">
                    <i class="fas fa-user"></i>
                </div>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="flex items-start">
                <div class="bg-green-600 text-white rounded-full p-2 mr-3">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="bg-green-100 p-4 rounded-lg max-w-2xl backdrop-filter backdrop-blur-sm">
                    <p class="text-gray-800">${message}</p>
                </div>
            </div>
        `;
    }
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
} 