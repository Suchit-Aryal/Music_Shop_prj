
document.addEventListener('DOMContentLoaded', () => {
    // Ensure products data is available
    if (typeof products === 'undefined') {
        console.error('Products data not loaded');
        return;
    }

    renderSection('featured', 'featured-grid', 8);
    renderSection('electronic', 'electronics-grid', 8);
    renderSection('accessories', 'accessories-scroll', 15);

    initUnifiedCarousel();
});

function initUnifiedCarousel() {
    const track = document.getElementById('category-track');
    const prevBtn = document.getElementById('cat-prev-btn');
    const nextBtn = document.getElementById('cat-next-btn');

    if (!track) return;

    let items = Array.from(track.children);
    const totalItems = items.length;
    let itemsPerScreen = window.innerWidth >= 768 ? 3 : 1;
    let currentIndex = itemsPerScreen; // Start at first clone
    let autoPlayInterval;
    let isTransitioning = false;

    // Clone items for infinite loop
    // Clone last 'itemsPerScreen' to start
    // Clone first 'itemsPerScreen' to end
    // Use enough clones to cover a full screen width transition
    const cloneCount = itemsPerScreen;

    // Clear track and rebuild with clones
    track.innerHTML = '';

    const clonesStart = items.slice(-cloneCount).map(item => {
        const clone = item.cloneNode(true);
        clone.classList.add('clone');
        return clone;
    });

    const clonesEnd = items.slice(0, cloneCount).map(item => {
        const clone = item.cloneNode(true);
        clone.classList.add('clone');
        return clone;
    });

    [...clonesStart, ...items, ...clonesEnd].forEach(item => track.appendChild(item));

    function updateResponsiveVars() {
        // Simple reload on resize to handle changing clone needs (1 vs 3)
        // Or just update width calculation. For simplicity in this structure:
        const newItemsPerScreen = window.innerWidth >= 768 ? 3 : 1;
        if (newItemsPerScreen !== itemsPerScreen) {
            // Reset implementation on breakpoint change for stability
            location.reload();
        }
        itemsPerScreen = newItemsPerScreen;
    }

    function updateCarousel(enableTransition = true) {
        const widthPercentage = 100 / itemsPerScreen;
        const translateX = -(currentIndex * widthPercentage);

        if (enableTransition) {
            track.style.transition = 'transform 0.5s ease-in-out';
        } else {
            track.style.transition = 'none';
        }

        track.style.transform = `translateX(${translateX}%)`;
    }

    // Set initial position (offset by clonesStart)
    updateCarousel(false);

    // Handle Transition End for Loop
    track.addEventListener('transitionend', () => {
        isTransitioning = false;

        // If we moved to the clones at the END (after real items)
        if (currentIndex >= totalItems + cloneCount) {
            currentIndex = cloneCount; // Jump to start real item
            updateCarousel(false);
        }

        // If we moved to the clones at the START (before real items)
        if (currentIndex < cloneCount) {
            currentIndex = totalItems + cloneCount - 1; // Jump to end real item (WAIT. logic check)
            // If itemsPerScreen is 3. Total 6. Clones 3.
            // Indices: 0,1,2 (Clones End-3..End) | 3,4,5,6,7,8 (Real) | 9,10,11 (Clones Start..Start+3)
            // Start at 3.
            // Next -> 4, 5, 6, 7, 8.
            // Next -> 9 (Shows Clone 0,1,2). Transition ends.
            // Reset to 3 (Real 0,1,2).

            // Prev -> 2 (Shows Clone End). Transition ends.
            // Reset to 8 (Real End).
            currentIndex = totalItems + cloneCount - 1; // Wrong logic?
            // Real items end at index: cloneCount + totalItems - 1
            // If we are at index < cloneCount (e.g. cloneCount-1), we are showing the last single item?
            // Actually, if itemsPerScreen=1:
            // [Clone 6] [1] [2] ... [6] [Clone 1]
            // Idx: 0, 1...6, 7. Start at 1.
            // Prev -> 0. Transition end.
            // Reset to 6 (Total).
            // currentIndex = totalItems; // (if cloneCount=1)

            // If itemsPerScreen=3:
            // 3 clones.
            // [4,5,6] [1,2,3,4,5,6] [1,2,3]
            // Idx: 0,1,2 | 3..8 | 9..11
            // Start at 3.
            // Prev -> 2. Transition End.
            // Should show [4,5,6]. That is index 8 (if 3 items visible, index 8 shows 6, 1?? No.)
            // TranslateX for 3 items:
            // At index 2: shows [6 (clone), 1, 2].
            // Wait, items.slice(-cloneCount) gives [4,5,6].
            // So clone 0 is 4, clone 1 is 5, clone 2 is 6.
            // Index 2 shows: 6, 1, 2. (Wait, DOM order: 4,5,6, 1,2,3...)
            // Index 2 starts at "6". Then "1", "2". Correct.
            // We want to jump to the REAL "6" which is at...
            // Real items start at 3. 1 is at 3. 6 is at 8.
            // If we jump to 8, we show 6, Clone 1, Clone 2. 
            // Clone 1 is 1. Clone 2 is 2.
            // So jumping to 8 shows 6, 1, 2.
            // Visual match!

            currentIndex = totalItems + cloneCount - 1; // 6 + 3 - 1 = 8.
        }

        // Correct logic for end loop
        // If index >= cloneCount + totalItems
        // e.g. index 9. Shows [1 (clone), 2 (clone), 3 (clone)].
        // Matches Real 1 (index 3).
        if (currentIndex >= cloneCount + totalItems) {
            currentIndex = cloneCount;
            updateCarousel(false);
        }
    });

    function next() {
        if (isTransitioning) return;
        isTransitioning = true;
        currentIndex++;
        updateCarousel(true);
    }

    function prev() {
        if (isTransitioning) return;
        isTransitioning = true;
        currentIndex--;
        updateCarousel(true);
    }

    function startAutoPlay() {
        stopAutoPlay();
        autoPlayInterval = setInterval(next, 3000);
    }

    function stopAutoPlay() {
        if (autoPlayInterval) clearInterval(autoPlayInterval);
    }

    // Event Listeners
    window.addEventListener('resize', () => {
        updateResponsiveVars();
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
        stopAutoPlay();
        next();
        startAutoPlay();
    });

    if (prevBtn) prevBtn.addEventListener('click', () => {
        stopAutoPlay();
        prev();
        startAutoPlay();
    });

    // Hover Pause
    track.parentElement.addEventListener('mouseenter', stopAutoPlay);
    track.parentElement.addEventListener('mouseleave', startAutoPlay);

    // Touch Support (Simple Swipe)
    let touchStartX = 0;
    track.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoPlay();
    }, { passive: true });

    track.addEventListener('touchend', e => {
        const diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
            diff > 0 ? next() : prev();
        }
        startAutoPlay();
    }, { passive: true });

    // Init
    startAutoPlay();
}

