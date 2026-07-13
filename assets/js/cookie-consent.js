// Copyright (c) 2026 Trovalo. All rights reserved. Unauthorized use prohibited.
(function () {
    var COOKIE_NAME = 'cookieConsent';
    var GA_ID = 'G-YF7Z32YV20';
    var CF_TOKEN = '7903190b9f4944ca90cbede983442504';
    var ADSENSE_CLIENT = 'ca-pub-7840795594547987';
    const BRAND_PRIMARY = '#1976D2';

    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;

    // Returns {analytics: bool, advertising: bool} or null if no choice made yet
    function getStoredConsent() {
        try {
            var val = localStorage.getItem(COOKIE_NAME);
            if (!val) return null;
            if (val === 'accepted') return { analytics: true, advertising: true };
            if (val === 'rejected') return { analytics: false, advertising: false };
            return JSON.parse(val);
        } catch (e) {
            var match = document.cookie.match(new RegExp('(^| )' + COOKIE_NAME + '=([^;]+)'));
            if (!match) return null;
            var cv = decodeURIComponent(match[2]);
            if (cv === 'accepted') return { analytics: true, advertising: true };
            if (cv === 'rejected') return { analytics: false, advertising: false };
            try { return JSON.parse(cv); } catch (e2) { return null; }
        }
    }

    function storeConsent(prefs) {
        var val = JSON.stringify(prefs);
        try { localStorage.setItem(COOKIE_NAME, val); } catch (e) {}
        var d = new Date();
        d.setDate(d.getDate() + 365);
        document.cookie = COOKIE_NAME + '=' + encodeURIComponent(val) +
            '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax';
    }

    // Elimina i cookie first-party di Google Analytics quando l'utente revoca
    // il consenso analitico. Il reload impedisce il ricaricamento dello script,
    // ma i cookie _ga/_ga_* già scritti vanno rimossi a mano per applicare la revoca.
    // (I cookie AdSense sono di terze parti su domini doubleclick → non eliminabili via JS.)
    function clearAnalyticsCookies() {
        var names = document.cookie.split(';')
            .map(function (c) { return c.split('=')[0].trim(); })
            .filter(function (n) {
                return n === '_ga' || n === '_gid' ||
                    n.indexOf('_ga_') === 0 || n.indexOf('_gat') === 0;
            });
        var host = location.hostname;
        var domains = ['', host, '.' + host];
        var parts = host.split('.');
        if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
        names.forEach(function (name) {
            domains.forEach(function (d) {
                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/' +
                    (d ? '; domain=' + d : '');
            });
        });
    }

    function loadScript(src, attrs, useDefer) {
        var s = document.createElement('script');
        if (useDefer) { s.defer = true; } else { s.async = true; }
        s.src = src;
        if (attrs) {
            Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
        }
        document.head.appendChild(s);
    }

    function activateTracking(prefs) {
        if (prefs.analytics) {
            loadScript('https://www.googletagmanager.com/gtag/js?id=' + GA_ID);
            gtag('js', new Date());
            gtag('config', GA_ID);
            loadScript(
                'https://static.cloudflareinsights.com/beacon.min.js',
                { 'data-cf-beacon': JSON.stringify({ token: CF_TOKEN }) },
                true
            );
        }
        if (prefs.advertising && document.querySelector('ins.adsbygoogle')) {
            loadScript('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_CLIENT);
        }
    }

    function showOverlay() {
        if (document.getElementById('cookieOverlay')) return;
        if (window.location.pathname.indexOf('privacy.html') !== -1) return;
        var overlay = document.createElement('div');
        overlay.id = 'cookieOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
            'background:rgba(0,0,0,0.65);z-index:9990;backdrop-filter:blur(2px);';
        document.body.appendChild(overlay);
    }

    function removeOverlay() {
        var el = document.getElementById('cookieOverlay');
        if (el) el.remove();
    }

    function showBanner() {
        var banner = document.getElementById('cookieConsent');
        if (banner) {
            banner.style.display = 'flex';
            banner.style.zIndex = '9999';
        }
        showOverlay();
    }

    function hideBanner() {
        var banner = document.getElementById('cookieConsent');
        if (banner) { banner.style.display = 'none'; }
        removeOverlay();
    }

    function addPreferencesButton() {
        if (document.getElementById('cookiePrefsBtn')) return;
        var btn = document.createElement('button');
        btn.id = 'cookiePrefsBtn';
        btn.title = 'Gestisci preferenze cookie';
        btn.setAttribute('aria-label', 'Gestisci preferenze cookie');
        btn.innerHTML = '🍪';
        btn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9998;' +
            `background:${BRAND_PRIMARY};color:white;border:none;border-radius:50%;` +
            'width:38px;height:38px;cursor:pointer;font-size:17px;' +
            'box-shadow:0 2px 6px rgba(0,0,0,0.25);';
        btn.addEventListener('click', function () {
            showModal(getStoredConsent(), true, btn);
        });
        document.body.appendChild(btn);
    }

    function createToggle(id, checked, ariaLabel) {
        var label = document.createElement('label');
        label.style.cssText = 'position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer;';

        var input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.checked = checked;
        if (ariaLabel) input.setAttribute('aria-label', ariaLabel);
        input.style.cssText = 'opacity:0;width:0;height:0;position:absolute;';

        var track = document.createElement('span');
        track.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;' +
            'border-radius:24px;transition:background 0.25s;' +
            (checked ? `background:${BRAND_PRIMARY};` : 'background:#ccc;');

        var knob = document.createElement('span');
        knob.style.cssText = 'position:absolute;height:18px;width:18px;bottom:3px;' +
            'background:white;border-radius:50%;transition:left 0.25s;' +
            (checked ? 'left:23px;' : 'left:3px;');

        track.appendChild(knob);

        input.addEventListener('change', function () {
            track.style.background = this.checked ? BRAND_PRIMARY : '#ccc';
            knob.style.left = this.checked ? '23px' : '3px';
        });

        label.appendChild(input);
        label.appendChild(track);
        return label;
    }

    // originEl (opzionale): elemento da cui il pannello "cresce" all'apertura
    // (il bottone 🍪 o il "Personalizza" del banner). Senza, cresce dal centro.
    function showModal(currentPrefs, isChange, originEl) {
        if (document.getElementById('cookieModal')) return;

        // In assenza di consenso salvato i toggle partono OFF (niente pre-selezione,
        // vedi sentenza Planet49); se un consenso esiste già, riflettono i valori salvati.
        var analyticsChecked = currentPrefs ? currentPrefs.analytics : false;
        var advertisingChecked = currentPrefs ? currentPrefs.advertising : false;

        // Elemento che aveva il focus prima dell'apertura: ci torna alla chiusura.
        var openerEl = document.activeElement;

        var backdrop = document.createElement('div');
        backdrop.id = 'cookieModal';
        backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
            'display:flex;align-items:center;justify-content:center;z-index:10000;' +
            'background:rgba(0,0,0,0.55);';

        var box = document.createElement('div');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-labelledby', 'cookieModalTitle');
        box.style.cssText = 'background:white;border-radius:16px;padding:28px;' +
            'max-width:480px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);' +
            'max-height:85vh;overflow-y:auto;';

        var title = document.createElement('h3');
        title.id = 'cookieModalTitle';
        title.textContent = 'Gestisci preferenze cookie';
        title.style.cssText = `color:${BRAND_PRIMARY};margin:0 0 8px 0;font-size:20px;`;

        var subtitle = document.createElement('p');
        subtitle.textContent = 'Scegli quali cookie accettare. I cookie necessari non possono essere ' +
            'disattivati in quanto indispensabili al funzionamento del sito.';
        subtitle.style.cssText = 'color:#666;font-size:14px;margin:0 0 20px 0;line-height:1.6;';

        box.appendChild(title);
        box.appendChild(subtitle);

        function createRow(titleText, descText, toggleId, checked, alwaysOn, ariaLabel) {
            var row = document.createElement('div');
            row.style.cssText = 'border:1px solid #e0e0e0;border-radius:8px;padding:14px 16px;margin-bottom:10px;';

            var inner = document.createElement('div');
            inner.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:16px;';

            var textDiv = document.createElement('div');
            textDiv.style.cssText = 'flex:1;';

            var rowTitle = document.createElement('strong');
            rowTitle.textContent = titleText;
            rowTitle.style.fontSize = '15px';

            var rowDesc = document.createElement('p');
            rowDesc.textContent = descText;
            rowDesc.style.cssText = 'color:#888;font-size:13px;margin:4px 0 0 0;line-height:1.5;';

            textDiv.appendChild(rowTitle);
            textDiv.appendChild(rowDesc);
            inner.appendChild(textDiv);

            if (alwaysOn) {
                var badge = document.createElement('span');
                badge.textContent = 'Sempre attivi';
                badge.style.cssText = 'background:#4CAF50;border-radius:12px;padding:4px 10px;' +
                    'font-size:12px;color:white;white-space:nowrap;flex-shrink:0;';
                inner.appendChild(badge);
            } else {
                inner.appendChild(createToggle(toggleId, checked, ariaLabel));
            }

            row.appendChild(inner);
            return row;
        }

        box.appendChild(createRow(
            'Cookie Necessari',
            'cookieConsent — memorizza la tua preferenza cookie (durata: 1 anno).',
            null, true, true
        ));
        box.appendChild(createRow(
            'Cookie Analitici',
            'Google Analytics 4 (_ga, _ga_*) e Cloudflare Analytics. Misurano il traffico in forma anonima.',
            'toggleAnalytics', analyticsChecked, false, 'Consenti cookie analitici'
        ));
        box.appendChild(createRow(
            'Cookie Pubblicitari',
            'Google AdSense. Mostrano pubblicità pertinente ai tuoi interessi.',
            'toggleAdvertising', advertisingChecked, false, 'Consenti cookie pubblicitari'
        ));

        var privacyLink = document.createElement('p');
        privacyLink.style.cssText = 'font-size:13px;color:#888;margin:16px 0 0 0;';
        privacyLink.innerHTML = `<a href="privacy.html#cookies" style="color:${BRAND_PRIMARY};">Leggi la Cookie Policy completa</a>`;
        box.appendChild(privacyLink);

        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;margin-top:12px;';

        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Annulla';
        cancelBtn.style.cssText = 'padding:10px 20px;border:1px solid #ddd;background:white;' +
            'border-radius:8px;cursor:pointer;font-size:14px;color:#555;';
        cancelBtn.addEventListener('click', function () {
            closeModal();
        });

        var saveBtn = document.createElement('button');
        saveBtn.textContent = 'Salva preferenze';
        saveBtn.style.cssText = `padding:10px 20px;background:${BRAND_PRIMARY};color:white;` +
            'border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;';
        saveBtn.addEventListener('click', function () {
            var prefs = {
                analytics: document.getElementById('toggleAnalytics').checked,
                advertising: document.getElementById('toggleAdvertising').checked
            };
            storeConsent(prefs);
            if (!prefs.analytics) clearAnalyticsCookies();

            if (isChange) {
                // Reload so previously active scripts are cleanly unloaded.
                // Parte a ritiro completato, così l'animazione di chiusura si vede.
                closeModal(function () { window.location.reload(); });
            } else {
                closeModal();
                hideBanner();
                activateTracking(prefs);
                addPreferencesButton();
            }
        });

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(saveBtn);
        box.appendChild(btnRow);
        backdrop.appendChild(box);
        document.body.appendChild(backdrop);

        // Apertura animata: il pannello cresce (scale 0.15 -> 1) dal punto in cui
        // sta il bottone che l'ha aperto, col backdrop in fade parallelo. Il rect
        // del box va misurato PRIMA di applicare la scala iniziale (getBoundingClientRect
        // restituisce il rect già trasformato). Transition inline: le azzera comunque
        // il blocco prefers-reduced-motion di styles.css (linkato su tutte le pagine).
        var boxRect = box.getBoundingClientRect();
        if (originEl && originEl.getBoundingClientRect) {
            var oRect = originEl.getBoundingClientRect();
            box.style.transformOrigin =
                (oRect.left + oRect.width / 2 - boxRect.left) + 'px ' +
                (oRect.top + oRect.height / 2 - boxRect.top) + 'px';
        }
        backdrop.style.background = 'rgba(0,0,0,0)';
        box.style.transform = 'scale(0.15)';
        box.style.opacity = '0';
        void box.offsetWidth; // reflow: fissa lo stato iniziale prima della transition
        backdrop.style.transition = 'background 0.25s ease-out';
        box.style.transition = 'transform 0.25s ease-out, opacity 0.2s ease-out';
        backdrop.style.background = 'rgba(0,0,0,0.55)';
        box.style.transform = 'scale(1)';
        box.style.opacity = '1';

        // Focus trap semplice: Tab/Shift+Tab restano dentro al pannello finché è aperto;
        // Escape chiude; alla chiusura il focus torna all'elemento che ha aperto il pannello.
        function getFocusable() {
            return Array.prototype.slice.call(
                box.querySelectorAll('button, input, a[href], [tabindex]:not([tabindex="-1"])')
            );
        }

        function handleKeydown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
                return;
            }
            if (e.key === 'Tab') {
                var focusable = getFocusable();
                if (!focusable.length) return;
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first || !box.contains(document.activeElement)) {
                        e.preventDefault();
                        last.focus();
                    }
                } else if (document.activeElement === last || !box.contains(document.activeElement)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }

        var closing = false;
        // onClosed (opzionale): eseguito una volta sola, a rimozione avvenuta
        // (usato dal Salva per posticipare il reload a fine animazione).
        function closeModal(onClosed) {
            if (closing) return; // Escape + click ravvicinati: una chiusura sola
            closing = true;
            document.removeEventListener('keydown', handleKeydown);

            function cleanup() {
                if (!backdrop.parentNode) return;
                backdrop.remove();
                if (openerEl && typeof openerEl.focus === 'function') {
                    openerEl.focus();
                }
                if (onClosed) onClosed();
            }

            // Movimento inverso dell'apertura: il pannello si ritira nel bottone
            // d'origine (il transform-origin impostato all'apertura resta valido),
            // backdrop in fade-out. La rimozione dal DOM avviene a fine transition,
            // col setTimeout come rete di sicurezza se transitionend non arrivasse.
            box.style.transition = 'transform 0.2s ease-in, opacity 0.15s ease-in';
            backdrop.style.transition = 'background 0.2s ease-in';
            box.style.transform = 'scale(0.15)';
            box.style.opacity = '0';
            backdrop.style.background = 'rgba(0,0,0,0)';
            box.addEventListener('transitionend', function (e) {
                if (e.propertyName === 'transform') cleanup();
            });
            setTimeout(cleanup, 300);
        }

        document.addEventListener('keydown', handleKeydown);

        var initialFocusable = getFocusable();
        if (initialFocusable.length) initialFocusable[0].focus();
    }

    function init() {
        var consent = getStoredConsent();

        if (consent !== null) {
            activateTracking(consent);
            addPreferencesButton();
        } else {
            showBanner();
        }

        var acceptBtn = document.getElementById('cookieAccept');
        var rejectBtn = document.getElementById('cookieReject');
        var manageBtn = document.getElementById('cookieManage');

        if (acceptBtn) {
            acceptBtn.addEventListener('click', function () {
                var prefs = { analytics: true, advertising: true };
                storeConsent(prefs);
                hideBanner();
                activateTracking(prefs);
                addPreferencesButton();
            });
        }

        if (rejectBtn) {
            rejectBtn.addEventListener('click', function () {
                storeConsent({ analytics: false, advertising: false });
                clearAnalyticsCookies();
                hideBanner();
                addPreferencesButton();
            });
        }

        if (manageBtn) {
            manageBtn.addEventListener('click', function () {
                showModal(null, false, manageBtn);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
