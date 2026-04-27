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
const savedPresetsContainer = document.getElementById("saved-presets");
const openPresetModal = document.getElementById('open-preset-modal');
const savePresetBtn = document.getElementById("save-preset-btn");

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

const elements = {
    mainBPM : bpmInput,
    mainSubdivision : mainSubdivisionInput,
    secondarySubdivision : secondarySubdivisionInput,
    mainPulseCount : selectedPulseInput,
    secondaryPulseCount : selectedPolyrhythmInput,
    mainVolume : mainVolumeSlider,
    secondaryVolume : secondaryVolumeSlider,
    endBPM : endBpmDisplay,
    // BPM acceleration variables
    cycleCount : accelCyclesInput,
    bpmInterval : bpmIntervalInput,
    startBpm : startBpmDisplay
}

const state = {
    mainBPM : 120,
    mainSubdivision : parseInt(mainSubdivisionInput.value, 10) || 1,
    secondarySubdivision : parseInt(secondarySubdivisionInput.value, 10) || 1,
    mainPulseCount : parseInt(selectedPulseInput.value, 10) || 4,
    secondaryPulseCount : parseInt(selectedPolyrhythmInput.value, 10) || 3,
    mainVolume : 0.5,
    secondaryVolume : 0.5,
    endBPM : parseInt(endBpmDisplay.value, 10) || 180,
    // BPM acceleration variables
    cycleCount : 0,
    bpmInterval : parseInt(bpmIntervalInput.value, 10) || 5,
    startBpm : parseInt(startBpmDisplay.value, 10) || mainBPM
}


// Scheduler variables
let nextMainSubdivisionTime = 0;
let nextSecondarySubdivisionTime = 0;
let mainSubdivisionStep = 0;
let secondarySubdivisionStep = 0;


const frequencies = {
    first: 800,
    main: 500,
    mainSubdivision: 400,
    secondary: 600,
    secondarySubdivision: 300
};

// Map: sets input value to its corresponding variable
const setters = {
    'bpm-input' : (val) => state.mainBPM = val,
    'pulse' : (val) => state.mainPulseCount = val,
    'polyrhythm' : (val) => state.secondaryPulseCount = val,
    'main-subdivision' : (val) => state.mainSubdivision = val,
    'secondary-subdivision' : (val) => state.secondarySubdivision = val,
    'accel-cycles' : (val) => state.cycleCount = val,
    'bpm-interval' : (val) => state.bpmInterval = val,
    'start-bpm-display' : (val) => {
        state.startBpm = val
        limitBpms()
        restartPlayback()
    },
    'end-bpm-display' : (val) => {
        state.endBPM = val
        limitBpms()
        restartPlayback()
    }
};

// For plus/minus buttons
// Points an input value from DOM to setters which resets the correspoding variables
function updateValues(el) {
    const func = setters[el.id];
    if (!func) return;
    func(parseInt(el.value));
};

// get device type and altert mobile users that silent mode may need
// to be turned off
const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return "mobile";
  }
  return "desktop";
};

function alertMobileUsers() {
    const device = getDeviceType()
    if (device !== 'desktop') {
        alert("Mobile users may need to turn off Silent Mode to use this tool")
    }
}

// Check if user selected to swap tones
function isSwapped() {
    return swapBtn.checked;
};

function accelerateBPM() {
    if (state.mainBPM >= state.endBPM) return; // Stop accelerating if we've reached the target BPM
    state.cycleCount = 0;
    state.mainBPM += state.bpmInterval;
    if (state.mainBPM >= state.endBPM) {
        state.mainBPM = state.endBPM
    }
    // Stop display from cutting off last dot in the display
    setTimeout(() => {
        updateDisplays();
    }, 50);
}

