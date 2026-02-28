/**
 * AI Chatbot for Song Generation with Gemini
 * - Voice input using Web Speech API (browser-based STT)
 * - Gemini conversation
 * - Song generation trigger detection
 */

import { ensureContext } from './audio.js';

class ChatbotController {
  constructor() {
    this.conversation = [];
    this.isListening = false;
    this.recognition = null;
    this.audioContext = null;
    this.currentAudio = null;
    
    this.voiceBtn = document.getElementById('voiceBtn');
    this.chatMessages = document.getElementById('chatMessages');
    this.chatStatus = document.getElementById('chatStatus');
    this.generatedSong = document.getElementById('generatedSong');
    this.songAudio = document.getElementById('songAudio');
    this.downloadBtn = document.getElementById('downloadBtn');
    this.addToTimelineBtn = document.getElementById('addToTimelineBtn');
    
    this.init();
  }

  init() {
    // Initialize Web Speech API
    this.setupSpeechRecognition();
    
    // Voice button: press and hold to record
    this.voiceBtn.addEventListener('mousedown', () => this.startListening());
    this.voiceBtn.addEventListener('mouseup', () => this.stopListening());
    this.voiceBtn.addEventListener('mouseleave', () => {
      if (this.isListening) this.stopListening();
    });
    
    // Touch support for mobile
    this.voiceBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startListening();
    });
    this.voiceBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.stopListening();
    });
    
    // Download button
    this.downloadBtn.addEventListener('click', () => this.downloadSong());
    
    // Add to timeline button
    this.addToTimelineBtn.addEventListener('click', () => this.addSongToTimeline());
    
    console.log('🎤 Chatbot initialized with Web Speech API');
  }

  setupSpeechRecognition() {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech Recognition not supported in this browser');
      this.updateStatus('⚠️ Voice input not supported in this browser');
      this.voiceBtn.disabled = true;
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    
    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('Transcript:', transcript);
      this.processTranscript(transcript);
    };
    
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.updateStatus('⚠️ Error: ' + event.error);
      this.isListening = false;
      this.voiceBtn.classList.remove('recording');
      this.voiceBtn.querySelector('.voice-text').textContent = 'Hold to Talk';
      
      setTimeout(() => this.updateStatus('Ready'), 3000);
    };
    
    this.recognition.onend = () => {
      this.isListening = false;
      this.voiceBtn.classList.remove('recording');
      this.voiceBtn.querySelector('.voice-text').textContent = 'Hold to Talk';
    };
  }

  startListening() {
    if (this.isListening || !this.recognition) return;
    
    try {
      this.recognition.start();
      this.isListening = true;
      this.voiceBtn.classList.add('recording');
      this.voiceBtn.querySelector('.voice-text').textContent = 'Listening...';
      this.updateStatus('🎤 Listening...');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.updateStatus('⚠️ Error starting voice input');
    }
  }

  stopListening() {
    if (!this.isListening || !this.recognition) return;
    
    try {
      this.recognition.stop();
      this.updateStatus('Processing...');
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  }

  async processTranscript(transcript) {
    try {
      // Add user message to UI
      this.addMessage(transcript, 'user');
      this.conversation.push({ role: 'user', content: transcript });
      
      // Check for trigger phrase
      if (this.detectReadyTrigger(transcript)) {
        await this.generateSong();
        return;
      }
      
      // Get Gemini response
      await this.getAIResponse();
      
    } catch (error) {
      console.error('Error processing transcript:', error);
      this.updateStatus('⚠️ Error: ' + error.message);
      setTimeout(() => this.updateStatus('Ready'), 3000);
    }
  }

  detectReadyTrigger(text) {
    const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, '');
    return normalizedText.includes('im ready') || 
           normalizedText.includes('i am ready') ||
           normalizedText.includes('lets do it') ||
           normalizedText.includes('make the song') ||
           normalizedText.includes('create the song');
  }

  async getAIResponse() {
    try {
      this.updateStatus('🤖 Thinking...', true);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversation: this.conversation
        })
      });
      
      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const aiMessage = data.message;
      this.conversation.push({ role: 'assistant', content: aiMessage });
      
      // Generate speech first
      await this.speakText(aiMessage);
      
      // Then show message after audio is ready
      this.addMessage(aiMessage, 'assistant');
      
      this.updateStatus('Ready');
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      this.updateStatus('⚠️ Error: ' + error.message);
      setTimeout(() => this.updateStatus('Ready'), 3000);
    }
  }

  async speakText(text) {
    try {
      this.updateStatus('🔊 Speaking...', true);
      
      // Stop any currently playing audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      
      // Call TTS endpoint
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });
      
      if (!response.ok) {
        console.error('TTS error:', response.status);
        return; // Fail silently for TTS, don't block the conversation
      }
      
      // Get audio blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create and play audio
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };
      
      await this.currentAudio.play();
      
    } catch (error) {
      console.error('Error speaking text:', error);
      // Fail silently for TTS errors
    }
  }

  async generateSong() {
    try {
      this.updateStatus('🎵 Creating your song...', true);
      this.addMessage('Perfect! Let me create a song based on our conversation... 🎵', 'assistant');
      
      const response = await fetch('/api/generate-song', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversation: this.conversation
        })
      });
      
      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Show generated song
      this.songAudio.src = data.audioUrl;
      this.generatedSong.style.display = 'block';
      this.generatedSong.scrollIntoView({ behavior: 'smooth' });
      
      this.addMessage('Your song is ready! 🎉 Check it out above!', 'assistant');
      this.updateStatus('✨ Song created!');
      
      // Store file path for download
      this.currentSongPath = data.filePath;
      
    } catch (error) {
      console.error('Error generating song:', error);
      this.updateStatus('⚠️ Error creating song: ' + error.message);
      this.addMessage('Sorry, I had trouble creating the song. Please try again!', 'assistant');
    }
  }

  downloadSong() {
    if (this.songAudio.src) {
      const a = document.createElement('a');
      a.href = this.songAudio.src;
      a.download = 'my-generated-song.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  async addSongToTimeline() {
    if (!this.songAudio.src) {
      this.updateStatus('⚠️ No song to add');
      return;
    }

    // Check if main app state is available
    if (!window.state) {
      this.updateStatus('⚠️ Timeline not ready');
      return;
    }

    try {
      this.updateStatus('📥 Adding to timeline...', true);
      
      // Ensure audio context is initialized
      await ensureContext(window.state);
      
      // Fetch the audio file
      const response = await fetch(this.songAudio.src);
      const arrayBuffer = await response.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await window.state.audio.context.decodeAudioData(arrayBuffer);
      
      // Create a new clip
      const clipNumber = window.state.nextClipIndex || 1;
      const clip = {
        id: `ai-song-${Date.now()}`,
        trackId: 'AI Song',
        startTimeSec: 0,
        endTimeSec: audioBuffer.duration,
        duration: audioBuffer.duration,
        label: `AI Song ${clipNumber}`,
        status: 'ready',
        blob: await response.blob(),
        buffer: audioBuffer,
        lockTrack: false,
        maxDurationSec: null,
      };
      
      // Add to clips array
      window.state.clips.push(clip);
      window.state.nextClipIndex = (window.state.nextClipIndex || 1) + 1;
      window.state.selectedClipId = clip.id;
      
      // Trigger render if available
      if (window.render) {
        window.render();
      }
      
      this.updateStatus('✅ Added to timeline!');
      this.addMessage('Song added to timeline! You can now edit and mix it with your other tracks.', 'assistant');
      
      setTimeout(() => this.updateStatus('Ready'), 3000);
      
    } catch (error) {
      console.error('Error adding song to timeline:', error);
      this.updateStatus('⚠️ Error: ' + error.message);
      setTimeout(() => this.updateStatus('Ready'), 3000);
    }
  }

  addMessage(text, role) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role}`;
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;
    
    bubble.appendChild(content);
    this.chatMessages.appendChild(bubble);
    
    // Scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  updateStatus(text, processing = false) {
    this.chatStatus.textContent = text;
    if (processing) {
      this.chatStatus.classList.add('processing');
    } else {
      this.chatStatus.classList.remove('processing');
    }
  }
}

// Initialize chatbot when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new ChatbotController();
  });
} else {
  window.chatbot = new ChatbotController();
}
