// Voice Manager for KrishiMitra
class VoiceManager {
    constructor() {
        this.speechRecognition = null;
        this.speechSynthesis = window.speechSynthesis;
        this.isListening = false;
        this.voices = [];
        this.currentLanguage = 'en';
        
        this.init();
    }
    
    init() {
        // Initialize Speech Recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.speechRecognition = new SpeechRecognition();
            
            this.speechRecognition.continuous = false;
            this.speechRecognition.interimResults = false;
            this.speechRecognition.maxAlternatives = 1;
            this.speechRecognition.lang = this.getRecognitionLanguage();
            
            this.setupRecognitionEvents();
        } else {
            console.warn('Speech Recognition not supported in this browser');
        }
        
        // Initialize Speech Synthesis
        if (this.speechSynthesis) {
            this.loadVoices();
            // Load voices when they change (some browsers load voices asynchronously)
            this.speechSynthesis.addEventListener('voiceschanged', () => {
                this.loadVoices();
            });
        }
        
        // Listen for language changes
        window.addEventListener('languageChanged', (event) => {
            this.setLanguage(event.detail.language);
        });
    }
    
    loadVoices() {
        this.voices = this.speechSynthesis.getVoices();
    }
    
    getRecognitionLanguage() {
        const langMap = {
            'en': 'en-US',
            'hi': 'hi-IN',
            'mr': 'mr-IN'
        };
        return langMap[this.currentLanguage] || 'en-US';
    }
    
    getSynthesisVoice() {
        const langMap = {
            'en': 'en-US',
            'hi': 'hi-IN',
            'mr': 'mr-IN'
        };
        
        const targetLang = langMap[this.currentLanguage] || 'en-US';
        
        // Find voice for current language
        let voice = this.voices.find(v => v.lang === targetLang);
        
        // Fallback to similar language
        if (!voice) {
            const langCode = targetLang.split('-')[0];
            voice = this.voices.find(v => v.lang.startsWith(langCode));
        }
        
        // Final fallback to English
        if (!voice) {
            voice = this.voices.find(v => v.lang.startsWith('en'));
        }
        
        return voice;
    }
    
    setupRecognitionEvents() {
        this.speechRecognition.onstart = () => {
            this.isListening = true;
            this.onListeningStart();
        };
        
        this.speechRecognition.onend = () => {
            this.isListening = false;
            this.onListeningEnd();
        };
        
        this.speechRecognition.onresult = (event) => {
            const result = event.results[0][0].transcript;
            this.onSpeechResult(result);
        };
        
        this.speechRecognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.onSpeechError(event.error);
        };
    }
    
    startListening() {
        if (!this.speechRecognition) {
            this.showNotification(t('error') + ': Speech recognition not supported', 'error');
            return;
        }
        
        if (this.isListening) {
            this.stopListening();
            return;
        }
        
        try {
            this.speechRecognition.lang = this.getRecognitionLanguage();
            this.speechRecognition.start();
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            this.showNotification(t('error') + ': Could not start voice input', 'error');
        }
    }
    
    stopListening() {
        if (this.speechRecognition && this.isListening) {
            this.speechRecognition.stop();
        }
    }
    
    speak(text, options = {}) {
        if (!this.speechSynthesis) {
            console.warn('Speech synthesis not supported');
            return;
        }
        
        // Cancel any ongoing speech
        this.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set voice
        const voice = this.getSynthesisVoice();
        if (voice) {
            utterance.voice = voice;
        }
        
        // Set properties
        utterance.rate = options.rate || 0.9;
        utterance.pitch = options.pitch || 1;
        utterance.volume = options.volume || 1;
        
        // Add event listeners
        utterance.onstart = () => {
            this.onSpeechStart();
        };
        
        utterance.onend = () => {
            this.onSpeechEnd();
        };
        
        utterance.onerror = (error) => {
            console.error('Speech synthesis error:', error);
            this.onSpeechEnd();
        };
        
        this.speechSynthesis.speak(utterance);
    }
    
    setLanguage(language) {
        this.currentLanguage = language;
        if (this.speechRecognition) {
            this.speechRecognition.lang = this.getRecognitionLanguage();
        }
    }
    
    // Event handlers (can be overridden)
    onListeningStart() {
        this.updateVoiceButton('listening');
        console.log('Started listening...');
    }
    
    onListeningEnd() {
        this.updateVoiceButton('idle');
        console.log('Stopped listening...');
    }
    
    onSpeechResult(result) {
        console.log('Speech result:', result);
        // Send to chatbot if available
        if (typeof quickQuestion === 'function') {
            quickQuestion(result);
        } else {
            // Fallback: put text in chat input
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.value = result;
                if (typeof sendChatMessage === 'function') {
                    sendChatMessage();
                }
            }
        }
    }
    
    onSpeechError(error) {
        console.error('Speech error:', error);
        this.updateVoiceButton('error');
        
        const errorMessages = {
            'en': 'Voice input error. Please try again.',
            'hi': 'आवाज़ इनपुट त्रुटि। कृपया पुनः प्रयास करें।',
            'mr': 'आवाज इनपुट त्रुटी. कृपया पुन्हा प्रयत्न करा.'
        };
        
        const message = errorMessages[this.currentLanguage] || errorMessages['en'];
        this.showNotification(message, 'error');
        
        setTimeout(() => {
            this.updateVoiceButton('idle');
        }, 2000);
    }
    
    onSpeechStart() {
        console.log('Speech synthesis started');
        this.updateSpeakerButton('speaking');
    }
    
    onSpeechEnd() {
        console.log('Speech synthesis ended');
        this.updateSpeakerButton('idle');
    }
    
    updateVoiceButton(state) {
        const voiceBtn = document.getElementById('voiceInputBtn');
        if (!voiceBtn) return;
        
        const icon = voiceBtn.querySelector('i');
        const text = voiceBtn.querySelector('.btn-text');
        
        switch (state) {
            case 'listening':
                icon.className = 'fas fa-stop-circle';
                voiceBtn.className = 'bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition flex items-center space-x-2';
                if (text) text.textContent = t('stopListening');
                break;
            case 'error':
                icon.className = 'fas fa-exclamation-triangle';
                voiceBtn.className = 'bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 transition flex items-center space-x-2';
                break;
            default:
                icon.className = 'fas fa-microphone';
                voiceBtn.className = 'bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition flex items-center space-x-2';
                if (text) text.textContent = t('voiceInput');
        }
    }
    
    updateSpeakerButton(state) {
        const speakerBtn = document.getElementById('speakerBtn');
        if (!speakerBtn) return;
        
        const icon = speakerBtn.querySelector('i');
        
        switch (state) {
            case 'speaking':
                icon.className = 'fas fa-volume-up animate-pulse';
                speakerBtn.disabled = true;
                break;
            default:
                icon.className = 'fas fa-volume-up';
                speakerBtn.disabled = false;
        }
    }
    
    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
    
    // Public methods
    isSupported() {
        return !!(this.speechRecognition && this.speechSynthesis);
    }
    
    getAvailableVoices() {
        return this.voices.filter(voice => {
            const lang = this.getRecognitionLanguage().split('-')[0];
            return voice.lang.startsWith(lang);
        });
    }
}

// Create global voice manager instance
window.voiceManager = new VoiceManager();

// Global voice control functions
window.startVoiceInput = function() {
    window.voiceManager.startListening();
};

window.speakText = function(text) {
    window.voiceManager.speak(text);
};

window.toggleVoiceInput = function() {
    if (window.voiceManager.isListening) {
        window.voiceManager.stopListening();
    } else {
        window.voiceManager.startListening();
    }
}; 