import OpenAI from 'openai'
import { defineEventHandler, createError } from 'h3'

// Add at the top of the file, outside the handler
interface CachedResponse {
  response: string
  words: Set<string>
  categories: Set<string>
  timestamp: number
}
const lastResponses = new Map<string, CachedResponse>()
const MAX_CACHE_SIZE = 50  // Increased from 10
const WORD_COOLDOWN = 1000 * 60 * 5  // 5 minutes cooldown for repeated words

// Common themes/categories to track
const themeCategories = {
  clothing: ['sock', 'shoe', 'shirt', 'pants', 'clothes', 'wear', 'wearing'],
  gym: ['gym', 'sweat', 'workout', 'exercise', 'locker'],
  food: ['cheese', 'milk', 'fish', 'food', 'eat', 'eating'],
  animals: ['dog', 'cat', 'pet', 'animal'],
  bathroom: ['toilet', 'bathroom', 'poop', 'fart'],
  garbage: ['trash', 'garbage', 'dumpster', 'waste'],
}

// Helper function to detect themes
const detectThemes = (text: string): Set<string> => {
  const themes = new Set<string>()
  const words = text.toLowerCase().split(/\W+/)
  
  for (const [category, keywords] of Object.entries(themeCategories)) {
    if (keywords.some(keyword => words.some(word => word.includes(keyword)))) {
      themes.add(category)
    }
  }
  return themes
}

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
      dumb: "Use simple, immature, middle-school level insults. Keep it basic and childish like a 13-year-old would say.",
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
      1: "keeping it lighthearted and silly, like playground teasing or dad jokes. Should make people laugh without any hurt feelings. Think 'knock-knock joke' level of harmless fun.",
      0: "using moderate roasting that might make someone feel embarrassed but not hurt. Like friendly banter between coworkers or casual friends. Should be okay to say in most social situations.",
      "-1": "using dark humor that makes light of uncomfortable truths and taboo subjects. Like gallows humor that provokes both discomfort and nervous laughter. Should hit psychological weak spots and make people question whether they should laugh. Think comedy that punches at societal norms and personal insecurities, but stays within AI guidelines."
    }

    const prompts = {
      smell: "Generate a smell-related description that someone could smell like.",
      hope: "Generate something unfortunate that could happen to someone.",
      still: "Generate an embarrassing action or habit someone might do.",
      heard: "Generate an embarrassing or questionable personal action or decision that someone made. Focus on specific things they did, like 'tried to start a boy band at age 40' or 'bought a flip phone in 2024' or 'applied to be on Love Island but got rejected'. It should be about their specific choices or actions, not general life situations."
    }

    if (!prompts[template]) {
      throw createError({
        statusCode: 400,
        message: 'Invalid template'
      })
    }

    // Base configuration for all styles
    const baseConfig = {
      frequency_penalty: 2.0,
      presence_penalty: 1.0,
      max_tokens: 50
    }

    const styleConfigs = {
      // Generic Styles
      dumb: {
        temperature: 0.2,  // Keep it simple and direct
        ...baseConfig
      },
      dry: {
        temperature: 0.7,
        ...baseConfig
      },
      observational: {
        temperature: 0.9,
        ...baseConfig
      },
      sarcastic: {
        temperature: 1.0,
        ...baseConfig
      },
      shock: {
        temperature: 1.1,
        ...baseConfig
      },
      wordplay: {
        temperature: 1.0,
        ...baseConfig
      },
      absurd: {
        temperature: 1.2,  // Maximum creativity
        ...baseConfig
      }
    }

    // Default config
    const config = styleConfigs[style] || {
      temperature: 0.9,
      ...baseConfig
    }

    // Create a consistent system prompt function
    const getSystemPrompt = (style: string, intensity: number) => `You are a roast generator specializing in ${styleDescriptions[style] || 'playful'} humor that is ${intensityDescriptions[intensity] || 'balanced'}. 
    IMPORTANT FORMATTING RULES:
    1. Return ONLY the completion part, nothing else
    2. NO template phrases (like "you smell like", "i hope", etc.)
    3. NO explanations or additional sentences`

    // Initial completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: getSystemPrompt(style, intensity)
        },
        {
          role: "user",
          content: prompts[template]
        }
      ],
      ...config
    })

    let response = completion.choices[0]?.message?.content?.trim() || ''
    
    // Extract the completion part more reliably
    if (response.toUpperCase().includes('COMPLETION:')) {
      const parts = response.split(/COMPLETION:/i)
      response = parts[parts.length - 1]  // Take everything after the last COMPLETION:
        .replace(/^\s*\[|\]\s*$/g, '')    // Remove brackets
        .trim()
    }

    // Then apply our standard cleanup
    response = response
      .replace(/^completion:?\s*/i, '')   // Remove any remaining "completion:" text
      .replace(/^you(?:'?re|'?d)?\s+/i, '')
      .replace(/^(?:you\s+)?smell\s+like\s+/i, '')
      .replace(/^(?:i\s+)?hope\s+(?:you\s+)?/i, '')
      .replace(/^(?:don'?t\s+)?(?:you\s+)?still\s+/i, '')
      .replace(/^(?:i\s+)?heard\s+(?:you\s+)?/i, '')
      .replace(/\s*[.!?]+\s+.+$/, '')
      .replace(/\s*,\s*.*(?:it'?s|like|that|because|and)\s+.*$/i, '')
      .toLowerCase()

    // For dumb style, enforce single phrase
    if (style === 'dumb') {
      response = response.split(/[,.]|\s+(?:and|but|or)\s+/)[0].trim()
    }

    // Get significant words from response (excluding common words)
    const words = new Set(response.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3)  // Only keep words longer than 3 letters
    )

    // Check if any of the significant words were used recently
    const now = Date.now()
    const themes = detectThemes(response)
    const recentlyUsedTheme = Array.from(themes).some(theme => {
      for (const cached of lastResponses.values()) {
        if (cached.categories.has(theme) && (now - cached.timestamp) < WORD_COOLDOWN) {
          return true
        }
      }
      return false
    })

    if (lastResponses.has(response) || recentlyUsedTheme) {
      // Try up to 3 times to get a unique response
      for (let i = 0; i < 3; i++) {
        const newCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: getSystemPrompt(style, intensity)
            },
            {
              role: "user",
              content: prompts[template]
            }
          ],
          ...config,
          temperature: Math.min(config.temperature + 0.2 * (i + 1), 2.0)
        })
        
        const newResponse = newCompletion.choices[0]?.message?.content?.trim() || ''
        if (!lastResponses.has(newResponse) && !newResponse.includes('gym') && !newResponse.includes('shoe')) {
          response = newResponse
          break
        }
      }
    }

    // Update cache entry
    lastResponses.set(response, {
      response,
      words,
      categories: themes,
      timestamp: now
    })

    // Remove oldest entries if cache is too large
    if (lastResponses.size > MAX_CACHE_SIZE) {
      const oldest = Array.from(lastResponses.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0][0]
      lastResponses.delete(oldest)
    }

    if (!response) {
      throw createError({
        statusCode: 500,
        message: 'Failed to generate roast'
      })
    }

    // Apply template at the very end, just before returning
    const formattedResponse = (() => {
      switch (template) {
        case 'smell':
          return `you smell like ${response}`
        case 'hope':
          return `i hope ${response}`
        case 'still':
          return `don't you still ${response}`
        case 'heard':
          return `i heard you ${response}. How's that been going for you?`
        default:
          return response
      }
    })()

    return {
      completion: formattedResponse
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