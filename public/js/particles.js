// Enhanced Particle System for KrishiMitra
class ParticleSystem {
    constructor() {
        this.canvas = document.getElementById('particleCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.weather = 'clear';
        this.time = 0;
        
        this.initCanvas();
        this.createParticles();
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.initCanvas());
    }
    
    initCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        const particleCount = window.innerWidth < 768 ? 30 : 50;
        this.particles = [];
        
        // Crop icons for particles
        const cropIcons = ['🌾', '🌽', '🍃', '☀️', '💧', '🌱', '🌿', '🍂'];
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 20 + 10,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5,
                icon: cropIcons[Math.floor(Math.random() * cropIcons.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                opacity: Math.random() * 0.3 + 0.1,
                pulseSpeed: Math.random() * 0.02 + 0.01,
                originalSize: 0
            });
            this.particles[i].originalSize = this.particles[i].size;
        }
    }
    
    updateWeather(weatherType) {
        this.weather = weatherType;
        this.adjustParticlesForWeather();
    }
    
    adjustParticlesForWeather() {
        this.particles.forEach(particle => {
            switch (this.weather) {
                case 'rain':
                case 'rainy':
                    particle.speedY = Math.abs(particle.speedY) + 1;
                    particle.speedX *= 0.5;
                    particle.icon = Math.random() > 0.7 ? '💧' : particle.icon;
                    break;
                case 'sunny':
                case 'clear':
                    particle.speedY = (Math.random() - 0.5) * 0.3;
                    particle.speedX = (Math.random() - 0.5) * 0.5;
                    particle.icon = Math.random() > 0.8 ? '☀️' : particle.icon;
                    break;
                case 'cloudy':
                    particle.speedY = (Math.random() - 0.5) * 0.2;
                    particle.speedX = (Math.random() - 0.5) * 0.8;
                    particle.opacity *= 0.7;
                    break;
                default:
                    // Default behavior
                    break;
            }
        });
    }
    
    createWeatherEffect() {
        if (this.weather === 'rain' || this.weather === 'rainy') {
            this.createRainDrops();
        }
    }
    
    createRainDrops() {
        for (let i = 0; i < 5; i++) {
            if (Math.random() > 0.7) {
                this.particles.push({
                    x: Math.random() * this.canvas.width,
                    y: -10,
                    size: 2,
                    speedX: Math.random() * 2 - 1,
                    speedY: Math.random() * 8 + 5,
                    icon: '💧',
                    rotation: 0,
                    rotationSpeed: 0,
                    opacity: 0.6,
                    pulseSpeed: 0,
                    originalSize: 2,
                    isRainDrop: true,
                    life: 100
                });
            }
        }
    }
    
    drawParticle(particle) {
        this.ctx.save();
        
        // Apply transformations
        this.ctx.globalAlpha = particle.opacity;
        this.ctx.translate(particle.x, particle.y);
        this.ctx.rotate(particle.rotation);
        
        // Pulsing effect
        const pulseSize = particle.originalSize + Math.sin(this.time * particle.pulseSpeed) * 3;
        this.ctx.font = `${pulseSize}px serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Add glow effect for certain icons
        if (particle.icon === '☀️') {
            this.ctx.shadowColor = '#FFD700';
            this.ctx.shadowBlur = 10;
        } else if (particle.icon === '💧') {
            this.ctx.shadowColor = '#87CEEB';
            this.ctx.shadowBlur = 5;
        }
        
        this.ctx.fillText(particle.icon, 0, 0);
        this.ctx.restore();
    }
    
    updateParticle(particle) {
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Update rotation
        particle.rotation += particle.rotationSpeed;
        
        // Handle screen wrapping
        if (particle.x > this.canvas.width + 50) {
            particle.x = -50;
        } else if (particle.x < -50) {
            particle.x = this.canvas.width + 50;
        }
        
        if (particle.y > this.canvas.height + 50) {
            if (particle.isRainDrop) {
                // Remove raindrops that fall off screen
                return false;
            }
            particle.y = -50;
        } else if (particle.y < -50 && !particle.isRainDrop) {
            particle.y = this.canvas.height + 50;
        }
        
        // Handle raindrop life
        if (particle.isRainDrop) {
            particle.life--;
            if (particle.life <= 0) {
                return false;
            }
        }
        
        return true;
    }
    
    animate() {
        this.time += 0.016; // Roughly 60fps
        
        // Clear canvas with a subtle gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        
        switch (this.weather) {
            case 'sunny':
            case 'clear':
                gradient.addColorStop(0, 'rgba(135, 206, 250, 0.1)');
                gradient.addColorStop(1, 'rgba(255, 223, 0, 0.05)');
                break;
            case 'rainy':
                gradient.addColorStop(0, 'rgba(70, 130, 180, 0.15)');
                gradient.addColorStop(1, 'rgba(100, 149, 237, 0.1)');
                break;
            case 'cloudy':
                gradient.addColorStop(0, 'rgba(169, 169, 169, 0.1)');
                gradient.addColorStop(1, 'rgba(192, 192, 192, 0.05)');
                break;
            default:
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0.01)');
        }
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Create weather effects
        this.createWeatherEffect();
        
        // Update and draw particles
        this.particles = this.particles.filter(particle => {
            const shouldKeep = this.updateParticle(particle);
            if (shouldKeep) {
                this.drawParticle(particle);
            }
            return shouldKeep;
        });
        
        // Ensure minimum particle count
        if (this.particles.length < 30) {
            this.createParticles();
        }
        
        requestAnimationFrame(() => this.animate());
    }
    
    addBurst(x, y) {
        const burstIcons = ['✨', '🌟', '💫', '⭐'];
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: x,
                y: y,
                size: Math.random() * 15 + 5,
                speedX: (Math.random() - 0.5) * 8,
                speedY: (Math.random() - 0.5) * 8,
                icon: burstIcons[Math.floor(Math.random() * burstIcons.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.1,
                opacity: 0.8,
                pulseSpeed: 0.1,
                originalSize: 0,
                isBurst: true,
                life: 60
            });
            this.particles[this.particles.length - 1].originalSize = this.particles[this.particles.length - 1].size;
        }
    }
}

// Weather-reactive background controller
class WeatherBackground {
    constructor() {
        this.body = document.body;
        this.currentWeather = 'clear';
    }
    
    updateBackground(weatherData) {
        if (!weatherData) return;
        
        const description = weatherData.description.toLowerCase();
        let weatherType = 'clear';
        
        if (description.includes('rain') || description.includes('drizzle')) {
            weatherType = 'rainy';
        } else if (description.includes('cloud')) {
            weatherType = 'cloudy';
        } else if (description.includes('sun') || description.includes('clear')) {
            weatherType = 'sunny';
        }
        
        // Remove previous weather classes
        this.body.classList.remove('weather-clear', 'weather-cloudy', 'weather-rainy', 'weather-sunny');
        
        // Add new weather class
        this.body.classList.add(`weather-${weatherType}`);
        
        if (this.currentWeather !== weatherType) {
            this.currentWeather = weatherType;
            
            // Update particles
            if (window.particleSystem) {
                window.particleSystem.updateWeather(weatherType);
            }
            
            // Create special effects
            this.createWeatherEffects(weatherType);
        }
    }
    
    createWeatherEffects(weatherType) {
        switch (weatherType) {
            case 'rainy':
                this.createRainEffect();
                break;
            case 'sunny':
                this.createSunRays();
                break;
        }
    }
    
    createRainEffect() {
        // Remove existing rain effect
        const existingRain = document.querySelector('.rain-effect');
        if (existingRain) {
            existingRain.remove();
        }
        
        const rainContainer = document.createElement('div');
        rainContainer.className = 'rain-effect';
        
        for (let i = 0; i < 50; i++) {
            const raindrop = document.createElement('div');
            raindrop.className = 'raindrop';
            raindrop.style.left = Math.random() * 100 + '%';
            raindrop.style.animationDuration = (Math.random() * 0.5 + 0.5) + 's';
            raindrop.style.animationDelay = Math.random() * 2 + 's';
            rainContainer.appendChild(raindrop);
        }
        
        document.body.appendChild(rainContainer);
        
        // Remove after 10 seconds
        setTimeout(() => {
            rainContainer.remove();
        }, 10000);
    }
    
    createSunRays() {
        // Create subtle sun ray effect
        const rays = document.createElement('div');
        rays.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at 80% 20%, rgba(255, 223, 0, 0.1) 0%, transparent 50%);
            pointer-events: none;
            z-index: -1;
            animation: sunRays 20s linear infinite;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes sunRays {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(rays);
        
        setTimeout(() => {
            rays.remove();
            style.remove();
        }, 20000);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.id = 'particleCanvas';
    document.body.insertBefore(canvas, document.body.firstChild);
    
    // Initialize systems
    window.particleSystem = new ParticleSystem();
    window.weatherBackground = new WeatherBackground();
});

// Export for use in other scripts
window.ParticleSystem = ParticleSystem;
window.WeatherBackground = WeatherBackground; 