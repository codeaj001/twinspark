// Match JavaScript File
// Handles matchmaking logic and UI rendering

document.addEventListener('DOMContentLoaded', function() {
    // Show welcome message for dashboard experience
    showWelcomeMessage();
    
    initializeMatchingSystem();
    requestLocationPermission(); // Request permission immediately on load
    setupRealtimeControls();
    setupLocationControls();
    setupFilterControls();
});

// Show welcome message for first-time or returning users
function showWelcomeMessage() {
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (!welcomeMessage) return;
    
    // Check if user is coming from login/index redirect or first visit today
    const referrer = document.referrer;
    const hasShownToday = localStorage.getItem('welcomeShownToday');
    const today = new Date().toDateString();
    
    // Show welcome if:
    // 1. Coming from index.html or auth.html
    // 2. Haven't shown welcome today
    // 3. No referrer (direct access)
    const shouldShowWelcome = 
        referrer.includes('index.html') || 
        referrer.includes('auth.html') || 
        hasShownToday !== today ||
        !referrer;
    
    if (shouldShowWelcome) {
        welcomeMessage.style.display = 'block';
        
        // Set flag to not show again today
        localStorage.setItem('welcomeShownToday', today);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            welcomeMessage.style.transition = 'opacity 0.5s ease';
            welcomeMessage.style.opacity = '0';
            setTimeout(() => {
                welcomeMessage.style.display = 'none';
                welcomeMessage.style.opacity = '1'; // Reset for next time
            }, 500);
        }, 10000);
        
        // Allow manual dismiss on click
        welcomeMessage.addEventListener('click', () => {
            welcomeMessage.style.transition = 'opacity 0.3s ease';
            welcomeMessage.style.opacity = '0';
            setTimeout(() => {
                welcomeMessage.style.display = 'none';
                welcomeMessage.style.opacity = '1';
            }, 300);
        });
    }
}

// Initialize matching system
function initializeMatchingSystem() {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', async function() {
        // Ensure location permission is granted before refreshing
        const hasPermission = await ensureLocationPermission();
        if (!hasPermission) {
            TwinSpark.showMessage('Location permission is required to find matches', 'error');
            return;
        }
        
        TwinSpark.showMessage('Refreshing matches...', 'info');
        loadMatches();
    });
}

// Setup location controls
function setupLocationControls() {
    const updateLocationBtn = document.getElementById('updateLocationBtn');
    const searchRadius = document.getElementById('searchRadius');
    
        updateLocationBtn.addEventListener('click', async function() {
            updateLocationBtn.style.transform = 'rotate(360deg)';
            updateLocationBtn.style.transition = 'transform 0.5s ease';
            
            setTimeout(() => {
                updateLocationBtn.style.transform = 'rotate(0deg)';
            }, 500);
            
            // Ensure location permission before updating
            const hasPermission = await ensureLocationPermission();
            if (!hasPermission) {
                TwinSpark.showMessage('Location permission is required to update your location', 'error');
                return;
            }
            
            updateLocationDisplay(true);
        });
    
    searchRadius.addEventListener('change', function() {
        const radius = parseInt(this.value);
        localStorage.setItem('matchingRadius', radius.toString());
        TwinSpark.showMessage(`Search radius updated to ${formatRadius(radius)}`, 'success');
        
        // Reload matches with new radius
        setTimeout(loadMatches, 500);
    });
    
    // Load saved radius
    const savedRadius = localStorage.getItem('matchingRadius');
    if (savedRadius) {
        searchRadius.value = savedRadius;
    }
    
    // Initialize location display
    updateLocationDisplay();
}

// Setup filter controls
function setupFilterControls() {
    // Interest matching is now automatically determined by the system
    // based on user profile and preferences
    console.log('Filter controls initialized');
}

// Format radius for display
function formatRadius(meters) {
    if (meters < 1000) {
        return `${meters}m`;
    } else {
        return `${(meters / 1000).toFixed(1)}km`;
    }
}

