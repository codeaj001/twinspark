// Supabase Configuration
// Load configuration from environment variables
const SUPABASE_URL = envLoader.getSupabaseUrl()
const SUPABASE_ANON_KEY = envLoader.getSupabaseAnonKey()

// Validate configuration
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase configuration. Please check your .env file.');
    throw new Error('Supabase configuration is required');
}

// Create Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Export for global use
window.supabase = supabase

// Location services
class LocationService {
    constructor() {
        this.currentLocation = null
        this.watchId = null
    }

    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'))
                return
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    }
                    resolve(this.currentLocation)
                },
                (error) => {
                    reject(error)
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            )
        })
    }

    startWatching() {
        if (!navigator.geolocation) {
            console.error('Geolocation not supported')
            return
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                }
                this.updateUserLocation()
            },
            (error) => {
                console.error('Error watching location:', error)
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        )
    }

    stopWatching() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId)
            this.watchId = null
        }
    }

    async updateUserLocation() {
        // Get current location from realtime service or get it fresh
        let location = this.currentLocation;
        if (!location && window.realtimeMatchingService) {
            location = window.realtimeMatchingService.currentLocation;
        }
        
        if (!location) {
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 60000
                    });
                });
                location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                this.currentLocation = location;
            } catch (error) {
                console.error('Could not get location:', error);
                return;
            }
        }

        try {
            const { data, error } = await supabase.rpc('update_user_location', {
                lat: location.lat,
                lng: location.lng
            })

            if (error) {
                console.error('Error updating location:', error)
            } else {
                console.log('✅ Location updated in database:', location)
            }
        } catch (error) {
            console.error('Error updating location:', error)
        }
    }
}

// Authentication helper
class AuthService {
    constructor() {
        this.user = null
        this.session = null
    }

    async signUp(email, password, username) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username
                    }
                }
            })

            if (error) throw error

            // Wait a moment for the trigger to fire
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Check if user profile was created by trigger
            if (data.user) {
                const { data: profile, error: profileCheckError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('id', data.user.id)
                    .single()

                // If profile doesn't exist, create it manually as fallback
                if (!profile || profileCheckError) {
                    console.log('Trigger didn\'t create profile, creating manually...')
                    const { error: profileError } = await supabase
                        .from('users')
                        .insert({
                            id: data.user.id,
                            email: data.user.email,
                            username: username,
                            interests: [],
                            avatar: '1'
                        })

                    if (profileError) {
                        console.error('Error creating user profile:', profileError)
                        throw new Error('Database error saving new user')
                    }
                }
            }
            
            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    async signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            })

            if (error) throw error

            this.user = data.user
            this.session = data.session

            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    async signOut() {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error

            this.user = null
            this.session = null

            return { error: null }
        } catch (error) {
            return { error }
        }
    }

    async getCurrentUser() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            this.user = user
            return user
        } catch (error) {
            console.error('Error getting current user:', error)
            return null
        }
    }

    async hasCompletedProfile() {
        try {
            if (!this.user) {
                return false
            }

            const { data, error } = await supabase
                .from('users')
                .select('interests, looking_for, bio')
                .eq('id', this.user.id)
                .single()

            if (error) {
                console.error('Error checking profile completion:', error)
                return false
            }

            // Consider profile complete if user has at least one interest
            // and has filled out their bio (optional check for looking_for)
            return data && 
                   data.interests && 
                   data.interests.length > 0 && 
                   data.bio && 
                   data.bio.trim().length > 0
        } catch (error) {
            console.error('Error checking profile completion:', error)
            return false
        }
    }

    async updateUserProfile(updates) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', this.user.id)
                .select()

            if (error) throw error

            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    async setOnlineStatus(isOnline) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update({ is_online: isOnline })
                .eq('id', this.user.id)

            if (error) throw error

            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }
}

// Matching service
class MatchingService {
    constructor() {
        this.nearbyUsers = []
    }

