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
      dry: "Use subtle, understated humor with deadpan delivery",
      shock: "Create unexpected, surprising humor that subverts expectations",
      campy: "Use deliberately exaggerated, over-the-top humor",
      sarcastic: "Employ ironic, witty humor with a hint of mockery",
      absurd: "Generate nonsensical, random humor that defies logic",
      wordplay: "Focus on puns, clever language, and double meanings",
      observational: "Base humor on relatable, everyday situations",
      surreal: "Create dreamlike, bizarre scenarios that are strangely funny",
      deadpan: "Deliver humor in a completely serious, matter-of-fact way"
    }

    const intensityDescriptions = {
      3: "keeping it wholesome and family-friendly",
      2: "using light-hearted teasing",
      1: "delivering sassy comebacks",
      0: "giving honest reality checks",
      "-1": "delivering harsh life observations, like a drill sergeant's feedback",
      "-2": "using ruthless psychological insights that cut deep",
      "-3": "employing dark gallows humor like first responders use to cope with tough situations, while keeping it professional"
    }

    const prompts = {
      smell: "Generate a funny, creative roast completion. The roast will start with 'You smell like' but DO NOT include that part in your response. Keep it playful and not too offensive. Example response: 'a forgotten gym sock in a sauna'",
      hope: "Generate a funny, creative roast completion. The roast will start with 'I hope you' but DO NOT include that part in your response. Keep it playful and not too offensive. Example response: 'step on a Lego while running late'",
      still: "Generate a funny, creative roast completion. The roast will start with 'Don't you still' but DO NOT include that part in your response. Keep it playful and not too offensive. Example response: 'practice karate moves in front of your mirror'",
      heard: "Generate a funny, creative roast completion. The roast will start with 'I heard you' and end with 'How's that been going for you?' but DO NOT include those parts in your response. Keep it playful and not too offensive. Example response: 'started a professional sock puppet theater'"
    }

    if (!prompts[template]) {
      throw createError({
        statusCode: 400,
        message: 'Invalid template'
      })
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
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
    
    // Clean up any template text that might have been included
    response = response
      .replace(/^you smell like /i, '')
      .replace(/^i hope you /i, '')
      .replace(/^don't you still /i, '')
      .replace(/^i heard you /i, '')
      .replace(/[\s.]?how'?s? that (?:been )?going for you\??$/i, '')
      .replace(/^["']|["']$/g, '') // Remove any quotes

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