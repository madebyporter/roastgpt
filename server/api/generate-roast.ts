import OpenAI from 'openai'
import { defineEventHandler, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  if (!config.openaiApiKey) {
    throw createError({
      statusCode: 500,
      message: 'OpenAI API key is not configured'
    })
  }

  const openai = new OpenAI({
    apiKey: config.openaiApiKey
  })

  try {
    const body = await readBody(event)
    const { template, style = 'dry', intensity = 0 } = body

    if (!template) {
      throw createError({
        statusCode: 400,
        message: 'Template is required'
      })
    }

    const styleDescriptions = {
      // Generic Styles
      lockerroom: "Use raw, unfiltered locker room trash talk that stings. Mix personal jabs about dating failures, embarrassing moments, and brutal truths. Think ruthless high school/college athlete burns. Examples: 'still using Pokemon pickup lines on Tinder', 'gets rejected by even the spam bots', 'peaked in kindergarten when you learned to tie your shoes'. Keep it personal and make it hurt, but stay away from serious topics.",
      dry: "Use deadpan delivery with matter-of-fact statements",
      observational: "Base humor on relatable, everyday situations",
      sarcastic: "Employ ironic, witty humor with a hint of mockery",
      shock: "Create unexpected, surprising humor that subverts expectations",
      wordplay: "Focus on puns, clever language, and double meanings",
      absurd: "Generate nonsensical, random humor that defies logic",
      
      // Comedian-Specific Styles
      pryor: "Channel Richard Pryor's raw, honest, street-smart observations with perfect timing and character work",
      carlin: "Channel George Carlin's sharp social criticism with intelligent wordplay and counterculture perspective",
      mac: "Channel Bernie Mac's bold, unapologetic storytelling with a mix of tough love and exaggerated reactions",
      williams: "Channel Robin Williams' manic, high-energy stream of consciousness with rapid character switches",
      chappelle: "Channel Dave Chappelle's clever social commentary with street-smart storytelling and race, gender, and cultural observations",
      rock: "Channel Chris Rock's exaggerated delivery with hard-hitting social observations on race, political and relationship insights",
      seinfeld: "Channel Jerry Seinfeld's meticulous observations about everyday life and human behavior",
      burr: "Channel Bill Burr's aggressive, unapologetic rants with working-class perspective",
      hedberg: "Channel Mitch Hedberg's surreal one-liners with unique observations and clever misdirection"
    }

    const intensityDescriptions = {
      1: "keeping it lighthearted and playful with gentle teasing",
      0: "using balanced humor with honest observations and mild burns",
      "-1": "delivering sharp reality checks with psychological insights that might sting"
    }

    const prompts = {
      smell: "IMPORTANT: Generate ONLY a smell-related description. Must be about an actual scent or odor. DO NOT include 'You smell like' in your response. BAD examples: 'You smell like a walking Wikipedia' or 'a lost dream'. GOOD examples: 'expired milk in a hot car' or 'gym socks marinated in cheap cologne'. Keep it about actual smells.",
      hope: "IMPORTANT: Generate ONLY a specific, real-life unfortunate event. Focus on embarrassing or inconvenient situations. DO NOT include 'I hope you' in your response. BAD examples: 'find happiness' or 'learn your lesson'. GOOD examples: 'trip in front of your crush', 'get caught singing in your car at a red light', 'accidentally like your ex's Instagram post from 3 years ago'. Keep it realistic and relatable.",
      still: "IMPORTANT: DO NOT include 'Don't you still' in your response. Generate ONLY the action that would come after those words. BAD example: 'Don't you still eat crayons'. GOOD example: 'eat crayons'",
      heard: "IMPORTANT: Generate a single, simple action or situation. DO NOT use multiple statements or complex scenarios. DO NOT include any introductory phrases. BAD examples: 'trying to find a personality while still using a flip phone' or 'collecting dust and failing at life'. GOOD examples: 'tried to high-five your reflection' or 'bought a brain from the dollar store'. Keep it short and focused on ONE thing."
    }

    if (!prompts[template]) {
      throw createError({
        statusCode: 400,
        message: 'Invalid template'
      })
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a roast generator specializing in ${styleDescriptions[style] || 'playful'} humor that is ${intensityDescriptions[intensity] || 'balanced'}. Generate creative roasts that match this style and intensity. Keep responses short and punchy. NEVER include the template text in your response, only provide the completion.`
        },
        {
          role: "user",
          content: prompts[template]
        }
      ],
      temperature: 0.9,
      max_tokens: 50
    })

    let response = completion.choices[0]?.message?.content?.trim() || ''
    
    // Remove quotes and any "you're" prefix
    response = response
      .replace(/^["']|["']$/g, '')
      .replace(/^you'?re\s+/i, '') // Remove "you're" or "youre" from the start

    // Apply the template on the server side
    switch (template) {
      case 'smell':
        response = `You smell like ${response}`
        break
      case 'hope':
        response = `I hope you ${response}`
        break
      case 'still':
        response = `Don't you still ${response}`
        break
      case 'heard':
        response = `I heard you ${response}. How's that been going for you?`
        break
    }

    if (!response) {
      throw createError({
        statusCode: 500,
        message: 'Failed to generate roast'
      })
    }

    return {
      completion: response
    }
  } catch (error) {
    console.error('Error generating roast:', error)
    
    if (error.response?.status === 401) {
      throw createError({
        statusCode: 500,
        message: 'Invalid OpenAI API key'
      })
    }

    throw createError({
      statusCode: 500,
      message: 'Failed to generate roast'
    })
  }
})