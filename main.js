// polyrhythm metronome

// dependencies
import { Midi }  from '@tonejs/midi';

// DOM elements
const bpmInput = document.getElementById('bpm-input');
const bpmDisplay = document.getElementById('bpm-display');
const mainSubdivisionInput = document.getElementById('main-subdivision');
const secondarySubdivisionInput = document.getElementById('secondary-subdivision');
const secondaryBpmDisplay = document.getElementById('secondary-bpm-display');
const volumeSlider = document.getElementById('volume-slider');
const startStopBtn = document.getElementById('start-stop-btn');
const mainDotsContainer = document.getElementById('main-dots');
const secondaryDotsContainer = document.getElementById('secondary-dots');
const swapBtn = document.getElementById('swap-btn');
const selectedPulseInput = document.getElementById('pulse');
const selectedPolyrhythmInput = document.getElementById('polyrhythm');
const exportMidiBtn = document.getElementById('export-midi');
const cyclesInput = document.getElementById('cycles');

// Audio context
let audioContext;
let isPlaying = false;
let mainBPM = 120;
let mainSubdivision = parseInt(mainSubdivisionInput.value, 10) || 1;
let secondarySubdivision = parseInt(secondarySubdivisionInput.value, 10) || 1;
let mainPulseCount = parseInt(selectedPulseInput.value, 10) || 4;
let secondaryPulseCount = parseInt(selectedPolyrhythmInput.value, 10) || 3;
let volume = 0.5;

// Scheduler variables
let nextMainSubdivisionTime = 0;
let nextSecondarySubdivisionTime = 0;
let mainSubdivisionStep = 0;
let secondarySubdivisionStep = 0;

const frequencies = {
    first: 800,
    main: 500,
    secondary: 600
};

// Initialize audio context
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

// Check if user selected to swap tones
function isSwapped() {
    return swapBtn.checked
}

// Modular sound generation - easy to customize later
function createClickSound(frequency = 800, duration = 0.1) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Scheduler for beats and subdivisions
function scheduler() {
    if (!isPlaying) return;
    
    const currentTime = audioContext.currentTime;
    const mainCount = mainPulseCount;
    const totalMainSubdivisions = mainPulseCount * mainSubdivision;
    const mainInterval = 60 / mainBPM / mainSubdivision;
    
    // Schedule main subdivisions
    while (nextMainSubdivisionTime < currentTime + 0.1) {
        const mainPulseIndex = Math.floor(mainSubdivisionStep / mainSubdivision) % mainCount;
        const subIndex = mainSubdivisionStep % mainSubdivision;
        const freq = subIndex === 0 && mainPulseIndex === 0 ? frequencies.first : frequencies.main;
        createClickSound(freq, subIndex === 0 ? 0.1 : 0.06);
        flashDot(mainDotsContainer, mainSubdivisionStep % totalMainSubdivisions);
        nextMainSubdivisionTime += mainInterval;
        mainSubdivisionStep++;
    }
    
    // Schedule secondary subdivisions if polyrhythm selected
    if (secondaryPulseCount > 0) {
        const secondaryBPM = mainBPM * secondaryPulseCount / mainCount;
        const totalSecondarySubdivisions = secondaryPulseCount * secondarySubdivision;
        const secondaryInterval = 60 / secondaryBPM / secondarySubdivision;
        while (nextSecondarySubdivisionTime < currentTime + 0.1) {
            createClickSound(frequencies.secondary, secondarySubdivisionStep % secondarySubdivision === 0 ? 0.08 : 0.05);
            flashDot(secondaryDotsContainer, secondarySubdivisionStep % totalSecondarySubdivisions);
            nextSecondarySubdivisionTime += secondaryInterval;
            secondarySubdivisionStep++;
        }
    }
    
    setTimeout(scheduler, 25); // Check every 25ms
}

// Flash visual indicator
function flashDot(container, index) {
    const dots = container.children;
    if (dots[index]) {
        dots[index].classList.add('active');
        setTimeout(() => {
            dots[index].classList.remove('active');
        }, 100);
    }
}

// Update displays
function updateDisplays() {
    bpmDisplay.textContent = mainBPM;
    if (secondaryPulseCount > 0) {
        const secondaryBPM = Math.round(mainBPM * secondaryPulseCount / mainPulseCount);
        secondaryBpmDisplay.textContent = `${secondaryBPM} BPM`;
    } else {
        secondaryBpmDisplay.textContent = '';
    }
    updateSwapControl();
    generateDots();
}

// Generate dots for visualization
function generateDots() {
    mainDotsContainer.innerHTML = '';
    secondaryDotsContainer.innerHTML = '';
    
    for (let i = 0; i < mainPulseCount; i++) {
        const largeDot = document.createElement('div');
        largeDot.className = 'dot large';
        mainDotsContainer.appendChild(largeDot);

        for (let j = 1; j < mainSubdivision; j++) {
            const smallDot = document.createElement('div');
            smallDot.className = 'dot small';
            mainDotsContainer.appendChild(smallDot);
        }
    }
    
    for (let i = 0; i < secondaryPulseCount; i++) {
        const largeDot = document.createElement('div');
        largeDot.className = 'dot large secondary';
        secondaryDotsContainer.appendChild(largeDot);

        for (let j = 1; j < secondarySubdivision; j++) {
            const smallDot = document.createElement('div');
            smallDot.className = 'dot small secondary';
            secondaryDotsContainer.appendChild(smallDot);
        }
    }
}

