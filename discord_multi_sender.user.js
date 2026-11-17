// ==UserScript==
// @name         Discord マルチ転送ボタン (ビジュアル設定内蔵版)
// @namespace    https://github.com/koukakurui0603/
// @version      7.0
// @description  現在見ているページを目的別のDiscordに送信。右下の折り畳みボタンから展開し、内蔵の設定画面でWebhook疎通・名前確認やJSON入出力が行えます。
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      discord.com
// @connect      discordapp.com
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'discord_multi_sender_configs_v1';

    function loadButtonConfigs() {
        try {
            const saved = GM_getValue(STORAGE_KEY, null);
            if (Array.isArray(saved)) return saved;
        } catch (e) {}
        return [];
    }

    let currentConfigs = loadButtonConfigs();
    let isVisible = false;

    // ==========================================
    // 📦 振り分けボタン一覧の箱（右下・トグルボタンの上に展開）
    // ==========================================
    const container = document.createElement('div');
    container.style.cssText = [
        'position:fixed',
        'bottom:220px',
        'right:20px',
        'z-index:2147483647',
        'display:grid',
        'grid-template-columns:repeat(5, 1fr)',
        'gap:8px',
        'transition:0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'transform-origin:bottom right',
        'opacity:0',
        'pointer-events:none',
        'transform:scale(0.8)'
    ].join(';');

    function renderButtons() {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        currentConfigs.forEach(config => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = config.icon || '📌';
            if (config.name) btn.title = config.name;

            btn.style.cssText = [
                'font-size:28px',
                'border-radius:16px',
                'border:none',
                'background:#5865F2',
                'color:#ffffff',
                'width:56px',
                'height:56px',
                'box-shadow:0 4px 6px rgba(0,0,0,0.2)',
                'display:flex',
                'justify-content:center',
                'align-items:center',
                'opacity:0.55',
                'transition:0.2s',
                'cursor:pointer',
                'padding:0',
                'margin:0',
                'line-height:1'
            ].join(';');

            let isSending = false;
            btn.onclick = function() {
                if (isSending) return;
                if (!config.url || !config.url.startsWith('http')) {
                    alert('Webhook URLが未設定です。⚙️ボタンから設定してください。');
                    return;
                }

                isSending = true;
                const originalIcon = config.icon || '📌';
                btn.textContent = '⏳';
                btn.style.opacity = '1.0';

                GM_xmlhttpRequest({
                    method: "POST",
                    url: config.url,
                    headers: { "Content-Type": "application/json" },
                    data: JSON.stringify({ content: `**${document.title}**\n${location.href}` }),
                    onload: function(res) {
                        btn.textContent = (res.status >= 200 && res.status < 300) ? '✅' : '❌';
                        setTimeout(() => {
                            btn.textContent = originalIcon;
                            btn.style.opacity = '0.55';
                            isSending = false;
                        }, 1800);
                    },
                    onerror: function() {
                        btn.textContent = '❌';
                        setTimeout(() => {
                            btn.textContent = originalIcon;
                            btn.style.opacity = '0.55';
                            isSending = false;
                        }, 1800);
                    }
                });
            };
            container.appendChild(btn);
        });
    }

    // ==========================================
    // ⚙️ ビジュアル設定画面モーダル（1〜10プレビュー＋自動確認＋JSON入出力）
    // ==========================================
    function fetchWebhookInfo(url) {
        return new Promise((resolve) => {
            const cleanUrl = (url || '').trim();
            if (!cleanUrl) {
                resolve({ ok: false, empty: true, name: '' });
                return;
            }
            if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/.test(cleanUrl)) {
                resolve({ ok: false, empty: false, name: '', error: 'URL形式が不正' });
                return;
            }

            GM_xmlhttpRequest({
                method: "GET",
                url: cleanUrl,
                onload: function(res) {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            const data = JSON.parse(res.responseText);
                            resolve({ ok: true, empty: false, name: data.name || '名称なしWebhook' });
                        } catch (e) {
                            resolve({ ok: false, empty: false, name: '', error: '解析失敗' });
                        }
                    } else {
                        resolve({ ok: false, empty: false, name: '', error: `エラー(${res.status})` });
                    }
                },
                onerror: function() {
                    resolve({ ok: false, empty: false, name: '', error: '通信失敗' });
                }
            });
        });
    }

    function openSettingsModal() {
        const existing = document.getElementById('dms-settings-overlay');
        if (existing) existing.remove();

        // 作業用リスト（最低10枠を用意）
        const minSlots = Math.max(10, currentConfigs.length);
        const workingRows = [];
        for (let i = 0; i < minSlots; i++) {
            const item = currentConfigs[i] || {};
            workingRows.push({
                icon: item.icon || '',
                url: item.url || '',
                name: item.name || ''
            });
        }

        const overlay = document.createElement('div');
        overlay.id = 'dms-settings-overlay';
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:2147483647; display:flex; justify-content:center; align-items:center; padding:12px; box-sizing:border-box;';

        const card = document.createElement('div');
        card.style.cssText = 'background:#ffffff; color:#222222; border-radius:16px; padding:18px; width:100%; max-width:660px; max-height:92vh; overflow-y:auto; box-shadow:0 10px 30px rgba(0,0,0,0.35); font-family:sans-serif; font-size:14px; line-height:1.45; box-sizing:border-box;';

        // ヘッダー
        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; border-bottom:1px solid #eeeeee; padding-bottom:10px;';

        const title = document.createElement('div');
        title.textContent = '⚙️ 開いているWebページをDiscordに流すボタン設定';
        title.style.cssText = 'font-weight:bold; font-size:16px; color:#111111;';

        // JSONファイル読込（既存ファイル復元用）
        const importLabel = document.createElement('label');
        importLabel.textContent = '📂 JSONから読込';
        importLabel.style.cssText = 'font-size:12px; padding:6px 10px; background:#f0f2f5; border:1px solid #cccccc; border-radius:8px; cursor:pointer; color:#333333;';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,.txt';
        fileInput.style.display = 'none';
        importLabel.appendChild(fileInput);

        headerRow.appendChild(title);
        headerRow.appendChild(importLabel);

        // 1〜10 リアルタイムプレビューエリア
        const previewCaption = document.createElement('div');
        previewCaption.textContent = '▼ ボタン配置プレビュー（下の入力に合わせてリアルタイムで変わります）';
        previewCaption.style.cssText = 'font-size:12px; font-weight:bold; color:#555555; margin-bottom:8px;';

        const previewGrid = document.createElement('div');
        previewGrid.style.cssText = 'display:grid; grid-template-columns:repeat(5, 56px); gap:8px; justify-content:center; background:#f7f8fa; padding:12px; border-radius:12px; border:1px solid #e2e5ea; margin-bottom:14px;';

        // 入力リストエリア
        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'display:flex; flex-direction:column; gap:10px; margin-bottom:12px;';

        let previewBoxes = [];
        let rowElements = [];

        function updatePreview() {
            workingRows.forEach((row, idx) => {
                const box = previewBoxes[idx];
                if (!box) return;
                const hasIcon = row.icon.trim().length > 0;
                const hasUrl = row.url.trim().length > 0;
                box.textContent = hasIcon ? row.icon.trim() : String(idx + 1);
                box.style.background = (hasIcon || hasUrl) ? '#5865F2' : '#d0d5dd';
                box.style.color = '#ffffff';
                box.style.opacity = (hasIcon || hasUrl) ? '1' : '0.65';
                box.title = row.name ? `${idx + 1}: ${row.name}` : `ボタン位置 ${idx + 1}`;
            });
        }

        function rebuildForm() {
            while (previewGrid.firstChild) previewGrid.removeChild(previewGrid.firstChild);
            while (listContainer.firstChild) listContainer.removeChild(listContainer.firstChild);
            previewBoxes = [];
            rowElements = [];

            workingRows.forEach((row, idx) => {
                // プレビューBOX
                const pBox = document.createElement('div');
                pBox.style.cssText = 'width:56px; height:56px; border-radius:16px; display:flex; justify-content:center; align-items:center; font-size:26px; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.12); transition:0.15s; user-select:none;';
                previewGrid.appendChild(pBox);
                previewBoxes.push(pBox);

                // 入力行
                const rowWrap = document.createElement('div');
                rowWrap.style.cssText = 'display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:8px; border:1px solid #e0e0e0; border-radius:10px; background:#fafafa;';

                const numBadge = document.createElement('div');
                numBadge.textContent = String(idx + 1);
                numBadge.style.cssText = 'width:26px; height:26px; border-radius:50%; background:#333333; color:#ffffff; font-size:12px; font-weight:bold; display:flex; justify-content:center; align-items:center; flex-shrink:0;';

                const iconInput = document.createElement('input');
                iconInput.type = 'text';
                iconInput.placeholder = '絵文字';
                iconInput.value = row.icon;
                iconInput.style.cssText = 'width:58px; text-align:center; font-size:20px; padding:5px; border:1px solid #cccccc; border-radius:8px; background:#ffffff; box-sizing:border-box;';

                const urlInput = document.createElement('input');
                urlInput.type = 'text';
                urlInput.placeholder = 'Discord Webhook URL (https://discord.com/api/webhooks/...)';
                urlInput.value = row.url;
                urlInput.style.cssText = 'flex:1 1 200px; min-width:160px; font-size:12px; padding:7px 8px; border:1px solid #cccccc; border-radius:8px; background:#ffffff; font-family:monospace; box-sizing:border-box;';

                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.placeholder = 'Webhook名(自動取得/メモ)';
                nameInput.value = row.name;
                nameInput.style.cssText = 'flex:0 1 160px; min-width:120px; font-size:12px; padding:7px 8px; border:1px solid #e0a0b0; border-radius:8px; background:#fffafa; color:#333333; box-sizing:border-box;';

                const statusTag = document.createElement('span');
                statusTag.style.cssText = 'font-size:11px; min-width:16px;';

                iconInput.oninput = function() {
                    workingRows[idx].icon = iconInput.value;
                    updatePreview();
                };
                urlInput.oninput = function() {
                    workingRows[idx].url = urlInput.value;
                    statusTag.textContent = '';
                    updatePreview();
                };
                nameInput.oninput = function() {
                    workingRows[idx].name = nameInput.value;
                    updatePreview();
                };

                rowWrap.appendChild(numBadge);
                rowWrap.appendChild(iconInput);
                rowWrap.appendChild(urlInput);
                rowWrap.appendChild(nameInput);
                rowWrap.appendChild(statusTag);
                listContainer.appendChild(rowWrap);

                rowElements.push({ iconInput, urlInput, nameInput, statusTag });
            });

            updatePreview();
        }

        // 枠追加ボタン
        const addSlotBtn = document.createElement('button');
        addSlotBtn.type = 'button';
        addSlotBtn.textContent = '＋ ボタン枠を1つ追加';
        addSlotBtn.style.cssText = 'align-self:flex-start; font-size:12px; padding:6px 12px; border:1px dashed #999999; background:#ffffff; color:#555555; border-radius:8px; cursor:pointer; margin-bottom:14px;';
        addSlotBtn.onclick = function() {
            workingRows.push({ icon: '', url: '', name: '' });
            rebuildForm();
        };

        // 案内メッセージエリア
        const infoBanner = document.createElement('div');
        infoBanner.textContent = '※Discord側でWebhook作成時に付けた「名前」を自動取得します（取得後にメモとして書き換えも可能です）。';
        infoBanner.style.cssText = 'font-size:11px; color:#666666; margin-bottom:12px;';

        const statusArea = document.createElement('div');
        statusArea.style.cssText = 'font-size:13px; font-weight:bold; margin-bottom:12px; min-height:18px; color:#333333;';

        // 下部アクションボタンエリア（①名前確認 → ②反映／JSON出力）
        const actionArea = document.createElement('div');
        actionArea.style.cssText = 'display:flex; flex-direction:column; gap:10px; border-top:1px solid #eeeeee; padding-top:12px;';

        const checkBtn = document.createElement('button');
        checkBtn.type = 'button';
        checkBtn.textContent = '🔍 ① Webhookから名前・接続を確認する';
        checkBtn.style.cssText = 'width:100%; padding:10px; border:none; border-radius:10px; background:#2b2d31; color:#ffffff; font-weight:bold; font-size:14px; cursor:pointer;';

        const step2Row = document.createElement('div');
        step2Row.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; align-items:center;';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '閉じる';
        closeBtn.style.cssText = 'padding:9px 14px; border:1px solid #cccccc; background:#ffffff; color:#333333; border-radius:8px; cursor:pointer; font-size:13px;';

        const exportJsonBtn = document.createElement('button');
        exportJsonBtn.type = 'button';
        exportJsonBtn.textContent = '📥 ② 設定用JSONファイル出力';
        exportJsonBtn.style.cssText = 'padding:9px 14px; border:1px solid #5865F2; background:#eef0ff; color:#3c48c4; font-weight:bold; border-radius:8px; cursor:pointer; font-size:13px; opacity:0.65;';

        const saveApplyBtn = document.createElement('button');
        saveApplyBtn.type = 'button';
        saveApplyBtn.textContent = '💾 ② 保存してボタンに反映';
        saveApplyBtn.style.cssText = 'padding:9px 16px; border:none; background:#5865F2; color:#ffffff; font-weight:bold; border-radius:8px; cursor:pointer; font-size:13px; opacity:0.65;';

        // 確認後の強調状態にする関数
        function activateStep2Buttons() {
            exportJsonBtn.style.opacity = '1';
            saveApplyBtn.style.opacity = '1';
            saveApplyBtn.style.boxShadow = '0 0 0 3px rgba(88,101,242,0.3)';
        }

        function collectValidRows() {
            return workingRows
                .map(r => ({
                    icon: r.icon.trim(),
                    name: r.name.trim(),
                    url: r.url.trim()
                }))
                .filter(r => r.url.length > 0 || r.icon.length > 0);
        }

        checkBtn.onclick = async function() {
            checkBtn.disabled = true;
            checkBtn.textContent = '⏳ Webhookを確認中...';
            statusArea.style.color = '#333333';
            statusArea.textContent = '入力されたWebhook URLを順番に確認しています...';

            let okCount = 0;
            let errCount = 0;

            for (let i = 0; i < workingRows.length; i++) {
                const row = workingRows[i];
                const el = rowElements[i];
                if (!row.url.trim()) {
                    el.statusTag.textContent = '';
                    continue;
                }
                el.statusTag.textContent = '⏳';
                const res = await fetchWebhookInfo(row.url);
                if (res.ok) {
                    okCount++;
                    el.statusTag.textContent = '✅';
                    el.statusTag.title = '接続OK';
                    // 名前欄が空、またはまだ手書きされていなければ自動入力
                    if (!el.nameInput.value.trim() || el.nameInput.dataset.autoFilled === '1') {
                        el.nameInput.value = res.name;
                        el.nameInput.dataset.autoFilled = '1';
                        workingRows[i].name = res.name;
                    }
                    el.nameInput.style.borderColor = '#4caf50';
                    el.nameInput.style.background = '#f1f8e9';
                } else {
                    errCount++;
                    el.statusTag.textContent = '❌';
                    el.statusTag.title = res.error || 'エラー';
                    el.nameInput.style.borderColor = '#e53935';
                    el.nameInput.style.background = '#ffebee';
                    if (!el.nameInput.value.trim()) {
                        el.nameInput.placeholder = res.error || 'URLエラー';
                    }
                }
            }

            updatePreview();
            checkBtn.disabled = false;
            checkBtn.textContent = '🔍 ① Webhookから名前・接続を確認する';

            if (errCount > 0) {
                statusArea.style.color = '#d32f2f';
                statusArea.textContent = `確認完了：有効 ${okCount}件 / エラー ${errCount}件（❌のURLを確認してください）`;
            } else if (okCount > 0) {
                statusArea.style.color = '#2e7d32';
                statusArea.textContent = `✅ 確認完了！ 有効なWebhook ${okCount}件の名前を取得しました。下の「②」へ進んでください。`;
                activateStep2Buttons();
            } else {
                statusArea.style.color = '#666666';
                statusArea.textContent = 'Webhook URLが入力されていません。';
            }
        };

        exportJsonBtn.onclick = function() {
            const valid = collectValidRows();
            const jsonText = JSON.stringify(valid, null, 2);
            const blob = new Blob([jsonText], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'buttons_secret.json';
            a.click();
            URL.revokeObjectURL(a.href);
            statusArea.style.color = '#2e7d32';
            statusArea.textContent = '📥 「buttons_secret.json」を出力しました！';
        };

        saveApplyBtn.onclick = function() {
            const valid = collectValidRows();
            GM_setValue(STORAGE_KEY, valid);
            currentConfigs = valid;
            renderButtons();
            overlay.remove();
            if (valid.length > 0 && !isVisible) {
                toggleDisplay(true);
            }
        };

        closeBtn.onclick = function() {
            overlay.remove();
        };

        fileInput.onchange = function(e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    if (!Array.isArray(parsed)) throw new Error('配列形式ではありません');
                    workingRows.length = 0;
                    const count = Math.max(10, parsed.length);
                    for (let i = 0; i < count; i++) {
                        const item = parsed[i] || {};
                        workingRows.push({
                            icon: item.icon || '',
                            url: item.url || '',
                            name: item.name || ''
                        });
                    }
                    rebuildForm();
                    statusArea.style.color = '#2e7d32';
                    statusArea.textContent = `📂 JSONファイルから ${parsed.length}件を読み込みました！「①」で確認または「②」で反映できます。`;
                    activateStep2Buttons();
                } catch (err) {
                    statusArea.style.color = '#d32f2f';
                    statusArea.textContent = '❌ JSONファイルの読み込みに失敗しました: ' + err.message;
                }
            };
            reader.readAsText(file, 'utf-8');
        };

        step2Row.appendChild(closeBtn);
        step2Row.appendChild(exportJsonBtn);
        step2Row.appendChild(saveApplyBtn);

        actionArea.appendChild(checkBtn);
        actionArea.appendChild(step2Row);

        card.appendChild(headerRow);
        card.appendChild(previewCaption);
        card.appendChild(previewGrid);
        card.appendChild(listContainer);
        card.appendChild(addSlotBtn);
        card.appendChild(infoBanner);
        card.appendChild(statusArea);
        card.appendChild(actionArea);

        overlay.appendChild(card);
        overlay.onclick = function(e) {
            if (e.target === overlay) overlay.remove();
        };

        rebuildForm();
        document.body.appendChild(overlay);
    }

    // ==========================================
    // 📂 右下の表示／非表示トグルボタン＆設定ボタン
    // ==========================================
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.textContent = currentConfigs.length === 0 ? '⚙️' : '📂';
    toggleBtn.style.cssText = [
        'position:fixed',
        'bottom:160px',
        'right:20px',
        'z-index:2147483647',
        'font-size:24px',
        'border-radius:50%',
        'border:none',
        'background:#333333',
        'color:#ffffff',
        'width:48px',
        'height:48px',
        'box-shadow:0 4px 6px rgba(0,0,0,0.2)',
        'display:flex',
        'justify-content:center',
        'align-items:center',
        'opacity:0.45',
        'transition:0.2s',
        'cursor:pointer',
        'padding:0',
        'margin:0',
        'line-height:1'
    ].join(';');

    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.textContent = '⚙️';
    settingsBtn.title = 'ボタン設定を開く';
    settingsBtn.style.cssText = [
        'position:fixed',
        'bottom:164px',
        'right:76px',
        'z-index:2147483647',
        'font-size:20px',
        'border-radius:50%',
        'border:none',
        'background:#555555',
        'color:#ffffff',
        'width:40px',
        'height:40px',
        'box-shadow:0 4px 6px rgba(0,0,0,0.2)',
        'display:flex',
        'justify-content:center',
        'align-items:center',
        'opacity:0',
        'pointer-events:none',
        'transform:scale(0.8)',
        'transition:0.2s',
        'cursor:pointer',
        'padding:0',
        'margin:0',
        'line-height:1'
    ].join(';');

    function toggleDisplay(forceState) {
        isVisible = (typeof forceState === 'boolean') ? forceState : !isVisible;

        if (isVisible) {
            if (currentConfigs.length === 0) {
                isVisible = false;
                openSettingsModal();
                return;
            }
            container.style.opacity = '1';
            container.style.pointerEvents = 'auto';
            container.style.transform = 'scale(1)';

            settingsBtn.style.opacity = '0.75';
            settingsBtn.style.pointerEvents = 'auto';
            settingsBtn.style.transform = 'scale(1)';

            toggleBtn.textContent = '➖';
            toggleBtn.style.opacity = '0.75';
        } else {
            container.style.opacity = '0';
            container.style.pointerEvents = 'none';
            container.style.transform = 'scale(0.8)';

            settingsBtn.style.opacity = '0';
            settingsBtn.style.pointerEvents = 'none';
            settingsBtn.style.transform = 'scale(0.8)';

            toggleBtn.textContent = currentConfigs.length === 0 ? '⚙️' : '📂';
            toggleBtn.style.opacity = '0.45';
        }
    }

    toggleBtn.onclick = function() {
        toggleDisplay();
    };
    settingsBtn.onclick = function() {
        openSettingsModal();
    };

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('⚙️ ボタン設定画面を開く', openSettingsModal);
    }

    renderButtons();
    document.body.appendChild(container);
    document.body.appendChild(settingsBtn);
    document.body.appendChild(toggleBtn);
})();