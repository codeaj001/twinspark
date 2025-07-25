// Real-time Matching System
// Handles location tracking, nearby user detection, and push notifications

class RealtimeMatchingService {
    constructor() {
        this.watchId = null;
        this.currentLocation = null;
        this.matchingInterval = null;
        this.isMatching = false;
        this.notificationPermission = null;
        this.lastMatchCheck = null;
        this.matchCheckInterval = 10000; // Check every 10 seconds
        
        this.init();
    }

    async init() {
        await this.requestNotificationPermission();
        this.setupLocationTracking();
    }

    // Request notification permission
    async requestNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                this.notificationPermission = await Notification.requestPermission();
            } else {
                this.notificationPermission = Notification.permission;
            }
        }
    }

    // Start real-time matching
    startMatching() {
        if (this.isMatching) return;
        
        this.isMatching = true;
        console.log('Starting real-time matching...');
        
        // Get current location and start watching
        this.getCurrentLocation().then(() => {
            this.startLocationTracking();
            this.startMatchingLoop();
        }).catch(error => {
            console.error('Location access denied:', error);
            window.TwinSpark.showMessage('Location access is required for matching. Please enable location permissions.', 'error');
        });
    }

    // Stop real-time matching
    stopMatching() {
        if (!this.isMatching) return;
        
        this.isMatching = false;
        console.log('Stopping real-time matching...');
        
        this.stopLocationTracking();
        this.stopMatchingLoop();
    }

    // Get current location
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    console.log('Current location:', this.currentLocation);
                    resolve(this.currentLocation);
                },
                (error) => {
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 30000
                }
            );
        });
    }

    // Start location tracking
    startLocationTracking() {
        if (this.watchId) return;

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const newLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };

                // Check if location changed significantly (more than 10 meters)
                if (this.hasLocationChanged(newLocation, 10)) {
                    console.log('Location updated:', newLocation);
                    this.currentLocation = newLocation;
                    this.updateLocationInDatabase();
                }
            },
            (error) => {
                console.error('Location tracking error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000
            }
        );
    }

    // Stop location tracking
    stopLocationTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    // Check if location changed significantly
    hasLocationChanged(newLocation, thresholdMeters = 10) {
        if (!this.currentLocation) return true;

        const distance = this.calculateDistance(
            this.currentLocation.lat,
            this.currentLocation.lng,
            newLocation.lat,
            newLocation.lng
        );

        return distance > thresholdMeters;
    }

    // Calculate distance between two points in meters
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    // Update location in database
    async updateLocationInDatabase() {
        if (!this.currentLocation) return;

        try {
            // Update Supabase if user is authenticated
            if (window.authService && window.authService.user) {
                await window.locationService.updateUserLocation();
            }
            
            // Update local storage
            const user = JSON.parse(localStorage.getItem('twinsparkUser') || '{}');
            user.location = this.currentLocation;
            user.lastLocationUpdate = new Date().toISOString();
            localStorage.setItem('twinsparkUser', JSON.stringify(user));

        } catch (error) {
            console.error('Failed to update location:', error);
        }
    }

    // Start matching loop
    startMatchingLoop() {
        if (this.matchingInterval) return;

        this.matchingInterval = setInterval(() => {
            this.checkForMatches();
        }, this.matchCheckInterval);

        // Check immediately
        this.checkForMatches();
    }

    // Stop matching loop
    stopMatchingLoop() {
        if (this.matchingInterval) {
            clearInterval(this.matchingInterval);
            this.matchingInterval = null;
        }
    }

    // Check for nearby matches
    async checkForMatches() {
        if (!this.currentLocation) return;

        try {
            const user = JSON.parse(localStorage.getItem('twinsparkUser') || '{}');
            if (!user.interests || user.interests.length === 0) {
                console.log('No interests set, skipping match check');
                return;
            }

            console.log('🔍 Checking for matches...');

            // In a real implementation, this would call the Supabase function
            // For now, we'll simulate with local dummy data
            const matches = await this.findNearbyMatches(user);
            
            if (matches.length > 0) {
                console.log(`Found ${matches.length} potential matches!`);
                this.handleNewMatches(matches);
            } else {
                console.log('No matches found nearby');
            }

        } catch (error) {
            console.error('Error checking for matches:', error);
        }
    }

    // Find nearby matches using real Supabase data
    async findNearbyMatches(currentUser) {
        try {
            // Use the same function as the match page
            if (window.authService && window.authService.user) {
                const { data, error } = await window.supabase.rpc('find_nearby_users', {
                    user_lat: this.currentLocation.lat,
                    user_lng: this.currentLocation.lng,
                    radius_meters: 100
                });

                if (error) {
                    console.error('Error finding nearby matches:', error);
                    return [];
                }

                return (data || []).map(match => ({
                    id: match.user_id,
                    name: match.username,
                    bio: match.bio || 'No bio available',
                    interests: match.interests || [],
                    lookingFor: match.looking_for,
                    avatar: match.avatar,
                    matchScore: match.match_score || 0,
                    distance: Math.round(match.distance_meters),
                    commonInterests: match.common_interests || 0
                })).sort((a, b) => b.matchScore - a.matchScore);
            }

            return [];
        } catch (error) {
            console.error('Error in findNearbyMatches:', error);
            return [];
        }
    }

    // Check if there's a looking_for match
    checkLookingForMatch(user1, user2) {
        if (!user1.lookingFor || !user2.interests) return false;

        return user2.interests.some(interest => 
            user1.lookingFor.toLowerCase().includes(interest.toLowerCase()) ||
            interest.toLowerCase().includes(user1.lookingFor.toLowerCase())
        );
    }

    // Calculate match score
    calculateMatchScore(currentUser, otherUser) {
        let score = 0;

        // Common interests (up to 50 points)
        const commonInterests = currentUser.interests.filter(interest =>
            otherUser.interests.includes(interest)
        );
        score += commonInterests.length * 10;

        // Looking for match (up to 50 points)
        if (this.checkLookingForMatch(currentUser, otherUser)) {
            score += 50;
        }

        return Math.min(score, 100);
    }

    // Handle new matches found
    handleNewMatches(matches) {
        const existingMatches = JSON.parse(localStorage.getItem('recentMatches') || '[]');
        const existingMatchIds = existingMatches.map(m => m.id);

        for (const match of matches) {
            // Only notify for new matches
            if (!existingMatchIds.includes(match.id)) {
                this.showMatchNotification(match);
            }
        }

        // Store recent matches
        localStorage.setItem('recentMatches', JSON.stringify(matches));
    }

    // Show match notification
    showMatchNotification(match) {
        const reasons = [];
        
        if (match.commonInterests.length > 0) {
            reasons.push(`${match.commonInterests.length} common interest${match.commonInterests.length > 1 ? 's' : ''}`);
        }
        
        const user = JSON.parse(localStorage.getItem('twinsparkUser') || '{}');
        if (this.checkLookingForMatch(user, match)) {
            reasons.push('matches what you\'re looking for');
        }

        const reasonText = reasons.length > 0 ? ` (${reasons.join(', ')})` : '';
        
        // Browser notification
        if (this.notificationPermission === 'granted') {
            const notification = new Notification('Match Found!', {
                body: `${match.name} is ${match.distance}m away${reasonText}`,
                icon: '/favicon.ico',
                tag: `match-${match.id}`,
                requireInteraction: true
            });

            notification.onclick = () => {
                window.focus();
                window.location.href = 'match.html';
                notification.close();
            };
        }

        // In-app notification
        window.TwinSpark.showMessage(
            `Match found! ${match.name} is ${match.distance}m away${reasonText}`,
            'success'
        );

        // Play notification sound (if available)
        this.playNotificationSound();
    }

    // Play notification sound
    playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b3yHhqZnBwdXp8fYGEhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b3yHhqZnBwdXp8fYGEhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b3yHhqZnBwdXp8fYGEhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b3yHhqZnBwdXp8fYGEhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b3yHhqZnBwdXp8fYGEhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b3yHhqZnBwdXp8fYGEhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b3yHhqZnBwdXp8fYGEhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b3yHhqZnBwdXp8fYGEhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b3yHhqZnBwdXp8fYGEhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b3yHhqZnBwdXp8fYGEhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b3yHhqZnBwdXp8fYGE');
            audio.play().catch(() => {
                // Ignore audio play errors
            });
        } catch (error) {
            // Ignore audio errors
        }
    }

    // Setup location tracking (called from main app)
    setupLocationTracking() {
        // Auto-start matching if user has completed profile
        const user = JSON.parse(localStorage.getItem('twinsparkUser') || '{}');
        if (user.name && user.interests && user.interests.length > 0) {
            // Don't auto-start to avoid overwhelming users
            console.log('Profile complete. Ready for matching.');
        }
    }

    // Get matching status
    getMatchingStatus() {
        return {
            isMatching: this.isMatching,
            hasLocation: !!this.currentLocation,
            hasPermission: this.notificationPermission === 'granted'
        };
    }
}

// Initialize the service
const realtimeMatchingService = new RealtimeMatchingService();

// Export for global use
window.realtimeMatchingService = realtimeMatchingService;

// Export for other modules
window.RealtimeMatchingService = RealtimeMatchingService;
