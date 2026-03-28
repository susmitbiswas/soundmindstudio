document.addEventListener('DOMContentLoaded', function() {
  // Category filter (index page)
  const filterButtons = document.querySelectorAll('.filter-btn');
  const postCards = document.querySelectorAll('.post-card');

  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      const filter = this.getAttribute('data-filter');
      if (!filter) return;

      filterButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');

      postCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          card.classList.remove('hidden');
          card.style.opacity = '1';
          card.style.visibility = 'visible';
        } else {
          card.classList.add('hidden');
          card.style.opacity = '0';
          card.style.visibility = 'hidden';
        }
      });
    });
  });

  // Post dropdown toggle (single post page)
  const dropdownToggle = document.querySelector('.dropdown-toggle');
  const postDropdown = document.querySelector('.post-dropdown');

  if (dropdownToggle && postDropdown) {
    dropdownToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      postDropdown.classList.toggle('open');
    });

    document.addEventListener('click', function(e) {
      if (!postDropdown.contains(e.target)) {
        postDropdown.classList.remove('open');
      }
    });
  }
});
