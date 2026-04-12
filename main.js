// polyrhythm metronome

// dependencies
import { Midi }  from '@tonejs/midi';

// DOM elements
const bpmInput = document.getElementById('bpm-input');
const bpmDisplay = document.getElementById('bpm-display');
const mainSubdivisionInput = document.getElementById('main-subdivision');
const secondarySubdivisionInput = document.getElementById('secondary-subdivision');
const secondaryBpmDisplay = document.getElementById('secondary-bpm-display');
const mainVolumeSlider = document.getElementById('main-volume-slider');
const secondaryVolumeSlider = document.getElementById('secondary-volume-slider');
const startStopBtn = document.getElementById('start-stop-btn');
const mainDotsContainer = document.getElementById('main-dots');
const secondaryDotsContainer = document.getElementById('secondary-dots');
const swapBtn = document.getElementById('swap-btn');
const selectedPulseInput = document.getElementById('pulse');
const selectedPolyrhythmInput = document.getElementById('polyrhythm');
const exportMidiBtn = document.getElementById('export-midi');
const midiCyclesInput = document.getElementById('cycles');
const numInputContainer = document.querySelectorAll('.number-input-container');

// acceleration mode settings
const accelCyclesInput = document.getElementById('accel-cycles');
const accelToggle = document.getElementById('acceleration-btn');
const startBpmDisplay = document.getElementById('start-bpm-display');
const endBpmDisplay = document.getElementById('end-bpm-display');
const bpmIntervalInput = document.getElementById('bpm-interval');

const accelEnabled = () => {
    return accelToggle.checked;
};

// Audio context
let audioContext;
let isPlaying = false;
let mainBPM = 120;
let mainSubdivision = parseInt(mainSubdivisionInput.value, 10) || 1;
let secondarySubdivision = parseInt(secondarySubdivisionInput.value, 10) || 1;
let mainPulseCount = parseInt(selectedPulseInput.value, 10) || 4;
let secondaryPulseCount = parseInt(selectedPolyrhythmInput.value, 10) || 3;
let mainVolume = 0.5;
let secondaryVolume = 0.5;
let endBPM = parseInt(endBpmDisplay.value, 10) || 180;

// Scheduler variables
let nextMainSubdivisionTime = 0;
let nextSecondarySubdivisionTime = 0;
let mainSubdivisionStep = 0;
let secondarySubdivisionStep = 0;

// BPM Acceleration Variables
let cycleCount = 0;
let bpmInterval = parseInt(bpmIntervalInput.value, 10) || 5
let startBpm = parseInt(startBpmDisplay.value, 10) || mainBPM

const frequencies = {
    first: 800,
    main: 500,
    mainSubdivision: 400,
    secondary: 600,
    secondarySubdivision: 300
};

// Map: sets input value to its corresponding variable
const setters = {
    'bpm-input' : (val) => mainBPM = val,
    'pulse' : (val) => mainPulseCount = val,
    'polyrhythm' : (val) => secondaryPulseCount = val,
    'main-subdivision' : (val) => mainSubdivision = val,
    'secondary-subdivision' : (val) => secondarySubdivision = val,
    'accel-cycles' : (val) => cycleCount = val,
    'bpm-interval' : (val) => bpmInterval = val,
    'start-bpm-display' : (val) => {
        startBpm = val
        limitBpms()
        restartPlayback()
    },
    'end-bpm-display' : (val) => {
        endBPM = val
        limitBpms()
        restartPlayback()
    }
};

// From plus/minus buttons
// Points an input value to setters which resets the correspoding variables
function updateValues(el) {
    const func = setters[el.id];
    if (!func) return;
    func(parseInt(el.value));
};

// Initialize audio context
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

// Check if user selected to swap tones
function isSwapped() {
    return swapBtn.checked;
};

function accelerateBPM() {
    if (mainBPM >= endBPM) return; // Stop accelerating if we've reached the target BPM
    cycleCount = 0;
    mainBPM += bpmInterval;
    if (mainBPM >= endBPM) {
        mainBPM = endBPM
    }
    // Stop display from cutting off last dot in the display
    setTimeout(() => {
        updateDisplays();
    }, 50);
}

