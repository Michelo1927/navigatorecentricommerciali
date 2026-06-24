// Copyright (c) 2026 Trovalo. All rights reserved. Unauthorized use prohibited.
(function () {
    var COOKIE_NAME = 'cookieConsent';
    var GA_ID = 'G-YF7Z32YV20';
    var CF_TOKEN = '7903190b9f4944ca90cbede983442504';
    var ADSENSE_CLIENT = 'ca-pub-7840795594547987';

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

    function clearConsent() {
        try { localStorage.removeItem(COOKIE_NAME); } catch (e) {}
        document.cookie = COOKIE_NAME + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
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
            'background:#1976D2;color:white;border:none;border-radius:50%;' +
            'width:38px;height:38px;cursor:pointer;font-size:17px;' +
            'box-shadow:0 2px 6px rgba(0,0,0,0.25);';
        btn.addEventListener('click', function () {
            showModal(getStoredConsent(), true);
        });
        document.body.appendChild(btn);
    }

    function createToggle(id, checked) {
        var label = document.createElement('label');
        label.style.cssText = 'position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer;';

        var input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.checked = checked;
        input.style.cssText = 'opacity:0;width:0;height:0;position:absolute;';

        var track = document.createElement('span');
        track.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;' +
            'border-radius:24px;transition:background 0.25s;' +
            (checked ? 'background:#1976D2;' : 'background:#ccc;');

        var knob = document.createElement('span');
        knob.style.cssText = 'position:absolute;height:18px;width:18px;bottom:3px;' +
            'background:white;border-radius:50%;transition:left 0.25s;' +
            (checked ? 'left:23px;' : 'left:3px;');

        track.appendChild(knob);

        input.addEventListener('change', function () {
            track.style.background = this.checked ? '#1976D2' : '#ccc';
            knob.style.left = this.checked ? '23px' : '3px';
        });

        label.appendChild(input);
        label.appendChild(track);
        return label;
    }

    function showModal(currentPrefs, isChange) {
        if (document.getElementById('cookieModal')) return;

        var analyticsChecked = currentPrefs ? currentPrefs.analytics : true;
        var advertisingChecked = currentPrefs ? currentPrefs.advertising : true;

        var backdrop = document.createElement('div');
        backdrop.id = 'cookieModal';
        backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
            'display:flex;align-items:center;justify-content:center;z-index:10000;' +
            'background:rgba(0,0,0,0.55);';

        var box = document.createElement('div');
        box.style.cssText = 'background:white;border-radius:16px;padding:28px;' +
            'max-width:480px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);' +
            'max-height:85vh;overflow-y:auto;';

        var title = document.createElement('h3');
        title.textContent = 'Gestisci preferenze cookie';
        title.style.cssText = 'color:#1976D2;margin:0 0 8px 0;font-size:20px;';

        var subtitle = document.createElement('p');
        subtitle.textContent = 'Scegli quali cookie accettare. I cookie necessari non possono essere ' +
            'disattivati in quanto indispensabili al funzionamento del sito.';
        subtitle.style.cssText = 'color:#666;font-size:14px;margin:0 0 20px 0;line-height:1.6;';

        box.appendChild(title);
        box.appendChild(subtitle);

        function createRow(titleText, descText, toggleId, checked, alwaysOn) {
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
                inner.appendChild(createToggle(toggleId, checked));
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
            'toggleAnalytics', analyticsChecked, false
        ));
        box.appendChild(createRow(
            'Cookie Pubblicitari',
            'Google AdSense. Mostrano pubblicità pertinente ai tuoi interessi.',
            'toggleAdvertising', advertisingChecked, false
        ));

        var privacyLink = document.createElement('p');
        privacyLink.style.cssText = 'font-size:13px;color:#888;margin:16px 0 0 0;';
        privacyLink.innerHTML = '<a href="privacy.html#cookies" style="color:#1976D2;">Leggi la Cookie Policy completa</a>';
        box.appendChild(privacyLink);

        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;margin-top:12px;';

        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Annulla';
        cancelBtn.style.cssText = 'padding:10px 20px;border:1px solid #ddd;background:white;' +
            'border-radius:8px;cursor:pointer;font-size:14px;color:#555;';
        cancelBtn.addEventListener('click', function () {
            backdrop.remove();
        });

        var saveBtn = document.createElement('button');
        saveBtn.textContent = 'Salva preferenze';
        saveBtn.style.cssText = 'padding:10px 20px;background:#1976D2;color:white;' +
            'border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;';
        saveBtn.addEventListener('click', function () {
            var prefs = {
                analytics: document.getElementById('toggleAnalytics').checked,
                advertising: document.getElementById('toggleAdvertising').checked
            };
            storeConsent(prefs);
            backdrop.remove();

            if (isChange) {
                // Reload so previously active scripts are cleanly unloaded
                window.location.reload();
            } else {
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
                hideBanner();
                addPreferencesButton();
            });
        }

        if (manageBtn) {
            manageBtn.addEventListener('click', function () {
                showModal(null, false);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
