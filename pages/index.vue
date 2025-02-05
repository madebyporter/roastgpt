<template>
  <div class="max-w-md mx-auto space-y-8">
    <div class="text-center">
      <h1 class="text-4xl font-bold mb-2">Roast Generator</h1>
      <p class="text-purple-200">Shake your device or tap generate for a new roast!</p>
    </div>

    <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 space-y-4">
      <div class="space-y-4">
        <div class="space-y-2">
          <label class="block text-sm font-medium text-purple-200">Setup</label>
        <select 
          v-model="selectedTemplate" 
          class="w-full bg-white text-black rounded-lg px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="smell">You smell like _____</option>
          <option value="hope">I hope you _____</option>
          <option value="still">Don't you still _____</option>
          <option value="heard">I heard you _____. How's that been going for you?</option>
        </select>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-purple-200">Humor Style</label>
          <select 
            v-model="humorStyle" 
            class="w-full bg-white text-black rounded-lg px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <optgroup label="Generic Styles">
              <option value="dumb">Dumb (Basic insults)</option>
              <option value="dry">Dry (Deadpan delivery)</option>
              <option value="observational">Observational (Everyday situations)</option>
              <option value="sarcastic">Sarcastic (Ironic and witty)</option>
              <option value="shock">Shock (Unexpected and surprising)</option>
              <option value="wordplay">Wordplay (Clever language)</option>
              <option value="absurd">Absurd (Random and illogical)</option>
            </optgroup>
            <optgroup label="Comedian Styles">
              <option value="pryor">Richard Pryor Style (Raw, honest observations)</option>
              <option value="carlin">George Carlin Style (Sharp social criticism)</option>
              <option value="mac">Bernie Mac Style (Bold storytelling)</option>
              <option value="williams">Robin Williams Style (High-energy, manic)</option>
              <option value="chappelle">Dave Chappelle Style (Clever social commentary)</option>
              <option value="rock">Chris Rock Style (Exaggerated observations)</option>
              <option value="seinfeld">Jerry Seinfeld Style (Everyday observations)</option>
              <option value="burr">Bill Burr Style (Aggressive, unapologetic)</option>
              <option value="hedberg">Mitch Hedberg Style (Surreal one-liners)</option>
            </optgroup>
          </select>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-purple-200">Humor Intensity</label>
          <select 
            v-model="humorIntensity" 
            class="w-full bg-white text-black rounded-lg px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="1">Light (Playful teasing)</option>
            <option value="0">Neutral (Reality checks)</option>
            <option value="-1">Dark (Sharp truths)</option>
          </select>
        </div>
      </div>

      <button 
        @click="generateJoke"
        :disabled="isLoading"
        class="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-purple-400 disabled:cursor-not-allowed transition-colors rounded-lg py-3 px-4 font-semibold flex items-center justify-center gap-2"
      >
        <Zap class="w-5 h-5" :class="{ 'animate-pulse': isLoading }" />
        {{ isLoading ? 'Generating...' : 'Generate Roast' }}
      </button>



      <div class="min-h-24 bg-transparent border border-white/20 text-white rounded-lg p-4 text-lg">
        <div v-if="isLoading" class="flex items-center justify-center h-full">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
        <div v-else-if="error" class="text-red-500">
          {{ error }}
        </div>
        <div v-else>
          {{ currentJoke || 'Your roast will appear here...' }}
        </div>
      </div>
    </div>

    <div class="text-center text-sm text-purple-200">
      <p>Pro tip: Shake your device for a new roast!</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Zap } from 'lucide-vue-next'

const selectedTemplate = ref('smell')
const humorStyle = ref('dumb')
const humorIntensity = ref('0')
const currentJoke = ref('')
const isLoading = ref(false)
const error = ref(null)

const templates = ['smell', 'hope', 'still', 'heard']
const styles = ['dumb', 'dry', 'observational', 'sarcastic', 'shock', 'wordplay', 'absurd']
const intensities = ['1', '0', '-1']

const generateJoke = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  error.value = null
  
  try {
    const response = await fetch('/api/generate-roast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: selectedTemplate.value,
        style: humorStyle.value,
        intensity: parseInt(humorIntensity.value)
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to generate roast')
    }

    const data = await response.json()
    currentJoke.value = data.completion
  } catch (err) {
    console.error('Error:', err)
    error.value = err.message || 'Failed to generate a roast. Try again!'
    currentJoke.value = ''
  } finally {
    isLoading.value = false
  }
}

const randomizeAndGenerate = () => {
  // Randomize all selections
  selectedTemplate.value = templates[Math.floor(Math.random() * templates.length)]
  humorStyle.value = styles[Math.floor(Math.random() * styles.length)]
  humorIntensity.value = intensities[Math.floor(Math.random() * intensities.length)]
  
  // Generate the roast
  generateJoke()
}

// Shake detection
let shakeEvent

onMounted(() => {
  if (typeof window !== 'undefined') {
    import('shake.js').then(({ default: Shake }) => {
      shakeEvent = new Shake({
        threshold: 15,
        timeout: 1000
      })
      
      shakeEvent.start()
      window.addEventListener('shake', randomizeAndGenerate)
    })
  }
})

onUnmounted(() => {
  if (shakeEvent) {
    window.removeEventListener('shake', randomizeAndGenerate)
    shakeEvent.stop()
  }
})
</script>