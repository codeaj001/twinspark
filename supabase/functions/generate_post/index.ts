import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the session or user object
    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { match_id, user_summary } = await req.json()

    if (!match_id || !user_summary) {
      return new Response(
        JSON.stringify({ error: 'match_id and user_summary are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user has access to this match
    const { data: match, error: matchError } = await supabaseClient
      .from('matches')
      .select('*')
      .eq('id', match_id)
      .single()

    if (matchError || !match) {
      return new Response(
        JSON.stringify({ error: 'Match not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (match.user_id_1 !== user.id && match.user_id_2 !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized to access this match' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate AI post using Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a social media content creator. Your task is to create engaging, authentic social media posts based on conversation summaries between two people who met through a location-based matching app called TwinSpark. The posts should be:
            - Genuine and human-like
            - Positive and engaging
            - Include relevant hashtags
            - Capture the essence of the connection
            - Be suitable for platforms like Instagram, Twitter, or LinkedIn
            - Keep it concise (under 280 characters for Twitter-style posts)
            - Use emojis appropriately
            
            Create a social media post based on this conversation summary: "${user_summary}". Make it sound natural and engaging, as if written by someone excited about meeting a new person through TwinSpark.`
          }]
        }],
        generationConfig: {
          temperature: 0.8,
          topK: 1,
          topP: 1,
          maxOutputTokens: 300,
          stopSequences: []
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      }),
    })

    if (!response.ok) {
      console.error('Gemini API error:', await response.text())
      return new Response(
        JSON.stringify({ error: 'Failed to generate post' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiResponse = await response.json()
    const aiGeneratedPost = geminiResponse.candidates[0].content.parts[0].text.trim()

    // Save the generated post to the database
    const { data: savedPost, error: saveError } = await supabaseClient
      .from('posts')
      .insert({
        match_id,
        user_summary,
        ai_generated_post: aiGeneratedPost,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving post:', saveError)
      return new Response(
        JSON.stringify({ error: 'Failed to save post' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        post: savedPost,
        ai_generated_post: aiGeneratedPost 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in generate_post function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