// Update location display
async function updateLocationDisplay(forceUpdate = false) {
    const locationText = document.getElementById('locationText');
    
    if (!forceUpdate) {
        // Check if we have cached location
        const user = JSON.parse(localStorage.getItem('twinsparkUser') || '{}');
        if (user.location && user.lastLocationUpdate) {
            const lastUpdate = new Date(user.lastLocationUpdate);
            const now = new Date();
            const timeDiff = now - lastUpdate;
            
            // If location was updated less than 5 minutes ago, use cached location
            if (timeDiff < 5 * 60 * 1000) {
                await displayLocationFromCoords(user.location.lat, user.location.lng);
                return;
            }
        }
    }
    
    locationText.textContent = 'Getting location...';
    
    try {
        const location = await getCurrentLocation();
        if (location) {
            await displayLocationFromCoords(location.lat, location.lng);
            
            // Update user data in localStorage
            const user = JSON.parse(localStorage.getItem('twinsparkUser') || '{}');
            user.location = location;
            user.lastLocationUpdate = new Date().toISOString();
            localStorage.setItem('twinsparkUser', JSON.stringify(user));
            
            // Update in database if user is authenticated
            if (window.authService && window.authService.user) {
                try {
                    await window.locationService.updateUserLocation();
                } catch (error) {
                    console.error('Failed to update location in database:', error);
                }
            }
        }
    } catch (error) {
        console.error('Location error:', error);
        locationText.textContent = 'Location unavailable';
        TwinSpark.showMessage('Unable to get your location. Please enable location services.', 'error');
    }
}

// Display location from coordinates
async function displayLocationFromCoords(lat, lng) {
    const locationText = document.getElementById('locationText');
    
    try {
        // Try to get readable address using reverse geocoding
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
        const data = await response.json();
        
        if (data.city && data.countryName) {
            locationText.textContent = `${data.city}, ${data.countryName}`;
        } else if (data.locality && data.countryName) {
            locationText.textContent = `${data.locality}, ${data.countryName}`;
        } else {
            locationText.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    } catch (error) {
        // Fallback to coordinates
        locationText.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

// Request location permission explicitly
async function requestLocationPermission() {
    if (!navigator.geolocation) {
        TwinSpark.showMessage('Geolocation is not supported by this browser', 'error');
        return false;
    }

    // Check if permission is already granted
    if (navigator.permissions) {
        try {
            const permission = await navigator.permissions.query({name: 'geolocation'});
            if (permission.state === 'granted') {
                // Permission already granted, load matches
                loadMatches();
                return true;
            } else if (permission.state === 'denied') {
                TwinSpark.showMessage('Location access is blocked. Please enable it in your browser settings to find matches nearby.', 'error');
                return false;
            }
        } catch (error) {
            console.warn('Permission API not supported, falling back to geolocation request');
        }
    }

    // Request location permission by attempting to get current position
    try {
        TwinSpark.showMessage('Requesting location access for better matches...', 'info');
        const location = await getCurrentLocationWithPrompt();
        if (location) {
            TwinSpark.showMessage('Location access granted! Loading matches...', 'success');
            loadMatches();
            return true;
        }
    } catch (error) {
        console.error('Location permission request failed:', error);
        if (error.code === 1) { // PERMISSION_DENIED
            TwinSpark.showMessage('Location access denied. You can still use the app, but matches will be limited.', 'warning');
        } else {
            TwinSpark.showMessage('Unable to access location. Please check your settings.', 'warning');
        }
        return false;
    }
    return false;
}

// Ensure location permission is granted before location-dependent operations
async function ensureLocationPermission() {
    if (!navigator.geolocation) {
        return false;
    }

    // Check current permission state
    if (navigator.permissions) {
        try {
            const permission = await navigator.permissions.query({name: 'geolocation'});
            if (permission.state === 'granted') {
                return true;
            } else if (permission.state === 'denied') {
                return false;
            }
        } catch (error) {
            console.warn('Permission API not supported');
        }
    }

    // Try to get location to trigger permission prompt if needed
    try {
        await getCurrentLocationWithPrompt();
        return true;
    } catch (error) {
        return false;
    }
}

// Get current location with permission prompt
async function getCurrentLocationWithPrompt() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                resolve(location);
            },
            (error) => {
                console.error('Geolocation error:', error);
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0 // Always request fresh location for permission prompt
            }
        );
    });
}

// Get current location using browser geolocation API (for normal usage)
async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                resolve(location);
            },
            (error) => {
                console.error('Geolocation error:', error);
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );
    });
}

