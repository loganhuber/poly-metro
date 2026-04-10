const tabBtns = document.querySelectorAll('.tab-btn');
const tabs = document.querySelectorAll('.tab');
const accelerationBtn = document.getElementById('acceleration-btn');


tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');

        // underline selected tab button
        tabBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        // switch tabs
        tabs.forEach(tab => {
            if (tab.id === target) {
                tab.classList.remove('hidden');
                tab.classList.add('invisible');
                setTimeout(() => {
                    tab.classList.remove('invisible');
                    tab.classList.add('visible');
                }, 50)
            } else {
                tab.classList.remove('visible');
                tab.classList.add('hidden');
            }
        });
    });
});

accelerationBtn.addEventListener('change', () => {
    const accelarationSettings = document.getElementById('acceleration-settings');
    const mainBpmDisplay = document.getElementById('bpm-input');
    if (accelerationBtn.checked) {
        mainBpmDisplay.disabled = true;
        mainBpmDisplay.parentElement.classList.add("hidden")
        accelarationSettings.classList.remove('hidden');
    } else {
        mainBpmDisplay.disabled = false;
        mainBpmDisplay.parentElement.classList.remove("hidden")
        accelarationSettings.classList.add('hidden');
    }
});