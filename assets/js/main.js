// assets/js/main.js
document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // MOBILE MENU FUNCTIONALITY
  // ==========================================
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (mobileBtn && mobileMenu) {
    // Toggle mobile menu when button is clicked
    mobileBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent event from bubbling
      mobileMenu.classList.toggle("hidden");
    });

    // Close mobile menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!mobileBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.add("hidden");
      }
    });

    // Close mobile menu when a navigation link is clicked
    const mobileLinks = mobileMenu.querySelectorAll("a");
    mobileLinks.forEach((link) => {
      link.addEventListener("click", () => {
        mobileMenu.classList.add("hidden");
      });
    });

    // Mobile dropdown toggle functionality
    const mobileDropdownBtns = mobileMenu.querySelectorAll(".mobile-dropdown-btn");
    mobileDropdownBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const dropdown = btn.closest(".mobile-dropdown");
        const content = dropdown.querySelector(".mobile-dropdown-content");
        const arrow = btn.querySelector("svg");

        // Toggle content visibility
        content.classList.toggle("hidden");

        // Rotate arrow
        if (content.classList.contains("hidden")) {
          arrow.style.transform = "rotate(0deg)";
        } else {
          arrow.style.transform = "rotate(180deg)";
        }
      });
    });
  }

  // ==========================================
  // PRODUCT FILTER FUNCTIONALITY (guitars.html)
  // ==========================================
  const filterButtons = document.querySelectorAll(".filter-btn");
  const productCards = document.querySelectorAll(".product-card");

  if (filterButtons.length > 0 && productCards.length > 0) {
    // Set "All Guitars" as active by default
    const allFilter = document.querySelector('.filter-btn[data-filter="all"]');
    if (allFilter) {
      allFilter.classList.add("text-yellow-600", "font-bold");
    }

    // Add click event to each filter button
    filterButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();

        const filter = button.getAttribute("data-filter");

        // Update active state on filter buttons
        filterButtons.forEach((btn) => {
          btn.classList.remove("text-yellow-600", "font-bold");
        });
        button.classList.add("text-yellow-600", "font-bold");

        // Filter products with smooth animation
        productCards.forEach((card) => {
          const category = card.getAttribute("data-category");

          if (filter === "all" || category === filter) {
            // Show matching products
            card.style.display = "flex";

            // Add smooth fade-in animation
            card.style.opacity = "0";
            setTimeout(() => {
              card.style.opacity = "1";
              card.style.transition = "opacity 0.3s ease-in";
            }, 10);
          } else {
            // Hide non-matching products
            card.style.display = "none";
          }
        });

        // On mobile, scroll to product grid after filtering
        if (window.innerWidth < 768) {
          const productGrid = document.getElementById("product-grid");
          if (productGrid) {
            productGrid.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }
      });
    });
  }

  // ==========================================
  // FORM SUBMISSION HANDLER
  // ==========================================
  const forms = document.querySelectorAll("form");
  forms.forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      alert("Thank you! This is a demo form. Your message has been received.");
      form.reset();
    });
  });

  // ==========================================
  // SMOOTH SCROLL FOR ANCHOR LINKS
  // ==========================================
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");

      // Only prevent default for actual anchor links (not just "#")
      if (href !== "#") {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }
    });
  });

  // ==========================================
  // HORIZONTAL SCROLL ARROWS FUNCTIONALITY
  // ==========================================
  const scrollContainer = document.querySelector(".product-scroll-container");
  const scrollLeftBtn = document.querySelector(".scroll-arrow-left");
  const scrollRightBtn = document.querySelector(".scroll-arrow-right");

  if (scrollContainer && scrollLeftBtn && scrollRightBtn) {
    const scrollAmount = 220; // Scroll by slightly more than one card width

    // Scroll left when left arrow is clicked
    scrollLeftBtn.addEventListener("click", () => {
      scrollContainer.scrollBy({
        left: -scrollAmount,
        behavior: "smooth",
      });
    });

    // Scroll right when right arrow is clicked
    scrollRightBtn.addEventListener("click", () => {
      scrollContainer.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      });
    });

    // Optional: Update arrow visibility based on scroll position
    const updateArrowVisibility = () => {
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;

      if (scrollContainer.scrollLeft <= 0) {
        scrollLeftBtn.style.visibility = "hidden";
      } else {
        scrollLeftBtn.style.visibility = "visible";
      }

      if (scrollContainer.scrollLeft >= maxScroll - 1) {
        scrollRightBtn.style.visibility = "hidden";
      } else {
        scrollRightBtn.style.visibility = "visible";
      }
    };

    // Initially hide left arrow (at start position)
    updateArrowVisibility();

    // Update arrows on scroll
    scrollContainer.addEventListener("scroll", updateArrowVisibility);
  }
});