function renderSection(filterType, containerId, limit) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let items = [];
    if (filterType === 'featured') {
        const featuredItems = products.filter(p => p.price.replace(/[^0-9]/g, '') > 20000);
        items = featuredItems.sort(() => 0.5 - Math.random()).slice(0, limit);
    } else {
        items = products.filter(p => p.category === filterType);
    }

    items = items.slice(0, limit);
    const isScroll = containerId === 'accessories-scroll';
    container.innerHTML = items.map(product => createCardHtml(product, isScroll)).join('');
}

function createCardHtml(product, isScroll) {
    const scrollClasses = isScroll
        ? "min-w-[200px] w-[200px] sm:w-[240px] flex-shrink-0 bg-white rounded-xl p-4 shadow-sm snap-center hover:shadow-lg transition-all group block border border-transparent hover:border-yellow-200"
        : "bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group border border-gray-100";

    const imgContainerClasses = isScroll
        ? "aspect-square bg-gray-50 rounded-lg mb-4 p-4 flex items-center justify-center"
        : "aspect-square p-4 flex items-center justify-center relative";

    const contentClasses = isScroll
        ? ""
        : "p-4 border-t border-gray-50";

    return `
    <a href="product.html?id=${encodeURIComponent(product.id)}" class="${scrollClasses}">
        <div class="${imgContainerClasses}">
            <img src="${product.image}" alt="${product.name}" class="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-500" loading="lazy"/>
        </div>
        <div class="${contentClasses}">
            <h3 class="font-bold text-gray-900 truncate">${product.name}</h3>
            <p class="text-yellow-600 font-medium">${product.price}</p>
        </div>
    </a>
    `;
}
