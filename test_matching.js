// Test script to demonstrate TwinSpark matching functionality
// Add this to your HTML page temporarily to test matching

console.log('🧪 TwinSpark Matching Test Script Loaded');

// Test function to create some test users in the database
async function createTestUsers() {
    console.log('Creating test users...');
    
    // First, let's check if we have a current user
    const currentUser = await window.authService.getCurrentUser();
    if (!currentUser) {
        console.error('❌ No authenticated user found. Please log in first.');
        return;
    }
    
    console.log('✅ Current user:', currentUser.email);
    
    // Get current location
    try {
        const location = await window.locationService.getCurrentLocation();
        console.log('✅ Current location:', location);
        
        // Update current user's location
        await window.locationService.updateUserLocation();
        console.log('✅ User location updated in database');
        
        // Set user as online
        await window.authService.setOnlineStatus(true);
        console.log('✅ User status set to online');
        
    } catch (error) {
        console.error('❌ Error setting up location:', error);
    }
}

// Test function to find nearby matches
async function testFindMatches() {
    console.log('🔍 Testing match finding...');
    
    try {
        // Get current location
        const location = await window.locationService.getCurrentLocation();
        if (!location) {
            console.error('❌ No location available');
            return;
        }
        
        // Call the find_nearby_users function
        const { data, error } = await window.supabase.rpc('find_nearby_users', {
            user_lat: location.lat,
            user_lng: location.lng,
            radius_meters: 100
        });
        
        if (error) {
            console.error('❌ Error finding matches:', error);
            return;
        }
        
        console.log('✅ Found matches:', data);
        
        if (data && data.length > 0) {
            console.log(`🎉 Found ${data.length} potential matches!`);
            data.forEach((match, index) => {
                console.log(`${index + 1}. ${match.username} (${Math.round(match.distance_meters)}m away) - Score: ${match.match_score}%`);
                console.log(`   Interests: ${match.interests.join(', ')}`);
                console.log(`   Bio: ${match.bio || 'No bio'}`);
            });
        } else {
            console.log('😔 No matches found within 100m');
        }
        
    } catch (error) {
        console.error('❌ Error in testFindMatches:', error);
    }
}

// Test function to start real-time matching
async function testRealtimeMatching() {
    console.log('🔄 Testing real-time matching...');
    
    if (!window.realtimeMatchingService) {
        console.error('❌ Real-time matching service not available');
        return;
    }
    
    // Start matching
    window.realtimeMatchingService.startMatching();
    console.log('✅ Real-time matching started');
    
    // Stop after 30 seconds
    setTimeout(() => {
        window.realtimeMatchingService.stopMatching();
        console.log('✅ Real-time matching stopped');
    }, 30000);
}

// Test function to check current user profile
async function checkUserProfile() {
    console.log('👤 Checking user profile...');
    
    try {
        const currentUser = await window.authService.getCurrentUser();
        if (!currentUser) {
            console.error('❌ No authenticated user');
            return;
        }
        
        const { data, error } = await window.supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();
            
        if (error) {
            console.error('❌ Error fetching profile:', error);
            return;
        }
        
        console.log('✅ User profile:', data);
        
        // Check if profile is complete
        const hasCompletedProfile = await window.authService.hasCompletedProfile();
        console.log('✅ Profile complete:', hasCompletedProfile);
        
    } catch (error) {
        console.error('❌ Error checking profile:', error);
    }
}

// Function to simulate adding interests to current user
async function addTestInterests() {
    console.log('🎯 Adding test interests...');
    
    const testInterests = ['technology', 'music', 'sports', 'travel'];
    const testBio = 'Test user for TwinSpark matching system';
    
    try {
        const updates = {
            interests: testInterests,
            bio: testBio,
            looking_for: 'friends'
        };
        
        const result = await window.authService.updateUserProfile(updates);
        if (result.error) {
            console.error('❌ Error updating profile:', result.error);
            return;
        }
        
        console.log('✅ Profile updated with test interests:', testInterests);
        
    } catch (error) {
        console.error('❌ Error adding interests:', error);
    }
}

// Main test function
async function runMatchingTests() {
    console.log('🚀 Starting TwinSpark Matching Tests...');
    
    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
        // 1. Check user profile
        await checkUserProfile();
        
        // 2. Add test interests if needed
        await addTestInterests();
        
        // 3. Set up test users
        await createTestUsers();
        
        // 4. Test finding matches
        await testFindMatches();
        
        // 5. Test real-time matching (optional)
        // await testRealtimeMatching();
        
        console.log('✅ All tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Export functions for manual testing
window.testMatching = {
    run: runMatchingTests,
    createTestUsers,
    testFindMatches,
    testRealtimeMatching,
    checkUserProfile,
    addTestInterests
};

console.log('🔧 Test functions available:');
console.log('- testMatching.run() - Run all tests');
console.log('- testMatching.testFindMatches() - Test finding matches');
console.log('- testMatching.checkUserProfile() - Check user profile');
console.log('- testMatching.addTestInterests() - Add test interests');
console.log('- testMatching.testRealtimeMatching() - Test real-time matching');