// Setup real-time matching controls
function setupRealtimeControls() {
    const realtimeToggle = document.getElementById('realtimeToggle');
    const matchingStatus = document.getElementById('matchingStatus');
    const locationIndicator = document.getElementById('locationIndicator');
    
    // Update location indicator
    updateLocationIndicator();
    
    // Real-time toggle button
    realtimeToggle.addEventListener('click', async function() {
        const matchingService = window.realtimeMatchingService;
        
        if (matchingService.isMatching) {
            // Stop matching
            matchingService.stopMatching();
            realtimeToggle.innerHTML = 'Start Matching';
            realtimeToggle.classList.remove('active');
            matchingStatus.style.display = 'none';
            TwinSpark.showMessage('Real-time matching stopped', 'info');
        } else {
            // Start matching - first ensure location permission
            const hasPermission = await ensureLocationPermission();
            if (!hasPermission) {
                TwinSpark.showMessage('Location permission is required for real-time matching', 'error');
                return;
            }
            
            const user = JSON.parse(localStorage.getItem('twinsparkUser') || '{}');
            
            if (!user.name || !user.interests || user.interests.length === 0) {
                TwinSpark.showMessage('Please complete your profile first!', 'error');
                setTimeout(() => {
                    window.location.href = 'profile.html';
                }, 2000);
                return;
            }
            
            matchingService.startMatching();
            realtimeToggle.innerHTML = '⏹Stop Matching';
            realtimeToggle.classList.add('active');
            matchingStatus.style.display = 'block';
            TwinSpark.showMessage('Real-time matching started! You\'ll get notified when matches are found.', 'success');
        }
    });
    
    // Update button state based on current matching status
    const matchingService = window.realtimeMatchingService;
    if (matchingService && matchingService.isMatching) {
        realtimeToggle.innerHTML = '⏹Stop Matching';
        realtimeToggle.classList.add('active');
        matchingStatus.style.display = 'block';
    }
}

// Update location indicator
function updateLocationIndicator() {
    const locationIndicator = document.getElementById('locationIndicator');
    const matchingService = window.realtimeMatchingService;
    
    if (matchingService && matchingService.currentLocation) {
        // In a real app, you would reverse geocode the coordinates
        // For now, just show coordinates
        const lat = matchingService.currentLocation.lat.toFixed(4);
        const lng = matchingService.currentLocation.lng.toFixed(4);
        locationIndicator.innerHTML = `📍 ${lat}, ${lng}`;
    } else {
        // Try to get location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude.toFixed(4);
                    const lng = position.coords.longitude.toFixed(4);
                    locationIndicator.innerHTML = `📍 ${lat}, ${lng}`;
                },
                (error) => {
                    locationIndicator.innerHTML = '📍 Location unavailable';
                }
            );
        } else {
            locationIndicator.innerHTML = '📍 Location not supported';
        }
    }
}

