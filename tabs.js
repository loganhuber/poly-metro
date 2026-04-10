const tabBtns = document.querySelectorAll('.tab-btn');
const tabs = document.querySelectorAll('.tab');

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