// Show/hide swap control based on whether a polyrhythm is selected
function updateSwapControl() {
    if (secondaryPulseCount > 0) {
        swapBtn.parentElement.classList.remove('hidden');
    } else {
        swapBtn.parentElement.classList.add('hidden');
    }
}

// Swap frequencies for main and secondary tones
function swapFrequencies() {
    const temp = frequencies.first;
    frequencies.first = frequencies.main;
    frequencies.main = temp;
}

// Start/stop playback depending on current state. Initializes audio context on first start and resets scheduler variables to ensure timing is correct when restarting.
function startStopPlayback() {
    if (!isPlaying) {
        // Start
        if (!audioContext) initAudio();
        isPlaying = true;
        nextMainSubdivisionTime = audioContext.currentTime;
        nextSecondarySubdivisionTime = audioContext.currentTime;
        mainSubdivisionStep = 0;
        secondarySubdivisionStep = 0;
        startStopBtn.textContent = 'Stop';
        scheduler();
    } else {
        // Stop
        isPlaying = false;
        startStopBtn.textContent = 'Start';
    }
}

// Restart playback when user changes settings to ensure beats are in sync with new parameters
function restartPlayback() {
    if (isPlaying) {
    startStopPlayback();
    startStopPlayback();
}
}

function updatePulseCounts() {
    mainPulseCount = parseInt(selectedPulseInput.value, 10) || 4;
    secondaryPulseCount = parseInt(selectedPolyrhythmInput.value, 10) || 0;
    updateDisplays();
    restartPlayback();
}

// Convert frequency (Hz) to MIDI note number
function frequencyToMidi(frequency) {
    return Math.round(12 * Math.log2(frequency / 440) + 69);
}

// Generate Midi file based on current settings and user-selected number of cycles
function generateMidiData(totalSeconds) {
    const midiData = [];
    const mainInterval = 60 / mainBPM / mainSubdivision;
    const mainCount = mainPulseCount;
    const totalMainSubdivisions = mainPulseCount * mainSubdivision;
    
    for (let time = 0; time < totalSeconds; time += mainInterval) {
        const mainSubdivisionStep = Math.floor(time / mainInterval);
        const mainPulseIndex = Math.floor(mainSubdivisionStep / mainSubdivision) % mainCount;
        const subIndex = mainSubdivisionStep % mainSubdivision;
        const freq = subIndex === 0 && mainPulseIndex === 0 ? frequencies.first : frequencies.main;
        const duration = subIndex === 0 ? 0.1 : 0.06;
        
        midiData.push({ 
            time, 
            midi: frequencyToMidi(freq),
            duration: duration / 1000 // Convert ms to seconds for MIDI
        });
    }
    
    if (secondaryPulseCount > 0) {
        const secondaryBPM = mainBPM * secondaryPulseCount / mainCount;
        const secondaryInterval = 60 / secondaryBPM / secondarySubdivision;
        
        for (let time = 0; time < totalSeconds; time += secondaryInterval) {
            const duration = (secondarySubdivisionStep % secondarySubdivision === 0) ? 0.08 : 0.05;
            midiData.push({ 
                time, 
                midi: frequencyToMidi(frequencies.secondary),
                duration: duration / 1000
            });
        }
    }
    
    return midiData;
}



// Event listeners
startStopBtn.addEventListener('click', startStopPlayback);

swapBtn.addEventListener('change', swapFrequencies);

bpmInput.addEventListener('input', (e) => {
    mainBPM = parseInt(e.target.value) || 120;
    updateDisplays();
    restartPlayback();
});

selectedPulseInput.addEventListener('change', updatePulseCounts);
selectedPolyrhythmInput.addEventListener('change', updatePulseCounts);

mainSubdivisionInput.addEventListener('input', (e) => {
    mainSubdivision = Math.max(1, parseInt(e.target.value, 10) || 1);
    updateDisplays();
    restartPlayback();
});

secondarySubdivisionInput.addEventListener('input', (e) => {
    secondarySubdivision = Math.max(1, parseInt(e.target.value, 10) || 1);
    updateDisplays();
    restartPlayback();
});

volumeSlider.addEventListener('input', (e) => {
    volume = parseFloat(e.target.value);
});

exportMidiBtn.addEventListener('click', () => {
    const totalSeconds = (parseInt(cyclesInput.value) || 4) * 60 / mainBPM;
    const midiData = generateMidiData(totalSeconds);
    const midi = new Midi();
    const track = midi.addTrack();
    
    midiData.forEach(note => {
        track.addNote({
            midi: note.midi,
            time: note.time,
            duration: note.duration
        });
    });
    
    // Convert MIDI to binary array and create download
    const midiArray = midi.toArray();
    const blob = new Blob([new Uint8Array(midiArray)], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    
    // Create and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'metronome.mid';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});


// Initialize
updateDisplays();