// Load matches from database
async function loadMatches() {
    const matchesContainer = document.getElementById('matchesContainer');
    const noMatches = document.getElementById('noMatches');

    // Clear current matches
    matchesContainer.innerHTML = '';

    // Get user data
    const user = JSON.parse(localStorage.getItem('twinsparkUser'));

    // Check if user has profile setup
    if (!user || !user.name || user.interests.length === 0) {
        matchesContainer.innerHTML = `
            <div style="text-align: center; color: white; padding: 2rem; grid-column: 1 / -1;">
                <h3>Please set up your profile first!</h3>
                <p>You need to create a profile and select interests to find matches.</p>
                <br>
                <a href="profile.html" class="cta-button">Setup Profile</a>
            </div>
        `;
        return;
    }

    // Show loading state
    matchesContainer.innerHTML = `
        <div style="text-align: center; color: white; padding: 2rem; grid-column: 1 / -1;">
            <div class="pulse-dot" style="margin: 0 auto 1rem;"></div>
            <h3>Finding matches...</h3>
            <p>Looking for people with similar interests nearby</p>
        </div>
    `;

    try {
        // Get matches from Supabase if user is authenticated
        let potentialMatches = [];
        
        if (window.authService && window.authService.user) {
            // Ensure location permission before getting location
            const hasPermission = await ensureLocationPermission();
            if (!hasPermission) {
                TwinSpark.showMessage('Location permission is required to find matches nearby', 'error');
                matchesContainer.innerHTML = `
                    <div style="text-align: center; color: white; padding: 2rem; grid-column: 1 / -1;">
                        <h3>Location Access Required</h3>
                        <p>Please enable location access in your browser to find matches nearby.</p>
                        <br>
                        <button onclick="requestLocationPermission()" class="cta-button">Enable Location</button>
                    </div>
                `;
                return;
            }
            
            // Get current location
            const location = await getCurrentLocation();
            if (location) {
                // Update user's location in database
                await window.locationService.updateUserLocation();
                
                // Get search radius from UI (default 500m)
                const searchRadius = document.getElementById('searchRadius');
                const radiusMeters = parseInt(searchRadius?.value || '500');
                
                // Use Supabase function to find nearby users
                const { data, error } = await window.supabase.rpc('find_nearby_users', {
                    user_lat: location.lat,
                    user_lng: location.lng,
                    radius_meters: radiusMeters
                });
                
                if (error) {
                    console.error('Error finding matches:', error);
                    
                    // Show user-friendly error message
                    if (error.message.includes('auth')) {
                        TwinSpark.showMessage('Please log in to find matches', 'error');
                    } else if (error.message.includes('location')) {
                        TwinSpark.showMessage('Location services required for matching', 'error');
                    } else {
                        TwinSpark.showMessage('Unable to find matches. Please try again.', 'error');
                    }
                } else {
                    potentialMatches = (data || []).map(match => ({
                        id: match.user_id,
                        name: match.username,
                        bio: match.bio || 'No bio available',
                        interests: match.interests || [],
                        lookingFor: match.looking_for,
                        avatar: TwinSpark.getAvatarEmoji(match.avatar),
                        matchScore: match.match_score || 0,
                        distance: Math.round(match.distance_meters),
                        commonInterests: match.common_interests || 0
                    }));
                }
            } else {
                TwinSpark.showMessage('Location access is required to find matches nearby', 'error');
            }
        }

        // Clear loading state
        matchesContainer.innerHTML = '';
        
        // Render matches
        if (potentialMatches.length === 0) {
            noMatches.style.display = 'block';
        } else {
            noMatches.style.display = 'none';
            potentialMatches.forEach((match, index) => {
                const matchCard = document.createElement('div');
                matchCard.className = 'match-card';
                matchCard.style.animationDelay = `${index * 0.1}s`;
                
                const lookingForText = match.lookingFor ? `<div class="looking-for">Looking for: ${match.lookingFor}</div>` : '';
                const distanceText = match.distance !== undefined ? `<div class="match-distance">${match.distance}m away</div>` : '';
                
                matchCard.innerHTML = `
                    <div class="match-avatar">${match.avatar}</div>
                    <h3>${match.name}</h3>
                    <p>${match.bio}</p>
                    ${lookingForText}
                    ${distanceText}
                    <div class="match-interests">
                        ${match.interests.map(interest => `<span class="interest-tag">${interest}</span>`).join('')}
                    </div>
                    <div class="match-actions">
                        <button class="connect-btn" data-match-id="${match.id}">Connect (${Math.round(match.matchScore)}%)</button>
                        <button class="skip-btn" data-match-id="${match.id}">Skip</button>
                    </div>
                `;
                
                // Add event listeners
                const connectBtn = matchCard.querySelector('.connect-btn');
                const skipBtn = matchCard.querySelector('.skip-btn');
                
                connectBtn.addEventListener('click', function() {
                    handleConnect(match, matchCard);
                });
                
                skipBtn.addEventListener('click', function() {
                    handleSkip(match, matchCard);
                });
                
                matchesContainer.appendChild(matchCard);
            });
        }
    } catch (error) {
        console.error('Error loading matches:', error);
        matchesContainer.innerHTML = `
            <div style="text-align: center; color: white; padding: 2rem; grid-column: 1 / -1;">
                <h3>Unable to load matches</h3>
                <p>Please try again later or check your connection.</p>
                <br>
                <button onclick="loadMatches()" class="cta-button">Retry</button>
            </div>
        `;
    }
}

// Get current location
async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                console.error('Location error:', error);
                resolve(null); // Return null instead of rejecting
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    });
}

// Handle connect button click
function handleConnect(match, matchCard) {
    // Animate card
    matchCard.style.transform = 'scale(1.05)';
    matchCard.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
    matchCard.style.color = 'white';
    
    // Update button text
    const connectBtn = matchCard.querySelector('.connect-btn');
    connectBtn.textContent = 'Connecting...';
    connectBtn.disabled = true;
    
    // Simulate connection process
    setTimeout(() => {
        // Store the current match in session storage for chat
        sessionStorage.setItem('currentMatch', JSON.stringify(match));
        
        TwinSpark.showMessage('Connection established! Starting chat...', 'success');
        
        // Redirect to chat after delay
        setTimeout(() => {
            window.location.href = 'chat.html';
        }, 1500);
    }, 1000);
}

// Handle skip button click
function handleSkip(match, matchCard) {
    // Animate card removal
    matchCard.style.transform = 'translateX(100%) rotate(10deg)';
    matchCard.style.opacity = '0';
    
    // Remove card after animation
    setTimeout(() => {
        matchCard.remove();
        
        // Check if there are any cards left
        const remainingCards = document.querySelectorAll('.match-card');
        if (remainingCards.length === 0) {
            document.getElementById('noMatches').style.display = 'block';
        }
    }, 300);
    
    TwinSpark.showMessage('Match skipped', 'info');
}


// Add animation for match cards
const style = document.createElement('style');
style.textContent = `
    .match-card {
        animation: slideInUp 0.6s ease-out;
    }
    
    @keyframes slideInUp {
        from {
            transform: translateY(30px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

