/* Three Cookers — lightweight rhythm mini-games */
(function () {
    const PAD_FREQ = [523.25, 659.25, 783.99, 987.77];
    const PAD_COLORS = ['#00f0ff', '#ff6bb5', '#b44dff', '#ffc0dc'];

    let audioCtx = null;
    let arcadeLang = 'en';

    function t(key) {
        const dict = window.TCG_I18N && window.TCG_I18N.dict;
        const pack = (dict && dict[arcadeLang]) || (dict && dict.en) || {};
        return pack[key] != null ? pack[key] : (dict && dict.en && dict.en[key]) || key;
    }

    function ensureAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playTone(freq, duration, type, vol) {
        duration = duration || 0.1;
        type = type || 'triangle';
        vol = vol || 0.12;
        const ctx = ensureAudio();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.02);
    }

    function flashFeedback(el, text, kind) {
        if (!el) return;
        el.textContent = text;
        el.className = 'game-feedback ' + (kind || '');
        el.classList.add('show');
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(function () {
            el.classList.remove('show');
        }, 650);
    }

    /* —— Beat Sync —— */
    const padState = {
        active: false,
        step: 0,
        pattern: [],
        score: 0,
        combo: 0,
        best: 0,
        expectLane: -1,
        timer: null,
        deadline: 0
    };

    function padEls() {
        return {
            lanes: document.querySelectorAll('#padLanes .pad-lane'),
            score: document.getElementById('padScore'),
            combo: document.getElementById('padCombo'),
            best: document.getElementById('padBest'),
            feedback: document.getElementById('padFeedback'),
            btn: document.getElementById('padStartBtn')
        };
    }

    function updatePadHud() {
        const els = padEls();
        if (els.score) els.score.textContent = padState.score;
        if (els.combo) els.combo.textContent = padState.combo;
        if (els.best) els.best.textContent = padState.best;
    }

    function buildPattern(len) {
        const p = [];
        for (let i = 0; i < len; i++) {
            let lane = Math.floor(Math.random() * 4);
            if (i > 0 && lane === p[i - 1] && Math.random() > 0.35) {
                lane = (lane + 1 + Math.floor(Math.random() * 3)) % 4;
            }
            p.push(lane);
        }
        return p;
    }

    function clearPadHighlight() {
        padEls().lanes.forEach(function (lane) {
            lane.classList.remove('glow', 'hit', 'miss');
        });
    }

    function endPadGame() {
        padState.active = false;
        clearPadHighlight();
        padState.expectLane = -1;
        if (padState.score > padState.best) {
            padState.best = padState.score;
            try { localStorage.setItem('tcg_pad_best', String(padState.best)); } catch (e) {}
        }
        updatePadHud();
        const btn = padEls().btn;
        if (btn) {
            btn.textContent = t('play_restart');
            btn.disabled = false;
        }
        flashFeedback(padEls().feedback, t('play_done').replace('{score}', padState.score), 'good');
    }

    function padStep() {
        if (!padState.active) return;
        if (padState.step >= padState.pattern.length) {
            endPadGame();
            return;
        }

        clearPadHighlight();
        const lane = padState.pattern[padState.step];
        padState.expectLane = lane;
        padState.deadline = Date.now() + 420;

        const lanes = padEls().lanes;
        if (lanes[lane]) lanes[lane].classList.add('glow');
        playTone(PAD_FREQ[lane], 0.08, 'sine', 0.08);

        padState.timer = setTimeout(function () {
            if (padState.active && padState.expectLane === lane) {
                padState.expectLane = -1;
                padState.combo = 0;
                if (lanes[lane]) lanes[lane].classList.add('miss');
                flashFeedback(padEls().feedback, t('play_miss'), 'miss');
                updatePadHud();
            }
            padState.step++;
            padStep();
        }, 430);
    }

    function onPadTap(laneIndex) {
        if (!padState.active || padState.expectLane < 0) return;
        ensureAudio();
        const lanes = padEls().lanes;
        const expected = padState.expectLane;
        const onTime = Date.now() <= padState.deadline;

        if (laneIndex === expected && onTime) {
            clearTimeout(padState.timer);
            padState.expectLane = -1;
            padState.combo++;
            padState.score += 100 + padState.combo * 15;
            if (lanes[laneIndex]) {
                lanes[laneIndex].classList.remove('glow');
                lanes[laneIndex].classList.add('hit');
            }
            playTone(PAD_FREQ[laneIndex] * 1.02, 0.14, 'triangle', 0.14);
            flashFeedback(padEls().feedback, padState.combo >= 5 ? t('play_perfect') : t('play_good'), 'good');
            updatePadHud();
            padState.step++;
            setTimeout(padStep, 120);
        } else {
            padState.combo = 0;
            if (lanes[laneIndex]) lanes[laneIndex].classList.add('miss');
            playTone(180, 0.15, 'sawtooth', 0.06);
            flashFeedback(padEls().feedback, t('play_miss'), 'miss');
            updatePadHud();
        }
    }

    function startPadGame() {
        ensureAudio();
        clearTimeout(padState.timer);
        padState.active = true;
        padState.step = 0;
        padState.score = 0;
        padState.combo = 0;
        padState.pattern = buildPattern(24);
        padState.expectLane = -1;
        clearPadHighlight();
        updatePadHud();
        const btn = padEls().btn;
        if (btn) {
            btn.textContent = t('play_playing');
            btn.disabled = true;
        }
        flashFeedback(padEls().feedback, t('play_go'), 'good');
        setTimeout(padStep, 500);
    }

    /* —— Neon Tiles —— */
    const tileState = {
        running: false,
        score: 0,
        combo: 0,
        best: 0,
        tiles: [],
        lastSpawn: 0,
        spawnGap: 720,
        speed: 2.8,
        raf: null,
        misses: 0
    };

    function tileEls() {
        return {
            board: document.getElementById('tileBoard'),
            cols: document.querySelectorAll('#tileBoard .tile-col'),
            score: document.getElementById('tileScore'),
            combo: document.getElementById('tileCombo'),
            best: document.getElementById('tileBest'),
            feedback: document.getElementById('tileFeedback'),
            btn: document.getElementById('tileStartBtn')
        };
    }

    function updateTileHud() {
        const els = tileEls();
        if (els.score) els.score.textContent = tileState.score;
        if (els.combo) els.combo.textContent = tileState.combo;
        if (els.best) els.best.textContent = tileState.best;
    }

    function spawnTile() {
        const col = Math.floor(Math.random() * 3);
        const cols = tileEls().cols;
        if (!cols[col]) return;
        const el = document.createElement('div');
        el.className = 'tile-note';
        el.style.background = PAD_COLORS[col];
        el.dataset.col = String(col);
        cols[col].appendChild(el);
        tileState.tiles.push({ col: col, el: el, y: -48, scored: false });
    }

    function stopTileGame() {
        tileState.running = false;
        if (tileState.raf) cancelAnimationFrame(tileState.raf);
        tileState.tiles.forEach(function (t) {
            if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
        });
        tileState.tiles = [];
        if (tileState.score > tileState.best) {
            tileState.best = tileState.score;
            try { localStorage.setItem('tcg_tile_best', String(tileState.best)); } catch (e) {}
        }
        updateTileHud();
        const btn = tileEls().btn;
        if (btn) {
            btn.textContent = t('play_restart');
            btn.disabled = false;
        }
    }

    function endTileGame() {
        stopTileGame();
        flashFeedback(tileEls().feedback, t('play_done').replace('{score}', tileState.score), 'good');
    }

    function tileLoop(now) {
        if (!tileState.running) return;
        if (!tileState.lastSpawn) tileState.lastSpawn = now;
        if (now - tileState.lastSpawn > tileState.spawnGap) {
            spawnTile();
            tileState.lastSpawn = now;
            tileState.spawnGap = Math.max(480, tileState.spawnGap - 6);
        }

        const board = tileEls().board;
        const boardH = board ? board.clientHeight : 280;
        const hitY = boardH - 56;

        for (let i = tileState.tiles.length - 1; i >= 0; i--) {
            const tile = tileState.tiles[i];
            tile.y += tileState.speed;
            tile.el.style.transform = 'translateY(' + tile.y + 'px)';
            if (tile.y > boardH + 20) {
                tile.el.remove();
                tileState.tiles.splice(i, 1);
                if (!tile.scored) {
                    tileState.combo = 0;
                    tileState.misses++;
                    updateTileHud();
                    if (tileState.misses >= 5) {
                        endTileGame();
                        return;
                    }
                }
            }
        }

        tileState.raf = requestAnimationFrame(tileLoop);
    }

    function onTileTap(colIndex) {
        if (!tileState.running) return;
        ensureAudio();
        const board = tileEls().board;
        const boardH = board ? board.clientHeight : 280;
        const hitY = boardH - 56;
        const hitZone = 44;

        let hit = null;
        for (let i = tileState.tiles.length - 1; i >= 0; i--) {
            const tile = tileState.tiles[i];
            if (tile.col !== colIndex || tile.scored) continue;
            if (Math.abs(tile.y + 24 - hitY) <= hitZone) {
                hit = tile;
                break;
            }
        }

        const cols = tileEls().cols;
        if (hit) {
            hit.scored = true;
            hit.el.classList.add('pop');
            setTimeout(function () { if (hit.el.parentNode) hit.el.remove(); }, 180);
            tileState.tiles = tileState.tiles.filter(function (t) { return t !== hit; });
            tileState.combo++;
            tileState.score += 80 + tileState.combo * 12;
            tileState.speed = Math.min(5.2, tileState.speed + 0.02);
            playTone(PAD_FREQ[colIndex], 0.12, 'triangle', 0.13);
            if (cols[colIndex]) cols[colIndex].classList.add('flash');
            setTimeout(function () { if (cols[colIndex]) cols[colIndex].classList.remove('flash'); }, 150);
            flashFeedback(tileEls().feedback, tileState.combo >= 4 ? t('play_perfect') : t('play_good'), 'good');
        } else {
            tileState.combo = 0;
            playTone(140, 0.1, 'sawtooth', 0.05);
            if (cols[colIndex]) cols[colIndex].classList.add('miss-flash');
            setTimeout(function () { if (cols[colIndex]) cols[colIndex].classList.remove('miss-flash'); }, 150);
            flashFeedback(tileEls().feedback, t('play_miss'), 'miss');
        }
        updateTileHud();
    }

    function startTileGame() {
        ensureAudio();
        stopTileGame();
        tileState.running = true;
        tileState.score = 0;
        tileState.combo = 0;
        tileState.misses = 0;
        tileState.speed = 2.8;
        tileState.spawnGap = 720;
        tileState.lastSpawn = 0;
        updateTileHud();
        const btn = tileEls().btn;
        if (btn) {
            btn.textContent = t('play_playing');
            btn.disabled = true;
        }
        flashFeedback(tileEls().feedback, t('play_go'), 'good');
        tileState.raf = requestAnimationFrame(tileLoop);
    }

    function updateArcadeLabels() {
        document.querySelectorAll('[data-i18n-arcade]').forEach(function (el) {
            const key = el.getAttribute('data-i18n-arcade');
            if (key) el.textContent = t(key);
        });
        const padBtn = document.getElementById('padStartBtn');
        const tileBtn = document.getElementById('tileStartBtn');
        if (padBtn && !padState.active) padBtn.textContent = t('play_start');
        if (tileBtn && !tileState.running) tileBtn.textContent = t('play_start');
    }

    function setupArcade() {
        try {
            padState.best = parseInt(localStorage.getItem('tcg_pad_best') || '0', 10) || 0;
            tileState.best = parseInt(localStorage.getItem('tcg_tile_best') || '0', 10) || 0;
        } catch (e) {}
        updatePadHud();
        updateTileHud();
        updateArcadeLabels();

        document.querySelectorAll('#padLanes .pad-lane').forEach(function (lane, i) {
            lane.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                onPadTap(i);
            });
        });

        document.querySelectorAll('#tileBoard .tile-col').forEach(function (col, i) {
            col.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                onTileTap(i);
            });
        });

        var padBtn = document.getElementById('padStartBtn');
        var tileBtn = document.getElementById('tileStartBtn');
        if (padBtn) padBtn.addEventListener('click', startPadGame);
        if (tileBtn) tileBtn.addEventListener('click', startTileGame);
    }

    window.TCGArcade = {
        setup: setupArcade,
        setLang: function (code) {
            arcadeLang = code;
            updateArcadeLabels();
        }
    };
})();