    async findNearbyUsers(lat, lng) {
        try {
            const { data, error } = await supabase.functions.invoke('find_matches', {
                body: { lat, lng }
            })

            if (error) throw error

            this.nearbyUsers = data
            return data
        } catch (error) {
            console.error('Error finding nearby users:', error)
            return []
        }
    }

    async createMatch(otherUserId) {
        try {
            const { data, error } = await supabase.rpc('create_match', {
                other_user_id: otherUserId
            })

            if (error) throw error

            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    async getMatches() {
        try {
            const { data, error } = await supabase
                .from('matches')
                .select(`
                    *,
                    user1:users!matches_user_id_1_fkey(id, username, avatar, interests),
                    user2:users!matches_user_id_2_fkey(id, username, avatar, interests)
                `)
                .order('timestamp', { ascending: false })

            if (error) throw error

            return data
        } catch (error) {
            console.error('Error getting matches:', error)
            return []
        }
    }
}

// Chat service
class ChatService {
    constructor() {
        this.currentMatch = null
        this.messages = []
        this.subscription = null
    }

    async subscribeToMatch(matchId) {
        this.currentMatch = matchId
        
        // Subscribe to realtime changes
        this.subscription = supabase
            .channel(`match_${matchId}`)
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'chats', filter: `match_id=eq.${matchId}` },
                (payload) => {
                    this.handleNewMessage(payload.new)
                }
            )
            .subscribe()

        // Load existing messages
        return this.loadMessages()
    }

    async loadMessages() {
        try {
            const { data, error } = await supabase
                .from('chats')
                .select(`
                    *,
                    sender:users(id, username, avatar)
                `)
                .eq('match_id', this.currentMatch)
                .order('timestamp', { ascending: true })

            if (error) throw error

            this.messages = data
            return data
        } catch (error) {
            console.error('Error loading messages:', error)
            return []
        }
    }

    async sendMessage(message) {
        try {
            const { data, error } = await supabase
                .from('chats')
                .insert({
                    match_id: this.currentMatch,
                    sender_id: authService.user.id,
                    message: message
                })
                .select()

            if (error) throw error

            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    handleNewMessage(message) {
        this.messages.push(message)
        // Trigger UI update
        if (window.chatUI && window.chatUI.renderMessages) {
            window.chatUI.renderMessages()
        }
    }

    unsubscribe() {
        if (this.subscription) {
            supabase.removeChannel(this.subscription)
            this.subscription = null
        }
    }
}

// AI Post service
class AIPostService {
    async generatePost(matchId, userSummary) {
        try {
            const { data, error } = await supabase.functions.invoke('generate_post', {
                body: {
                    match_id: matchId,
                    user_summary: userSummary
                }
            })

            if (error) throw error

            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    async getPostsForMatch(matchId) {
        try {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .eq('match_id', matchId)
                .order('created_at', { ascending: false })

            if (error) throw error

            return data
        } catch (error) {
            console.error('Error getting posts:', error)
            return []
        }
    }
}

// Initialize services
const locationService = new LocationService()
const authService = new AuthService()
const matchingService = new MatchingService()
const chatService = new ChatService()
const aiPostService = new AIPostService()

// Export services globally
window.locationService = locationService
window.authService = authService
window.matchingService = matchingService
window.chatService = chatService
window.aiPostService = aiPostService

// Initialize auth state on page load
document.addEventListener('DOMContentLoaded', async () => {
    const user = await authService.getCurrentUser()
    if (user) {
        authService.user = user
        // Set user as online
        await authService.setOnlineStatus(true)
        
        // Start location tracking
        try {
            await locationService.getCurrentLocation()
            locationService.startWatching()
        } catch (error) {
            console.error('Location access denied:', error)
        }
    }
})

// Clean up on page unload
window.addEventListener('beforeunload', async () => {
    if (authService.user) {
        await authService.setOnlineStatus(false)
    }
    locationService.stopWatching()
    chatService.unsubscribe()
})
