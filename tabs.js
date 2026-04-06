const tabBtns = document.querySelectorAll('.tab-btn');
const tabs = document.querySelectorAll('.tab');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        tabs.forEach(tab => {
            if (tab.id === target) {
                tab.classList.remove('hidden');
                tab.classList.add('visible');
            } else {
                tab.classList.remove('visible');
                tab.classList.add('hidden');
            }
        });
    });
});