// Hard limit at 300BPM for mainBPm and endBPM
function limitBpms() {
    if (mainBPM > 300) {
        mainBPM = 300;
        bpmInput.value = 300;
        startBpmDisplay.value = 300;
        bpmDisplay.textContent = 300;
        endBpmDisplay.value = 300;
        restartPlayback()
    }
    if (endBPM > 300) {
        endBPM = 300;
        endBpmDisplay.value = 300;
        endBpmDisplay.setAttribute('min', mainBPM);
        restartPlayback()
    };
};

// helper function to get correct frequency based on whether its a main pulse, main subdivision, secondary pulse, or secondary subdivision
function getFrequency(isMainPulse, isSubdivision, isSecondary = false, isFirstBeat = false) {
    if (isMainPulse && isFirstBeat) {
        return frequencies.first;
    } else if (isMainPulse && !isSubdivision) {
        return isSwapped() ? frequencies.secondary : frequencies.main;
    } else if (isMainPulse && isSubdivision) {
        return isSwapped() ? frequencies.secondarySubdivision : frequencies.mainSubdivision;
    } else if (isSecondary && !isSubdivision) {
        return isSwapped() ? frequencies.main : frequencies.secondary;
    } else if (isSecondary && isSubdivision) {
        return isSwapped() ? frequencies.mainSubdivision : frequencies.secondarySubdivision;
    }
}

// Modular sound generation - easy to customize later
function createClickSound(frequency = 800, duration = 0.1, volume = mainVolume) {
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
    // limitBpms()
    
    const currentTime = audioContext.currentTime;
    const mainCount = mainPulseCount;
    const totalMainSubdivisions = mainPulseCount * mainSubdivision;
    const mainInterval = 60 / mainBPM / mainSubdivision;
    
    // Schedule main subdivisions
    while (nextMainSubdivisionTime < currentTime + 0.1) {
        const mainPulseIndex = Math.floor(mainSubdivisionStep / mainSubdivision) % mainCount;
        const subIndex = mainSubdivisionStep % mainSubdivision;
        // const freq = subIndex === 0 && mainPulseIndex === 0 ? frequencies.first : frequencies.main;
        const isBeat = subIndex === 0;
        const isFirstBeat = isBeat && mainPulseIndex === 0;
        const freq = getFrequency(true, !isBeat, false, isFirstBeat);
        createClickSound(freq, subIndex === 0 ? 0.1 : 0.06);
        flashDot(mainDotsContainer, mainSubdivisionStep % totalMainSubdivisions);
        nextMainSubdivisionTime += mainInterval;
        mainSubdivisionStep++;
        if (isBeat) cycleCount++;
    }

    if (accelEnabled() && cycleCount >= mainPulseCount * parseInt(accelCyclesInput.value)) {
        accelerateBPM();
    }
    
    
    // Schedule secondary subdivisions if polyrhythm selected
    if (secondaryPulseCount > 0) {
        const secondaryBPM = mainBPM * secondaryPulseCount / mainCount;
        const totalSecondarySubdivisions = secondaryPulseCount * secondarySubdivision;
        const secondaryInterval = 60 / secondaryBPM / secondarySubdivision;
        const isBeatSecondary = secondarySubdivisionStep % secondarySubdivision === 0;
        const freq = getFrequency(false, !isBeatSecondary, true, false);
        while (nextSecondarySubdivisionTime < currentTime + 0.1) {
            createClickSound(freq, isBeatSecondary ? 0.08 : 0.05, secondaryVolume);
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
    bpmDisplay.textContent = `${mainBPM} BPM`;
    // startBPMDisplay.value = mainBPM;
    endBpmDisplay.setAttribute('min', mainBPM);

    // Ensure end BPM can not be lower than main BPM
    if (mainBPM > endBpmDisplay.value) {
        endBpmDisplay.value = mainBPM
    }

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
};

// Show/hide swap control based on whether a polyrhythm is selected
function updateSwapControl() {
    if (secondaryPulseCount > 0) {
        swapBtn.parentElement.classList.remove('hidden');
    } else {
        swapBtn.parentElement.classList.add('hidden');
    }
};

// Swap frequencies for main and secondary tones
function swapFrequencies() {
    const temp = frequencies.first;
    frequencies.first = frequencies.main;
    frequencies.main = temp;
};

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
        cycleCount = 0;
        startStopBtn.textContent = 'Stop';
        scheduler();
    } else {
        
        if (accelEnabled()) {
            
            console.log("start BPM " + startBpm)
            bpmInput.value = startBpm;
            mainBPM = startBpm;
            updateDisplays()
        };
        // Stop

        isPlaying = false;
        startStopBtn.textContent = 'Start';
    }
};

