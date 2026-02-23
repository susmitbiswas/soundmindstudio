document.addEventListener('DOMContentLoaded', function() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const postCards = document.querySelectorAll('.post-card');

  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      const filter = this.getAttribute('data-filter');

      // Update active button
      filterButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');

      // Filter posts
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
});