// Hard limit at 300BPM for mainBPm and endBPM
function limitBpms() {
    if (state.mainBPM > 300) {
        state.mainBPM = 300;
        bpmInput.value = 300;
        startBpmDisplay.value = 300;
        bpmDisplay.textContent = 300;
        endBpmDisplay.value = 300;
        restartPlayback()
    }
    if (state.endBPM > 300) {
        state.endBPM = 300;
        endBpmDisplay.value = 300;
        endBpmDisplay.setAttribute('min', state.mainBPM);
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

// Initialize audio context
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

// Modular sound generation - easy to customize later
function createClickSound(frequency = 800, duration = 0.1, volume = state.mainVolume) {
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
    const mainCount = state.mainPulseCount;
    const totalMainSubdivisions = state.mainPulseCount * state.mainSubdivision;
    const mainInterval = 60 / state.mainBPM / state.mainSubdivision;
    
    // Schedule main subdivisions
    while (nextMainSubdivisionTime < currentTime + 0.1) {
        const mainPulseIndex = Math.floor(mainSubdivisionStep / state.mainSubdivision) % mainCount;
        const subIndex = mainSubdivisionStep % state.mainSubdivision;
        // const freq = subIndex === 0 && mainPulseIndex === 0 ? frequencies.first : frequencies.main;
        const isBeat = subIndex === 0;
        const isFirstBeat = isBeat && mainPulseIndex === 0;
        const freq = getFrequency(true, !isBeat, false, isFirstBeat);
        createClickSound(freq, subIndex === 0 ? 0.1 : 0.06);
        flashDot(mainDotsContainer, mainSubdivisionStep % totalMainSubdivisions);
        nextMainSubdivisionTime += mainInterval;
        mainSubdivisionStep++;
        if (isBeat) state.cycleCount++;
    }

    if (accelEnabled() && state.cycleCount >= state.mainPulseCount * parseInt(accelCyclesInput.value)) {
        accelerateBPM();
    }
    
    
    // Schedule secondary subdivisions if polyrhythm selected
    if (state.secondaryPulseCount > 0) {
        const secondaryBPM = state.mainBPM * state.secondaryPulseCount / mainCount;
        const totalSecondarySubdivisions = state.secondaryPulseCount * state.secondarySubdivision;
        const secondaryInterval = 60 / secondaryBPM / state.secondarySubdivision;
        const isBeatSecondary = secondarySubdivisionStep % state.secondarySubdivision === 0;
        const freq = getFrequency(false, !isBeatSecondary, true, false);
        while (nextSecondarySubdivisionTime < currentTime + 0.1) {
            createClickSound(freq, isBeatSecondary ? 0.08 : 0.05, state.secondaryVolume);
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

    for (const key in state) {
        elements[key].value = state[key]
    }

    bpmDisplay.textContent = `${state.mainBPM} BPM`;
    endBpmDisplay.setAttribute('min', state.mainBPM);
    

    // Ensure end BPM can not be lower than main BPM
    if (state.mainBPM > endBpmDisplay.value) {
        endBpmDisplay.value = state.mainBPM
    }

    if (state.secondaryPulseCount > 0) {
        const secondaryBPM = Math.round(state.mainBPM * state.secondaryPulseCount / state.mainPulseCount);
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
    
    for (let i = 0; i < state.mainPulseCount; i++) {
        const largeDot = document.createElement('div');
        largeDot.className = 'dot large';
        mainDotsContainer.appendChild(largeDot);

        for (let j = 1; j < state.mainSubdivision; j++) {
            const smallDot = document.createElement('div');
            smallDot.className = 'dot small';
            mainDotsContainer.appendChild(smallDot);
        }
    }
    
    for (let i = 0; i < state.secondaryPulseCount; i++) {
        const largeDot = document.createElement('div');
        largeDot.className = 'dot large secondary';
        secondaryDotsContainer.appendChild(largeDot);

        for (let j = 1; j < state.secondarySubdivision; j++) {
            const smallDot = document.createElement('div');
            smallDot.className = 'dot small secondary';
            secondaryDotsContainer.appendChild(smallDot);
        }
    }
};

// Show/hide swap control based on whether a polyrhythm is selected
function updateSwapControl() {
    if (state.secondaryPulseCount > 0) {
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
        state.cycleCount = 0;
        startStopBtn.textContent = 'Stop';
        scheduler();
    } else {
        
        if (accelEnabled()) {
            
            bpmInput.value = state.startBpm;
            state.mainBPM = state.startBpm;
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
    state.mainPulseCount = parseInt(selectedPulseInput.value, 10) || 4;
    state.secondaryPulseCount = parseInt(selectedPolyrhythmInput.value, 10) || 0;
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
    const mainInterval = 60 / state.mainBPM / state.mainSubdivision;
    const mainCount = state.mainPulseCount;
    const totalMainSubdivisions = state.mainPulseCount * state.mainSubdivision;
    
    for (let time = 0; time < totalSeconds; time += mainInterval) {
        const mainSubdivisionStep = Math.floor(time / mainInterval);
        const mainPulseIndex = Math.floor(mainSubdivisionStep / state.mainSubdivision) % mainCount;
        const subIndex = mainSubdivisionStep % state.mainSubdivision;
        const freq = subIndex === 0 && mainPulseIndex === 0 ? frequencies.first : frequencies.main;
        const duration = subIndex === 0 ? 0.1 : 0.06;
        
        midiData.push({ 
            time, 
            midi: frequencyToMidi(freq),
            duration: duration / 1000 // Convert ms to seconds for MIDI
        });
    }
    
    if (state.secondaryPulseCount > 0) {
        const secondaryBPM = state.mainBPM * state.secondaryPulseCount / mainCount;
        const secondaryInterval = 60 / secondaryBPM / secondarySubdivision;
        
        for (let time = 0; time < totalSeconds; time += secondaryInterval) {
            const duration = (secondarySubdivisionStep % state.secondarySubdivision === 0) ? 0.08 : 0.05;
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
    const pulseInfo = `${state.mainPulseCount}`;
    const polyrhythmInfo = `${state.secondaryPulseCount}`

    return `${polyrhythmInfo}over${pulseInfo}_polyrhythm.mid`;
}

function handlePresets(e) {
    const row = e.target.closest(".saved-preset");
    const preset = row.id 
    const deleteBtn = row.querySelector(".delete-preset-btn")
    const presetDisplay = row.querySelector('.preset-display')
    const savedPresets = JSON.parse(localStorage.getItem('savedPresets'));

    if (e.target.contains(deleteBtn)) {
        const updatedPresets = savedPresets.filter((p) => {
            return p.name !== preset
        })
        localStorage.setItem("savedPresets", JSON.stringify(updatedPresets))
        displaySavedPresets()
        return
    }

    if (e.target.contains(presetDisplay)) {
        const newState = savedPresets.find((p) => {
            return p.name === preset
        })
        console.log(newState)
        for (const key in state) {
            state[key] = newState[key]
        }
        updateDisplays()
        return
    }

}

function displaySavedPresets() {
    savedPresetsContainer.innerHTML = ''
    const savedPresets = JSON.parse(localStorage.getItem("savedPresets")).reverse() || [];

    if (savedPresets.length == 0) return;

    
    savedPresets.forEach((preset) => {
        const wrapper = document.createElement('li');
        wrapper.classList.add('saved-preset');
        wrapper.classList.add('flex-row')
        wrapper.setAttribute("id", preset.name)
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add("delete-preset-btn", "button");
        deleteBtn.textContent = "Remove"
        const presetDisplay = document.createElement("button")
        presetDisplay.classList.add("preset-display");

        presetDisplay.textContent = preset.name;
        wrapper.appendChild(presetDisplay);
        wrapper.appendChild(deleteBtn);
        savedPresetsContainer.appendChild(wrapper);
    })

}

// Event listeners

// Start/stop. Button, spacebar, and enter key
startStopBtn.addEventListener('click', startStopPlayback);
document.addEventListener('keydown', (event) => {
    // make sure user is on the metronome tab and the dialog is not open
    const tab = document.getElementById('tab-metronome');
    const dialog = document.getElementById("save-dialog");
    if (dialog.open || tab.classList.contains('hidden')) return;

    if (event.code == 'Space' || event.code == 'Enter') {
        event.preventDefault()
        startStopPlayback()
    }
    else return
});


swapBtn.addEventListener('change', swapFrequencies);

selectedPulseInput.addEventListener('change', updatePulseCounts);
selectedPolyrhythmInput.addEventListener('change', updatePulseCounts);

mainSubdivisionInput.addEventListener('input', (e) => {
    state.mainSubdivision = Math.max(1, parseInt(e.target.value, 10) || 1);
    updateDisplays();
    restartPlayback();
});

secondarySubdivisionInput.addEventListener('input', (e) => {
    state.secondarySubdivision = Math.max(1, parseInt(e.target.value, 10) || 1);
    updateDisplays();
    restartPlayback();
});

mainVolumeSlider.addEventListener('input', (e) => {
    state.mainVolume = parseFloat(e.target.value);
});

secondaryVolumeSlider.addEventListener('input', (e) => {
    state.secondaryVolume = parseFloat(e.target.value);
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
    // Extra events for touch screens
    container.addEventListener('mouseup', () => {
        stopHold(container);
    });
    // container.addEventListener('mouseleave', () => {
    //     stopHold(container);
    // });
    container.addEventListener('touchend', () => {
        stopHold(container);
    });
    container.addEventListener('touchcancel', () => {
        stopHold(container);
    });

});

// Handles duplicate preset names
function numerateTitle(title, arr) {
    const regex = /-\d{2}$/g
    const trimmed = title.replaceAll(regex, '')
    let count = 1
    for (const obj of arr) {
        if (trimmed == obj.name.replaceAll(regex, '')) {
            count++
        }
    }
    return `${trimmed}-${count.toString().padStart(2, "0")}`
}

// save array of state objects in local storage under item 'savedPresets'
savePresetBtn.addEventListener("click", () => {
    const savedPresets = JSON.parse(localStorage.getItem('savedPresets')) || []
    let title = document.getElementById("state-title").value

    for (const preset of savedPresets) {
        if (preset.name == title) {
            title = numerateTitle(title, savedPresets)    
        }
    }
    const currState = {
        ...state,
        name: title
    };

    savedPresets.push(currState);
    localStorage.setItem("savedPresets", JSON.stringify(savedPresets));
    displaySavedPresets()
})

openPresetModal.addEventListener("click", displaySavedPresets)

savedPresetsContainer.addEventListener("click", (e) => {
    handlePresets(e)
} )


// Initialize
updateDisplays();
alertMobileUsers();