// Restart playback when user changes settings to ensure beats are in sync with new parameters
function restartPlayback() {
    if (isPlaying) {
        startStopPlayback();
        startStopPlayback();
    };
};

function updatePulseCounts() {
    mainPulseCount = parseInt(selectedPulseInput.value, 10) || 4;
    secondaryPulseCount = parseInt(selectedPolyrhythmInput.value, 10) || 0;
    updateDisplays();
    restartPlayback();
};

// Convert frequency (Hz) to MIDI note number
function frequencyToMidi(frequency) {
    return Math.round(12 * Math.log2(frequency / 440) + 69);
};

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

function createMidiFile() {
    const totalSeconds = (parseInt(midiCyclesInput.value * selectedPulseInput.value) || 4) * 60 / mainBPM;
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

    const filename = createMidiFileName();
    downloadMidiFile(url, filename);
    
}


function downloadMidiFile(url, filename) {
    // Create and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// creates a name like 3over4_polyrhythm.mid 
function createMidiFileName() {
    const pulseInfo = `${mainPulseCount}`;
    const polyrhythmInfo = `${secondaryPulseCount}`

    return `${polyrhythmInfo}over${pulseInfo}_polyrhythm.mid`;
}

// Event listeners
startStopBtn.addEventListener('click', startStopPlayback);

swapBtn.addEventListener('change', swapFrequencies);

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

mainVolumeSlider.addEventListener('input', (e) => {
    mainVolume = parseFloat(e.target.value);
});

secondaryVolumeSlider.addEventListener('input', (e) => {
    secondaryVolume = parseFloat(e.target.value);
})

exportMidiBtn.addEventListener('click', createMidiFile); 

accelToggle.addEventListener('click', () => {
    const accelarationSettings = document.getElementById('acceleration-settings');
    const bmpCtrlContainer = document.querySelector('.bpm-control')
    if (accelToggle.checked) {
        bpmInput.disabled = true;
        bmpCtrlContainer.classList.add('hidden')
        accelarationSettings.classList.remove('hidden');
        restartPlayback();
    } else {
        bpmInput.disabled = false;
        bmpCtrlContainer.classList.remove('hidden')
        accelarationSettings.classList.add('hidden');
    }
})

midiCyclesInput.addEventListener('change', restartPlayback)

function startHold(e, container) {
        const addBtn = e.target.closest('.add');
        const subtractBtn = e.target.closest(".subtract");
        const number = container.querySelector('input[type="number"]')
        if (addBtn) {
            interval = setInterval(() => number.stepUp(), 75);
        }
        if (subtractBtn) {
            interval = setInterval(() => number.stepDown(), 75);
        }
}

function stopHold(container) {
    console.log("Hi mom")
        clearInterval(interval);
        const input = container.querySelector('input')
        updateValues(input)
        updateDisplays();
        restartPlayback();
        limitBpms();
}

// Handle custom number input buttons
let interval
numInputContainer.forEach((container) => {
    ['mousedown', 'touchstart'].forEach((event) => {
        container.addEventListener(event, (e) => {
            startHold(e, container)
        })
    })

    container.addEventListener('mouseup', () => {
        stopHold(container);
    });
    container.addEventListener('mouseleave', () => {
        stopHold(container);
    });
    container.addEventListener('touchend', () => {
        stopHold(container);
    });
    container.addEventListener('touchcancel', () => {
        stopHold(container);
    });
    // container.addEventListener("mousedown", (e) => {
    //     const addBtn = e.target.closest('.add');
    //     const subtractBtn = e.target.closest(".subtract");
    //     const number = container.querySelector('input[type="number"]')
    //     if (addBtn) {
    //         interval = setInterval(() => number.stepUp(), 75);
    //     }
    //     if (subtractBtn) {
    //         interval = setInterval(() => number.stepDown(), 75);
    //     }
    // });
    // container.addEventListener("mouseup", () => {
    //     clearInterval(interval);
    //     const input = container.querySelector('input')
    //     updateValues(input)
    //     updateDisplays();
    //     restartPlayback();
    //     limitBpms();
    // });
});

// Initialize
updateDisplays();

