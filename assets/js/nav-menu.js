// Copyright (c) 2026 Trovalo. All rights reserved. Unauthorized use prohibited.
// Mobile Navigation Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            const isActive = navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
            navToggle.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        });

        // Chiudi menu quando clicchi su un link
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });

        // Chiudi menu quando clicchi fuori
        document.addEventListener('click', function(event) {
            if (!navToggle.contains(event.target) && !navMenu.contains(event.target)) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Logo Trovalo = "torna alla home": azzera il centro selezionato così al
    // caricamento di index.html si riparte dalla selezione centro, invece di
    // ripristinare il mall preselezionato salvato in sessionStorage (che
    // porterebbe direttamente alla schermata di ricerca/percorso). Un refresh
    // (F5) invece mantiene la selezione perché non passa da questo handler.
    const navLogo = document.querySelector('.nav-logo a');
    if (navLogo) {
        navLogo.addEventListener('click', function() {
            sessionStorage.removeItem('selectedMall');
        });
    }
});
