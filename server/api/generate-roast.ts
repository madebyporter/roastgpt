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
      3: "extremely gentle and lighthearted, suitable for all audiences",
      2: "very mild and friendly, avoiding any edge",
      1: "playful and light, with minimal bite",
      0: "balanced humor, neither too gentle nor too sharp",
      "-1": "slightly edgy humor with a bit of bite",
      "-2": "sharper humor with more edge, but not cruel",
      "-3": "maximum edge while staying within bounds of good taste"
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
      .replace(/\. how'?s? that been going for you\??$/i, '')
      .replace(/^["']|["']$/g, '') // Remove any quotes

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