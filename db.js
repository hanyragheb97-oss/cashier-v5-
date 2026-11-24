// =========================================================================
// 🌟 المحرك المركزي لنظام الكاشير التجاري (V5 Commercial SaaS + Offline-First)
// الجزء (1/3): الهوية التجارية، التخزين العملاق IndexedDB + RAM، بوابة الجاهزية،
// الصوت والواجهات الموحدة، الأدوات والتقريب المركزي، ومحرك الصور الأوفلاين.
// =========================================================================
// ==================== [ بداية الجزء الأول 1/3 ] ====================

window.APP_BRAND_CONFIG = Object.freeze({
    appName: 'نظام الكاشير الذكي',
    shortName: 'الكاشير الذكي',
    version: '5.0.0',
    supportPhone: '',
    supportWhatsApp: '',
    supportEmail: '',
    cloudRoot: 'Seraj_SaaS_Stores',
    backupsRoot: 'Store_Backups'
});

// تسجيل Service Worker بمسار نسبي (./sw.js) لدعم الجذر والمسارات الفرعية
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
            if (!reg) return;
            const notifyUpdate = (worker) => {
                if (!worker) return;
                worker.postMessage({ type: 'SKIP_WAITING' });
                if (typeof showCloudStatus === 'function') {
                    showCloudStatus('✨ يتوفر تحديث جديد للتطبيق (SW Update Ready)');
                }
            };
            if (reg.waiting) notifyUpdate(reg.waiting);
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        notifyUpdate(newWorker);
                    }
                });
            });
        }).catch(err => console.warn('SW Register Warning:', err));
    });
}

// إعدادات Firebase للمشروع
const firebaseConfig = {
    apiKey: "AIzaSyASQurlODfgqRi812wwzcSGOTetYTaeUfQ",
    authDomain: "serajled.firebaseapp.com",
    databaseURL: "https://serajled-default-rtdb.firebaseio.com",
    projectId: "serajled",
    storageBucket: "serajled.firebasestorage.app",
    messagingSenderId: "586272473412",
    appId: "1:586272473412:web:a31487a74d9ea4ea96d711",
    measurementId: "G-6Q7K2H0XJJ"
};

// =========================================================================
// 1. حالة الجلسة والمعرفات الصارمة (ممنوع تماماً السقوط الاحتياطي لـ DemoStore)
// =========================================================================
let cloudReady = false;
let _serverTimeOffset = 0;

function getActiveStoreId() {
    let raw = '';
    try {
        raw = String((window._serajRAM && window._serajRAM.get('seraj_store_id')) ?? localStorage.getItem('seraj_store_id') ?? '').trim();
    } catch (e) {
        raw = '';
    }
    if (!raw || raw.toLowerCase() === 'demostore' || raw === 'null' || raw === 'undefined') {
        return '';
    }
    return raw.replace(/[.#$\[\]\/\\]/g, '_');
}

let currentStoreId = getActiveStoreId();

// منع فتح الصفحات الداخلية بدون تسجيل دخول من الشاشة الرئيسية (مع استثناء index.html)
const _currentPagePath = (window.location.pathname || '').toLowerCase();
const _isEntryIndexPage = (
    _currentPagePath === '/' ||
    _currentPagePath === '' ||
    _currentPagePath.endsWith('/index.html') ||
    _currentPagePath.endsWith('index.html')
);

if (!currentStoreId && !_isEntryIndexPage) {
    window.location.replace('index.html');
}

// معرف الجهاز الدائم لربط التراخيص (offline_single) وفحص max_devices
function _getOrCreateDeviceId() {
    let id = '';
    try { id = localStorage.getItem('seraj_device_id') || ''; } catch (e) {}
    if (!id) {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            id = 'DEV_' + crypto.randomUUID();
        } else {
            id = 'DEV_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        }
        try { localStorage.setItem('seraj_device_id', id); } catch (e) {}
    }
    return id;
}

const myDeviceId = _getOrCreateDeviceId();
let myDeviceUid = sessionStorage.getItem('seraj_device_uid');
if (!myDeviceUid) {
    myDeviceUid = 'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    try { sessionStorage.setItem('seraj_device_uid', myDeviceUid); } catch (e) {}
}

let myDeviceName = localStorage.getItem('seraj_device_name') || '';
let myDevicePrefix = localStorage.getItem('seraj_device_prefix') || '';
const _initialPlanMode = (localStorage.getItem('seraj_plan') || '').toLowerCase();

if (_initialPlanMode === 'offline_single') {
    myDeviceName = myDeviceName || 'الجهاز الرئيسي';
    myDevicePrefix = (myDevicePrefix || 'A').toUpperCase();
    try {
        localStorage.setItem('seraj_device_name', myDeviceName);
        localStorage.setItem('seraj_device_prefix', myDevicePrefix);
    } catch (e) {}
} else if (currentStoreId && (!myDeviceName || !myDevicePrefix)) {
    while (!myDeviceName || myDeviceName.trim() === '') {
        myDeviceName = prompt(`مرحباً بك في (${window.APP_BRAND_CONFIG.appName}) 🛠️\n🛑 إجباري: أدخل اسم هذا الجهاز/الكاشير (مثال: كاشير 1 أو المالك):`);
        if (myDeviceName === null) myDeviceName = 'كاشير 1';
    }
    while (!myDevicePrefix || !/^[a-zA-Z]$/.test(myDevicePrefix.trim())) {
        myDevicePrefix = prompt('🛑 إجباري: أدخل حرف إنجليزي واحد مميز لبادئة فواتير هذا الجهاز (مثال: A أو B أو C):');
        if (myDevicePrefix === null) myDevicePrefix = 'A';
    }
    myDeviceName = myDeviceName.trim();
    myDevicePrefix = myDevicePrefix.trim().toUpperCase();
    try {
        localStorage.setItem('seraj_device_name', myDeviceName);
        localStorage.setItem('seraj_device_prefix', myDevicePrefix);
    } catch (e) {}
}
myDeviceName = myDeviceName || 'كاشير 1';
myDevicePrefix = (myDevicePrefix || 'A').toUpperCase();
window.myDeviceName = myDeviceName;
window.myDevicePrefix = myDevicePrefix;

// =========================================================================
// 2. محرك التخزين العملاق (SerajMegaDB: IndexedDB + RAM Cache + BroadcastChannel)
// - IndexedDB هو المخزن الرئيسي الوحيد للبيانات الثقيلة + RAM Cache للقراءة الفورية (0ms)
// - localStorage للإعدادات الخفيفة فقط (إلغاء اقتطاع 300 عنصر seraj_trimmed_ نهائياً)
// - بوابة await SerajMegaDB.ready قبل تشغيل initCloud أو migrateOldData أو onload
// =========================================================================
const _rawNativeSetItem = localStorage.setItem.bind(localStorage);
const _rawNativeGetItem = localStorage.getItem.bind(localStorage);
const _rawNativeRemoveItem = localStorage.removeItem.bind(localStorage);
let _isInternalSetItem = false;

window._serajRAM = new Map();

// قائمة المفاتيح الثقيلة التي تُحفظ في IndexedDB + RAM فقط ولا تُكتب أبداً في localStorage
const HEAVY_STORAGE_KEYS = new Set([
    'seraj_products',
    'seraj_customers',
    'seraj_suppliers',
    'seraj_customer_vouchers',
    'seraj_supplier_vouchers',
    'seraj_sales_invoices',
    'seraj_purchase_invoices',
    'seraj_treasury_moves',
    'seraj_smart_notes',
    'seraj_sales_returns',
    'seraj_outbox_queue',
    'seraj_outbox_dead_letter',
    'seraj_sync_queue',
    'seraj_delete_queue',
    'seraj_dirty_items',
    'seraj_offline_cert',
    'seraj_bound_device_id',
    'seraj_email_queue',
    'seraj_ai_history'
]);

function _isHeavyStorageKey(key) {
    let k = String(key || '');
    if (HEAVY_STORAGE_KEYS.has(k)) return true;
    if (k.startsWith('seraj_cloud_cache_')) return true;
    if (k.startsWith('seraj_last_sync_ts_')) return true;
    if (k.startsWith('seraj_backup_')) return true;
    return false;
}

// قناة التزامن اللحظي بين التبويبات المفتوحة
let _serajBroadcast = null;
try {
    if ('BroadcastChannel' in window) {
        _serajBroadcast = new BroadcastChannel('seraj_pos_v5_sync');
    }
} catch (e) {
    _serajBroadcast = null;
}

function _broadcastTabChange(type, key, value = null) {
    if (!_serajBroadcast) return;
    try {
        _serajBroadcast.postMessage({
            type: type,
            key: key,
            value: value,
            sender: myDeviceUid,
            ts: Date.now()
        });
    } catch (e) {}
}

window.SerajMegaDB = {
    dbName: 'SerajMegaStorageDB_V5',
    legacyDbName: 'SerajMegaStorageDB',
    storeName: 'kvStore',
    _dbPromise: null,
    _readyResolve: null,
    isReady: false,
    ready: null,

    _initReadyPromise: function() {
        if (!this.ready) {
            this.ready = new Promise((resolve) => {
                this._readyResolve = resolve;
            });
        }
        return this.ready;
    },

    open: function() {
        if (this._dbPromise) return this._dbPromise;
        this._dbPromise = new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) return reject(new Error('IndexedDB not supported'));
            let req = indexedDB.open(this.dbName, 1);
            req.onupgradeneeded = (e) => {
                let db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'k' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
        return this._dbPromise;
    },

    _readLegacyIDB: function() {
        return new Promise((resolve) => {
            if (!('indexedDB' in window)) return resolve([]);
            try {
                let req = indexedDB.open(this.legacyDbName, 1);
                req.onupgradeneeded = (e) => {
                    let db = e.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName, { keyPath: 'k' });
                    }
                };
                req.onsuccess = (e) => {
                    let db = e.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.close();
                        return resolve([]);
                    }
                    try {
                        let tx = db.transaction([this.storeName], 'readonly');
                        let getAllReq = tx.objectStore(this.storeName).getAll();
                        getAllReq.onsuccess = (ev) => {
                            let res = ev.target.result || [];
                            db.close();
                            resolve(res);
                        };
                        getAllReq.onerror = () => { db.close(); resolve([]); };
                    } catch (err) {
                        db.close();
                        resolve([]);
                    }
                };
                req.onerror = () => resolve([]);
            } catch (e) {
                resolve([]);
            }
        });
    },

    set: function(key, strVal) {
        return this.open().then(db => {
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction([this.storeName], 'readwrite');
                    tx.objectStore(this.storeName).put({ k: String(key), v: String(strVal), t: Date.now() });
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        }).catch(() => false);
    },

    setBatch: function(entries) {
        if (!Array.isArray(entries) || entries.length === 0) return Promise.resolve(true);
        return this.open().then(db => {
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction([this.storeName], 'readwrite');
                    let store = tx.objectStore(this.storeName);
                    let now = Date.now();
                    entries.forEach(([k, v]) => {
                        if (k !== undefined && v !== null && v !== undefined) {
                            store.put({ k: String(k), v: String(v), t: now });
                        }
                    });
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        }).catch(() => false);
    },

    get: function(key) {
        return this.open().then(db => {
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction([this.storeName], 'readonly');
                    let req = tx.objectStore(this.storeName).get(String(key));
                    req.onsuccess = (e) => resolve(e.target.result ? e.target.result.v : null);
                    req.onerror = () => resolve(null);
                } catch (e) {
                    resolve(null);
                }
            });
        }).catch(() => null);
    },

    remove: function(key) {
        return this.open().then(db => {
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction([this.storeName], 'readwrite');
                    tx.objectStore(this.storeName).delete(String(key));
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        }).catch(() => false);
    },

    clearAll: function() {
        return this.open().then(db => {
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction([this.storeName], 'readwrite');
                    tx.objectStore(this.storeName).clear();
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        }).catch(() => false);
    },

    // تهيئة الذاكرة وترحيل البيانات الثقيلة من localStorage وقاعدة V4 القديمة إلى V5 IndexedDB
    initAndHydrate: function() {
        this._initReadyPromise();
        window._isHydratingMegaDB = true;
        window._isMegaCacheReady = false;

        // 1. قراءة فورية للإعدادات الخفيفة (وأي بقايا قديمة) من localStorage إلى RAM
        let legacyLocalHeavyEntries = [];
        let keysToStripFromLocal = [];

        try {
            for (let i = 0; i < localStorage.length; i++) {
                let k = localStorage.key(i);
                if (!k) continue;
                // تنظيف أي مفاتيح اقتطاع قديمة seraj_trimmed_ نهائياً
                if (k.startsWith('seraj_trimmed_')) {
                    keysToStripFromLocal.push(k);
                    continue;
                }
                let v = _rawNativeGetItem(k);
                if (v !== null) {
                    window._serajRAM.set(k, v);
                    if (_isHeavyStorageKey(k)) {
                        legacyLocalHeavyEntries.push([k, v]);
                        keysToStripFromLocal.push(k);
                    }
                }
            }
        } catch (e) {
            console.error('RAM Preload Error:', e);
        }

        const finishHydration = () => {
            // تنظيف localStorage من البيانات الثقيلة ومفاتيح الاقتطاع القديمة
            keysToStripFromLocal.forEach(k => {
                try { _rawNativeRemoveItem(k); } catch (e) {}
            });
            window._isHydratingMegaDB = false;
            window._isMegaCacheReady = true;
            this.isReady = true;
            currentStoreId = getActiveStoreId();
            if (typeof this._readyResolve === 'function') {
                this._readyResolve(true);
            }
            window.dispatchEvent(new CustomEvent('seraj:dbReady', { detail: { timestamp: Date.now() } }));
        };

        this.open().then(async (db) => {
            try {
                let records = await new Promise((resolve) => {
                    try {
                        let tx = db.transaction([this.storeName], 'readonly');
                        let req = tx.objectStore(this.storeName).getAll();
                        req.onsuccess = (e) => resolve(e.target.result || []);
                        req.onerror = () => resolve([]);
                    } catch (err) {
                        resolve([]);
                    }
                });

                let v5Map = new Map();
                records.forEach(r => {
                    if (r && r.k && !r.k.startsWith('seraj_trimmed_')) {
                        v5Map.set(r.k, r.v);
                    }
                });

                let toWriteV5 = [];

                // إذا كانت قاعدة V5 جديدة تماماً، ننقل بيانات V4 القديمة من SerajMegaStorageDB مرة واحدة
                if (v5Map.size === 0) {
                    let legacyRecords = await this._readLegacyIDB();
                    legacyRecords.forEach(r => {
                        if (r && r.k && !r.k.startsWith('seraj_trimmed_') && !v5Map.has(r.k)) {
                            v5Map.set(r.k, r.v);
                            toWriteV5.push([r.k, r.v]);
                        }
                    });
                }

                // تحميل كل السجلات الكاملة من IndexedDB إلى RAM (الإصدار الكامل غير المقتطع)
                v5Map.forEach((idbVal, idbKey) => {
                    if (_isHeavyStorageKey(idbKey) || !window._serajRAM.has(idbKey)) {
                        window._serajRAM.set(idbKey, idbVal);
                    }
                });

                // حفظ أي بيانات كانت ما زالت في localStorage ولم تدخل V5 بعد
                legacyLocalHeavyEntries.forEach(([k, v]) => {
                    if (!v5Map.has(k)) {
                        window._serajRAM.set(k, v);
                        toWriteV5.push([k, v]);
                    }
                });

                // نسخ الإعدادات الخفيفة seraj_* أيضاً إلى IndexedDB للأمان
                window._serajRAM.forEach((val, key) => {
                    if (key.startsWith('seraj_') && !key.startsWith('seraj_trimmed_') && !v5Map.has(key)) {
                        toWriteV5.push([key, val]);
                    }
                });

                if (toWriteV5.length > 0) {
                    await this.setBatch(toWriteV5);
                }

                finishHydration();
            } catch (err) {
                console.error('SerajMegaDB Hydration Error:', err);
                finishHydration();
            }
        }).catch((err) => {
            console.error('SerajMegaDB Open Error:', err);
            finishHydration();
        });

        return this.ready;
    }
};

// دالة الحفظ المركزية: البيانات الثقيلة إلى RAM + IndexedDB فقط، والإعدادات الخفيفة إلى localStorage أيضاً
const _origSetItem = function(key, value) {
    let k = String(key);
    let strVal = String(value);

    // منع تخزين أي مفاتيح اقتطاع قديمة أو كاش سحابي في باقة الأوفلاين
    if (k.startsWith('seraj_trimmed_')) return;
    if (k.startsWith('seraj_cloud_cache_') && window.SerajAuth && typeof window.SerajAuth.isOfflineSinglePlan === 'function' && window.SerajAuth.isOfflineSinglePlan()) {
        return;
    }

    if (k === 'seraj_device_name') {
        myDeviceName = strVal || 'كاشير 1';
        window.myDeviceName = myDeviceName;
    } else if (k === 'seraj_device_prefix') {
        myDevicePrefix = (strVal || 'A').toUpperCase();
        window.myDevicePrefix = myDevicePrefix;
    }

    window._serajRAM.set(k, strVal);

    if (k.startsWith('seraj_')) {
        window.SerajMegaDB.set(k, strVal);
    }

    if (_isHeavyStorageKey(k)) {
        // البيانات الثقيلة لا تُكتب أبداً في localStorage لمنع QuotaExceededError والقص العشوائي
        try { _rawNativeRemoveItem(k); } catch (e) {}
        _broadcastTabChange('kv_update', k, strVal);
        return;
    }

    // الإعدادات الخفيفة فقط تُكتب في localStorage
    try {
        _rawNativeSetItem(k, strVal);
    } catch (quotaErr) {
        console.warn('localStorage light write warning for key:', k, quotaErr);
    }
    _broadcastTabChange('kv_update', k, strVal);
};

// توجيه كتابة وقراءة وحذف localStorage لتمر عبر الرامات اللحظية + IndexedDB بدون تضارب
localStorage.setItem = _origSetItem;

localStorage.getItem = function(key) {
    let k = String(key);
    if (window._serajRAM && window._serajRAM.has(k)) {
        return window._serajRAM.get(k);
    }
    if (_isHeavyStorageKey(k)) return null;
    return _rawNativeGetItem(k);
};

localStorage.removeItem = function(key) {
    let k = String(key);
    if (window._serajRAM) window._serajRAM.delete(k);
    if (k.startsWith('seraj_') && window.SerajMegaDB) {
        window.SerajMegaDB.remove(k);
    }
    try { _rawNativeRemoveItem(k); } catch (e) {}
    _broadcastTabChange('kv_remove', k, null);
};

function _internalSetItem(key, value) {
    _isInternalSetItem = true;
    try {
        _origSetItem(key, value);
    } finally {
        _isInternalSetItem = false;
    }
}

// استقبال التحديثات اللحظية من التبويبات الأخرى (BroadcastChannel + storage event)
if (_serajBroadcast) {
    _serajBroadcast.onmessage = (event) => {
        let msg = event.data;
        if (!msg || msg.sender === myDeviceUid) return;
        if (msg.type === 'reload_required') {
            window.location.reload();
            return;
        }
        if (msg.type === 'kv_update' && msg.key) {
            window._serajRAM.set(msg.key, msg.value);
            let col = msg.key.replace(/^seraj_/, '');
            if (typeof emitSerajUpdate === 'function') {
                emitSerajUpdate(col, 'tab');
            }
        } else if (msg.type === 'kv_remove' && msg.key) {
            window._serajRAM.delete(msg.key);
            let col = msg.key.replace(/^seraj_/, '');
            if (typeof emitSerajUpdate === 'function') {
                emitSerajUpdate(col, 'tab');
            }
        }
    };
}

window.addEventListener('storage', (event) => {
    if (!event.key || event.key.startsWith('seraj_trimmed_')) return;
    if (event.newValue === null) {
        window._serajRAM.delete(event.key);
    } else {
        window._serajRAM.set(event.key, event.newValue);
    }
    if (['seraj_user_role', 'seraj_role_sig', 'seraj_store_id', 'seraj_plan', 'seraj_offline_cert'].includes(event.key)) {
        if (window.SerajAuth && typeof window.SerajAuth.applyRoleGuards === 'function') {
            window.SerajAuth.applyRoleGuards();
        }
    }
    let col = event.key.replace(/^seraj_/, '');
    if (typeof emitSerajUpdate === 'function') {
        emitSerajUpdate(col, 'tab');
    }
});

// بدء تهيئة وقراءة IndexedDB فوراً
window.SerajMegaDB.initAndHydrate();

// =========================================================================
// 3. محرك الصوت المركزي المشترك (_serajAudioCtx - بدون ملفات WAV مبتورة)
// =========================================================================
let _serajAudioCtx = null;

window.SerajAudio = {
    getContext: function() {
        try {
            let AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return null;
            if (!_serajAudioCtx || _serajAudioCtx.state === 'closed') {
                _serajAudioCtx = new AudioCtx();
            }
            if (_serajAudioCtx.state === 'suspended') {
                _serajAudioCtx.resume().catch(() => {});
            }
            return _serajAudioCtx;
        } catch (e) {
            return null;
        }
    },

    beep: function(freq = 880, durationSec = 0.12, type = 'sine', volume = 0.25) {
        try {
            let ctx = this.getContext();
            if (!ctx) return;
            let now = ctx.currentTime;
            let osc = ctx.createOscillator();
            let gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + durationSec);
        } catch (e) {}
    },

    playBarcodeBeep: function() {
        this.beep(1200, 0.09, 'square', 0.16);
    },

    playSuccess: function() {
        try {
            let ctx = this.getContext();
            if (!ctx) return;
            let now = ctx.currentTime;
            const tone = (f, t, d) => {
                let osc = ctx.createOscillator();
                let g = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, t);
                g.gain.setValueAtTime(0.22, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + d);
                osc.connect(g);
                g.connect(ctx.destination);
                osc.start(t);
                osc.stop(t + d);
            };
            tone(587.33, now, 0.14);
            tone(880.00, now + 0.15, 0.24);
        } catch (e) {}
    },

    playError: function() {
        this.beep(220, 0.25, 'sawtooth', 0.2);
    }
};

function playSmartNoteTone() {
    window.SerajAudio.playSuccess();
}

// =========================================================================
// 4. محرك إدارة النوافذ والرجوع والميديا (SerajUI - بدون Ghost History + حماية اللمس)
// =========================================================================
window.SerajUI = {
    _modalStack: [],
    _mediaStoppers: new Map(),
    _isHandlingPop: false,
    _ignoringBackCount: 0,
    _clickShieldUntil: 0,
    _clickShieldBound: false,

    armClickShield: function(durationMs = 420) {
        let until = Date.now() + Math.max(150, Number(durationMs) || 420);
        if (until > this._clickShieldUntil) this._clickShieldUntil = until;
        if (!this._clickShieldBound && typeof document !== 'undefined') {
            this._clickShieldBound = true;
            document.addEventListener('click', (ev) => {
                if (Date.now() < this._clickShieldUntil) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (typeof ev.stopImmediatePropagation === 'function') {
                        ev.stopImmediatePropagation();
                    }
                }
            }, true);
        }
    },

    registerMediaStopper: function(key, stopFn) {
        if (key && typeof stopFn === 'function') {
            this._mediaStoppers.set(String(key), stopFn);
        }
    },

    unregisterMediaStopper: function(key) {
        this._mediaStoppers.delete(String(key));
    },

    stopAllMedia: function() {
        this._mediaStoppers.forEach((fn) => {
            try { fn(); } catch (e) {}
        });
    },

    openModal: function(modalOrId, options = {}) {
        let el = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
        if (!el) return false;
        let id = el.id || ('modal_' + Date.now());
        if (!el.id) el.id = id;

        // منع التكرار في المكدس (لا Ghost History)
        if (this._modalStack.some(m => m.id === id)) {
            el.style.display = options.display || 'flex';
            return true;
        }

        el.style.display = options.display || 'flex';
        let entry = {
            id: id,
            el: el,
            onClose: typeof options.onClose === 'function' ? options.onClose : null,
            removeOnClose: Boolean(options.removeOnClose),
            stopMediaOnClose: options.stopMediaOnClose !== false,
            pushedHistory: false
        };

        if (options.useHistory !== false && window.history && typeof window.history.pushState === 'function') {
            try {
                window.history.pushState({ serajModalId: id, ts: Date.now() }, '', window.location.href);
                entry.pushedHistory = true;
            } catch (e) {}
        }

        this._modalStack.push(entry);
        this.armClickShield(360);
        return true;
    },

    closeModal: function(modalOrId = null, fromPopState = false) {
        if (this._modalStack.length === 0) {
            if (modalOrId) {
                let fallbackEl = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
                if (fallbackEl) fallbackEl.style.display = 'none';
            }
            return false;
        }

        let idx = this._modalStack.length - 1;
        if (modalOrId) {
            let targetId = typeof modalOrId === 'string' ? modalOrId : modalOrId.id;
            let foundIdx = this._modalStack.findIndex(m => m.id === targetId);
            if (foundIdx === -1) {
                let fallbackEl = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
                if (fallbackEl) fallbackEl.style.display = 'none';
                return false;
            }
            idx = foundIdx;
        }

        let entry = this._modalStack.splice(idx, 1)[0];
        if (!entry) return false;

        if (entry.stopMediaOnClose) {
            this.stopAllMedia();
        }

        if (entry.el) {
            if (entry.removeOnClose && entry.el.parentNode) {
                entry.el.parentNode.removeChild(entry.el);
            } else {
                entry.el.style.display = 'none';
            }
        }

        if (typeof entry.onClose === 'function') {
            try { entry.onClose(); } catch (e) {}
        }

        // سحب حالة History النظيفة عند الإغلاق من الزر (وليس من زر الرجوع بالموبايل)
        if (!fromPopState && entry.pushedHistory && window.history && window.history.state && window.history.state.serajModalId === entry.id) {
            this._ignoringBackCount++;
            try {
                window.history.back();
            } catch (e) {
                this._ignoringBackCount = Math.max(0, this._ignoringBackCount - 1);
            }
        }
        this.armClickShield(360);
        return true;
    },

    // حارس اللمس لمنع تكرار الضغط واختراق الضغطة (Ghost Click) والاختيار أثناء التمرير
    bindSafeTap: function(element, handler, cooldownMs = 380) {
        if (!element || typeof handler !== 'function') return;
        let lastFire = 0;
        let startX = 0;
        let startY = 0;
        let isDown = false;
        let moved = false;

        const wrapped = (e) => {
            let now = Date.now();
            if (now - lastFire < cooldownMs) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            lastFire = now;
            this.armClickShield(Math.max(400, cooldownMs));
            handler(e);
        };

        if (window.PointerEvent) {
            element.addEventListener('pointerdown', (e) => {
                if (e.button !== undefined && e.button !== 0) return;
                startX = e.clientX;
                startY = e.clientY;
                isDown = true;
                moved = false;
            });
            element.addEventListener('pointermove', (e) => {
                if (!isDown) return;
                if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) {
                    moved = true;
                }
            });
            element.addEventListener('pointercancel', () => {
                isDown = false;
                moved = true;
            });
            element.addEventListener('pointerup', (e) => {
                if (!isDown || moved || (e.button !== undefined && e.button !== 0)) {
                    isDown = false;
                    return;
                }
                isDown = false;
                e.preventDefault();
                e.stopPropagation();
                wrapped(e);
            });
            element.addEventListener('click', (e) => {
                if (Date.now() - lastFire < cooldownMs || Date.now() < this._clickShieldUntil) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        } else {
            element.addEventListener('click', wrapped);
        }
    }
};

window.addEventListener('popstate', () => {
    if (window.SerajUI._ignoringBackCount > 0) {
        window.SerajUI._ignoringBackCount--;
        return;
    }
    // إغلاق الكاميرا والمايك تلقائياً عند أي رجوع
    window.SerajUI.stopAllMedia();
    if (window.SerajUI._modalStack.length > 0) {
        window.SerajUI.closeModal(null, true);
    }
});

window.addEventListener('pagehide', () => {
    window.SerajUI.stopAllMedia();
});

// =========================================================================
// 5. شريط حالة السحابة والأدوات المركزية (Utils - بدون أي تلوث لـ Number.prototype)
// =========================================================================
function showCloudStatus(msg) {
    if (!document.body) return;
    let el = document.getElementById('cloud-sync-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'cloud-sync-status';
        el.style.cssText = 'position:fixed; bottom:15px; left:15px; background:var(--bg-dark-2, #0b0d1e); color:var(--neon-border, #00ff66); padding:8px 16px; border-radius:20px; font-size:14px; font-weight:bold; z-index:99999; border:1px solid var(--neon-border, #00ff66); pointer-events:none; transition:opacity 0.3s ease;';
        document.body.appendChild(el);
    }
    el.style.opacity = '1';
    el.textContent = String(msg || '');
    if (el._hideTimer) clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.opacity = '0'; }, 4000);
}

const _buttonLocks = new WeakSet();

function safeParseJSON(str, fallback = []) {
    if (str === null || str === undefined || str === '') return fallback;
    if (typeof str === 'object') return str;
    try {
        let parsed = JSON.parse(str);
        return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
        console.error('JSON Parse Error:', e);
        return fallback;
    }
}

function _stripComputedFieldsForDiff(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    let copy = { ...obj };
    delete copy.computedRemaining;
    delete copy.calculatedRemaining;
    delete copy._lastModified;
    delete copy.balance;
    delete copy.calculatedBalance;
    delete copy.netBalanceVal;
    delete copy.isNetDebt;
    delete copy.deferredInvoicesTotal;
    delete copy.displayCurrentBalance;
    delete copy.isCurrentBalDebt;
    delete copy.isZeroCustomer;
    delete copy.isZeroBalance;
    delete copy.isZeroIdle;
    delete copy.isIdleZero;
    return copy;
}

window.Utils = {
    // التقريب المركزي الدقيق وإلغاء الفواصل الشبحية
    round2: function(val) {
        let num = parseFloat(val);
        if (!isFinite(num) || isNaN(num)) return 0;
        let res = Math.round((num + Number.EPSILON) * 100) / 100;
        return Math.abs(res) < 0.0001 ? 0 : res;
    },

    round4: function(val) {
        let num = parseFloat(val);
        if (!isFinite(num) || isNaN(num)) return 0;
        let res = Math.round((num + Number.EPSILON) * 10000) / 10000;
        return Math.abs(res) < 0.00001 ? 0 : res;
    },

    isNonZeroStock: function(stock) {
        let num = parseFloat(stock);
        if (!isFinite(num) || isNaN(num)) return false;
        return Math.abs(num) > 0.0001;
    },

    formatCurrency: function(amount) {
        return this.round2(amount).toFixed(2);
    },

    debounce: function(fn, delay = 220) {
        let timer = null;
        return function(...args) {
            const context = this;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                fn.apply(context, args);
            }, delay);
        };
    },

    normalizeName: function(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .toLowerCase();
    },

    fastSearch: function(list, query, keys = ['name', 'phone', 'id', 'barcode', 'code', 'customer', 'supplier', 'notes'], limit = 0) {
        if (!Array.isArray(list)) return [];
        let normQ = this.normalizeName(query);
        if (!normQ) return limit > 0 ? list.slice(0, limit) : list;

        let tokens = normQ.split(' ').filter(Boolean);
        let results = [];

        for (let i = 0; i < list.length; i++) {
            let item = list[i];
            if (!item) continue;

            let hay = item._searchIndex;
            if (!hay || item._searchIndexMod !== item._lastModified) {
                let parts = [];
                for (let k = 0; k < keys.length; k++) {
                    let val = item[keys[k]];
                    if (val !== undefined && val !== null && val !== '') {
                        parts.push(this.normalizeName(val));
                    }
                }
                hay = parts.join(' ');
                try {
                    Object.defineProperty(item, '_searchIndex', { value: hay, writable: true, configurable: true, enumerable: false });
                    Object.defineProperty(item, '_searchIndexMod', { value: item._lastModified, writable: true, configurable: true, enumerable: false });
                } catch (e) {}
            }

            let matched = true;
            for (let t = 0; t < tokens.length; t++) {
                if (!hay.includes(tokens[t])) {
                    matched = false;
                    break;
                }
            }
            if (matched) {
                results.push(item);
                if (limit > 0 && results.length >= limit) break;
            }
        }
        return results;
    },

    // تعقيم 100% ضد XSS لكل مدخلات innerHTML
    sanitizeHTML: function(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
    },

    // تعقيم HTML التقارير قبل المعاينة/الطباعة في PDF مع الحفاظ على التنسيق وألوان الديون
    sanitizeRichHTML: function(htmlStr) {
        if (!htmlStr) return '';
        try {
            let tpl = document.createElement('template');
            tpl.innerHTML = String(htmlStr);
            let forbidden = tpl.content.querySelectorAll('script, iframe, object, embed, link, meta, base, form');
            forbidden.forEach(node => node.remove());

            let allEls = tpl.content.querySelectorAll('*');
            allEls.forEach(el => {
                Array.from(el.attributes).forEach(attr => {
                    let n = attr.name.toLowerCase();
                    let v = String(attr.value || '').trim().toLowerCase();
                    if (n.startsWith('on') || n === 'srcdoc') {
                        el.removeAttribute(attr.name);
                    } else if ((n === 'href' || n === 'src' || n === 'xlink:href') && (v.startsWith('javascript:') || v.startsWith('vbscript:'))) {
                        el.removeAttribute(attr.name);
                    }
                });
            });
            return tpl.innerHTML;
        } catch (e) {
            return this.sanitizeHTML(String(htmlStr));
        }
    },

    // التاريخ المحلي القياسي YYYY-MM-DD (بدون أخطاء UTC)
    getLocalDateString: function(dateInput = null) {
        let d;
        if (dateInput instanceof Date) {
            d = dateInput;
        } else if (typeof dateInput === 'number' && dateInput > 0) {
            d = new Date(dateInput);
        } else if (typeof dateInput === 'string' && dateInput.trim() !== '') {
            let clean = dateInput.replace(/[٠-٩]/g, x => '٠١٢٣٤٥٦٧٨٩'.indexOf(x)).trim();
            let exactIso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (exactIso) return `${exactIso[1]}-${exactIso[2]}-${exactIso[3]}`;
            let ms = this.getSafeTime(clean);
            d = ms > 0 ? new Date(ms) : new Date();
        } else {
            d = new Date();
        }
        if (isNaN(d.getTime())) d = new Date();
        let y = d.getFullYear();
        let m = String(d.getMonth() + 1).padStart(2, '0');
        let day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    toLocalISODate: function(dateInput = null) {
        return this.getLocalDateString(dateInput);
    },

    // إرجاع نطاق الشهر الماضي بأمان حتى في يوم 31 من الشهر
    getLastMonthRange: function(refDate = new Date()) {
        let y = refDate.getFullYear();
        let m = refDate.getMonth();
        let start = new Date(y, m - 1, 1);
        let end = new Date(y, m, 0);
        return {
            start: this.getLocalDateString(start),
            end: this.getLocalDateString(end),
            startDate: start,
            endDate: end
        };
    },

    normalizeDateStr: function(dateVal, fallbackTs = null) {
        if (dateVal) {
            let clean = String(dateVal)
                .replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
                .trim();
            let isoMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
            if (isoMatch && !clean.includes('T')) {
                let y = isoMatch[1];
                let m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
                let d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            let dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (dmyMatch) {
                let d = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
                let m = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
                let y = dmyMatch[3];
                return `${y}-${m}-${d}`;
            }
            let ms = this.getSafeTime(clean);
            if (ms > 0) return this.getLocalDateString(ms);
        }
        if (fallbackTs) {
            let ms = this.getSafeTime(fallbackTs);
            if (ms > 0) return this.getLocalDateString(ms);
        }
        return this.getLocalDateString();
    },

    alignTimestampWithDate: function(dateStr, currentTs = null) {
        let now = Date.now();
        let rawTs = Number(currentTs);
        let baseTs = (!isNaN(rawTs) && rawTs > 0) ? rawTs : now;
        let normalizedDate = this.normalizeDateStr(dateStr, baseTs);
        let baseDateStr = this.getLocalDateString(baseTs);

        if (normalizedDate === baseDateStr) return baseTs;

        let parts = normalizedDate.split('-');
        if (parts.length === 3) {
            let refDate = new Date(baseTs);
            if (isNaN(refDate.getTime())) refDate = new Date(now);
            let aligned = new Date(
                parseInt(parts[0], 10),
                parseInt(parts[1], 10) - 1,
                parseInt(parts[2], 10),
                refDate.getHours(),
                refDate.getMinutes(),
                refDate.getSeconds(),
                refDate.getMilliseconds()
            ).getTime();
            if (!isNaN(aligned) && aligned > 0) return aligned;
        }
        return baseTs;
    },

    syncDateAndTimestamp: function(dateInput, tsInput) {
        let normDate = this.normalizeDateStr(dateInput, tsInput);
        let alignedTs = this.alignTimestampWithDate(normDate, tsInput);
        return { date: normDate, timestamp: alignedTs };
    },

    getSafeTime: function(dateVal) {
        if (!dateVal) return 0;
        if (typeof dateVal === 'number') return isNaN(dateVal) ? 0 : dateVal;
        if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? 0 : dateVal.getTime();
        let clean = String(dateVal)
            .replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .trim();
        if (!clean) return 0;

        let ymdOnly = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (ymdOnly) {
            return new Date(parseInt(ymdOnly[1], 10), parseInt(ymdOnly[2], 10) - 1, parseInt(ymdOnly[3], 10), 12, 0, 0).getTime() || 0;
        }

        let dmyOnly = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmyOnly) {
            return new Date(parseInt(dmyOnly[3], 10), parseInt(dmyOnly[2], 10) - 1, parseInt(dmyOnly[1], 10), 12, 0, 0).getTime() || 0;
        }

        let parsed = Date.parse(clean);
        if (!isNaN(parsed)) return parsed;

        let parts = clean.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
        if (parts) {
            let p1 = parseInt(parts[1], 10), p2 = parseInt(parts[2], 10), p3 = parseInt(parts[3], 10);
            if (p1 > 1000) return new Date(p1, p2 - 1, p3, 12, 0, 0).getTime() || 0;
            if (p3 > 1000) return new Date(p3, p2 - 1, p1, 12, 0, 0).getTime() || 0;
        }
        return 0;
    },

    formatDate: function(timestamp) {
        if (!timestamp) return '';
        let time = this.getSafeTime(timestamp) || timestamp;
        let d = new Date(time);
        if (isNaN(d.getTime())) return String(timestamp);
        return d.toLocaleDateString('ar-EG') + ' ' + d.toLocaleTimeString('ar-EG');
    },

    extractSerialNum: function(idVal) {
        if (idVal === undefined || idVal === null) return 0;
        if (typeof idVal === 'number') return isNaN(idVal) ? 0 : idVal;
        let str = String(idVal).trim();
        let n = Number(str);
        if (!isNaN(n)) return n;
        let parts = str.split('-');
        if (parts.length > 1) {
            let tail = parseInt(parts[parts.length - 1].replace(/\D/g, ''), 10);
            if (!isNaN(tail)) return tail;
        }
        let digits = parseInt(str.replace(/\D/g, ''), 10);
        return isNaN(digits) ? 0 : digits;
    },

    extractSerialNumber: function(idVal) {
        return this.extractSerialNum(idVal);
    },

    // مفتاح سحابي فريد (UUID) لكل مستند لمنع التصادم نهائياً بين الأجهزة
    generateUUID: function(prefix = '') {
        let uid = '';
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            uid = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        } else {
            uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
        }
        return prefix ? `${prefix}_${uid}` : uid;
    },

    sanitizeEntityId: function(rawId) {
        if (rawId === undefined || rawId === null || rawId === '') {
            return this.generateUniqueId();
        }
        let str = String(rawId).trim();
        if (str.includes('.')) str = str.replace(/\./g, '');
        return str.replace(/[#$\[\]\/\\]/g, '_');
    },

    // توليد رقم فاتورة معروض مفصول بوضوح: S-A-100 للبيع و P-A-100 للشراء
    generateInvoiceId: function(type = 'sales') {
        let devPrefix = String(localStorage.getItem('seraj_device_prefix') || myDevicePrefix || 'A').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'A';
        let typeKey = (type === 'sales') ? 'sales' : 'purchases';
        let domainTag = (typeKey === 'sales') ? 'S' : 'P';

        let counters = safeParseJSON(localStorage.getItem('seraj_invoice_counters'), { sales: {}, purchases: {} });
        let savedMax = parseInt(counters[typeKey]?.[devPrefix], 10);
        let maxNum = (!isNaN(savedMax) && savedMax >= 99) ? savedMax : 99;

        const scanInvNo = (invNoRaw) => {
            let s = String(invNoRaw || '').trim().toUpperCase();
            if (!s) return;
            let matchNew = s.match(new RegExp(`^${domainTag}-${devPrefix}-(\\d+)$`));
            if (matchNew) {
                let n = parseInt(matchNew[1], 10);
                if (!isNaN(n) && n > maxNum) maxNum = n;
                return;
            }
            let matchOld = s.match(new RegExp(`^${devPrefix}-(\\d+)$`));
            if (matchOld) {
                let n = parseInt(matchOld[1], 10);
                if (!isNaN(n) && n > maxNum) maxNum = n;
            }
        };

        try {
            let invoices = typeKey === 'sales'
                ? safeParseJSON(localStorage.getItem('seraj_sales_invoices'), [])
                : safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []);
            invoices.forEach(inv => {
                if (inv) {
                    scanInvNo(inv.invoiceNo);
                    scanInvNo(inv.id);
                }
            });
        } catch (e) {}

        try {
            let moves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
            let targetTypes = typeKey === 'sales' ? ['sales', 'return_sale'] : ['purchase', 'return_purchase'];
            moves.forEach(m => {
                if (m && targetTypes.includes(m.type)) scanInvNo(m.invoiceNo);
            });
        } catch (e) {}

        let nextNum = maxNum + 1;

        if (window.DB && typeof window.DB._mergeInvoiceCounters === 'function') {
            let patch = {};
            patch[typeKey] = {};
            patch[typeKey][devPrefix] = nextNum;
            window.DB._mergeInvoiceCounters(patch, true);
        } else {
            if (!counters[typeKey] || typeof counters[typeKey] !== 'object') counters[typeKey] = {};
            counters[typeKey][devPrefix] = nextNum;
            _internalSetItem('seraj_invoice_counters', JSON.stringify(counters));
        }

        return `${domainTag}-${devPrefix}-${nextNum}`;
    },

    _seqInitialized: false,
    generateUniqueId: function(prefix = '') {
        let lastSeq = parseInt(localStorage.getItem('seraj_short_seq_id') || '1000', 10);
        if (isNaN(lastSeq) || lastSeq < 1000) lastSeq = 1000;

        if (!this._seqInitialized) {
            this._seqInitialized = true;
            try {
                const checkMax = (arr) => {
                    if (!Array.isArray(arr)) return;
                    arr.forEach(item => {
                        if (!item) return;
                        let numId = parseInt(String(item.id || '').replace(/\D/g, ''), 10);
                        if (!isNaN(numId) && numId >= 1000 && numId < 100000000 && numId > lastSeq) {
                            lastSeq = numId;
                        }
                    });
                };
                checkMax(safeParseJSON(localStorage.getItem('seraj_products'), []));
                checkMax(safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []));
                checkMax(safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []));
                checkMax(safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []));
                checkMax(safeParseJSON(localStorage.getItem('seraj_customers'), []));
                checkMax(safeParseJSON(localStorage.getItem('seraj_suppliers'), []));
                checkMax(safeParseJSON(localStorage.getItem('seraj_customer_vouchers'), []));
                checkMax(safeParseJSON(localStorage.getItem('seraj_supplier_vouchers'), []));
            } catch (e) {}
        }

        let devPrefix = String(localStorage.getItem('seraj_device_prefix') || myDevicePrefix || 'A')
            .trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'A';
        let nextSeq = lastSeq + 1;
        _internalSetItem('seraj_short_seq_id', String(nextSeq));
        return prefix ? `${prefix}${devPrefix}${nextSeq}` : `${devPrefix}${nextSeq}`;
    },

    // =========================================================================
    // 📄 محرك معاينة ومشاركة PDF الموحد (تعقيم XSS، الحفاظ على ألوان الديون، عرض 794px، Pagebreak)
    // =========================================================================
    downloadRealPDF: function(htmlOrElement, fileName = 'report.pdf') {
        return new Promise((resolve) => {
            let cleanFileName = String(fileName || 'report.pdf').trim().replace(/[\\/:*?"<>|]/g, '_');
            if (!cleanFileName.toLowerCase().endsWith('.pdf')) cleanFileName += '.pdf';

            let rawHtmlContent = '';
            if (typeof htmlOrElement === 'string') {
                let trimmed = htmlOrElement.trim();
                let byId = !trimmed.includes('<') ? document.getElementById(trimmed.replace(/^#/, '')) : null;
                if (byId) {
                    rawHtmlContent = (byId.tagName === 'TABLE') ? byId.outerHTML : byId.innerHTML;
                } else {
                    rawHtmlContent = htmlOrElement;
                }
            } else if (htmlOrElement instanceof Element) {
                rawHtmlContent = (htmlOrElement.tagName === 'TABLE') ? htmlOrElement.outerHTML : htmlOrElement.innerHTML;
            } else {
                rawHtmlContent = document.body.innerHTML;
            }

            // تعقيم محتوى الـ PDF ضد أي كود خبيث مع الإبقاء على الجداول وألوان الديون
            let safeHtmlContent = this.sanitizeRichHTML(rawHtmlContent);

            let oldModal = document.getElementById('seraj-pdf-preview-modal');
            if (oldModal && oldModal.parentNode) oldModal.parentNode.removeChild(oldModal);

            // حقن تنسيقات الورقة البيضاء بدون !important على color في الخلايا لحفظ ألوان الديون (أحمر/أخضر)
            if (!document.getElementById('seraj-pdf-paper-styles')) {
                let styleTag = document.createElement('style');
                styleTag.id = 'seraj-pdf-paper-styles';
                styleTag.textContent = `
                    .seraj-pdf-paper-sheet, .seraj-pdf-paper-sheet * {
                        box-sizing: border-box;
                        font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
                        text-shadow: none !important;
                        box-shadow: none !important;
                    }
                    .seraj-pdf-paper-sheet {
                        background-color: #ffffff;
                        color: #000000;
                        direction: rtl;
                        width: 794px;
                        max-width: 100%;
                    }
                    .seraj-pdf-paper-sheet table {
                        width: 100%;
                        border-collapse: collapse;
                        background-color: #ffffff;
                        border: 2px solid #000000;
                        border-radius: 0;
                        margin: 12px 0;
                    }
                    .seraj-pdf-paper-sheet thead { display: table-header-group; }
                    .seraj-pdf-paper-sheet tr { page-break-inside: avoid; break-inside: avoid; }
                    .seraj-pdf-paper-sheet th {
                        background-color: #e2e8f0;
                        color: #000000;
                        border: 1px solid #000000;
                        padding: 8px 6px;
                        font-size: 14px;
                        font-weight: bold;
                        text-align: center;
                    }
                    .seraj-pdf-paper-sheet td {
                        background-color: #ffffff;
                        color: inherit;
                        border: 1px solid #333333;
                        padding: 8px 6px;
                        font-size: 14px;
                        font-weight: bold;
                        text-align: center;
                    }
                    .seraj-pdf-paper-sheet .val-red, .seraj-pdf-paper-sheet .text-danger, .seraj-pdf-paper-sheet .color-red-val { color: #dc2626 !important; }
                    .seraj-pdf-paper-sheet .val-green, .seraj-pdf-paper-sheet .text-success, .seraj-pdf-paper-sheet .color-green-val { color: #16a34a !important; }
                `;
                document.head.appendChild(styleTag);
            }

            let storeSettings = (window.DB && typeof window.DB.getStoreSettings === 'function')
                ? window.DB.getStoreSettings()
                : { shopName: window.APP_BRAND_CONFIG.appName };
            let shopDisplayName = storeSettings.shopName || window.APP_BRAND_CONFIG.appName;
            let displayDocTitle = cleanFileName.replace(/\.pdf$/i, '').replace(/_/g, ' ');

            let modal = document.createElement('div');
            modal.id = 'seraj-pdf-preview-modal';
            modal.style.cssText = 'position:fixed; inset:0; width:100%; height:100vh; height:100dvh; background:rgba(7,9,19,0.96); z-index:999999; display:none; flex-direction:column; direction:rtl;';

            modal.innerHTML = `
                <div style="background:#0b0d1e; border-bottom:2px solid var(--neon-border, #0ea5e9); padding:12px 16px; display:flex; justify-content:space-between; align-items:center; color:#fff; flex-shrink:0;">
                    <span style="font-size:17px; font-weight:bold;">📄 معاينة المستند قبل المشاركة</span>
                    <button type="button" id="seraj-pdf-close-top" style="background:#ef4444; color:#fff; border:none; border-radius:8px; padding:6px 14px; font-weight:bold; font-size:15px; cursor:pointer;">✖ إغلاق</button>
                </div>
                <div id="seraj-pdf-scroll-area" style="flex:1; min-height:0; overflow:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; padding:12px 8px; display:block;">
                    <div id="seraj-pdf-scale-frame" style="margin:0 auto; overflow:hidden;">
                        <div id="seraj-pdf-preview-sheet" class="seraj-pdf-paper-sheet" style="width:794px; max-width:none; background:#ffffff; color:#000000; padding:22px; border-radius:8px; transform-origin:top right;">
                            ${safeHtmlContent}
                        </div>
                    </div>
                </div>
                <div style="background:#0b0d1e; border-top:2px solid var(--neon-border, #0ea5e9); padding:12px 15px max(12px, env(safe-area-inset-bottom)) 15px; display:flex; gap:10px; justify-content:center; align-items:center; flex-shrink:0;">
                    <button type="button" id="seraj-pdf-share-btn" style="flex:2; background:#10b981; color:#000; border:none; border-radius:12px; padding:12px; font-size:15px; font-weight:bold; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:6px;">
                        ⏳ جاري تجهيز الملف...
                    </button>
                    <button type="button" id="seraj-pdf-print-btn" style="flex:1; background:#0ea5e9; color:#fff; border:none; border-radius:12px; padding:12px; font-size:14px; font-weight:bold; cursor:pointer;">
                        🖨️ طباعة A4
                    </button>
                </div>
            `;

            document.body.appendChild(modal);

            const fitPreviewSheetToViewport = () => {
                let scrollArea = modal.querySelector('#seraj-pdf-scroll-area');
                let scaleFrame = modal.querySelector('#seraj-pdf-scale-frame');
                let previewSheet = modal.querySelector('#seraj-pdf-preview-sheet');
                if (!scrollArea || !scaleFrame || !previewSheet) return;
                let availW = Math.max(280, (scrollArea.clientWidth || window.innerWidth) - 16);
                let scale = Math.min(1, availW / 794);
                previewSheet.style.transform = scale < 0.999 ? `scale(${scale})` : 'none';
                scaleFrame.style.width = Math.round(794 * scale) + 'px';
                let naturalH = previewSheet.scrollHeight || previewSheet.offsetHeight || 600;
                scaleFrame.style.height = Math.ceil(naturalH * scale) + 'px';
            };
            requestAnimationFrame(() => setTimeout(fitPreviewSheetToViewport, 40));

            let readyPdfBlob = null;
            let readyPdfFile = null;
            let isGenerating = false;

            const finalizeClose = () => {
                resolve(true);
            };

            window.SerajUI.openModal(modal, {
                display: 'flex',
                removeOnClose: true,
                onClose: finalizeClose
            });

            modal.querySelector('#seraj-pdf-close-top').onclick = () => {
                window.SerajUI.closeModal(modal);
            };

            modal.querySelector('#seraj-pdf-print-btn').onclick = () => {
                const safeTitle = window.Utils.sanitizeHTML(cleanFileName);
                const printDocHtml = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${safeTitle}</title><style>@page{size:A4 portrait;margin:10mm;}body{font-family:Tahoma,Arial,sans-serif;direction:rtl;padding:10px;color:#000;background:#fff;}table{width:100%;border-collapse:collapse;margin-top:10px;}thead{display:table-header-group;}tr{page-break-inside:avoid;}th{background:#e2e8f0;color:#000;border:1px solid #000;padding:8px;text-align:center;}td{border:1px solid #333;padding:8px;text-align:center;}.val-red,.text-danger{color:#dc2626 !important;}.val-green,.text-success{color:#16a34a !important;}</style></head><body>${safeHtmlContent}</body></html>`;
                try {
                    let iframe = document.createElement('iframe');
                    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
                    document.body.appendChild(iframe);
                    let iDoc = iframe.contentWindow.document;
                    iDoc.open();
                    iDoc.write(printDocHtml);
                    iDoc.close();
                    setTimeout(() => {
                        try {
                            iframe.contentWindow.focus();
                            iframe.contentWindow.print();
                        } finally {
                            setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 1500);
                        }
                    }, 300);
                } catch (err) {
                    console.error('A4 Print Error:', err);
                }
            };

            const buildPdfInMemory = () => {
                if (isGenerating || typeof window.html2pdf !== 'function') return;
                isGenerating = true;
                let shareBtn = modal.querySelector('#seraj-pdf-share-btn');
                let previewSheet = modal.querySelector('#seraj-pdf-preview-sheet');
                if (!previewSheet) return;

                let offscreenHost = document.createElement('div');
                offscreenHost.style.cssText = 'position:fixed; inset:0; overflow:hidden; opacity:0; pointer-events:none; z-index:-1;';
                let cloneSheet = previewSheet.cloneNode(true);
                cloneSheet.removeAttribute('id');
                cloneSheet.style.cssText = 'width:794px; max-width:none; background:#ffffff; color:#000000; padding:22px; transform:none;';
                offscreenHost.appendChild(cloneSheet);
                document.body.appendChild(offscreenHost);

                const removeClone = () => {
                    try {
                        if (offscreenHost && offscreenHost.parentNode) offscreenHost.parentNode.removeChild(offscreenHost);
                    } catch (e) {}
                };

                let opt = {
                    margin: [8, 8, 8, 8],
                    filename: cleanFileName,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        scrollX: 0,
                        scrollY: 0,
                        windowWidth: 794
                    },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                };

                setTimeout(() => {
                    window.html2pdf().set(opt).from(cloneSheet).toPdf().get('pdf').then((pdf) => {
                        removeClone();
                        readyPdfBlob = pdf.output('blob');
                        try {
                            readyPdfFile = new File([readyPdfBlob], cleanFileName, { type: 'application/pdf', lastModified: Date.now() });
                        } catch (e) {}

                        isGenerating = false;
                        if (shareBtn) {
                            shareBtn.textContent = '📤 مشاركة / تنزيل PDF';
                            shareBtn.style.background = '#10b981';
                            shareBtn.style.color = '#000';
                        }
                    }).catch((err) => {
                        console.error('PDF Build Error:', err);
                        removeClone();
                        isGenerating = false;
                        if (shareBtn) {
                            shareBtn.textContent = '🖨️ طباعة / حفظ كـ PDF';
                            shareBtn.style.background = '#0ea5e9';
                            shareBtn.style.color = '#fff';
                        }
                    });
                }, 220);
            };

            modal.querySelector('#seraj-pdf-share-btn').onclick = async () => {
                if (isGenerating) {
                    if (typeof window.SerajAlert === 'function') window.SerajAlert('جاري تجهيز الملف، انتظر لحظة واحدة...');
                    return;
                }
                let shareSuccess = false;
                if (readyPdfFile && navigator.share) {
                    try {
                        if (!navigator.canShare || navigator.canShare({ files: [readyPdfFile] })) {
                            await navigator.share({
                                files: [readyPdfFile],
                                title: cleanFileName,
                                text: `${shopDisplayName} - ${displayDocTitle}`
                            });
                            shareSuccess = true;
                        }
                    } catch (shareErr) {
                        if (shareErr && shareErr.name === 'AbortError') return;
                    }
                }
                if (!shareSuccess && readyPdfBlob) {
                    let blobUrl = URL.createObjectURL(readyPdfBlob);
                    let tempLink = document.createElement('a');
                    tempLink.href = blobUrl;
                    tempLink.download = cleanFileName;
                    document.body.appendChild(tempLink);
                    tempLink.click();
                    document.body.removeChild(tempLink);
                    setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }, 10000);
                } else if (!shareSuccess) {
                    modal.querySelector('#seraj-pdf-print-btn').click();
                }
            };

            const loadHtml2Pdf = () => {
                if (typeof window.html2pdf === 'function') {
                    buildPdfInMemory();
                    return;
                }
                // محاولة التحميل من المكتبة المحلية /libs/ أولاً للعمل أوفلاين 100%
                let localScript = document.createElement('script');
                localScript.src = './libs/html2pdf.bundle.min.js';
                localScript.onload = buildPdfInMemory;
                localScript.onerror = () => {
                    if (!navigator.onLine) {
                        let shareBtn = modal.querySelector('#seraj-pdf-share-btn');
                        if (shareBtn) {
                            shareBtn.textContent = '🖨️ طباعة / حفظ كـ PDF (أوفلاين)';
                            shareBtn.style.background = '#0ea5e9';
                            shareBtn.style.color = '#ffffff';
                        }
                        return;
                    }
                    let cdnScript = document.createElement('script');
                    cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                    cdnScript.onload = buildPdfInMemory;
                    cdnScript.onerror = () => {
                        let shareBtn = modal.querySelector('#seraj-pdf-share-btn');
                        if (shareBtn) {
                            shareBtn.textContent = '🖨️ طباعة / حفظ كـ PDF';
                            shareBtn.style.background = '#0ea5e9';
                            shareBtn.style.color = '#ffffff';
                        }
                    };
                    document.head.appendChild(cdnScript);
                };
                document.head.appendChild(localScript);
            };

            loadHtml2Pdf();
        });
    },

    preventDoubleClick: function(btnOrEvent, actionFn = null, cooldownMs = 1500) {
        let btn = btnOrEvent && (btnOrEvent.currentTarget || btnOrEvent.target)
            ? (btnOrEvent.currentTarget || btnOrEvent.target)
            : btnOrEvent;

        if (btn && btn instanceof Element) {
            if (btn._isExecutingSync) {
                return typeof actionFn === 'function' ? actionFn() : true;
            }
            if (_buttonLocks.has(btn)) return false;

            _buttonLocks.add(btn);
            btn._isExecutingSync = true;
            let originalPointer = btn.style.pointerEvents;
            btn.style.pointerEvents = 'none';

            const unlock = () => {
                setTimeout(() => {
                    _buttonLocks.delete(btn);
                    btn.disabled = false;
                    btn.style.pointerEvents = originalPointer || '';
                }, cooldownMs);
            };

            if (typeof actionFn === 'function') {
                try {
                    let res = actionFn();
                    btn._isExecutingSync = false;
                    btn.disabled = true;
                    if (res && typeof res.finally === 'function') {
                        res.catch(err => console.error('preventDoubleClick Async Error:', err)).finally(unlock);
                    } else {
                        unlock();
                    }
                    return res;
                } catch (err) {
                    btn._isExecutingSync = false;
                    unlock();
                    throw err;
                }
            } else {
                setTimeout(() => { btn._isExecutingSync = false; }, 50);
                unlock();
                return true;
            }
        } else {
            return typeof actionFn === 'function' ? actionFn() : true;
        }
    }
};

window.getSafeTime = function(d) { return window.Utils.getSafeTime(d); };
window.generateUniqueId = function(p) { return window.Utils.generateUniqueId(p); };
window.getLocalDateStr = function(d) { return window.Utils.getLocalDateString(d); };
window.debounce = window.Utils.debounce;
window.fastSearch = function(list, query, keys, limit) { return window.Utils.fastSearch(list, query, keys, limit); };

if (typeof window.exportToPDF !== 'function') {
    window.exportToPDF = function(targetElOrHtml, fileName = 'export.pdf') {
        let el = targetElOrHtml || document.querySelector('table') || document.body;
        return window.Utils.downloadRealPDF(el, fileName);
    };
}

if (typeof window.exportToExcel !== 'function') {
    window.exportToExcel = function(tableIdOrElOrArray, fileName = 'export.xlsx') {
        try {
            let tableHtml = '';
            const protectStringCell = (key, val) => {
                if (val === null || val === undefined) return '';
                let kLow = String(key || '').toLowerCase();
                if (kLow.includes('phone') || kLow.includes('mobile') || kLow.includes('barcode') || kLow.includes('كود') || kLow.includes('باركود') || kLow.includes('موبايل') || kLow.includes('هاتف')) {
                    return String(val);
                }
                return val;
            };

            if (Array.isArray(tableIdOrElOrArray)) {
                if (tableIdOrElOrArray.length === 0) return false;
                let isAOA = Array.isArray(tableIdOrElOrArray[0]);
                if (typeof XLSX !== 'undefined' && XLSX.utils && XLSX.writeFile) {
                    let ws;
                    if (isAOA) {
                        ws = XLSX.utils.aoa_to_sheet(tableIdOrElOrArray);
                    } else {
                        let safeRows = tableIdOrElOrArray.map(r => {
                            let obj = {};
                            Object.keys(r || {}).forEach(k => { obj[k] = protectStringCell(k, r[k]); });
                            return obj;
                        });
                        ws = XLSX.utils.json_to_sheet(safeRows);
                    }
                    // حفظ الأعمدة النصية (الباركود والموبايل) كـ String داخل الشيت
                    Object.keys(ws).forEach(cellAddr => {
                        if (cellAddr.startsWith('!')) return;
                        let cell = ws[cellAddr];
                        if (cell && typeof cell.v === 'string' && /^0\d{7,}$|^\d{10,}$/.test(cell.v.trim())) {
                            cell.t = 's';
                            cell.z = '@';
                        }
                    });
                    ws['!dir'] = 'rtl';
                    let wb = XLSX.utils.book_new();
                    wb.Workbook = { Views: [{ RTL: true }] };
                    XLSX.utils.book_append_sheet(wb, ws, 'Report');
                    let cleanXlsx = String(fileName).replace(/\.(xls|xlsx)$/i, '') + '.xlsx';
                    XLSX.writeFile(wb, cleanXlsx);
                    return true;
                }
                if (isAOA) {
                    let trs = tableIdOrElOrArray.map((row, idx) => {
                        if (!Array.isArray(row) || row.length === 0) return '<tr><td colspan="6">&nbsp;</td></tr>';
                        let tag = idx === 0 ? 'th' : 'td';
                        let bg = idx === 0 ? 'background:#eee;font-weight:bold;' : '';
                        let cells = row.map(c => `<${tag} style="border:1px solid #333;padding:6px;mso-number-format:'\\@';${bg}">${window.Utils.sanitizeHTML(String(c ?? ''))}</${tag}>`).join('');
                        return `<tr>${cells}</tr>`;
                    }).join('');
                    tableHtml = `<table><tbody>${trs}</tbody></table>`;
                } else {
                    let headers = Object.keys(tableIdOrElOrArray[0] || {});
                    let ths = headers.map(h => `<th style="border:1px solid #333;padding:6px;background:#eee;">${window.Utils.sanitizeHTML(String(h))}</th>`).join('');
                    let trs = tableIdOrElOrArray.map(row => {
                        let tds = headers.map(h => `<td style="border:1px solid #333;padding:6px;mso-number-format:'\\@';">${window.Utils.sanitizeHTML(String(row[h] ?? ''))}</td>`).join('');
                        return `<tr>${tds}</tr>`;
                    }).join('');
                    tableHtml = `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
                }
            } else {
                let tableEl = typeof tableIdOrElOrArray === 'string' ? document.getElementById(tableIdOrElOrArray) : (tableIdOrElOrArray || document.querySelector('table'));
                if (!tableEl) return false;
                tableHtml = window.Utils.sanitizeRichHTML(tableEl.outerHTML);
            }
            let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" dir="rtl"><head><meta charset="UTF-8"></head><body>${tableHtml}</body></html>`;
            let blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = String(fileName).endsWith('.xls') || String(fileName).endsWith('.xlsx') ? fileName : (fileName + '.xls');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 10000);
            return true;
        } catch (e) {
            console.error('Excel Export Error:', e);
            return false;
        }
    };
}

// =========================================================================
// 6. النوافذ الحوارية الموحدة (SerajAlert / SerajConfirm / SerajDestructiveConfirm)
// =========================================================================
window.SerajAlert = function(message, type = 'info', callback = null) {
    return new Promise((resolve) => {
        let modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; inset:0; width:100%; height:100%; background:rgba(7,9,19,0.92); z-index:100000; display:none; justify-content:center; align-items:center; direction:rtl;';

        let box = document.createElement('div');
        let borderColor = type === 'error' ? 'var(--accent-red, #ff1a40)' : (type === 'success' ? 'var(--accent-green, #00ff66)' : 'var(--neon-border, #3b82f6)');
        box.style.cssText = `background:var(--card-bg, #0f172a); padding:26px; border-radius:16px; border:2px solid ${borderColor}; color:var(--text-main, #ffffff); text-align:center; min-width:300px; max-width:88%; box-shadow:0 0 25px rgba(0,0,0,0.85);`;

        box.innerHTML = `
            <h3 style="margin-top:0; color:${borderColor};">${type === 'error' ? '⚠️ تنبيه هام' : '✅ رسالة النظام'}</h3>
            <p style="font-size:17px; margin:18px 0; line-height:1.6; white-space:pre-line;">${window.Utils.sanitizeHTML(String(message))}</p>
            <button type="button" id="alert-ok-btn" style="background:${borderColor}; color:#000; border:none; padding:10px 30px; font-weight:bold; border-radius:10px; cursor:pointer; font-size:16px;">موافق</button>
        `;

        modal.appendChild(box);
        document.body.appendChild(modal);

        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            if (typeof callback === 'function') callback(true);
            resolve(true);
        };

        window.SerajUI.openModal(modal, { display: 'flex', removeOnClose: true, useHistory: false, onClose: done });

        let okBtn = modal.querySelector('#alert-ok-btn');
        if (okBtn) {
            okBtn.focus();
            okBtn.onclick = () => window.SerajUI.closeModal(modal);
        }
    });
};

window.SerajSerajAlert = window.SerajAlert;

window.SerajConfirm = function(message, callback = null) {
    return new Promise((resolve) => {
        let modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; inset:0; width:100%; height:100%; background:rgba(7,9,19,0.92); z-index:100000; display:none; justify-content:center; align-items:center; direction:rtl;';

        let box = document.createElement('div');
        let warnColor = 'var(--accent-yellow, #facc15)';
        box.style.cssText = `background:var(--card-bg, #0f172a); padding:26px; border-radius:16px; border:2px solid ${warnColor}; color:var(--text-main, #ffffff); text-align:center; min-width:300px; max-width:88%; box-shadow:0 0 25px rgba(0,0,0,0.85);`;

        box.innerHTML = `
            <h3 style="margin-top:0; color:${warnColor};">❓ تأكيد إجراء</h3>
            <p style="font-size:17px; margin:18px 0; line-height:1.6; white-space:pre-line;">${window.Utils.sanitizeHTML(String(message))}</p>
            <div style="display:flex; justify-content:center; gap:14px;">
                <button type="button" id="confirm-yes-btn" style="background:var(--accent-green, #00ff66); color:#000; border:none; padding:10px 24px; font-weight:bold; border-radius:10px; cursor:pointer; font-size:15px;">نعم، متأكد</button>
                <button type="button" id="confirm-no-btn" style="background:var(--accent-red, #ff1a40); color:#fff; border:none; padding:10px 24px; font-weight:bold; border-radius:10px; cursor:pointer; font-size:15px;">إلغاء</button>
            </div>
        `;

        modal.appendChild(box);
        document.body.appendChild(modal);

        let settled = false;
        const finish = (val) => {
            if (settled) return;
            settled = true;
            if (typeof callback === 'function') callback(val);
            resolve(val);
        };

        window.SerajUI.openModal(modal, { display: 'flex', removeOnClose: true, useHistory: false, onClose: () => finish(false) });

        let yesBtn = modal.querySelector('#confirm-yes-btn');
        let noBtn = modal.querySelector('#confirm-no-btn');
        if (yesBtn) {
            yesBtn.onclick = () => {
                settled = true;
                window.SerajUI.closeModal(modal);
                if (typeof callback === 'function') callback(true);
                resolve(true);
            };
        }
        if (noBtn) {
            noBtn.onclick = () => window.SerajUI.closeModal(modal);
        }
    });
};

window.SerajSerajConfirm = window.SerajConfirm;

// نافذة تأكيد العمليات الحساسة (تصفير المصنع / استرجاع نسخة): تتطلب كتابة كلمة "تأكيد"
window.SerajDestructiveConfirm = function(title, warningMsg) {
    return new Promise((resolve) => {
        let modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; inset:0; width:100%; height:100%; background:rgba(7,9,19,0.95); z-index:100005; display:none; justify-content:center; align-items:center; direction:rtl;';

        let box = document.createElement('div');
        box.style.cssText = 'background:var(--card-bg, #0f172a); padding:26px; border-radius:16px; border:2px solid var(--accent-red, #ff1a40); color:var(--text-main, #ffffff); text-align:center; min-width:310px; max-width:90%; box-shadow:0 0 30px rgba(255,26,64,0.45);';

        box.innerHTML = `
            <h3 style="margin-top:0; color:var(--accent-red, #ff1a40);">🛑 ${window.Utils.sanitizeHTML(title || 'عملية خطيرة')}</h3>
            <p style="font-size:15px; margin:14px 0; line-height:1.6;">${window.Utils.sanitizeHTML(warningMsg || '')}</p>
            <p style="font-size:14px; color:var(--accent-yellow, #facc15); font-weight:bold; margin-bottom:10px;">سيتم أخذ نسخة احتياطية إجبارية مسبقة. اكتب كلمة (تأكيد) للمتابعة:</p>
            <input type="text" id="destructive-confirm-input" autocomplete="off" placeholder="اكتب هنا: تأكيد" style="width:100%; padding:10px; border-radius:10px; border:2px solid var(--accent-red, #ff1a40); background:var(--bg-dark-1, #070913); color:var(--text-main, #fff); font-size:16px; font-weight:bold; text-align:center; margin-bottom:16px; box-sizing:border-box;">
            <div style="display:flex; justify-content:center; gap:12px;">
                <button type="button" id="destructive-ok-btn" style="flex:1; background:var(--accent-red, #ff1a40); color:#fff; border:none; padding:10px 18px; font-weight:bold; border-radius:10px; cursor:pointer; font-size:15px;">تنفيذ نهائي</button>
                <button type="button" id="destructive-cancel-btn" style="flex:1; background:var(--card-bg-alt, #1e293b); color:var(--text-main, #fff); border:1px solid var(--neon-border, #3b82f6); padding:10px 18px; font-weight:bold; border-radius:10px; cursor:pointer; font-size:15px;">إلغاء</button>
            </div>
        `;

        modal.appendChild(box);
        document.body.appendChild(modal);

        let settled = false;
        const finish = (val) => {
            if (settled) return;
            settled = true;
            resolve(val);
        };

        window.SerajUI.openModal(modal, { display: 'flex', removeOnClose: true, useHistory: false, onClose: () => finish(false) });

        let inp = modal.querySelector('#destructive-confirm-input');
        let okBtn = modal.querySelector('#destructive-ok-btn');
        let cancelBtn = modal.querySelector('#destructive-cancel-btn');
        if (inp) setTimeout(() => inp.focus(), 50);

        okBtn.onclick = () => {
            let typed = window.Utils.normalizeName(inp.value || '');
            if (typed === 'تاكيد') {
                settled = true;
                window.SerajUI.closeModal(modal);
                resolve(true);
            } else {
                window.SerajAudio.playError();
                inp.style.borderColor = '#facc15';
                inp.value = '';
                inp.placeholder = '❌ يجب كتابة كلمة: تأكيد';
            }
        };
        cancelBtn.onclick = () => window.SerajUI.closeModal(modal);
    });
};

// =========================================================================
// 7. محرك الصور الأوفلاين المركزي (ImagesDB)
// - ضغط تلقائي عبر <canvas> إلى 300x300px (~25KB)
// - كاش _urlCache مع URL.revokeObjectURL عند الحذف/التعديل فقط لمنع تسريب الرامات
// - إخفاء <img style="display:none;"> تلقائياً وعرض 📦 لو الصورة غير موجودة على جهاز آخر
// - تصدير واستيراد ملف Images.json مستقل واختياري
// =========================================================================
const _nativeCreateObjectURL = URL.createObjectURL.bind(URL);

window.ImagesDB = {
    dbName: 'SerajImagesDB',
    storeName: 'productImages',
    _dbPromise: null,
    _urlCache: new Map(),

    open: function() {
        if (this._dbPromise) return this._dbPromise;
        this._dbPromise = new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) return reject(new Error('IndexedDB not supported'));
            let req = indexedDB.open(this.dbName, 1);
            req.onupgradeneeded = (e) => {
                let db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
        return this._dbPromise;
    },

    // ضغط الصورة تلقائياً عبر Canvas إلى 300x300px (~25KB)
    compressImage: function(fileOrBlobOrDataUrl, maxDim = 300, quality = 0.72) {
        return new Promise((resolve) => {
            if (!fileOrBlobOrDataUrl) return resolve(null);
            let isStr = typeof fileOrBlobOrDataUrl === 'string';
            let tempUrl = isStr ? fileOrBlobOrDataUrl : _nativeCreateObjectURL(fileOrBlobOrDataUrl);

            let img = new Image();
            img.onload = () => {
                try {
                    let w = img.naturalWidth || img.width || maxDim;
                    let h = img.naturalHeight || img.height || maxDim;
                    if (w > maxDim || h > maxDim) {
                        if (w >= h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }
                    let canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, w);
                    canvas.height = Math.max(1, h);
                    let ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    if (canvas.toBlob) {
                        canvas.toBlob((blob) => {
                            if (!isStr) { try { URL.revokeObjectURL(tempUrl); } catch (e) {} }
                            resolve(blob || fileOrBlobOrDataUrl);
                        }, 'image/jpeg', quality);
                    } else {
                        let dataUrl = canvas.toDataURL('image/jpeg', quality);
                        if (!isStr) { try { URL.revokeObjectURL(tempUrl); } catch (e) {} }
                        resolve(dataUrl);
                    }
                } catch (err) {
                    if (!isStr) { try { URL.revokeObjectURL(tempUrl); } catch (e) {} }
                    resolve(fileOrBlobOrDataUrl);
                }
            };
            img.onerror = () => {
                if (!isStr) { try { URL.revokeObjectURL(tempUrl); } catch (e) {} }
                resolve(fileOrBlobOrDataUrl);
            };
            img.src = tempUrl;
        });
    },

    _revokeCachedUrl: function(productId) {
        let key = String(productId);
        if (this._urlCache.has(key)) {
            let oldUrl = this._urlCache.get(key);
            if (typeof oldUrl === 'string' && oldUrl.startsWith('blob:')) {
                try { URL.revokeObjectURL(oldUrl); } catch (e) {}
            }
            this._urlCache.delete(key);
        }
    },

    _getOrCreateCachedUrl: function(productId, rawImg) {
        if (!rawImg) return null;
        let key = String(productId);
        if (this._urlCache.has(key)) {
            return this._urlCache.get(key);
        }
        let urlStr = (rawImg instanceof Blob) ? _nativeCreateObjectURL(rawImg) : String(rawImg);
        this._urlCache.set(key, urlStr);
        return urlStr;
    },

    _applyFallbackBox: function(el, showImage, imgUrl = '') {
        if (!el || !(el instanceof Element)) return;
        let parent = el.parentNode;
        let fallbackClass = 'seraj-img-fallback-box';
        let existingBox = parent ? parent.querySelector(`.${fallbackClass}[data-for-img="${el.id || ''}"]`) : null;

        if (showImage && imgUrl) {
            el.src = imgUrl;
            el.style.display = '';
            el.onerror = () => {
                this._applyFallbackBox(el, false, '');
            };
            if (existingBox) existingBox.style.display = 'none';
        } else {
            el.removeAttribute('src');
            el.style.display = 'none';
            if (parent) {
                if (!existingBox) {
                    existingBox = document.createElement('span');
                    existingBox.className = fallbackClass;
                    existingBox.setAttribute('data-for-img', el.id || '');
                    existingBox.textContent = '📦';
                    existingBox.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:8px; background:var(--card-bg-alt, #131c31); border:1px solid var(--neon-border-soft, rgba(59,130,246,0.3)); font-size:20px; flex-shrink:0;';
                    parent.insertBefore(existingBox, el.nextSibling);
                } else {
                    existingBox.style.display = 'inline-flex';
                }
            }
        }
    },

    saveImage: async function(productId, blobOrBase64) {
        if (!productId || !blobOrBase64) return false;
        let key = String(productId);
        let compressed = await this.compressImage(blobOrBase64, 300, 0.72);
        this._revokeCachedUrl(key);

        return this.open().then(db => {
            return new Promise((resolve) => {
                try {
                    let sName = db.objectStoreNames.contains(this.storeName) ? this.storeName : db.objectStoreNames[0];
                    let tx = db.transaction([sName], 'readwrite');
                    let store = tx.objectStore(sName);
                    store.put({ id: key, imageBlob: compressed, updatedAt: Date.now() });
                    tx.oncomplete = () => {
                        this._getOrCreateCachedUrl(key, compressed);
                        resolve(true);
                    };
                    tx.onerror = () => resolve(false);
                } catch (err) {
                    resolve(false);
                }
            });
        }).catch(() => false);
    },

    getImage: function(productId, targetImgElementId = null) {
        let key = String(productId ?? '');
        let el = targetImgElementId
            ? (typeof targetImgElementId === 'string' ? document.getElementById(targetImgElementId) : targetImgElementId)
            : null;

        if (!key) {
            if (el) this._applyFallbackBox(el, false);
            return Promise.resolve(null);
        }

        // قراءة فورية من كاش الروابط دون تسريب رامات
        if (this._urlCache.has(key)) {
            let cachedUrl = this._urlCache.get(key);
            if (el) this._applyFallbackBox(el, true, cachedUrl);
            return Promise.resolve(cachedUrl);
        }

        return this.open().then(db => {
            return new Promise((resolve) => {
                try {
                    let sName = db.objectStoreNames.contains(this.storeName) ? this.storeName : db.objectStoreNames[0];
                    let tx = db.transaction([sName], 'readonly');
                    let store = tx.objectStore(sName);

                    const handleRecord = (rec) => {
                        if (rec && (rec.imageBlob || rec.image)) {
                            let url = this._getOrCreateCachedUrl(key, rec.imageBlob || rec.image);
                            if (el) this._applyFallbackBox(el, true, url);
                            resolve(url);
                        } else {
                            if (el) this._applyFallbackBox(el, false);
                            resolve(null);
                        }
                    };

                    let reqStr = store.get(key);
                    reqStr.onsuccess = (e) => {
                        if (e.target.result) {
                            handleRecord(e.target.result);
                        } else if (!isNaN(key)) {
                            let reqNum = store.get(Number(key));
                            reqNum.onsuccess = (ev) => handleRecord(ev.target.result);
                            reqNum.onerror = () => handleRecord(null);
                        } else {
                            handleRecord(null);
                        }
                    };
                    reqStr.onerror = () => handleRecord(null);
                } catch (err) {
                    if (el) this._applyFallbackBox(el, false);
                    resolve(null);
                }
            });
        }).catch(() => {
            if (el) this._applyFallbackBox(el, false);
            return null;
        });
    },

    deleteImage: function(productId) {
        let key = String(productId ?? '');
        this._revokeCachedUrl(key);
        return this.open().then(db => {
            return new Promise((resolve) => {
                try {
                    let sName = db.objectStoreNames.contains(this.storeName) ? this.storeName : db.objectStoreNames[0];
                    let tx = db.transaction([sName], 'readwrite');
                    let store = tx.objectStore(sName);
                    store.delete(key);
                    if (!isNaN(key)) store.delete(Number(key));
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (err) {
                    resolve(false);
                }
            });
        }).catch(() => false);
    },

    // تصدير جميع الصور كملف Images.json مستقل (اختياري)
    exportAllImagesJSON: async function() {
        const blobToBase64 = (blob) => new Promise((res) => {
            if (typeof blob === 'string') return res(blob);
            try {
                let reader = new FileReader();
                reader.onloadend = () => res(reader.result || '');
                reader.onerror = () => res('');
                reader.readAsDataURL(blob);
            } catch (e) { res(''); }
        });

        let db = await this.open();
        let records = await new Promise((resolve) => {
            try {
                let tx = db.transaction([this.storeName], 'readonly');
                let req = tx.objectStore(this.storeName).getAll();
                req.onsuccess = (e) => resolve(e.target.result || []);
                req.onerror = () => resolve([]);
            } catch (e) { resolve([]); }
        });

        let imagesMap = {};
        for (let i = 0; i < records.length; i++) {
            let rec = records[i];
            if (!rec || !rec.id) continue;
            let raw = rec.imageBlob || rec.image;
            if (!raw) continue;
            let b64 = await blobToBase64(raw);
            if (b64) imagesMap[String(rec.id)] = b64;
        }
        return {
            format: 'seraj_images_backup_v5',
            exportedAt: Date.now(),
            count: Object.keys(imagesMap).length,
            images: imagesMap
        };
    },

    // استيراد ملف Images.json مستقل
    importAllImagesJSON: async function(payload) {
        let imagesMap = (payload && payload.images && typeof payload.images === 'object') ? payload.images : payload;
        if (!imagesMap || typeof imagesMap !== 'object') return 0;
        let ids = Object.keys(imagesMap);
        let imported = 0;
        for (let i = 0; i < ids.length; i++) {
            let id = ids[i];
            let dataUrl = imagesMap[id];
            if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
                let ok = await this.saveImage(id, dataUrl);
                if (ok) imported++;
            }
        }
        return imported;
    }
};

window.ImagesDB.open().catch(() => {});
// ==================== [ نهاية الجزء الأول 1/3 ] ====================

// ==================== [ بداية الجزء الثاني 2/3 ] ====================
// =========================================================================
// 8. بوابة السحابة، المصادقة، الباقات، والصلاحيات (Multi-Tenant SaaS + Offline Single)
// =========================================================================
function getServerNow() {
    return Date.now() + (Number(_serverTimeOffset) || 0);
}

function _getStoreCloudRef(subPath = '') {
    let storeId = getActiveStoreId();
    if (!storeId || !window.dbCloud) return null;
    let base = `${window.APP_BRAND_CONFIG.cloudRoot}/${storeId}`;
    return subPath ? window.dbCloud.ref(`${base}/${subPath}`) : window.dbCloud.ref(base);
}

window.SerajAuth = {
    _currentUser: null,
    _claims: null,
    _verifiedRole: null,
    _integritySalt: 'SRJ_V5#K9!2026$POS_SEAL',

    _computeIntegrityHash: function(rawStr) {
        let str = `${this._integritySalt}|${String(rawStr || '')}|${this._integritySalt.split('').reverse().join('')}`;
        let h1 = 0x811c9dc5;
        let h2 = 0x9e3779b9;
        for (let i = 0; i < str.length; i++) {
            let ch = str.charCodeAt(i);
            h1 ^= ch;
            h1 = Math.imul(h1, 0x01000193);
            h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b);
            h2 = (h2 << 13) | (h2 >>> 19);
        }
        h1 ^= h2 >>> 16;
        h2 ^= h1 >>> 13;
        return ((h1 >>> 0).toString(36) + '_' + (h2 >>> 0).toString(36)).toUpperCase();
    },

    _computeRoleSignature: function(storeId, role, uid) {
        return this._computeIntegrityHash(`ROLE|${storeId}|${role}|${uid || ''}|${myDeviceId}`);
    },

    _computeOfflineCertHash: function(storeId, deviceId, activationCode, activatedAt, nonce) {
        return this._computeIntegrityHash(`OFFLINE_V5|${storeId}|${deviceId}|${activationCode}|${activatedAt}|${nonce}`);
    },

    _purgeOfflineCloudResidue: function() {
        try {
            let keysToClean = [];
            if (window._serajRAM) {
                window._serajRAM.forEach((_, k) => {
                    if (k.startsWith('seraj_cloud_cache_') || k.startsWith('seraj_last_sync_ts_') || k === 'seraj_outbox_queue' || k === 'seraj_sync_queue' || k === 'seraj_delete_queue') {
                        keysToClean.push(k);
                    }
                });
            }
            keysToClean.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
    },

    getSession: function() {
        let storeId = getActiveStoreId();
        let plan = (localStorage.getItem('seraj_plan') || 'pro').toLowerCase();
        let expiryTs = parseInt(localStorage.getItem('seraj_expiry_ts') || '0', 10) || 0;
        let maxDevices = parseInt(localStorage.getItem('seraj_max_devices') || '5', 10) || 5;
        let cert = safeParseJSON(localStorage.getItem('seraj_offline_cert'), null);

        // Fail-Closed: الافتراضي دائماً cashier إلا بتحقق موثق
        let role = 'cashier';
        if (plan === 'offline_single') {
            role = this.verifyOfflineCertificate() ? 'owner' : 'cashier';
        } else if (this._verifiedRole === 'owner' || this._verifiedRole === 'cashier') {
            role = this._verifiedRole;
        } else {
            let storedRole = (localStorage.getItem('seraj_user_role') || '').toLowerCase();
            let storedSig = localStorage.getItem('seraj_role_sig') || '';
            let storedUid = localStorage.getItem('seraj_auth_uid') || '';
            if (storedRole === 'owner' && storeId && storedSig && storedSig === this._computeRoleSignature(storeId, 'owner', storedUid)) {
                role = 'owner';
            } else {
                role = 'cashier';
            }
        }

        return {
            storeId,
            role,
            plan,
            expiryTs,
            maxDevices,
            deviceId: myDeviceId,
            deviceName: myDeviceName,
            offlineCert: cert
        };
    },

    isOfflineSinglePlan: function() {
        return (localStorage.getItem('seraj_plan') || '').toLowerCase() === 'offline_single';
    },

    isOwner: function() {
        return this.getSession().role === 'owner';
    },

    isCashier: function() {
        return this.getSession().role !== 'owner';
    },

    canAccess: function(permissionKey) {
        let role = this.getSession().role;
        if (role === 'owner') return true;
        const cashierForbidden = new Set([
            'profits',
            'profit_detailed',
            'profit_summary',
            'profit_margin',
            'view_purchase_prices',
            'view_inventory_cost',
            'inventory_detailed',
            'create_purchase',
            'edit_purchase_invoice',
            'cancel_purchase_invoice',
            'edit_sales_invoice',
            'cancel_sales_invoice',
            'delete_product',
            'add_product',
            'edit_product',
            'edit_product_lots',
            'update_product_price',
            'bulk_price_update',
            'import_export_excel',
            'export_backup',
            'factory_reset',
            'wipe_store',
            'restore_backup',
            'delete_treasury_move',
            'reverse_treasury_move',
            'view_vault_balances',
            'treasury_direct_move',
            'view_treasury_movements',
            'ai_financial_queries',
            'manage_devices',
            'manage_users',
            'manage_voice_config',
            'manage_store_settings'
        ]);
        return !cashierForbidden.has(String(permissionKey || '').toLowerCase());
    },

    // حارس الصلاحيات والباقة على مستوى الصفحات والواجهة (Fail-Closed)
    applyRoleGuards: function() {
        let sess = this.getSession();
        if (document.documentElement) {
            document.documentElement.setAttribute('data-user-role', sess.role);
            document.documentElement.setAttribute('data-store-plan', sess.plan);
        }

        // حقن قواعد إخفاء خفيفة لعناصر السحابة وتعدد الأجهزة والصلاحيات بدون تعديل style.css
        if (document.head && !document.getElementById('seraj-rbac-plan-guards')) {
            let st = document.createElement('style');
            st.id = 'seraj-rbac-plan-guards';
            st.textContent = 'html[data-store-plan="offline_single"] .cloud-only-btn, html[data-store-plan="offline_single"] .cloud-only, html[data-store-plan="offline_single"] .multi-device-only { display: none !important; } html[data-user-role="cashier"] .owner-only, html[data-user-role="cashier"] [data-role="owner"], html[data-user-role="cashier"] [data-owner-only="true"] { display: none !important; }';
            document.head.appendChild(st);
        }

        if (sess.role === 'owner') return true;

        let path = (window.location.pathname || '').toLowerCase();
        let blockedPages = ['profit_detailed.html', 'profit_summary.html', 'profit_margin.html', 'inventory_detailed.html', 'purchases.html'];
        if (blockedPages.some(p => path.endsWith(p))) {
            if (document.body) document.body.style.visibility = 'hidden';
            window.SerajAlert('⛔ هذه الشاشة مخصصة لصاحب المحل (المالك) فقط.', 'error', () => {
                window.location.replace('index.html');
            });
            return false;
        }

        const hideOwnerOnly = () => {
            try {
                document.querySelectorAll('[data-role="owner"], .owner-only, [data-owner-only="true"]').forEach(el => {
                    el.style.display = 'none';
                });
            } catch (e) {}
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', hideOwnerOnly, { once: true });
        } else {
            hideOwnerOnly();
        }
        return true;
    },

    // طلب التثبيت الدائم للتخزين على الجهاز (مهم جداً لباقة offline_single)
    requestPersistentStorage: async function() {
        try {
            if (navigator.storage && typeof navigator.storage.persist === 'function') {
                let already = await navigator.storage.persisted();
                if (!already) {
                    return await navigator.storage.persist();
                }
                return true;
            }
        } catch (e) {}
        return false;
    },

    // تفعيل باقة جهاز واحد أوفلاين (أونلاين مرة واحدة لمدة 3 ثوانٍ لربط deviceId وقفل الكود ثم إغلاق السحابة 100%)
    activateOfflineSingleLicense: async function(storeIdInput, activationCode, appsScriptConfig = null) {
        let cleanStoreId = String(storeIdInput || '').trim().replace(/[.#$\[\]\/\\]/g, '_');
        let cleanCode = String(activationCode || '').trim();
        if (!cleanStoreId || !cleanCode || cleanStoreId.toLowerCase() === 'demostore') {
            throw new Error('يرجى إدخال كود محل صالح وكود التفعيل.');
        }
        if (!navigator.onLine) {
            throw new Error('يتطلب التفعيل لأول مرة اتصالاً بالإنترنت لمدة 3 ثوانٍ فقط.');
        }

        await ensureFirebaseSDKLoaded();
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        let rtdb = firebase.database();

        // التحقق من كود التفعيل وربطه بـ deviceId وقفل الكود لمرة واحدة
        let codeRef = rtdb.ref(`Activation_Codes/${cleanCode}`);
        let snap = await codeRef.once('value');
        if (!snap.exists()) {
            throw new Error('كود التفعيل غير صحيح أو غير موجود.');
        }
        let codeData = snap.val() || {};
        if (codeData.plan && codeData.plan !== 'offline_single') {
            throw new Error('هذا الكود غير مخصص لباقة الجهاز الواحد الأوفلاين.');
        }
        if (codeData.isUsed) {
            throw new Error('هذا الكود مستخدم ومقفل مسبقاً.');
        }

        let nowTs = Date.now();
        let nonce = window.Utils.generateUUID('LIC');
        await codeRef.update({
            isUsed: true,
            usedAt: nowTs,
            boundDeviceId: myDeviceId,
            boundStoreId: cleanStoreId,
            boundDeviceName: 'الجهاز الرئيسي'
        });

        let sigV2 = this._computeOfflineCertHash(cleanStoreId, myDeviceId, cleanCode, nowTs, nonce);
        let cert = {
            version: 5,
            plan: 'offline_single',
            storeId: cleanStoreId,
            deviceId: myDeviceId,
            activationCode: cleanCode,
            activatedAt: nowTs,
            nonce: nonce,
            role: 'owner',
            sigV2: sigV2
        };

        myDeviceName = 'الجهاز الرئيسي';
        myDevicePrefix = 'A';
        _internalSetItem('seraj_device_name', myDeviceName);
        _internalSetItem('seraj_device_prefix', myDevicePrefix);
        _internalSetItem('seraj_bound_device_id', myDeviceId);
        _internalSetItem('seraj_store_id', cleanStoreId);
        _internalSetItem('seraj_plan', 'offline_single');
        _internalSetItem('seraj_user_role', 'owner');
        _internalSetItem('seraj_role_sig', this._computeRoleSignature(cleanStoreId, 'owner', cleanCode));
        _internalSetItem('seraj_auth_uid', cleanCode);
        _internalSetItem('seraj_offline_cert', JSON.stringify(cert));
        _internalSetItem('seraj_last_offline_backup_ts', String(nowTs));
        this._verifiedRole = 'owner';

        if (appsScriptConfig && appsScriptConfig.url && appsScriptConfig.secretToken) {
            _internalSetItem('seraj_gas_backup_config', JSON.stringify({
                url: String(appsScriptConfig.url).trim(),
                secretToken: String(appsScriptConfig.secretToken).trim(),
                email: String(appsScriptConfig.email || '').trim(),
                enabled: true
            }));
        }

        currentStoreId = cleanStoreId;
        this._purgeOfflineCloudResidue();
        await this.requestPersistentStorage();

        // إغلاق اتصال Firebase فوراً لضمان استهلاك 0 من السحابة بعد التفعيل
        cloudReady = false;
        try { rtdb.goOffline(); } catch (e) {}
        showCloudStatus('🔒 تم تفعيل باقة الأوفلاين الدائمة (0 استهلاك سحابة)');
        window.dispatchEvent(new CustomEvent('seraj:cloudReady', { detail: { mode: 'offline_single', storeId: cleanStoreId } }));
        return cert;
    },

    verifyOfflineCertificate: function() {
        let cert = safeParseJSON(localStorage.getItem('seraj_offline_cert'), null);
        if (!cert || cert.plan !== 'offline_single') return false;
        let activeStore = getActiveStoreId();
        if (!activeStore || cert.storeId !== activeStore) return false;
        if (!cert.deviceId || cert.deviceId !== myDeviceId) return false;
        let boundId = localStorage.getItem('seraj_bound_device_id');
        if (boundId && boundId !== myDeviceId) return false;
        if (!cert.sigV2 || !cert.nonce || !cert.activatedAt || !cert.activationCode) return false;
        let expectedHash = this._computeOfflineCertHash(cert.storeId, myDeviceId, cert.activationCode, cert.activatedAt, cert.nonce);
        return cert.sigV2 === expectedHash;
    },

    // فحص تذكير النسخ الاحتياطي كل 7 أيام لباقة الأوفلاين
    checkOfflineBackupReminder: function() {
        if (!this.isOfflineSinglePlan()) return false;
        let lastTs = parseInt(localStorage.getItem('seraj_last_offline_backup_ts') || '0', 10) || 0;
        let sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (lastTs > 0 && (Date.now() - lastTs) >= sevenDaysMs) {
            let todayKey = window.Utils.getLocalDateString();
            if (sessionStorage.getItem('seraj_backup_reminded_day') !== todayKey) {
                sessionStorage.setItem('seraj_backup_reminded_day', todayKey);
                setTimeout(() => {
                    window.SerajConfirm('💾 تذكير أسبوعي: مر أكثر من 7 أيام على آخر نسخة احتياطية لبيانات المحل. هل تريد حفظ ومشاركة ملف Data.json الآن؟', (ok) => {
                        if (ok && window.DB && typeof window.DB.exportOfflineDataJSON === 'function') {
                            window.DB.exportOfflineDataJSON(true);
                        }
                    });
                }, 2500);
            }
            return true;
        }
        return false;
    },

    // استخراج Custom Claims من Firebase Auth وتوقيع الدور محلياً لمنع التلاعب
    syncAuthClaims: async function(user) {
        if (!user || typeof user.getIdTokenResult !== 'function') return null;
        try {
            let tokenResult = await user.getIdTokenResult();
            let claims = tokenResult.claims || {};
            this._currentUser = user;
            this._claims = claims;
            let claimedStore = claims.storeId ? String(claims.storeId).trim().replace(/[.#$\[\]\/\\]/g, '_') : '';
            if (claimedStore && claimedStore.toLowerCase() !== 'demostore') {
                _internalSetItem('seraj_store_id', claimedStore);
                currentStoreId = getActiveStoreId();
            }
            let verifiedRole = (claims.role === 'owner') ? 'owner' : 'cashier';
            this._verifiedRole = verifiedRole;
            _internalSetItem('seraj_user_role', verifiedRole);
            _internalSetItem('seraj_auth_uid', String(user.uid || ''));
            if (claimedStore) {
                _internalSetItem('seraj_role_sig', this._computeRoleSignature(claimedStore, verifiedRole, user.uid || ''));
            }
            if (claims.plan) {
                _internalSetItem('seraj_plan', String(claims.plan).toLowerCase());
            }
            this.applyRoleGuards();
            return claims;
        } catch (e) {
            console.warn('Auth Claims Warning:', e);
            return null;
        }
    },

    // تسجيل دخول سحابي بـ Firebase Authentication
    signInWithEmail: async function(email, password) {
        await ensureFirebaseSDKLoaded();
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        let cred = await firebase.auth().signInWithEmailAndPassword(String(email).trim(), String(password));
        let claims = await this.syncAuthClaims(cred.user);
        return { user: cred.user, claims };
    },

    signOut: async function() {
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                await firebase.auth().signOut();
            }
        } catch (e) {}
        cloudReady = false;
        this._currentUser = null;
        this._claims = null;
        this._verifiedRole = null;
        localStorage.removeItem('seraj_store_id');
        localStorage.removeItem('seraj_user_role');
        localStorage.removeItem('seraj_role_sig');
        localStorage.removeItem('seraj_auth_uid');
        localStorage.removeItem('seraj_plan');
        localStorage.removeItem('seraj_expiry_ts');
        window.location.replace('index.html');
    }
};

// تحميل SDKs Firebase (App + Auth + Database) بشكل آمن ومرتب
let _firebaseLoadPromise = null;
function ensureFirebaseSDKLoaded() {
    if (_firebaseLoadPromise) return _firebaseLoadPromise;
    _firebaseLoadPromise = new Promise((resolve, reject) => {
        const loadScript = (src) => new Promise((res, rej) => {
            if (document.querySelector(`script[src="${src}"]`)) return res();
            let s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
        });

        const step3 = () => {
            if (typeof firebase !== 'undefined' && typeof firebase.database === 'function') return resolve(true);
            loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js').then(() => resolve(true)).catch(reject);
        };
        const step2 = () => {
            if (typeof firebase !== 'undefined' && typeof firebase.auth === 'function') return step3();
            loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js').then(step3).catch(step3);
        };
        if (typeof window.firebase !== 'undefined') {
            step2();
        } else {
            loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js').then(step2).catch(reject);
        }
    });
    return _firebaseLoadPromise;
}

// =========================================================================
// 9. محرك التزامن التفاضلي (Delta Sync) + طابور الخروج المرتب (FIFO Outbox)
// + Dirty-Item Sync + system_epoch + Tombstones
// =========================================================================
let _emitTimeouts = {};
function emitSerajUpdate(collectionName, source = 'local') {
    try {
        let lockKey = collectionName + '_' + source;
        if (_emitTimeouts[lockKey]) clearTimeout(_emitTimeouts[lockKey]);
        _emitTimeouts[lockKey] = setTimeout(() => {
            delete _emitTimeouts[lockKey];
            window.dispatchEvent(new CustomEvent('seraj:updated', {
                detail: { collection: collectionName, source: source, timestamp: Date.now() }
            }));
        }, 80);
    } catch (e) {}
}

let _syncTimer = null;
let _scheduledSyncInterval = null;
let _outboxFlushPromise = null;
let _syncTargetTime = 0;
const CALM_SYNC_DELAY_MS = 2500;

function getSyncConfigInternal() {
    let saved = safeParseJSON(localStorage.getItem('seraj_sync_settings'), null);
    if (!saved || typeof saved !== 'object') {
        return {
            autoSync: true,
            intervalMs: 15000,
            syncOnSaveDelayMs: CALM_SYNC_DELAY_MS
        };
    }
    return {
        autoSync: saved.autoSync !== undefined ? Boolean(saved.autoSync) : true,
        intervalMs: Math.max(15000, parseInt(saved.intervalMs, 10) || 15000),
        syncOnSaveDelayMs: Math.max(500, parseInt(saved.syncOnSaveDelayMs, 10) || CALM_SYNC_DELAY_MS)
    };
}

function startScheduledSyncTimer() {
    if (_scheduledSyncInterval) clearInterval(_scheduledSyncInterval);
    if (window.SerajAuth.isOfflineSinglePlan()) return;
    let cfg = getSyncConfigInternal();
    if (cfg.autoSync !== false) {
        let ms = Math.max(15000, parseInt(cfg.intervalMs, 10) || 15000);
        _scheduledSyncInterval = setInterval(() => {
            if (cloudReady && navigator.onLine) {
                flushOutboxQueue();
            }
        }, ms);
    }
}

function scheduleSyncQueue(customDelayMs = null) {
    if (window.SerajAuth.isOfflineSinglePlan()) return;
    let cfg = getSyncConfigInternal();
    if (cfg.autoSync === false && customDelayMs === null) return;
    let delay = customDelayMs !== null ? customDelayMs : (cfg.syncOnSaveDelayMs || CALM_SYNC_DELAY_MS);
    let newTarget = Date.now() + delay;
    if (_syncTimer && _syncTargetTime > Date.now() && newTarget >= _syncTargetTime) return;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTargetTime = newTarget;
    _syncTimer = setTimeout(() => {
        _syncTimer = null;
        _syncTargetTime = 0;
        flushOutboxQueue();
    }, delay);
}

// --- طابور الخروج الواحد المرتب FIFO Outbox في IndexedDB ---
function _getOutbox() {
    let list = safeParseJSON(localStorage.getItem('seraj_outbox_queue'), []);
    return Array.isArray(list) ? list : [];
}

function _saveOutbox(list) {
    _internalSetItem('seraj_outbox_queue', JSON.stringify(Array.isArray(list) ? list : []));
}

function _getDocCloudKey(item) {
    if (!item) return '';
    let raw = item._cloudKey || item.id;
    return String(raw || '').replace(/[.#$\[\]\/\\]/g, '_');
}

let _outboxSeqCounter = 0;
function _nextOutboxSeq() {
    let now = Date.now();
    _outboxSeqCounter = (now > _outboxSeqCounter) ? now : (_outboxSeqCounter + 1);
    return _outboxSeqCounter;
}

function _sanitizeForFirebase(obj) {
    if (obj === null || obj === undefined) return null;
    try {
        return JSON.parse(JSON.stringify(obj, (k, v) => {
            if (typeof v === 'number' && !isFinite(v)) return 0;
            return v;
        }));
    } catch (e) {
        return null;
    }
}

function _quarantineDeadLetter(entry, reason) {
    try {
        let dead = safeParseJSON(localStorage.getItem('seraj_outbox_dead_letter'), []);
        if (!Array.isArray(dead)) dead = [];
        dead.push({
            ...entry,
            failedAt: Date.now(),
            reason: String(reason || 'unknown')
        });
        if (dead.length > 100) dead = dead.slice(-100);
        _internalSetItem('seraj_outbox_dead_letter', JSON.stringify(dead));
    } catch (e) {}
}

// إضافة عملية مفردة (Dirty-Item Sync) إلى طابور FIFO Outbox مع دمج التعديلات المتتالية لنفس العنصر
function enqueueOutboxOp(colName, itemId, opType = 'upsert', payload = null, immediate = false) {
    if (window.SerajAuth.isOfflineSinglePlan()) return;
    if (!colName || itemId === undefined || itemId === null || itemId === '') return;

    let cleanCol = String(colName).replace(/^seraj_/, '');
    let safeKey = String(itemId).replace(/[.#$\[\]\/\\]/g, '_');
    let outbox = _getOutbox();
    let now = getServerNow();

    // حذف أي عملية سابقة لنفس المستند في الطابور ثم الإضافة في النهاية للحفاظ على ترتيب FIFO لأحدث حالة
    outbox = outbox.filter(entry => !(entry && entry.col === cleanCol && entry.key === safeKey));

    let entryData = payload;
    if (opType === 'tombstone') {
        entryData = {
            ...(payload && typeof payload === 'object' ? payload : {}),
            id: itemId,
            isDeleted: true,
            isArchived: true,
            _deletedAt: now,
            _lastModified: now,
            _lastModifiedBy: myDeviceName
        };
    } else if (opType === 'upsert' && entryData && typeof entryData === 'object') {
        entryData = { ...entryData };
        if (!entryData._lastModified) entryData._lastModified = now;
        if (!entryData._cloudKey) entryData._cloudKey = safeKey;
    }

    outbox.push({
        seq: _nextOutboxSeq(),
        col: cleanCol,
        key: safeKey,
        op: opType, // 'upsert' | 'tombstone' | 'delete'
        data: entryData,
        retries: 0,
        ts: now
    });

    _saveOutbox(outbox);

    if (immediate) {
        flushOutboxQueue();
    } else {
        scheduleSyncQueue();
    }
}

function addToSyncQueue(colName, itemData, immediate = false) {
    if (!itemData || itemData.id === undefined || itemData.id === null) return;
    let key = _getDocCloudKey(itemData);
    enqueueOutboxOp(colName, key, 'upsert', itemData, immediate);
}

function addToDeleteQueue(colName, itemId, immediate = false, hardDelete = false) {
    if (itemId === undefined || itemId === null) return;
    let cleanCol = String(colName).replace(/^seraj_/, '');
    // منع الحذف الفيزيائي لحركات الخزينة تماماً
    if (cleanCol === 'treasury_moves') return;
    let op = hardDelete ? 'delete' : 'tombstone';
    enqueueOutboxOp(cleanCol, itemId, op, { id: itemId }, immediate);
}

window.saveActionToQueueSafely = function(actionObj) {
    try {
        if (actionObj && actionObj.col && actionObj.data && actionObj.data.id !== undefined) {
            addToSyncQueue(actionObj.col, actionObj.data);
        } else {
            scheduleSyncQueue();
        }
    } catch (e) {}
    return true;
};

// رفع طابور FIFO Outbox بالكامل وإرجاع Promise حقيقي لا ينتهي إلا بعد تمام الرفع
function flushOutboxQueue() {
    if (window.SerajAuth.isOfflineSinglePlan()) return Promise.resolve(true);
    if (_outboxFlushPromise) return _outboxFlushPromise;

    _outboxFlushPromise = (async () => {
        try {
            if (!cloudReady || !navigator.onLine || !window.dbCloud) return false;
            let storeRef = _getStoreCloudRef();
            if (!storeRef) return false;

            while (true) {
                let outbox = _getOutbox();
                if (outbox.length === 0) break;

                showCloudStatus(`⏳ جاري مزامنة (${outbox.length}) حركة...`);
                let batch = outbox.slice(0, 60);
                let updatesObj = {};
                let validEntries = [];
                let sentSigMap = new Map();
                let uploadNow = getServerNow();

                batch.forEach(entry => {
                    if (!entry || !entry.col || !entry.key) return;
                    let path = `${entry.col}/${entry.key}`;
                    if (entry.op === 'delete') {
                        if (entry.col === 'treasury_moves') {
                            sentSigMap.set(`${entry.col}|${entry.key}`, entry.seq);
                            return;
                        }
                        updatesObj[path] = null;
                        validEntries.push({ entry, path, val: null });
                    } else if (entry.data) {
                        let cleanCopy = _sanitizeForFirebase(entry.data);
                        if (cleanCopy && typeof cleanCopy === 'object') {
                            // تحديث _lastModified لحظة الرفع الفعلي لضمان التقاطها عبر Delta Sync في باقي الأجهزة دون تغيير date/timestamp المحاسبي
                            cleanCopy._lastModified = uploadNow;
                            updatesObj[path] = cleanCopy;
                            validEntries.push({ entry, path, val: cleanCopy });
                        } else {
                            _quarantineDeadLetter(entry, 'invalid_json_payload');
                            sentSigMap.set(`${entry.col}|${entry.key}`, entry.seq);
                        }
                    }
                });

                if (validEntries.length === 0) {
                    _saveOutbox(outbox.slice(batch.length));
                    continue;
                }

                let retryIncrementMap = new Map();
                let shouldBreakLoop = false;

                try {
                    await storeRef.update(updatesObj);
                    validEntries.forEach(({ entry }) => {
                        sentSigMap.set(`${entry.col}|${entry.key}`, entry.seq);
                    });
                } catch (batchErr) {
                    if (!navigator.onLine) throw batchErr;
                    // Poison Pill Fallback: عزل الحركة التالفة/المرفوضة فردياً حتى لا يتجمد طابور المزامنة
                    console.warn('Batch sync failed, activating Poison Pill Fallback:', batchErr);
                    for (let i = 0; i < validEntries.length; i++) {
                        let { entry, path, val } = validEntries[i];
                        let sigKey = `${entry.col}|${entry.key}`;
                        try {
                            if (val === null) await storeRef.child(path).remove();
                            else await storeRef.child(path).set(val);
                            sentSigMap.set(sigKey, entry.seq);
                        } catch (itemErr) {
                            let errCode = String(itemErr && itemErr.code || '').toUpperCase();
                            let errMsg = String(itemErr && itemErr.message || itemErr || '');
                            let isPermanentReject = (
                                errCode.includes('PERMISSION_DENIED') ||
                                errMsg.toLowerCase().includes('permission_denied') ||
                                errMsg.toLowerCase().includes('invalid') ||
                                (Number(entry.retries) || 0) >= 4
                            );
                            if (isPermanentReject) {
                                _quarantineDeadLetter(entry, errMsg);
                                sentSigMap.set(sigKey, entry.seq);
                            } else {
                                retryIncrementMap.set(sigKey, (Number(entry.retries) || 0) + 1);
                                shouldBreakLoop = true;
                                break;
                            }
                        }
                    }
                }

                // حذف العناصر التي رُفعت أو عُزلت، مع الإبقاء على أي عنصر عُدّل مجدداً أثناء الرفع
                let latestOutbox = _getOutbox();
                let remaining = latestOutbox.filter(entry => {
                    if (!entry || !entry.col || !entry.key) return false;
                    let sigKey = `${entry.col}|${entry.key}`;
                    if (retryIncrementMap.has(sigKey)) {
                        entry.retries = retryIncrementMap.get(sigKey);
                        return true;
                    }
                    let sentSeq = sentSigMap.get(sigKey);
                    if (sentSeq === undefined) return true;
                    return Number(entry.seq) > Number(sentSeq);
                });
                _saveOutbox(remaining);
                if (shouldBreakLoop) break;

                if (remaining.length === 0) {
                    showCloudStatus('✅ اكتملت المزامنة السحابية بنجاح');
                    break;
                }
            }
            return true;
        } catch (err) {
            console.error('FIFO Outbox Flush Error:', err);
            return false;
        } finally {
            _outboxFlushPromise = null;
        }
    })();

    return _outboxFlushPromise;
}

// =========================================================================
// 10. محرك التزامن السحابي (Delta Sync + system_epoch + max_devices + expiry_ts)
// =========================================================================
let localCollectionsCache = {};
let renderTimers = {};
let _dirtySaveTimers = {};
let _dirtySaveFlushers = {};

function _flushAllDirtyTimersSync() {
    Object.keys(_dirtySaveFlushers).forEach(col => {
        if (_dirtySaveTimers[col]) {
            clearTimeout(_dirtySaveTimers[col]);
            delete _dirtySaveTimers[col];
        }
        let fn = _dirtySaveFlushers[col];
        delete _dirtySaveFlushers[col];
        if (typeof fn === 'function') {
            try { fn(); } catch (e) {}
        }
    });
}

window.addEventListener('pagehide', _flushAllDirtyTimersSync);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') _flushAllDirtyTimersSync();
});
let _notifiedSmartNotes = {};

const SYNCED_COLLECTIONS = [
    'products',
    'customers',
    'suppliers',
    'customer_vouchers',
    'supplier_vouchers',
    'sales_invoices',
    'purchase_invoices',
    'treasury_moves',
    'smart_notes'
];

// حفظ عنصر واحد متغير (Dirty-Item Sync) مباشرة دون مقارنة المصفوفة كاملة
function saveDirtyItem(colName, itemData, immediate = false) {
    let cleanCol = String(colName).replace(/^seraj_/, '');
    if (!itemData || itemData.id === undefined) return;
    itemData._lastModified = getServerNow();
    itemData._lastModifiedBy = myDeviceName;
    if (!itemData._cloudKey) {
        itemData._cloudKey = _getDocCloudKey(itemData);
    }

    let list = safeParseJSON(localStorage.getItem('seraj_' + cleanCol), []);
    let idx = list.findIndex(x => x && String(x.id) === String(itemData.id));
    if (idx > -1) list[idx] = itemData;
    else list.unshift(itemData);

    _internalSetItem('seraj_' + cleanCol, JSON.stringify(list));
    localCollectionsCache[cleanCol] = [...list];
    if (!window.SerajAuth.isOfflineSinglePlan()) {
        _internalSetItem('seraj_cloud_cache_' + cleanCol, JSON.stringify(list));
        addToSyncQueue(cleanCol, itemData, immediate);
    }
    emitSerajUpdate(cleanCol, 'local');
}

// حفظ مصفوفة مع Dirty-Item Diff خفيف (يمنع الحذف الفيزيائي لـ treasury_moves)
function saveArrayToQueueSafely(colName, newArray) {
    if (!Array.isArray(newArray)) newArray = [];
    let cleanCol = String(colName).replace(/^seraj_/, '');
    localCollectionsCache[cleanCol] = [...newArray];
    emitSerajUpdate(cleanCol, 'local');

    if (window.SerajAuth.isOfflineSinglePlan()) {
        return;
    }

    if (_dirtySaveTimers[cleanCol]) clearTimeout(_dirtySaveTimers[cleanCol]);
    const _runDirtyDiff = () => {
        delete _dirtySaveFlushers[cleanCol];
        delete _dirtySaveTimers[cleanCol];
        try {
            let rawOldCache = localStorage.getItem('seraj_cloud_cache_' + cleanCol);
            if (!rawOldCache) {
                let outbox = _getOutbox();
                let now = getServerNow();
                newArray.forEach(item => {
                    if (!item || item.id === undefined || item.id === null) return;
                    let key = _getDocCloudKey(item);
                    if (!item._lastModified) item._lastModified = now;
                    outbox = outbox.filter(e => !(e.col === cleanCol && e.key === key));
                    outbox.push({ seq: now + Math.random(), col: cleanCol, key, op: 'upsert', data: item, ts: now });
                });
                _saveOutbox(outbox);
                _internalSetItem('seraj_cloud_cache_' + cleanCol, JSON.stringify(newArray));
                scheduleSyncQueue(1000);
                return;
            }

            let oldArray = safeParseJSON(rawOldCache, []);
            let oldMap = new Map(oldArray.map(i => [String(i?.id), i]));
            let changedItems = [];

            newArray.forEach(newItem => {
                if (!newItem || newItem.id === undefined) return;
                let id = String(newItem.id);
                let oldItem = oldMap.get(id);
                if (!oldItem || JSON.stringify(_stripComputedFieldsForDiff(oldItem)) !== JSON.stringify(_stripComputedFieldsForDiff(newItem))) {
                    if (!newItem._lastModified || (oldItem && Number(newItem._lastModified) <= Number(oldItem._lastModified || 0))) {
                        newItem._lastModified = getServerNow();
                    }
                    changedItems.push(newItem);
                }
            });

            if (changedItems.length > 0) {
                let outbox = _getOutbox();
                let now = getServerNow();
                changedItems.forEach(item => {
                    let key = _getDocCloudKey(item);
                    outbox = outbox.filter(e => !(e.col === cleanCol && e.key === key));
                    outbox.push({ seq: now + Math.random(), col: cleanCol, key, op: 'upsert', data: item, ts: now });
                });
                _saveOutbox(outbox);
                scheduleSyncQueue(1000);
            }

            // ملاحظة دستورية: ممنوع الحذف الفيزيائي لـ treasury_moves هنا نهائياً
            _internalSetItem('seraj_cloud_cache_' + cleanCol, JSON.stringify(newArray));
        } catch (e) {
            console.error('Dirty Queue Sync Error:', e);
        }
    };
    const _isCriticalFinancialCol = (
        cleanCol === 'sales_invoices' ||
        cleanCol === 'purchase_invoices' ||
        cleanCol === 'treasury_moves' ||
        cleanCol === 'customer_vouchers' ||
        cleanCol === 'supplier_vouchers'
    );
    if (_isCriticalFinancialCol) {
        _runDirtyDiff();
    } else {
        _dirtySaveFlushers[cleanCol] = _runDirtyDiff;
        _dirtySaveTimers[cleanCol] = setTimeout(_runDirtyDiff, 30);
    }
}

// رادارات التزامن التفاضلي (Delta Sync بـ orderByChild('_lastModified').startAt(lastSyncTs)) + system_epoch
function startSmartRadars() {
    if (!cloudReady || !window.dbCloud || window.SerajAuth.isOfflineSinglePlan()) return;
    let storeRef = _getStoreCloudRef();
    if (!storeRef) return;

    // 1. مراقبة system_epoch لإجبار الأجهزة الأوفلاين على التحديث بعد الاستعادة أو تصفير المصنع
    let epochRef = storeRef.child('meta/system_epoch');
    epochRef.off();
    epochRef.on('value', async (snap) => {
        if (!snap.exists()) return;
        let cloudEpoch = Number(snap.val() || 0);
        let localEpoch = Number(localStorage.getItem('seraj_system_epoch') || '0');
        if (localEpoch > 0 && cloudEpoch > localEpoch) {
            _internalSetItem('seraj_system_epoch', String(cloudEpoch));
            // مسح طوابير الرفع القديمة ومنع الكتابة العكسية ثم سحب نظيف كامل
            _saveOutbox([]);
            SYNCED_COLLECTIONS.forEach(c => localStorage.removeItem('seraj_last_sync_ts_' + c));
            if (window.DB && typeof window.DB._pullFullCleanStateFromCloud === 'function') {
                showCloudStatus('🔄 تم تحديث قاعدة البيانات من المالك، جاري التزامن...');
                await window.DB._pullFullCleanStateFromCloud(true);
            }
        } else if (localEpoch === 0 && cloudEpoch > 0) {
            _internalSetItem('seraj_system_epoch', String(cloudEpoch));
        }
    });

    // 2. التزامن التفاضلي (Delta Sync) لكل مجموعة
    SYNCED_COLLECTIONS.forEach(col => {
        let lastTs = parseInt(localStorage.getItem('seraj_last_sync_ts_' + col) || '0', 10) || 0;
        let baseRef = storeRef.child(col);
        baseRef.off();

        let queryRef = lastTs > 0
            ? baseRef.orderByChild('_lastModified').startAt(Math.max(0, lastTs - 5000))
            : baseRef;

        const onIncoming = (snap) => {
            let val = snap.val();
            if (!val || typeof val !== 'object') return;
            let mod = Number(val._lastModified || 0);
            if (mod > 0) {
                let prevMax = parseInt(localStorage.getItem('seraj_last_sync_ts_' + col) || '0', 10) || 0;
                if (mod > prevMax) _internalSetItem('seraj_last_sync_ts_' + col, String(mod));
            }
            updateLocalSingleItem(col, val);
        };

        queryRef.on('child_added', onIncoming);
        queryRef.on('child_changed', onIncoming);
        baseRef.on('child_removed', (snap) => {
            if (col === 'treasury_moves') return; // حماية كاميرا الخزينة
            removeLocalSingleItem(col, snap.key);
        });
    });

    // 3. رادار أرصدة الخزائن
    let vaultsRef = storeRef.child('vaults_v2');
    vaultsRef.off();
    vaultsRef.on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        let incomingStr = JSON.stringify(snapshot.val());
        if (incomingStr === localStorage.getItem('seraj_vaults_v2')) return;
        _internalSetItem('seraj_vaults_v2', incomingStr);
        emitSerajUpdate('vaults_v2', 'cloud');
        if (typeof updateTreasuryUI === 'function' && window.DB && !window.DB._isSavingVaults) {
            window.DB._isSavingVaults = true;
            try { updateTreasuryUI(); } catch (e) {}
            setTimeout(() => { window.DB._isSavingVaults = false; }, 200);
        }
    });

    // 4. رادار عدادات الفواتير
    let countersRef = storeRef.child('invoice_counters');
    countersRef.off();
    countersRef.on('value', (snapshot) => {
        if (snapshot.exists() && window.DB && typeof window.DB._mergeInvoiceCounters === 'function') {
            window.DB._mergeInvoiceCounters(snapshot.val(), false);
        }
    });

    // 5. رادار إعدادات الصوت والقاموس والوحدات
    let voiceRef = storeRef.child('voice_studio_v5');
    voiceRef.off();
    voiceRef.on('value', (snapshot) => {
        if (snapshot.exists() && window.DB && typeof window.DB._getVoiceStorageKey === 'function') {
            let vCfg = snapshot.val();
            if (vCfg.sales && vCfg.sales.settings) _internalSetItem(window.DB._getVoiceStorageKey('settings', 'sales'), JSON.stringify(vCfg.sales.settings));
            if (vCfg.purchases && vCfg.purchases.settings) _internalSetItem(window.DB._getVoiceStorageKey('settings', 'purchases'), JSON.stringify(vCfg.purchases.settings));
            if (vCfg.inventory && vCfg.inventory.settings) _internalSetItem(window.DB._getVoiceStorageKey('settings', 'inventory'), JSON.stringify(vCfg.inventory.settings));
            if (vCfg.units) _internalSetItem(window.DB._getVoiceStorageKey('units'), JSON.stringify(vCfg.units));
            if (vCfg.dictionary) _internalSetItem(window.DB._getVoiceStorageKey('dict'), JSON.stringify(vCfg.dictionary));
            if (typeof SmartVoice !== 'undefined') SmartVoice._invalidateShadowCache();
            emitSerajUpdate('voice_config', 'cloud');
        }
    });
}

// تهيئة السحابة (مغلقة بوابة SerajMegaDB.ready + فحص الباقة + max_devices + expiry_ts بتوقيت السيرفر)
async function initCloud() {
    await window.SerajMegaDB.ready;
    currentStoreId = getActiveStoreId();
    window.SerajAuth.applyRoleGuards();

    // 1. وضع باقة جهاز واحد أوفلاين (0 استهلاك Firebase + تحقق إلزامي من الشهادة على كل الصفحات)
    if (window.SerajAuth.isOfflineSinglePlan()) {
        cloudReady = false;
        if (!window.SerajAuth.verifyOfflineCertificate()) {
            if (!_isEntryIndexPage) {
                await window.SerajAuth.signOut();
            }
            window.dispatchEvent(new CustomEvent('seraj:cloudReady', { detail: { mode: 'invalid_offline_cert', storeId: '' } }));
            return;
        }
        window.SerajAuth._purgeOfflineCloudResidue();
        await window.SerajAuth.requestPersistentStorage();
        window.SerajAuth.checkOfflineBackupReminder();
        if (window.DB && typeof window.DB.checkAutoNightlyEmail === 'function') {
            window.DB.checkAutoNightlyEmail();
        }
        window.dispatchEvent(new CustomEvent('seraj:cloudReady', { detail: { mode: 'offline_single', storeId: currentStoreId } }));
        return;
    }

    // 2. إذا غاب storeId تُجهض أي عملية سحابية فوراً (ممنوع DemoStore)
    if (!currentStoreId) {
        cloudReady = false;
        return;
    }

    if (!navigator.onLine) {
        cloudReady = false;
        showCloudStatus('📴 وضع الأوفلاين (بياناتك محفوظة محلياً)');
        window.dispatchEvent(new CustomEvent('seraj:cloudReady', { detail: { mode: 'offline', storeId: currentStoreId } }));
        return;
    }

    try {
        await ensureFirebaseSDKLoaded();
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        window.dbCloud = firebase.database();

        // التحقق الصارم من جلسة Firebase Auth ومطابقة storeId ومنع التلاعب المحلي
        if (typeof firebase.auth === 'function') {
            let authUser = await new Promise((resolve) => {
                let settled = false;
                let timer = setTimeout(() => {
                    if (!settled) { settled = true; resolve(firebase.auth().currentUser || null); }
                }, 6000);
                firebase.auth().onAuthStateChanged(async (u) => {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timer);
                        resolve(u || null);
                    } else if (!u && !_isEntryIndexPage && !window.SerajAuth.isOfflineSinglePlan()) {
                        await window.SerajAuth.signOut();
                    } else if (u) {
                        await window.SerajAuth.syncAuthClaims(u);
                    }
                });
            });

            if (!authUser) {
                cloudReady = false;
                if (!_isEntryIndexPage) {
                    await window.SerajAuth.signOut();
                    return;
                }
                window.dispatchEvent(new CustomEvent('seraj:cloudReady', { detail: { mode: 'unauthenticated', storeId: '' } }));
                return;
            }

            let claims = await window.SerajAuth.syncAuthClaims(authUser);
            let claimedStore = (claims && claims.storeId) ? String(claims.storeId).trim().replace(/[.#$\[\]\/\\]/g, '_') : '';
            if (!claimedStore || claimedStore !== currentStoreId) {
                cloudReady = false;
                await window.SerajAuth.signOut();
                return;
            }
        }

        // مزامنة فرق التوقيت مع السيرفر واستقرار جلسة Auth قبل فحص meta وتشغيل الرادارات
        const _waitServerTimeAndAuthReady = async () => {
            await new Promise((resolve) => {
                let done = false;
                const finish = () => { if (!done) { done = true; resolve(); } };
                setTimeout(finish, 2000);
                window.dbCloud.ref('.info/serverTimeOffset').on('value', (snap) => {
                    _serverTimeOffset = Number(snap.val() || 0);
                    finish();
                });
            });
            if (typeof firebase.auth === 'function' && !firebase.auth().currentUser) {
                await new Promise((resolve) => {
                    let done = false;
                    let unsub = null;
                    const finish = () => {
                        if (!done) {
                            done = true;
                            if (typeof unsub === 'function') { try { unsub(); } catch (e) {} }
                            resolve();
                        }
                    };
                    setTimeout(finish, 2500);
                    unsub = firebase.auth().onAuthStateChanged(() => finish());
                });
            }
        };
        await _waitServerTimeAndAuthReady();

        let storeRef = _getStoreCloudRef();
        if (!storeRef) return;

        // فحص بيانات الاشتراك (expiry_ts بتوقيت السيرفر + max_devices)
        let metaSnap = await storeRef.child('meta').once('value').catch(() => null);
        if (metaSnap && metaSnap.exists()) {
            let meta = metaSnap.val() || {};
            let serverNow = getServerNow();

            if (meta.plan) _internalSetItem('seraj_plan', String(meta.plan).toLowerCase());
            if (meta.max_devices) _internalSetItem('seraj_max_devices', String(meta.max_devices));
            if (meta.expiry_ts) _internalSetItem('seraj_expiry_ts', String(meta.expiry_ts));

            // التحقق من انتهاء الاشتراك بتوقيت السيرفر
            if (meta.expiry_ts && Number(meta.expiry_ts) > 0 && serverNow > Number(meta.expiry_ts)) {
                cloudReady = false;
                showCloudStatus('⛔ انتهت صلاحية الاشتراك السحابي');
                window.SerajAlert('⛔ انتهت صلاحية الاشتراك لهذا المحل. يرجى التواصل مع الدعم الفني للتجديد (بياناتك المحلية ما زالت محفوظة بأمان).', 'error');
                window.dispatchEvent(new CustomEvent('seraj:cloudReady', { detail: { mode: 'expired', storeId: currentStoreId } }));
                return;
            }

            // التحقق من حد الأجهزة المسموح بها (max_devices)
            let maxDevs = parseInt(meta.max_devices, 10) || 5;
            let devicesMap = (meta.devices && typeof meta.devices === 'object') ? meta.devices : {};
            let registeredIds = Object.keys(devicesMap);
            if (!devicesMap[myDeviceId] && registeredIds.length >= maxDevs) {
                cloudReady = false;
                window.SerajAlert(`⛔ تم الوصول للحد الأقصى للأجهزة المسموح بها في باقتك (${maxDevs} أجهزة). يرجى إزالة جهاز قديم أو الترقية.`, 'error');
                window.dispatchEvent(new CustomEvent('seraj:cloudReady', { detail: { mode: 'device_limit', storeId: currentStoreId } }));
                return;
            }

            // تسجيل/تحديث بصمة هذا الجهاز
            storeRef.child(`meta/devices/${myDeviceId}`).set({
                deviceId: myDeviceId,
                name: myDeviceName,
                prefix: myDevicePrefix,
                role: window.SerajAuth.getSession().role,
                lastSeen: serverNow
            }).catch(() => {});
        }

        cloudReady = true;
        showCloudStatus('⚡ متصل بالسحابة: ' + currentStoreId);
        startSmartRadars();
        startScheduledSyncTimer();
        scheduleSyncQueue(4000);

        if (typeof checkAndRunAutoCloudBackup === 'function') {
            setTimeout(() => checkAndRunAutoCloudBackup(), 6000);
        }
        if (window.DB && typeof window.DB.flushEmailQueue === 'function') {
            setTimeout(() => {
                window.DB.flushEmailQueue();
                window.DB.checkAutoNightlyEmail();
            }, 8000);
        }

        // إطلاق حدث الجاهزية الرسمي بدلاً من setTimeout عشوائي
        window.dispatchEvent(new CustomEvent('seraj:cloudReady', {
            detail: { mode: 'online', storeId: currentStoreId, plan: window.SerajAuth.getSession().plan }
        }));
    } catch (err) {
        console.error('initCloud Error:', err);
        cloudReady = false;
        window.dispatchEvent(new CustomEvent('seraj:cloudReady', { detail: { mode: 'error', error: err.message } }));
    }
}

window.addEventListener('online', () => {
    if (window.SerajAuth.isOfflineSinglePlan()) {
        if (window.DB && typeof window.DB.flushEmailQueue === 'function') window.DB.flushEmailQueue();
        return;
    }
    showCloudStatus('🌐 عاد الاتصال بالإنترنت! جاري المزامنة...');
    if (!cloudReady && getActiveStoreId()) {
        initCloud();
    } else if (cloudReady) {
        scheduleSyncQueue(2000);
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine && cloudReady && window.dbCloud && !window.SerajAuth.isOfflineSinglePlan()) {
        try { window.dbCloud.goOnline(); } catch (e) {}
        scheduleSyncQueue(3000);
    }
});

window.addEventListener('click', function _initNotePerms() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
    window.removeEventListener('click', _initNotePerms);
}, { once: true });

function triggerSmartNoteNotification(data) {
    let sender = data.updatedBy || data._lastModifiedBy || data._device || 'جهاز بالمحل';
    let noteTitle = data.title || data.name || data.text || 'قائمة نواقص / ملاحظة';
    let itemsCount = Array.isArray(data.items) ? data.items.length : 0;

    let notifTitle = `📝 نوتة جديدة من: ${sender}`;
    let notifBody = itemsCount > 0 ? `العنوان: ${noteTitle} - عدد الأصناف: ${itemsCount}` : `المحتوى: ${noteTitle}`;

    showCloudStatus(`${notifTitle} (${noteTitle})`);
    playSmartNoteTone();

    if ('Notification' in window && Notification.permission === 'granted') {
        let notifOptions = {
            body: notifBody,
            icon: './icon.png',
            badge: './icon.png',
            tag: 'seraj_note_' + data.id,
            renotify: true,
            vibrate: [200, 100, 200]
        };
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(notifTitle, notifOptions);
            }).catch(() => {
                try { new Notification(notifTitle, notifOptions); } catch (e) {}
            });
        } else {
            try { new Notification(notifTitle, notifOptions); } catch (e) {}
        }
    }
}

function updateLocalSingleItem(col, data) {
    if (!data || data.id === undefined) return;
    if (col === 'treasury_moves') {
        let mId = String(data.id || '');
        if (data._isInvoice === true || data._isMergedInvoice === true || mId.endsWith('_vouch') || mId.endsWith('_cash') || mId.endsWith('_inv_sale') || mId.endsWith('_inv_purch')) {
            return;
        }
    }
    if (col === 'smart_notes') {
        data.id = String(data.id);
    }

    let docId = String(data.id);
    let docKey = _getDocCloudKey(data);

    // لا تستبدل عنصراً ما زال في طابور الرفع المحلي (Outbox)
    let outbox = _getOutbox();
    if (outbox.some(e => e && e.col === col && (e.key === docKey || e.key === docId))) return;

    if (!localCollectionsCache[col]) {
        localCollectionsCache[col] = safeParseJSON(localStorage.getItem('seraj_' + col), []);
    }
    let arr = localCollectionsCache[col];
    let existingIndex = docKey
        ? arr.findIndex(item => item && item._cloudKey && String(item._cloudKey) === docKey)
        : -1;
    if (existingIndex === -1) {
        existingIndex = arr.findIndex(item => {
            if (!item || String(item.id) !== docId) return false;
            if (item._cloudKey && data._cloudKey && String(item._cloudKey) !== String(data._cloudKey)) return false;
            return true;
        });
    }
    if (existingIndex === -1 && arr.some(item => item && String(item.id) === docId)) {
        data._idCollision = true;
    }

    let isChangedOrNew = false;
    if (existingIndex > -1) {
        let localItem = arr[existingIndex];
        let localMod = Number(localItem?._lastModified || 0);
        let cloudMod = Number(data?._lastModified || 0);
        if (localMod > 0 && cloudMod > 0 && localMod > cloudMod) return;
        if (JSON.stringify(_stripComputedFieldsForDiff(localItem)) === JSON.stringify(_stripComputedFieldsForDiff(data))) return;
        arr[existingIndex] = data;
        isChangedOrNew = true;
    } else {
        arr.push(data);
        isChangedOrNew = true;
    }

    if (col === 'smart_notes' && isChangedOrNew && !data.isDeleted) {
        let modTime = Number(data._lastModified || data.timestamp || 0);
        let isRecent = modTime > 0 && (getServerNow() - modTime) < 120000;
        let isDifferentSession = data._senderUid ? (data._senderUid !== myDeviceUid) : (data.updatedBy !== myDeviceName);

        if (isRecent && isDifferentSession && _notifiedSmartNotes[docId] !== modTime) {
            _notifiedSmartNotes[docId] = modTime;
            triggerSmartNoteNotification(data);
        }
    }

    if (renderTimers[col]) clearTimeout(renderTimers[col]);
    renderTimers[col] = setTimeout(() => saveAndRenderLocal(col, localCollectionsCache[col]), 180);
}

function removeLocalSingleItem(col, docKey) {
    if (col === 'treasury_moves') return;
    if (!localCollectionsCache[col]) {
        localCollectionsCache[col] = safeParseJSON(localStorage.getItem('seraj_' + col), []);
    }
    localCollectionsCache[col] = localCollectionsCache[col].filter(item => {
        if (!item) return false;
        return String(item.id) !== String(docKey) && _getDocCloudKey(item) !== String(docKey);
    });

    if (renderTimers[col]) clearTimeout(renderTimers[col]);
    renderTimers[col] = setTimeout(() => saveAndRenderLocal(col, localCollectionsCache[col]), 200);
}

function saveAndRenderLocal(col, localArray) {
    if (col.includes('invoices') || col === 'treasury_moves' || col.includes('vouchers')) {
        localArray.sort((a, b) => {
            let timeDiff = window.Utils.getSafeTime(b.timestamp || b.date) - window.Utils.getSafeTime(a.timestamp || a.date);
            if (timeDiff !== 0) return timeDiff;
            return window.Utils.extractSerialNum(b.id) - window.Utils.extractSerialNum(a.id);
        });
    }
    _internalSetItem('seraj_' + col, JSON.stringify(localArray));
    _internalSetItem('seraj_cloud_cache_' + col, JSON.stringify(localArray));

    let isEditingLocked = (typeof isEditingNow !== 'undefined' && Boolean(isEditingNow));
    emitSerajUpdate(col, 'cloud');

    try {
        if (!isEditingLocked) {
            if (col === 'products' && typeof renderInventoryTable === 'function') renderInventoryTable();
            if (col === 'sales_invoices' && typeof renderInvoicesHistory === 'function') renderInvoicesHistory();
            if (col === 'purchase_invoices') {
                if (typeof renderPurchasesHistory === 'function') renderPurchasesHistory();
                else if (typeof renderInvoicesHistory === 'function') renderInvoicesHistory();
            }
        }

        if (col === 'customers' || col === 'customer_vouchers') {
            if (typeof renderCustomersList === 'function') renderCustomersList();
            if (typeof currentActiveCustomerId !== 'undefined' && currentActiveCustomerId && window.DB) {
                let activeCust = window.DB.calculateCustomerBalances(currentActiveCustomerId);
                if (typeof updateAccountSummary === 'function') updateAccountSummary(activeCust);
                if (typeof renderAccountTransactions === 'function') renderAccountTransactions(activeCust);
                if (typeof renderStatementTable === 'function') renderStatementTable(activeCust);
            }
        }

        if (col === 'suppliers' || col === 'supplier_vouchers') {
            if (typeof renderSuppliersList === 'function') renderSuppliersList();
            if (typeof currentActiveSupplierId !== 'undefined' && currentActiveSupplierId && window.DB) {
                let activeSupp = window.DB.calculateSupplierBalances(currentActiveSupplierId);
                if (typeof updateAccountSummary === 'function') updateAccountSummary(activeSupp);
                if (typeof renderAccountTransactions === 'function') renderAccountTransactions(activeSupp);
                let stmtView = document.getElementById('supplier-statement-view');
                if (stmtView && stmtView.classList.contains('active-view') && typeof renderStatementTable === 'function') {
                    renderStatementTable(activeSupp);
                }
            }
            if (typeof populateSuppliers === 'function') populateSuppliers();
        }

        if (col === 'smart_notes' && typeof renderNotesList === 'function') renderNotesList();

        if (col === 'treasury_moves' || col === 'sales_invoices' || col === 'purchase_invoices') {
            if (window.DB && typeof window.DB.recalculateVaultBalances === 'function') {
                window.DB.recalculateVaultBalances(true);
            }
            if (col === 'treasury_moves') {
                if (typeof renderMovementsTable === 'function') renderMovementsTable();
                if (typeof updateTreasuryUI === 'function' && window.DB && !window.DB._isSavingVaults) {
                    window.DB._isSavingVaults = true;
                    try { updateTreasuryUI(); } catch (e) {}
                    setTimeout(() => { window.DB._isSavingVaults = false; }, 200);
                }
            }
        }

        if (typeof calculateCollectedData === 'function') calculateCollectedData();
        if (typeof calculateOverviewStats === 'function') calculateOverviewStats();
        if (typeof runSmartInventory === 'function') {
            try {
                runSmartInventory('shortages');
                runSmartInventory('suppliers');
            } catch (e) {}
        }
    } catch (e) {}
}

// =========================================================================
// 11. كائن قاعدة البيانات المركزي window.DB (بداية المحرك المحاسبي والمخزني)
// =========================================================================
window.DB = {
    _isCalculatingBalances: false,
    _hideZeroCustomersByDefault: false,
    _isSavingVaults: false,
    _isSavingSmartNotes: false,
    _isSavingTreasury: false,

    getSyncSettings: function() {
        return getSyncConfigInternal();
    },

    saveSyncSettings: function(newSettings = {}) {
        let current = getSyncConfigInternal();
        let merged = {
            autoSync: newSettings.autoSync !== undefined ? Boolean(newSettings.autoSync) : current.autoSync,
            intervalMs: Math.max(15000, parseInt(newSettings.intervalMs ?? current.intervalMs, 10) || 15000),
            syncOnSaveDelayMs: Math.max(500, parseInt(newSettings.syncOnSaveDelayMs ?? current.syncOnSaveDelayMs, 10) || CALM_SYNC_DELAY_MS)
        };
        _internalSetItem('seraj_sync_settings', JSON.stringify(merged));
        startScheduledSyncTimer();
        emitSerajUpdate('sync_settings', 'local');
        return merged;
    },

    // يرجع Promise حقيقي لا ينتهي إلا بعد تمام رفع طابور FIFO Outbox بالكامل
    syncNow: async function() {
        if (window.SerajAuth.isOfflineSinglePlan()) {
            showCloudStatus('🔒 باقة أوفلاين: البيانات محفوظة محلياً بأمان');
            return true;
        }
        if (_syncTimer) {
            clearTimeout(_syncTimer);
            _syncTimer = null;
            _syncTargetTime = 0;
        }
        if (!cloudReady || !navigator.onLine || !window.dbCloud) {
            showCloudStatus('⚠️ الجهاز أوفلاين - سيتم الرفع تلقائياً فور عودة الإنترنت');
            return false;
        }
        showCloudStatus('⚡ جاري المزامنة الفورية مع السحابة...');
        return await flushOutboxQueue();
    },

    _pullFullCleanStateFromCloud: async function(autoReload = true) {
        let storeRef = _getStoreCloudRef();
        if (!storeRef || !navigator.onLine) return false;
        let snapshot = await storeRef.once('value');
        if (!snapshot.exists()) return false;

        let data = snapshot.val() || {};
        let safeArray = (obj) => (obj && typeof obj === 'object') ? Object.values(obj).filter(Boolean) : [];
        let now = getServerNow();

        SYNCED_COLLECTIONS.forEach(col => {
            let arr = safeArray(data[col]);
            if (col === 'treasury_moves') {
                arr = arr.filter(m => {
                    let mId = String(m.id || '');
                    return !(m._isInvoice === true || m._isMergedInvoice === true || mId.endsWith('_vouch') || mId.endsWith('_cash') || mId.endsWith('_inv_sale') || mId.endsWith('_inv_purch'));
                });
            }
            if (col === 'smart_notes') {
                arr = arr.map(n => ({ ...n, id: String(n.id) }));
            }
            _internalSetItem('seraj_' + col, JSON.stringify(arr));
            _internalSetItem('seraj_cloud_cache_' + col, JSON.stringify(arr));
            _internalSetItem('seraj_last_sync_ts_' + col, String(now));
            localCollectionsCache[col] = arr;
        });

        if (data.vaults_v2) _internalSetItem('seraj_vaults_v2', JSON.stringify(data.vaults_v2));
        if (data.invoice_counters) _internalSetItem('seraj_invoice_counters', JSON.stringify(data.invoice_counters));
        if (data.meta && data.meta.system_epoch) _internalSetItem('seraj_system_epoch', String(data.meta.system_epoch));

        if (!data.vaults_v2) {
            let recalcVaults = this.recalculateVaultBalances(false);
            _internalSetItem('seraj_vaults_v2', JSON.stringify(recalcVaults));
        }

        _saveOutbox([]);

        if (window.SerajMegaDB && typeof window.SerajMegaDB.setBatch === 'function' && window._serajRAM) {
            let _pullBatchEntries = [];
            window._serajRAM.forEach((v, k) => {
                if (String(k).startsWith('seraj_')) _pullBatchEntries.push([k, v]);
            });
            if (_pullBatchEntries.length > 0) {
                await window.SerajMegaDB.setBatch(_pullBatchEntries);
            }
        }

        if (autoReload) {
            _broadcastTabChange('reload_required', 'all', null);
            window.location.reload();
        }
        return true;
    },

    syncFromCloud: async function() {
        if (window.SerajAuth.isOfflineSinglePlan()) {
            window.SerajAlert('هذه النسخة تعمل بباقة الأوفلاين الدائمة ولا تستخدم السحابة.', 'info');
            return false;
        }
        if (!cloudReady && navigator.onLine && getActiveStoreId()) {
            try { await initCloud(); } catch (e) {}
        }
        if (!cloudReady || !navigator.onLine || !window.dbCloud || !getActiveStoreId()) {
            window.SerajAlert('يجب الاتصال بالإنترنت وتسجيل الدخول لسحب بيانات المحل من السحابة!', 'error');
            return false;
        }

        return new Promise((resolve) => {
            window.SerajConfirm('سيتم مسح الذاكرة المؤقتة لهذا الجهاز وتحميل البيانات الموحدة من السحابة بالكامل. هل أنت متأكد؟', async (confirm) => {
                if (!confirm) return resolve(false);
                showCloudStatus('⏳ جاري تحميل بيانات المحل من السحابة...');
                try {
                    let ok = await this._pullFullCleanStateFromCloud(false);
                    if (ok) {
                        window.SerajAlert('✅ تم تحميل وتوحيد بيانات المحل بنجاح! سيتم تحديث الصفحة الآن.', 'success', () => {
                            window.location.reload();
                        });
                        resolve(true);
                    } else {
                        window.SerajAlert('⚠️ لا توجد بيانات سحابية مسجلة لهذا المحل حالياً.', 'error');
                        resolve(false);
                    }
                } catch (err) {
                    console.error(err);
                    window.SerajAlert('خطأ في الاتصال بالسحابة: ' + err.message, 'error');
                    resolve(false);
                }
            });
        });
    },

    _mergeInvoiceCounters: function(incomingCounters, pushToCloud = true) {
        if (!incomingCounters || typeof incomingCounters !== 'object') return;
        let current = safeParseJSON(localStorage.getItem('seraj_invoice_counters'), { sales: {}, purchases: {} });
        if (!current.sales || typeof current.sales !== 'object') current.sales = {};
        if (!current.purchases || typeof current.purchases !== 'object') current.purchases = {};

        let changed = false;
        let cloudPatch = {};

        ['sales', 'purchases'].forEach(typeKey => {
            let src = incomingCounters[typeKey];
            if (!src || typeof src !== 'object') return;
            Object.keys(src).forEach(prefix => {
                let cleanPrefix = String(prefix || '').trim().toUpperCase();
                let incomingVal = parseInt(src[prefix], 10);
                if (!cleanPrefix || isNaN(incomingVal) || incomingVal < 100) return;
                let currVal = parseInt(current[typeKey][cleanPrefix], 10) || 99;
                if (incomingVal > currVal) {
                    current[typeKey][cleanPrefix] = incomingVal;
                    cloudPatch[`${typeKey}/${cleanPrefix}`] = incomingVal;
                    changed = true;
                }
            });
        });

        if (changed) {
            _internalSetItem('seraj_invoice_counters', JSON.stringify(current));
            if (pushToCloud && cloudReady && navigator.onLine && !window.SerajAuth.isOfflineSinglePlan()) {
                let ref = _getStoreCloudRef('invoice_counters');
                if (ref && Object.keys(cloudPatch).length > 0) {
                    ref.update(cloudPatch).catch(() => {});
                }
            }
        }
    },

    _updateInvoiceCountersFromList: function(typeKey, invoicesList, pushToCloud = true) {
        if (!Array.isArray(invoicesList) || invoicesList.length === 0) return;
        let bucket = {};
        invoicesList.forEach(inv => {
            let invNo = String(inv?.invoiceNo || inv?.id || '').trim().toUpperCase();
            let parts = invNo.split('-');
            let prefix = '';
            let numPart = NaN;
            if (parts.length === 3 && (parts[0] === 'S' || parts[0] === 'P')) {
                prefix = parts[1];
                numPart = parseInt(parts[2], 10);
            } else if (parts.length === 2) {
                prefix = parts[0];
                numPart = parseInt(parts[1], 10);
            }
            if (prefix && !isNaN(numPart) && numPart >= 100) {
                if (!bucket[prefix] || numPart > bucket[prefix]) bucket[prefix] = numPart;
            }
        });
        if (Object.keys(bucket).length > 0) {
            let patch = {};
            patch[typeKey] = bucket;
            this._mergeInvoiceCounters(patch, pushToCloud);
        }
    },

    getCollection: function(colName, defaultVal = []) {
        let key = colName.startsWith('seraj_') ? colName : 'seraj_' + colName;
        return safeParseJSON(localStorage.getItem(key), defaultVal);
    },

    saveCollection: function(colName, data, syncToCloud = true) {
        let cleanCol = colName.replace(/^seraj_/, '');
        let key = 'seraj_' + cleanCol;
        _internalSetItem(key, JSON.stringify(data));
        if (syncToCloud && Array.isArray(data)) {
            saveArrayToQueueSafely(cleanCol, data);
        } else {
            emitSerajUpdate(cleanCol, 'local');
        }
    },

    // =========================================================================
    // 12. محرك المخزون الموحد (FIFO + normalizeProductLots + Multi-Level Auto-Unpack)
    // تستدعيه كل الشاشات: sales, purchases, history, purchases_history, store, ai_assistant
    // =========================================================================

    // تطبيع دفعات الصنف:
    // - يحذف الدفعات الصفرية الوسيطة فقط ويبقي دائماً على آخر دفعة برصيد 0 لحماية آخر سعر وقفل سعر الشراء
    // - يرحّل أي رصيد سابق سواء موجب أو سالب (!== 0) داخل lots
    // - يحدّث _lastValidPurchase و _lastValidPrice في كل الشاشات ويلغي الفواصل الشبحية
    normalizeProductLots: function(product) {
        if (!product || typeof product !== 'object') return product;
        let round2 = window.Utils.round2;
        let round4 = window.Utils.round4;

        let currentPrice = parseFloat(product.price);
        let currentPurchase = parseFloat(product.purchasePrice);
        let validPrice = (!isNaN(currentPrice) && currentPrice > 0) ? round2(currentPrice) : (round2(product._lastValidPrice) || 0);
        let validPurchase = (!isNaN(currentPurchase) && currentPurchase > 0) ? round2(currentPurchase) : (round2(product._lastValidPurchase) || 0);

        if (!Array.isArray(product.lots)) {
            product.lots = [];
        }

        // إذا كانت الدفعات فارغة ويوجد رصيد سابق (موجب أو سالب !== 0)، نرحله داخل الدفعات
        let rawStock = round4(product.stock);
        if (product.lots.length === 0) {
            product.lots.push({
                id: window.Utils.generateUUID('LOT'),
                stock: window.Utils.isNonZeroStock(rawStock) ? rawStock : 0,
                price: validPrice,
                purchasePrice: validPurchase,
                date: window.Utils.getLocalDateString(),
                timestamp: Date.now(),
                source: 'opening'
            });
        } else {
            // تنظيف كل دفعة وترتيبها زمنياً (FIFO)
            product.lots = product.lots.filter(Boolean).map((lot, idx) => {
                let lStock = round4(lot.stock);
                if (!window.Utils.isNonZeroStock(lStock)) lStock = 0;
                let lPrice = parseFloat(lot.price ?? lot.sellPrice);
                let lBuy = parseFloat(lot.purchasePrice ?? lot.buyPrice);
                let finalLPrice = (!isNaN(lPrice) && lPrice > 0) ? round2(lPrice) : validPrice;
                let finalLBuy = (!isNaN(lBuy) && lBuy > 0) ? round2(lBuy) : validPurchase;
                let normDate = window.Utils.normalizeDateStr(lot.date, lot.timestamp);
                let ts = window.Utils.alignTimestampWithDate(normDate, lot.timestamp || (Date.now() + idx));
                return {
                    ...lot,
                    id: lot.id || window.Utils.generateUUID('LOT'),
                    stock: lStock,
                    price: finalLPrice,
                    purchasePrice: finalLBuy,
                    date: normDate,
                    timestamp: ts
                };
            });

            product.lots.sort((a, b) => {
                let dDiff = window.Utils.getSafeTime(a.date) - window.Utils.getSafeTime(b.date);
                if (dDiff !== 0) return dDiff;
                return (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0);
            });

            // تسوية الدفعات السالبة ضد الموجبة تلقائياً بترتيب FIFO (_settleNegVsPosInNormalize)
            let negDeficit = 0;
            let hasPositiveLot = false;
            product.lots.forEach(l => {
                if (l.stock < -0.0001) {
                    negDeficit = round4(negDeficit + Math.abs(l.stock));
                } else if (l.stock > 0.0001) {
                    hasPositiveLot = true;
                }
            });
            if (negDeficit > 0.0001 && hasPositiveLot) {
                product.lots.forEach(l => {
                    if (l.stock < -0.0001) l.stock = 0;
                });
                for (let i = 0; i < product.lots.length && negDeficit > 0.0001; i++) {
                    if (product.lots[i].stock > 0.0001) {
                        let take = Math.min(product.lots[i].stock, negDeficit);
                        product.lots[i].stock = round4(product.lots[i].stock - take);
                        negDeficit = round4(negDeficit - take);
                    }
                }
                if (negDeficit > 0.0001 && product.lots.length > 0) {
                    let tailRef = product.lots[product.lots.length - 1];
                    tailRef.stock = round4((parseFloat(tailRef.stock) || 0) - negDeficit);
                }
            }

            // حذف الدفعات الصفرية الوسيطة فقط، والإبقاء دائماً على آخر دفعة حقيقية لحماية السعر وقفل الشراء
            let lastLot = product.lots[product.lots.length - 1];
            let nonZeroPrior = product.lots.slice(0, -1).filter(l => window.Utils.isNonZeroStock(l.stock));
            if (lastLot && !window.Utils.isNonZeroStock(lastLot.stock) && lastLot.isNegativeOverflow && nonZeroPrior.length > 0) {
                product.lots = [...nonZeroPrior];
            } else {
                product.lots = [...nonZeroPrior, lastLot];
            }
        }

        // تحديث إجمالي الرصيد والأسعار المعتمدة (أولوية قراءة p.price / p.purchasePrice ثم آخر دفعة)
        let totalStock = round4(product.lots.reduce((sum, l) => sum + (parseFloat(l.stock) || 0), 0));
        product.stock = window.Utils.isNonZeroStock(totalStock) ? totalStock : 0;

        let tailLot = product.lots[product.lots.length - 1];
        if (tailLot) {
            if (tailLot.price > 0) validPrice = round2(tailLot.price);
            if (tailLot.purchasePrice > 0) validPurchase = round2(tailLot.purchasePrice);
        }

        if (validPrice > 0) {
            product._lastValidPrice = validPrice;
            if (!(parseFloat(product.price) > 0)) product.price = validPrice;
        }
        if (validPurchase > 0) {
            product._lastValidPurchase = validPurchase;
            if (!(parseFloat(product.purchasePrice) > 0)) product.purchasePrice = validPurchase;
        }

        return product;
    },

    // محرك فك الكراتين التلقائي متعدد المستويات (maxDepth = 5 + Cycle Detection + تجاهل الأب المحذوف/المؤرشف)
    runAutoUnpack: function(childProductId, requiredDeficitQty, productsArray = null, options = {}) {
        let products = Array.isArray(productsArray) ? productsArray : this.getProducts(true);
        let deficit = window.Utils.round4(requiredDeficitQty);
        let maxDepth = Math.min(5, Math.max(1, parseInt(options.maxDepth, 10) || 5));
        let events = [];

        if (!window.Utils.isNonZeroStock(deficit) || deficit <= 0) {
            return { unpackedQty: 0, events: [] };
        }

        const unpackRecursive = (targetId, needQty, depth, visitedSet) => {
            if (depth > maxDepth || needQty <= 0.0001) return 0;
            let key = String(targetId);
            if (visitedSet.has(key)) return 0; // منع الحلقات الدائرية (Cycle Detection)
            visitedSet.add(key);

            let child = products.find(p => p && String(p.id) === key && !p.isDeleted && !p.isArchived);
            if (!child) return 0;

            let parentId = child.parentProductId || child.autoParentId || child.parentId || child.linkedParentId;
            let unitsPerParent = window.Utils.round4(child.unitsPerPack || child.autoConversionRate || child.packQty || child.conversionFactor || child.unpackQty || 0);
            if (!parentId || unitsPerParent <= 0) return 0;

            let parentKey = String(parentId);
            if (visitedSet.has(parentKey)) return 0;

            // تجاهل أي أب محذوف أو مؤرشف تماماً
            let parent = products.find(p => p && String(p.id) === parentKey && !p.isDeleted && !p.isArchived);
            if (!parent) return 0;

            this.normalizeProductLots(parent);
            this.normalizeProductLots(child);

            let neededParents = Math.ceil((needQty - 0.00001) / unitsPerParent);
            if (neededParents <= 0) return 0;

            let availableParents = window.Utils.round4(parent.stock);
            if (availableParents < neededParents) {
                let parentDeficit = window.Utils.round4(neededParents - availableParents);
                unpackRecursive(parent.id, parentDeficit, depth + 1, new Set(visitedSet));
                this.normalizeProductLots(parent);
                availableParents = window.Utils.round4(parent.stock);
            }

            // فتح الكراتين المطلوبة حتى لو نزل رصيد الأب للسالب لتصفيته لاحقاً مع فواتير الشراء
            let parentsToOpen = neededParents;
            if (parentsToOpen <= 0) return 0;

            // خصم الكراتين المفتوحة من الأب بطريقة FIFO لحساب تكلفة الوحدة المفكوكة بدقة
            let parentDeduct = this._consumeFromLotsFIFO(parent, parentsToOpen);
            let addedChildQty = window.Utils.round4(parentsToOpen * unitsPerParent);
            let unitCostFromParent = parentDeduct.weightedUnitCost > 0
                ? window.Utils.round4(parentDeduct.weightedUnitCost / unitsPerParent)
                : (window.Utils.round4(child.purchasePrice || child._lastValidPurchase || 0));

            let newLotId = window.Utils.generateUUID('UNPK');
            let now = Date.now();
            child.lots.push({
                id: newLotId,
                stock: addedChildQty,
                price: window.Utils.round2(child.price || child._lastValidPrice || 0),
                purchasePrice: window.Utils.round2(unitCostFromParent),
                date: window.Utils.getLocalDateString(now),
                timestamp: now,
                source: 'auto_unpack',
                parentId: parent.id
            });

            this.normalizeProductLots(parent);
            this.normalizeProductLots(child);
            parent._lastModified = now;
            child._lastModified = now;

            events.push({
                eventId: window.Utils.generateUUID('UEV'),
                parentId: parent.id,
                parentName: parent.name || '',
                childId: child.id,
                childName: child.name || '',
                parentsOpened: parentsToOpen,
                unitsPerParent: unitsPerParent,
                childQtyAdded: addedChildQty,
                childLotId: newLotId,
                parentConsumedLots: parentDeduct.consumedLots,
                unitCostFromParent: unitCostFromParent,
                depth: depth,
                timestamp: now
            });

            return addedChildQty;
        };

        let totalUnpacked = unpackRecursive(childProductId, deficit, 1, new Set());
        return { unpackedQty: window.Utils.round4(totalUnpacked), events };
    },

    // عكس أحداث فك الكراتين تلقائياً عند إلغاء أو تعديل فاتورة في history.html
    reverseAutoUnpackEvents: function(events, productsArray = null) {
        if (!Array.isArray(events) || events.length === 0) return false;
        let products = Array.isArray(productsArray) ? productsArray : this.getProducts(true);
        let now = Date.now();

        // العكس بترتيب عكسي (من أعمق مستوى للأعلى)
        for (let i = events.length - 1; i >= 0; i--) {
            let ev = events[i];
            if (!ev) continue;
            let child = products.find(p => p && String(p.id) === String(ev.childId));
            let parent = products.find(p => p && String(p.id) === String(ev.parentId));

            if (child) {
                this.normalizeProductLots(child);
                let qtyToRemove = window.Utils.round4(ev.childQtyAdded || 0);
                let targetLot = ev.childLotId ? child.lots.find(l => l && l.id === ev.childLotId) : null;
                if (targetLot) {
                    let take = Math.min(Math.max(0, targetLot.stock), qtyToRemove);
                    targetLot.stock = window.Utils.round4(targetLot.stock - take);
                    qtyToRemove = window.Utils.round4(qtyToRemove - take);
                }
                if (qtyToRemove > 0.0001 && child.lots.length > 0) {
                    let last = child.lots[child.lots.length - 1];
                    last.stock = window.Utils.round4(last.stock - qtyToRemove);
                }
                this.normalizeProductLots(child);
                child._lastModified = now;
            }

            if (parent) {
                this.normalizeProductLots(parent);
                if (Array.isArray(ev.parentConsumedLots) && ev.parentConsumedLots.length > 0) {
                    ev.parentConsumedLots.forEach(cl => {
                        let existing = parent.lots.find(l => l && cl.lotId && l.id === cl.lotId);
                        if (existing) {
                            existing.stock = window.Utils.round4(existing.stock + (parseFloat(cl.qty) || 0));
                        } else {
                            parent.lots.push({
                                id: cl.lotId || window.Utils.generateUUID('LOT'),
                                stock: window.Utils.round4(cl.qty || 0),
                                price: window.Utils.round2(cl.price || parent.price || parent._lastValidPrice || 0),
                                purchasePrice: window.Utils.round2(cl.purchasePrice || parent.purchasePrice || parent._lastValidPurchase || 0),
                                date: cl.date || window.Utils.getLocalDateString(now),
                                timestamp: cl.timestamp || now,
                                source: 'unpack_reversal'
                            });
                        }
                    });
                } else if (ev.parentsOpened > 0) {
                    let tail = parent.lots[parent.lots.length - 1];
                    if (tail) tail.stock = window.Utils.round4(tail.stock + ev.parentsOpened);
                }
                this.normalizeProductLots(parent);
                parent._lastModified = now;
            }
        }
        return true;
    },

    // دالة داخلية لخصم كمية من دفعات الصنف بترتيب FIFO وحساب متوسط التكلفة المرجح الفعلي
    _consumeFromLotsFIFO: function(product, qtyToDeduct) {
        this.normalizeProductLots(product);
        let remaining = window.Utils.round4(qtyToDeduct);
        let totalCost = 0;
        let totalConsumed = 0;
        let consumedLots = [];

        let fallbackCost = window.Utils.round2(product.purchasePrice || product._lastValidPurchase || 0);
        let fallbackPrice = window.Utils.round2(product.price || product._lastValidPrice || 0);

        for (let i = 0; i < product.lots.length && remaining > 0.0001; i++) {
            let lot = product.lots[i];
            let lotStock = window.Utils.round4(lot.stock);
            if (lotStock <= 0) continue;

            let take = Math.min(lotStock, remaining);
            let lotCost = window.Utils.round2(lot.purchasePrice > 0 ? lot.purchasePrice : fallbackCost);
            lot.stock = window.Utils.round4(lotStock - take);
            remaining = window.Utils.round4(remaining - take);

            totalCost += (take * lotCost);
            totalConsumed += take;
            consumedLots.push({
                lotId: lot.id,
                qty: window.Utils.round4(take),
                purchasePrice: lotCost,
                price: window.Utils.round2(lot.price || fallbackPrice),
                date: lot.date,
                timestamp: lot.timestamp
            });
        }

        // في حال البيع على المكشوف (الكمية أكبر من الرصيد المتاح) يُخصم الباقي من آخر دفعة بالسالب مع تسجيل تكلفتها
        if (remaining > 0.0001) {
            let tailLot = product.lots[product.lots.length - 1];
            let tailCost = window.Utils.round2((tailLot && tailLot.purchasePrice > 0) ? tailLot.purchasePrice : fallbackCost);
            if (tailLot) {
                tailLot.stock = window.Utils.round4((parseFloat(tailLot.stock) || 0) - remaining);
            }
            totalCost += (remaining * tailCost);
            totalConsumed += remaining;
            consumedLots.push({
                lotId: tailLot ? tailLot.id : window.Utils.generateUUID('NEG'),
                qty: window.Utils.round4(remaining),
                purchasePrice: tailCost,
                price: window.Utils.round2((tailLot && tailLot.price) || fallbackPrice),
                date: tailLot ? tailLot.date : window.Utils.getLocalDateString(),
                timestamp: tailLot ? tailLot.timestamp : Date.now(),
                isNegativeOverflow: true
            });
            remaining = 0;
        }

        this.normalizeProductLots(product);
        let weightedUnitCost = totalConsumed > 0 ? window.Utils.round4(totalCost / totalConsumed) : fallbackCost;

        return {
            weightedUnitCost: window.Utils.round2(weightedUnitCost),
            totalCost: window.Utils.round2(totalCost),
            consumedLots: consumedLots
        };
    },

    // الواجهة الموحدة لخصم المخزون بطريقة FIFO (تُشغل فك الكراتين تلقائياً وتُحدّث السحابة بـ Firebase transaction)
    deductStockFIFO: function(invoiceItems, productsArray = null, options = {}) {
        let isExternalArr = Array.isArray(productsArray);
        let products = isExternalArr ? productsArray : this.getProducts(true);
        let autoUnpack = options.autoUnpack !== false;
        let autoSave = options.autoSave !== undefined ? Boolean(options.autoSave) : !isExternalArr;
        let cloudTransaction = options.cloudTransaction !== false;
        let allUnpackEvents = [];
        let touchedProductIds = new Map();
        let now = getServerNow();

        (Array.isArray(invoiceItems) ? invoiceItems : []).forEach(item => {
            if (!item) return;
            let qty = window.Utils.round4(item.qty ?? item.quantity ?? 0);
            if (qty <= 0.0001) return;

            let prod = null;
            if (item.id !== undefined && item.id !== null) {
                prod = products.find(p => p && String(p.id) === String(item.id));
            }
            if (!prod && item.productId !== undefined && item.productId !== null) {
                prod = products.find(p => p && String(p.id) === String(item.productId));
            }
            if (!prod && item.name) {
                let norm = window.Utils.normalizeName(item.name);
                prod = products.find(p => p && !p.isDeleted && !p.isArchived && window.Utils.normalizeName(p.name) === norm);
            }
            if (!prod) return;

            this.normalizeProductLots(prod);
            let stockBefore = window.Utils.round4(prod.stock);

            // فك الكراتين تلقائياً قبل الخصم إذا كان الرصيد لا يكفي (شاملاً أي عجز سالب سابق)
            if (autoUnpack && stockBefore < qty) {
                let deficit = window.Utils.round4(qty - stockBefore);
                let unpackRes = this.runAutoUnpack(prod.id, deficit, products, { maxDepth: 5 });
                if (unpackRes.events && unpackRes.events.length > 0) {
                    allUnpackEvents.push(...unpackRes.events);
                    unpackRes.events.forEach(ev => {
                        let prevParentDelta = touchedProductIds.get(String(ev.parentId)) || 0;
                        touchedProductIds.set(String(ev.parentId), window.Utils.round4(prevParentDelta - (parseFloat(ev.parentsOpened) || 0)));
                        let prevChildDelta = touchedProductIds.get(String(ev.childId)) || 0;
                        touchedProductIds.set(String(ev.childId), window.Utils.round4(prevChildDelta + (parseFloat(ev.childQtyAdded) || 0)));
                    });
                }
            }

            let fifoRes = this._consumeFromLotsFIFO(prod, qty);
            item.purchasePrice = fifoRes.weightedUnitCost;
            item.weightedUnitCost = fifoRes.weightedUnitCost;
            item.cogsTotal = fifoRes.totalCost;
            item.consumedLots = fifoRes.consumedLots;

            prod._lastModified = now;
            prod._lastModifiedBy = myDeviceName;
            let prevDelta = touchedProductIds.get(String(prod.id)) || 0;
            touchedProductIds.set(String(prod.id), window.Utils.round4(prevDelta - qty));
        });

        if (autoSave) {
            this.saveProducts(products);
        }

        // تحديث الرصيد ذرياً عبر Firebase transaction() على السحابة لتجنب التصادم بين الكاشيرين
        if (cloudTransaction && cloudReady && navigator.onLine && !window.SerajAuth.isOfflineSinglePlan()) {
            touchedProductIds.forEach((delta, prodId) => {
                if (window.Utils.isNonZeroStock(delta)) {
                    this.syncProductStockTransaction(prodId, delta);
                }
            });
        }

        return {
            items: invoiceItems,
            autoUnpackEvents: allUnpackEvents,
            products: products
        };
    },

    // استرجاع المخزون وعكس فك الكراتين عند إلغاء أو تعديل فاتورة بيع
    restoreStockFromInvoice: function(invoice, productsArray = null, options = {}) {
        if (!invoice) return false;
        let isExternalArr = Array.isArray(productsArray);
        let products = isExternalArr ? productsArray : this.getProducts(true);
        let autoSave = options.autoSave !== undefined ? Boolean(options.autoSave) : !isExternalArr;
        let now = getServerNow();
        let touchedDeltas = new Map();

        let items = Array.isArray(invoice.items) ? invoice.items : [];
        items.forEach(item => {
            if (!item) return;
            let qty = window.Utils.round4(item.qty ?? item.quantity ?? 0);
            if (qty <= 0.0001) return;

            let prod = products.find(p => p && (String(p.id) === String(item.id) || String(p.id) === String(item.productId)));
            if (!prod && item.name) {
                let norm = window.Utils.normalizeName(item.name);
                prod = products.find(p => p && window.Utils.normalizeName(p.name) === norm);
            }
            if (!prod) return;

            this.normalizeProductLots(prod);
            if (Array.isArray(item.consumedLots) && item.consumedLots.length > 0) {
                item.consumedLots.forEach(cl => {
                    let existing = cl.lotId ? prod.lots.find(l => l && l.id === cl.lotId) : null;
                    if (existing) {
                        existing.stock = window.Utils.round4(existing.stock + (parseFloat(cl.qty) || 0));
                    } else {
                        prod.lots.push({
                            id: cl.lotId || window.Utils.generateUUID('LOT'),
                            stock: window.Utils.round4(cl.qty || 0),
                            price: window.Utils.round2(cl.price || prod.price || prod._lastValidPrice || 0),
                            purchasePrice: window.Utils.round2(cl.purchasePrice || item.purchasePrice || prod.purchasePrice || 0),
                            date: cl.date || window.Utils.getLocalDateString(now),
                            timestamp: cl.timestamp || now,
                            source: 'invoice_restore'
                        });
                    }
                });
            } else {
                let tail = prod.lots[prod.lots.length - 1];
                if (tail) tail.stock = window.Utils.round4(tail.stock + qty);
            }
            this.normalizeProductLots(prod);
            prod._lastModified = now;
            touchedDeltas.set(String(prod.id), window.Utils.round4((touchedDeltas.get(String(prod.id)) || 0) + qty));
        });

        // عكس أحداث فك الكراتين المسجلة على الفاتورة تلقائياً
        if (Array.isArray(invoice.autoUnpackEvents) && invoice.autoUnpackEvents.length > 0) {
            this.reverseAutoUnpackEvents(invoice.autoUnpackEvents, products);
        }

        if (autoSave) {
            this.saveProducts(products);
        }

        if (cloudReady && navigator.onLine && !window.SerajAuth.isOfflineSinglePlan()) {
            touchedDeltas.forEach((delta, prodId) => {
                if (window.Utils.isNonZeroStock(delta)) {
                    this.syncProductStockTransaction(prodId, delta);
                }
            });
        }
        return true;
    },

    // معاملة ذرية على Firebase RTDB لتحديث رصيد الصنف دون تعارض بين جهازين في نفس اللحظة
    syncProductStockTransaction: function(productId, deltaQty) {
        if (!cloudReady || !navigator.onLine || !window.dbCloud || window.SerajAuth.isOfflineSinglePlan()) {
            return Promise.resolve(false);
        }
        let safeKey = String(productId).replace(/[.#$\[\]\/\\]/g, '_');
        let ref = _getStoreCloudRef(`products/${safeKey}/stock`);
        if (!ref) return Promise.resolve(false);

        return ref.transaction((currentStock) => {
            if (currentStock === null || currentStock === undefined) return currentStock;
            let next = window.Utils.round4((parseFloat(currentStock) || 0) + (parseFloat(deltaQty) || 0));
            return window.Utils.isNonZeroStock(next) ? next : 0;
        }).then(() => true).catch(() => false);
    },

    // =========================================================================
    // 13. إدارة السندات المستقلة (customer_vouchers / supplier_vouchers)
    // فصل السندات عن كائن العميل/المورد لمنع فقدانها أوفلاين أو عند تعديل جهازين
    // =========================================================================
    getCustomerVouchers: function(includeDeleted = false) {
        let list = safeParseJSON(localStorage.getItem('seraj_customer_vouchers'), []);
        return includeDeleted ? list : list.filter(v => v && !v.isDeleted && !v.isCanceled && v.status !== 'deleted');
    },

    saveCustomerVouchers: function(list) {
        if (!Array.isArray(list)) return;
        let now = getServerNow();
        let cleaned = list.filter(Boolean).map(v => {
            let normDate = window.Utils.normalizeDateStr(v.date, v.timestamp);
            return {
                ...v,
                id: v.id || window.Utils.generateUniqueId('CV_'),
                _cloudKey: v._cloudKey || _getDocCloudKey(v) || window.Utils.generateUUID('CV'),
                date: normDate,
                timestamp: window.Utils.alignTimestampWithDate(normDate, v.timestamp || now),
                amount: window.Utils.round2(v.amount),
                _lastModified: v._lastModified || now
            };
        });
        _internalSetItem('seraj_customer_vouchers', JSON.stringify(cleaned));
        saveArrayToQueueSafely('customer_vouchers', cleaned);
    },

    addCustomerVoucher: function(voucherObj) {
        if (!voucherObj) return null;
        let now = getServerNow();
        let normDate = window.Utils.normalizeDateStr(voucherObj.date, voucherObj.timestamp || now);
        let id = voucherObj.id ? window.Utils.sanitizeEntityId(voucherObj.id) : window.Utils.generateUniqueId('CV_');
        let item = {
            ...voucherObj,
            id: id,
            _cloudKey: voucherObj._cloudKey || window.Utils.generateUUID('CV'),
            customerId: String(voucherObj.customerId || ''),
            customerName: String(voucherObj.customerName || voucherObj.customer || '').trim(),
            type: voucherObj.type || 'receipt',
            amount: window.Utils.round2(voucherObj.amount),
            treasury: voucherObj.treasury || voucherObj.vault || 'main',
            vault: voucherObj.vault || voucherObj.treasury || 'main',
            allocatedInvoices: Array.isArray(voucherObj.allocatedInvoices) ? voucherObj.allocatedInvoices : [],
            date: normDate,
            timestamp: window.Utils.alignTimestampWithDate(normDate, voucherObj.timestamp || now),
            notes: String(voucherObj.notes || ''),
            _device: voucherObj._device || myDeviceName,
            _lastModified: now,
            _lastModifiedBy: myDeviceName,
            isDeleted: false
        };
        saveDirtyItem('customer_vouchers', item);
        return item;
    },

    updateCustomerVoucher: function(voucherId, patchObj) {
        let list = this.getCustomerVouchers(true);
        let target = String(voucherId);
        let idx = list.findIndex(v => v && (String(v.id) === target || String(v.rawTreasuryId || '') === target));
        if (idx === -1) return null;
        let now = getServerNow();
        let prev = list[idx];
        let normDate = window.Utils.normalizeDateStr(patchObj.date || prev.date, patchObj.timestamp || prev.timestamp);

        let nextAllocated = Array.isArray(patchObj.allocatedInvoices)
            ? patchObj.allocatedInvoices
            : (Math.abs((parseFloat(patchObj.amount) || prev.amount) - (parseFloat(prev.amount) || 0)) > 0.009 && Array.isArray(prev.allocatedInvoices) && prev.allocatedInvoices.length > 1
                ? []
                : (prev.allocatedInvoices || []));

        let updated = {
            ...prev,
            ...patchObj,
            id: prev.id,
            amount: window.Utils.round2(patchObj.amount ?? prev.amount),
            allocatedInvoices: nextAllocated,
            date: normDate,
            timestamp: window.Utils.alignTimestampWithDate(normDate, patchObj.timestamp || prev.timestamp),
            _lastModified: now,
            _lastModifiedBy: myDeviceName
        };
        list[idx] = updated;
        _internalSetItem('seraj_customer_vouchers', JSON.stringify(list));
        addToSyncQueue('customer_vouchers', updated);
        this.calculateCustomerBalances(updated.customerId);
        emitSerajUpdate('customer_vouchers', 'local');
        return updated;
    },

    deleteCustomerVoucher: function(voucherId) {
        let list = this.getCustomerVouchers(true);
        let target = String(voucherId);
        let now = getServerNow();
        let found = null;
        let deletedKeys = new Set([target]);
        list.forEach(v => {
            if (v && (String(v.id) === target || String(v.rawTreasuryId || '') === target)) {
                v.isDeleted = true;
                v.isCanceled = true;
                v._lastModified = now;
                v._lastModifiedBy = myDeviceName;
                deletedKeys.add(String(v.id));
                if (v.rawTreasuryId) deletedKeys.add(String(v.rawTreasuryId));
                found = v;
            }
        });
        if (found) {
            _internalSetItem('seraj_customer_vouchers', JSON.stringify(list));
            addToSyncQueue('customer_vouchers', found);
            let rawCusts = safeParseJSON(localStorage.getItem('seraj_customers'), []);
            let cModified = false;
            rawCusts.forEach(c => {
                if (c && Array.isArray(c.transactions)) {
                    let before = c.transactions.length;
                    c.transactions = c.transactions.filter(t => t && !deletedKeys.has(String(t.id)) && !deletedKeys.has(String(t.rawTreasuryId || '')));
                    if (c.transactions.length !== before) cModified = true;
                }
            });
            if (cModified) _internalSetItem('seraj_customers', JSON.stringify(rawCusts));
            emitSerajUpdate('customer_vouchers', 'delete');
        }
        return Boolean(found);
    },

    getSupplierVouchers: function(includeDeleted = false) {
        let list = safeParseJSON(localStorage.getItem('seraj_supplier_vouchers'), []);
        return includeDeleted ? list : list.filter(v => v && !v.isDeleted && !v.isCanceled && v.status !== 'deleted');
    },

    saveSupplierVouchers: function(list) {
        if (!Array.isArray(list)) return;
        let now = getServerNow();
        let cleaned = list.filter(Boolean).map(v => {
            let normDate = window.Utils.normalizeDateStr(v.date, v.timestamp);
            return {
                ...v,
                id: v.id || window.Utils.generateUniqueId('SV_'),
                _cloudKey: v._cloudKey || _getDocCloudKey(v) || window.Utils.generateUUID('SV'),
                date: normDate,
                timestamp: window.Utils.alignTimestampWithDate(normDate, v.timestamp || now),
                amount: window.Utils.round2(v.amount),
                _lastModified: v._lastModified || now
            };
        });
        _internalSetItem('seraj_supplier_vouchers', JSON.stringify(cleaned));
        saveArrayToQueueSafely('supplier_vouchers', cleaned);
    },

    addSupplierVoucher: function(voucherObj) {
        if (!voucherObj) return null;
        let now = getServerNow();
        let normDate = window.Utils.normalizeDateStr(voucherObj.date, voucherObj.timestamp || now);
        let id = voucherObj.id ? window.Utils.sanitizeEntityId(voucherObj.id) : window.Utils.generateUniqueId('SV_');
        let item = {
            ...voucherObj,
            id: id,
            _cloudKey: voucherObj._cloudKey || window.Utils.generateUUID('SV'),
            supplierId: String(voucherObj.supplierId || ''),
            supplierName: String(voucherObj.supplierName || voucherObj.supplier || '').trim(),
            type: voucherObj.type || 'payment',
            amount: window.Utils.round2(voucherObj.amount),
            treasury: voucherObj.treasury || voucherObj.vault || 'main',
            vault: voucherObj.vault || voucherObj.treasury || 'main',
            allocatedInvoices: Array.isArray(voucherObj.allocatedInvoices) ? voucherObj.allocatedInvoices : [],
            date: normDate,
            timestamp: window.Utils.alignTimestampWithDate(normDate, voucherObj.timestamp || now),
            notes: String(voucherObj.notes || ''),
            _device: voucherObj._device || myDeviceName,
            _lastModified: now,
            _lastModifiedBy: myDeviceName,
            isDeleted: false
        };
        saveDirtyItem('supplier_vouchers', item);
        return item;
    },

    // إصلاح تعديل سند مورد متعدد الفواتير بتحديث العقدة المستقلة + إعادة حساب أرصدة الفواتير والخزينة
    updateSupplierVoucher: function(voucherId, patchObj) {
        let list = this.getSupplierVouchers(true);
        let target = String(voucherId);
        let idx = list.findIndex(v => v && (String(v.id) === target || String(v.rawTreasuryId || '') === target));
        if (idx === -1) return null;
        let now = getServerNow();
        let prev = list[idx];
        let normDate = window.Utils.normalizeDateStr(patchObj.date || prev.date, patchObj.timestamp || prev.timestamp);

        // عند تغيير المبلغ في سند متعدد الفواتير بدون تمرير توزيع جديد، نُفرغ التوزيع القديم ليعيد المحرك توزيعه FIFO تلقائياً بدقة
        let nextAllocated = Array.isArray(patchObj.allocatedInvoices)
            ? patchObj.allocatedInvoices
            : (Math.abs((parseFloat(patchObj.amount) || prev.amount) - (parseFloat(prev.amount) || 0)) > 0.009 && Array.isArray(prev.allocatedInvoices) && prev.allocatedInvoices.length > 1
                ? []
                : (prev.allocatedInvoices || []));

        let updated = {
            ...prev,
            ...patchObj,
            id: prev.id,
            amount: window.Utils.round2(patchObj.amount ?? prev.amount),
            allocatedInvoices: nextAllocated,
            date: normDate,
            timestamp: window.Utils.alignTimestampWithDate(normDate, patchObj.timestamp || prev.timestamp),
            _lastModified: now,
            _lastModifiedBy: myDeviceName
        };
        list[idx] = updated;
        _internalSetItem('seraj_supplier_vouchers', JSON.stringify(list));
        addToSyncQueue('supplier_vouchers', updated);
        this.calculateSupplierBalances(updated.supplierId);
        emitSerajUpdate('supplier_vouchers', 'local');
        return updated;
    },

    deleteSupplierVoucher: function(voucherId) {
        let list = this.getSupplierVouchers(true);
        let target = String(voucherId);
        let now = getServerNow();
        let found = null;
        list.forEach(v => {
            if (v && (String(v.id) === target || String(v.rawTreasuryId || '') === target)) {
                v.isDeleted = true;
                v.isCanceled = true;
                v._lastModified = now;
                v._lastModifiedBy = myDeviceName;
                found = v;
            }
        });
        if (found) {
            _internalSetItem('seraj_supplier_vouchers', JSON.stringify(list));
            addToSyncQueue('supplier_vouchers', found);
            let delKeys = new Set([target, String(found.id)]);
            if (found.rawTreasuryId) delKeys.add(String(found.rawTreasuryId));
            let rawSupps = safeParseJSON(localStorage.getItem('seraj_suppliers'), []);
            let sModified = false;
            rawSupps.forEach(s => {
                if (s && Array.isArray(s.transactions)) {
                    let before = s.transactions.length;
                    s.transactions = s.transactions.filter(t => t && !delKeys.has(String(t.id)) && !delKeys.has(String(t.rawTreasuryId || '')));
                    if (s.transactions.length !== before) sModified = true;
                }
            });
            if (sModified) _internalSetItem('seraj_suppliers', JSON.stringify(rawSupps));
            emitSerajUpdate('supplier_vouchers', 'delete');
        }
        return Boolean(found);
    },

    // =========================================================================
    // 14. دمج الكيانات، ترحيل البيانات، وحساب أرصدة وكشوفات العملاء والموردين
    // =========================================================================
    _deduplicateEntities: function(list, colName) {
        if (!Array.isArray(list)) return { cleaned: [], idRedirectMap: new Map(), normMap: new Map(), changed: false };
        let normMap = new Map();
        let idRedirectMap = new Map();
        let cleaned = [];
        let changed = false;

        list.forEach(item => {
            if (!item || !item.name) return;

            let origIdStr = String(item.id ?? '');
            let cleanIdStr = window.Utils.sanitizeEntityId(origIdStr);
            if (origIdStr && origIdStr !== cleanIdStr) {
                idRedirectMap.set(origIdStr, cleanIdStr);
                addToDeleteQueue(colName, origIdStr);
                item.id = cleanIdStr;
                changed = true;
            }

            if (item.isDeleted || item.isArchived) {
                cleaned.push(item);
                return;
            }
            let norm = window.Utils.normalizeName(item.name);
            if (!norm) return;

            if (!normMap.has(norm)) {
                item.name = String(item.name).trim();
                if (!Array.isArray(item.transactions)) item.transactions = [];
                normMap.set(norm, item);
                cleaned.push(item);
            } else {
                let primary = normMap.get(norm);
                changed = true;
                if (String(item.id) !== String(primary.id)) {
                    idRedirectMap.set(String(item.id), primary.id);
                    addToDeleteQueue(colName, item.id);
                }
                if (!primary.phone && item.phone) primary.phone = item.phone;
                if (!primary.notes && item.notes) primary.notes = item.notes;
                if (item.lastActivityDate && (!primary.lastActivityDate || item.lastActivityDate > primary.lastActivityDate)) {
                    primary.lastActivityDate = item.lastActivityDate;
                }
                if (Array.isArray(item.transactions) && item.transactions.length > 0) {
                    let existingTxIds = new Set(primary.transactions.map(t => String(t?.id)));
                    item.transactions.forEach(tx => {
                        if (tx && !existingTxIds.has(String(tx.id))) {
                            primary.transactions.push(tx);
                            existingTxIds.add(String(tx.id));
                        }
                    });
                }
            }
        });

        return { cleaned, idRedirectMap, normMap, changed };
    },

    // استخراج المبلغ المسدد لفاتورة معينة من قائمة السندات
    _getAppliedVoucherAmountForInvoice: function(inv, validTransactions, isSupplier = false) {
        if (!inv || !Array.isArray(validTransactions)) return 0;
        let appliedAmount = 0;
        let invIdStr = String(inv.id);
        let invNoStr = String(inv.invoiceNo || inv.id);
        let escapedId = invIdStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // قصر مطابقة النص على السند أحادي الفاتورة فقط لمنع مضاعفة سند متعدد الفواتير عند إعادة توزيعه بـ FIFO
        let exactNoteRegex = new RegExp(`\\(فاتورة\\s*${escapedId}\\)`);

        validTransactions.forEach(t => {
            if (!t) return;
            let isTargetVoucher = isSupplier
                ? (t.type === 'payment' || t.type === 'purchase_payment')
                : (t.type === 'receipt');
            if (!isTargetVoucher) return;

            let inAllocated = Array.isArray(t.allocatedInvoices) && t.allocatedInvoices.find(a =>
                a && (String(a.id ?? a.invoiceId) === invIdStr || String(a.id ?? a.invoiceId) === invNoStr)
            );
            if (inAllocated) {
                appliedAmount += parseFloat(inAllocated.deducted ?? inAllocated.amount) || 0;
            } else if (t.notes && exactNoteRegex.test(String(t.notes))) {
                appliedAmount += parseFloat(t.amount) || 0;
            }
        });
        return window.Utils.round2(appliedAmount);
    },

    // توحيد سندات العميل أو المورد من العقدة المستقلة + المصفوفة القديمة + الخزينة
    // ممنوع استخدام invoiceNo كمعرف للسند هنا لمنع ضياع السندات الجزئية المتعددة لنفس الفاتورة
    _collectUnifiedEntityTransactions: function(entity, allMoves, isSupplier = false) {
        let eIdStr = String(entity.id);
        let eNorm = window.Utils.normalizeName(entity.name || '');

        let allStandaloneVouchers = isSupplier ? this.getSupplierVouchers(true) : this.getCustomerVouchers(true);
        let deletedVoucherIds = new Set();
        allStandaloneVouchers.forEach(v => {
            if (v && (v.isDeleted || v.isCanceled || v.status === 'deleted')) {
                if (v.id !== undefined && v.id !== null) deletedVoucherIds.add(String(v.id).trim());
                if (v.rawTreasuryId) deletedVoucherIds.add(String(v.rawTreasuryId).trim());
            }
        });

        let standaloneVouchers = allStandaloneVouchers.filter(v => v && !v.isDeleted && !v.isCanceled && v.status !== 'deleted');
        let entityStandalone = standaloneVouchers.filter(v => {
            if (!v) return false;
            let vEntityId = isSupplier ? v.supplierId : v.customerId;
            let vEntityNorm = window.Utils.normalizeName(isSupplier ? (v.supplierName || v.supplier || '') : (v.customerName || v.customer || ''));
            return (vEntityId !== undefined && vEntityId !== null && String(vEntityId) === eIdStr) || (eNorm !== '' && vEntityNorm === eNorm);
        });

        let embeddedTx = Array.isArray(entity.transactions)
            ? entity.transactions.filter(t => t && t.type !== 'log' && !t.isCanceled && t.status !== 'deleted' && !t.isDeleted && !deletedVoucherIds.has(String(t.id ?? '').trim()) && !deletedVoucherIds.has(String(t.rawTreasuryId ?? '').trim()))
            : [];

        let validTransactions = [];
        let recordedTxIds = new Set();

        const registerVoucher = (t) => {
            let tId = String(t.id ?? '').trim();
            let tRawId = String(t.rawTreasuryId ?? '').trim();
            if ((tId && (recordedTxIds.has(tId) || deletedVoucherIds.has(tId))) || (tRawId && (recordedTxIds.has(tRawId) || deletedVoucherIds.has(tRawId)))) return;

            let normDate = window.Utils.normalizeDateStr(t.date, t.timestamp);
            let copy = {
                ...t,
                date: normDate,
                timestamp: window.Utils.alignTimestampWithDate(normDate, t.timestamp),
                amount: window.Utils.round2(t.amount)
            };
            validTransactions.push(copy);
            if (tId) recordedTxIds.add(tId);
            if (tRawId) recordedTxIds.add(tRawId);
        };

        // الأولوية للسندات المستقلة (Source of Truth) ثم السندات المضمنة القديمة
        entityStandalone.forEach(registerVoucher);
        embeddedTx.forEach(registerVoucher);

        let matchedLegacyTxIndices = new Set();

        allMoves.forEach(m => {
            if (!m || m._isInvoice || m._isMergedInvoice || m._isReversed || m._isReversal || m.type === 'correction' || m.isCanceled || m.isDeleted || m.status === 'deleted') return;
            let mIdStr = String(m.rawTreasuryId || m.id || '').trim();
            let mShortId = mIdStr.length > 10 ? mIdStr.slice(-6) : mIdStr;
            // لا نستخدم m.invoiceNo مطلقاً كمفتاح استبعاد حتى لا تضيع السندات الجزئية المتعددة
            if ((mIdStr && (recordedTxIds.has(mIdStr) || deletedVoucherIds.has(mIdStr))) || (mShortId && (recordedTxIds.has(mShortId) || deletedVoucherIds.has(mShortId)))) return;

            if (isSupplier) {
                if (!['suppliers', 'supplier_payment', 'purchase_payment', 'supplier_receipt', 'payment', 'receipt'].includes(m.type) || (!m.supplierId && !m.supplier && !m.supplierName)) return;
            } else {
                if (!['customers', 'customer_receipt', 'customer_payment', 'receipt', 'payment'].includes(m.type) || (!m.customerId && !m.customer && !m.customerName)) return;
            }

            let mEntityNorm = window.Utils.normalizeName(isSupplier ? (m.supplier || m.supplierName || '') : (m.customer || m.customerName || ''));
            let mEntityId = isSupplier ? m.supplierId : m.customerId;
            let isMatch = (
                (mEntityId !== undefined && mEntityId !== null && String(mEntityId) === eIdStr) ||
                (eNorm !== '' && mEntityNorm === eNorm)
            );

            if (isMatch) {
                let add = parseFloat(m.amountAdd) || 0;
                let ded = parseFloat(m.amountDeduct) || 0;
                let amt = window.Utils.round2(add || ded || (parseFloat(m.amount) || 0));
                if (amt <= 0) return;

                let mDateStr = window.Utils.normalizeDateStr(m.date, m.timestamp);
                let cleanNotes = String(m.notes || '').replace(/^سند\s+(?:تحصيل|سحب|دفع|مورد|تسديد|إضافة مديونية)\s+رقم\s+[^:]+:\s*[^-]+-\s*/, '').trim();
                let normMoveNotes = window.Utils.normalizeName(cleanNotes);
                let txType = isSupplier
                    ? (ded > 0 || m.type === 'purchase_payment' || m.type === 'supplier_payment' ? 'payment' : 'receipt')
                    : (add > 0 || m.type === 'customer_receipt' ? 'receipt' : 'payment');
                let mVault = m.vault || m.treasury || 'main';
                let mTs = Number(m.timestamp || 0);

                let legacyMatchIdx = validTransactions.findIndex((t, idx) => {
                    if (matchedLegacyTxIndices.has(idx) || t._restoredFromTreasury) return false;
                    let tDateStr = window.Utils.normalizeDateStr(t.date, t.timestamp);
                    if (tDateStr !== mDateStr) return false;
                    if (Math.abs((parseFloat(t.amount) || 0) - amt) >= 0.01) return false;
                    let tType = isSupplier
                        ? ((t.type === 'payment' || t.type === 'purchase_payment') ? 'payment' : 'receipt')
                        : (t.type === 'receipt' ? 'receipt' : 'payment');
                    if (tType !== txType) return false;
                    let tVault = t.treasury || t.vault || 'main';
                    let tTs = Number(t.timestamp || 0);
                    let closeInTime = (mTs > 0 && tTs > 0 && Math.abs(mTs - tTs) < 60000);
                    let sameNotes = (normMoveNotes !== '' && window.Utils.normalizeName(t.notes || '') === normMoveNotes);
                    return (tVault === mVault && (closeInTime || sameNotes));
                });

                if (legacyMatchIdx > -1) {
                    matchedLegacyTxIndices.add(legacyMatchIdx);
                    return;
                }

                // استخدام معرف الحركة المستقل وليس invoiceNo
                let voucherUniqueId = mIdStr || window.Utils.generateUniqueId(isSupplier ? 'SV_' : 'CV_');
                validTransactions.push({
                    id: voucherUniqueId,
                    rawTreasuryId: mIdStr,
                    type: txType,
                    amount: amt,
                    notes: cleanNotes || m.notes || '',
                    treasury: mVault,
                    vault: mVault,
                    date: mDateStr,
                    timestamp: window.Utils.alignTimestampWithDate(mDateStr, m.timestamp),
                    allocatedInvoices: Array.isArray(m.allocatedInvoices) ? m.allocatedInvoices : [],
                    _device: m._device,
                    _lastModifiedBy: m._lastModifiedBy,
                    _restoredFromTreasury: true
                });
                recordedTxIds.add(mIdStr);
                recordedTxIds.add(voucherUniqueId);
            }
        });

        return validTransactions;
    },

    // حساب صافي قيمة الفاتورة بأمان (منع الخصم المزدوج بـ isNetTotal + تقييد الخصم <= subTotal)
    _computeInvoiceNetTotal: function(inv) {
        if (!inv) return 0;
        let round2 = window.Utils.round2;
        let totalVal = round2(inv.total);
        let rawDisc = Math.max(0, round2(inv.discount));

        if (inv.isNetTotal === true) {
            return Math.max(0, totalVal);
        }

        let subTotal = Array.isArray(inv.items) && inv.items.length > 0
            ? round2(inv.items.reduce((s, it) => s + (parseFloat(it.total) || ((parseFloat(it.price) || 0) * (parseFloat(it.qty) || 0))), 0))
            : totalVal;

        let cappedDisc = Math.min(rawDisc, Math.max(0, subTotal));
        let checkoutPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null && !isNaN(parseFloat(inv.initialPaid)))
            ? parseFloat(inv.initialPaid)
            : (parseFloat(inv.paid) || 0);
        let origRem = (inv.initialRemaining !== undefined && inv.initialRemaining !== null && !isNaN(parseFloat(inv.initialRemaining)))
            ? parseFloat(inv.initialRemaining)
            : (parseFloat(inv.remaining) || 0);

        let alreadyNet = (cappedDisc > 0) && (
            Math.abs((checkoutPaid + origRem) - totalVal) < 0.05 ||
            (subTotal > 0 && Math.abs((subTotal - cappedDisc) - totalVal) < 0.05)
        );
        return Math.max(0, round2(alreadyNet ? totalVal : (totalVal - cappedDisc)));
    },

    migrateOldData: function() {
        try {
            let rawCustomers = safeParseJSON(localStorage.getItem('seraj_customers'), []);
            let rawSuppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []);
            let products = safeParseJSON(localStorage.getItem('seraj_products'), []);
            let sales = safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []);
            let purchases = safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []);
            let rawMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);

            let custDedup = this._deduplicateEntities(rawCustomers, 'customers');
            let customers = custDedup.cleaned;
            let suppDedup = this._deduplicateEntities(rawSuppliers, 'suppliers');
            let suppliers = suppDedup.cleaned;

            // ترحيل السندات المضمنة داخل العملاء والموردين إلى العقد المستقلة (customer_vouchers / supplier_vouchers)
            let custVouchers = this.getCustomerVouchers(true);
            let custVIds = new Set(custVouchers.map(v => String(v?.id)));
            let custVChanged = false;
            customers.forEach(c => {
                if (c && Array.isArray(c.transactions) && c.transactions.length > 0) {
                    c.transactions.forEach(t => {
                        if (!t || t.type === 'log') return;
                        let tid = String(t.id || window.Utils.generateUniqueId('CV_'));
                        if (!custVIds.has(tid)) {
                            custVIds.add(tid);
                            custVouchers.push({
                                ...t,
                                id: tid,
                                _cloudKey: t._cloudKey || window.Utils.generateUUID('CV'),
                                customerId: String(c.id),
                                customerName: c.name || '',
                                date: window.Utils.normalizeDateStr(t.date, t.timestamp),
                                timestamp: window.Utils.alignTimestampWithDate(t.date, t.timestamp)
                            });
                            custVChanged = true;
                        }
                    });
                }
            });
            if (custVChanged) _internalSetItem('seraj_customer_vouchers', JSON.stringify(custVouchers));

            let suppVouchers = this.getSupplierVouchers(true);
            let suppVIds = new Set(suppVouchers.map(v => String(v?.id)));
            let suppVChanged = false;
            suppliers.forEach(s => {
                if (s && Array.isArray(s.transactions) && s.transactions.length > 0) {
                    s.transactions.forEach(t => {
                        if (!t || t.type === 'log') return;
                        let tid = String(t.id || window.Utils.generateUniqueId('SV_'));
                        if (!suppVIds.has(tid)) {
                            suppVIds.add(tid);
                            suppVouchers.push({
                                ...t,
                                id: tid,
                                _cloudKey: t._cloudKey || window.Utils.generateUUID('SV'),
                                supplierId: String(s.id),
                                supplierName: s.name || '',
                                date: window.Utils.normalizeDateStr(t.date, t.timestamp),
                                timestamp: window.Utils.alignTimestampWithDate(t.date, t.timestamp)
                            });
                            suppVChanged = true;
                        }
                    });
                }
            });
            if (suppVChanged) _internalSetItem('seraj_supplier_vouchers', JSON.stringify(suppVouchers));

            if (custDedup.changed) {
                _internalSetItem('seraj_customers', JSON.stringify(customers));
                saveArrayToQueueSafely('customers', customers);
            }
            if (suppDedup.changed) {
                _internalSetItem('seraj_suppliers', JSON.stringify(suppliers));
                saveArrayToQueueSafely('suppliers', suppliers);
            }

            let custMapByNorm = new Map();
            customers.forEach(c => {
                if (c && c.name && !c.isDeleted && !c.isArchived) custMapByNorm.set(window.Utils.normalizeName(c.name), c);
            });
            let suppMapByNorm = new Map();
            suppliers.forEach(s => {
                if (s && s.name && !s.isDeleted && !s.isArchived) suppMapByNorm.set(window.Utils.normalizeName(s.name), s);
            });

            // تطبيع الأصناف والدفعات عبر المحرك الموحد
            let prodChanged = false;
            let prodNormMap = new Map();
            let cleanedProducts = [];
            products.forEach(p => {
                if (!p) return;
                if (p.isDeleted === true && !p.isArchived) { p.isArchived = true; prodChanged = true; }
                if (p.isArchived === true && !p.isDeleted) { p.isDeleted = true; prodChanged = true; }

                if (p.isDeleted || p.isArchived) {
                    cleanedProducts.push(p);
                    return;
                }

                this.normalizeProductLots(p);
                let normP = window.Utils.normalizeName(p.name);
                if (!normP || !prodNormMap.has(normP)) {
                    if (normP) prodNormMap.set(normP, p);
                    cleanedProducts.push(p);
                } else {
                    let primaryP = prodNormMap.get(normP);
                    prodChanged = true;
                    if (String(p.id) !== String(primaryP.id)) addToDeleteQueue('products', p.id);
                    if (Array.isArray(p.lots) && p.lots.length > 0) {
                        primaryP.lots.push(...p.lots);
                        this.normalizeProductLots(primaryP);
                    }
                }
            });
            if (prodChanged) _internalSetItem('seraj_products', JSON.stringify(cleanedProducts));

            let salesChanged = false;
            sales.forEach(inv => {
                if (!inv) return;
                if ((inv.type === 'canceled' || inv.status === 'deleted' || inv.isDeleted === true) && !inv.isCanceled) {
                    inv.isCanceled = true;
                    salesChanged = true;
                }
                if (inv.type === 'return_sale' || inv.type === 'sales_return') { inv.type = 'return'; salesChanged = true; }
                if (inv.type === 'all' && !inv.isCanceled) { inv.type = 'sales'; salesChanged = true; }
                let normDate = window.Utils.normalizeDateStr(inv.date, inv.timestamp);
                if (inv.date !== normDate) { inv.date = normDate; salesChanged = true; }
                let alignedTs = window.Utils.alignTimestampWithDate(inv.date, inv.timestamp);
                if (inv.timestamp !== alignedTs) { inv.timestamp = alignedTs; salesChanged = true; }
                if (inv.customerId && custDedup.idRedirectMap.has(String(inv.customerId))) {
                    inv.customerId = custDedup.idRedirectMap.get(String(inv.customerId));
                    salesChanged = true;
                }
                let cNorm = window.Utils.normalizeName(inv.customer || inv.customerName || '');
                if (cNorm && custMapByNorm.has(cNorm)) {
                    let matchedC = custMapByNorm.get(cNorm);
                    if (String(inv.customerId) !== String(matchedC.id)) { inv.customerId = matchedC.id; salesChanged = true; }
                    if (inv.customer !== matchedC.name) { inv.customer = matchedC.name; salesChanged = true; }
                }
            });
            if (salesChanged) _internalSetItem('seraj_sales_invoices', JSON.stringify(sales));

            let purchChanged = false;
            purchases.forEach(inv => {
                if (!inv) return;
                if ((inv.type === 'canceled' || inv.status === 'deleted' || inv.isDeleted === true) && !inv.isCanceled) {
                    inv.isCanceled = true;
                    purchChanged = true;
                }
                let normDate = window.Utils.normalizeDateStr(inv.date, inv.timestamp);
                if (inv.date !== normDate) { inv.date = normDate; purchChanged = true; }
                let alignedTs = window.Utils.alignTimestampWithDate(inv.date, inv.timestamp);
                if (inv.timestamp !== alignedTs) { inv.timestamp = alignedTs; purchChanged = true; }
                if (inv.supplierId && suppDedup.idRedirectMap.has(String(inv.supplierId))) {
                    inv.supplierId = suppDedup.idRedirectMap.get(String(inv.supplierId));
                    purchChanged = true;
                }
                let sNorm = window.Utils.normalizeName(inv.supplier || inv.supplierName || '');
                if (sNorm && suppMapByNorm.has(sNorm)) {
                    let matchedS = suppMapByNorm.get(sNorm);
                    if (String(inv.supplierId) !== String(matchedS.id)) { inv.supplierId = matchedS.id; purchChanged = true; }
                    if (inv.supplier !== matchedS.name) { inv.supplier = matchedS.name; purchChanged = true; }
                }
            });
            if (purchChanged) _internalSetItem('seraj_purchase_invoices', JSON.stringify(purchases));

            let movesChanged = false;
            let moves = [];
            rawMoves.forEach(m => {
                if (!m) return;
                let mIdStr = String(m.id ?? '');
                if (m._isInvoice === true || m._isMergedInvoice === true || mIdStr.endsWith('_vouch') || mIdStr.endsWith('_cash') || mIdStr.endsWith('_inv_sale') || mIdStr.endsWith('_inv_purch')) {
                    movesChanged = true;
                    return;
                }
                if ((m.type === 'canceled' || m.type === 'cancelled' || m.status === 'deleted' || m.isDeleted === true) && !m.isCanceled) {
                    m.isCanceled = true;
                    movesChanged = true;
                }
                if (!m.vault && m.treasury) {
                    let v = String(m.treasury).toLowerCase().trim();
                    m.vault = (v.includes('insta') || v.includes('انستا') || v.includes('إنستا')) ? 'insta' : ((v.includes('wallet') || v.includes('محفظ')) ? 'wallet' : 'main');
                    movesChanged = true;
                } else if (!m.vault) {
                    m.vault = 'main';
                    movesChanged = true;
                }
                let normDate = window.Utils.normalizeDateStr(m.date, m.timestamp);
                if (m.date !== normDate) { m.date = normDate; movesChanged = true; }
                let alignedTs = window.Utils.alignTimestampWithDate(m.date, m.timestamp);
                if (m.timestamp !== alignedTs) { m.timestamp = alignedTs; movesChanged = true; }
                let add = parseFloat(m.amountAdd) || 0;
                let ded = parseFloat(m.amountDeduct) || 0;
                let rawAmt = parseFloat(m.amount) || 0;
                if (add === 0 && ded === 0 && rawAmt > 0) {
                    let isOut = (m.direction === 'out' || ['payment', 'customer_payment', 'supplier_payment', 'purchase', 'purchases', 'purchase_payment', 'expenses', 'expense', 'return_sale', 'sales_return'].includes(m.type));
                    if (isOut) m.amountDeduct = rawAmt;
                    else m.amountAdd = rawAmt;
                    movesChanged = true;
                }
                if (m.customerId && custDedup.idRedirectMap.has(String(m.customerId))) { m.customerId = custDedup.idRedirectMap.get(String(m.customerId)); movesChanged = true; }
                let mcNorm = window.Utils.normalizeName(m.customer || m.customerName || '');
                if (!m.customerId && mcNorm && custMapByNorm.has(mcNorm)) { m.customerId = custMapByNorm.get(mcNorm).id; movesChanged = true; }
                if (m.supplierId && suppDedup.idRedirectMap.has(String(m.supplierId))) { m.supplierId = suppDedup.idRedirectMap.get(String(m.supplierId)); movesChanged = true; }
                let msNorm = window.Utils.normalizeName(m.supplier || m.supplierName || '');
                if (!m.supplierId && msNorm && suppMapByNorm.has(msNorm)) { m.supplierId = suppMapByNorm.get(msNorm).id; movesChanged = true; }
                moves.push(m);
            });
            if (movesChanged) _internalSetItem('seraj_treasury_moves', JSON.stringify(moves));

            return true;
        } catch (err) {
            console.error('Migration Error:', err);
            return false;
        }
    },

    getProducts: function(includeArchived = false) {
        let products = safeParseJSON(localStorage.getItem('seraj_products'), []);
        return includeArchived ? products : products.filter(p => p && !p.isArchived && !p.isDeleted);
    },

    // فحص ارتباطات الصنف (رصيد، أصناف فرعية مرتبطة، فواتير مبيعات ومشتريات تاريخية) قبل الأرشفة أو الحذف النهائي
    inspectProductDependencies: function(productId) {
        let allProducts = this.getProducts(true);
        let pidStr = String(productId ?? '');
        let product = allProducts.find(p => p && String(p.id) === pidStr) || null;
        if (!product) return null;

        let stock = (Array.isArray(product.lots) && product.lots.length > 0)
            ? window.Utils.round4(product.lots.reduce((sum, l) => sum + (parseFloat(l?.stock) || 0), 0))
            : window.Utils.round4(product.stock ?? product.qty ?? 0);
        let hasStock = window.Utils.isNonZeroStock(stock);

        let linkedChildren = allProducts.filter(other => {
            if (!other || other.isArchived || other.isDeleted || String(other.id) === pidStr) return false;
            let parentRef = other.parentProductId || other.autoParentId || other.parentId || other.linkedParentId;
            return parentRef !== undefined && parentRef !== null && String(parentRef) === pidStr;
        }).map(c => ({ id: c.id, name: c.name || String(c.id) }));

        let normProdName = window.Utils.normalizeName(product.name || '');
        const matchesLine = (it) => {
            if (!it) return false;
            if (it.id !== undefined && it.id !== null && String(it.id) === pidStr) return true;
            if (it.productId !== undefined && it.productId !== null && String(it.productId) === pidStr) return true;
            if (normProdName && it.name && window.Utils.normalizeName(it.name) === normProdName) return true;
            return false;
        };

        let salesInvoices = this.getSalesInvoices(true) || [];
        let purchaseInvoices = this.getPurchaseInvoices(true) || [];
        let salesCount = 0;
        let missingCostSalesCount = 0;
        let purchasesCount = 0;

        salesInvoices.forEach(inv => {
            if (!inv || !Array.isArray(inv.items)) return;
            let matchedLines = inv.items.filter(matchesLine);
            if (matchedLines.length > 0) {
                salesCount++;
                if (matchedLines.some(it => !(parseFloat(it.weightedUnitCost ?? it.purchasePrice ?? it.buyPrice) > 0) || !it.name)) {
                    missingCostSalesCount++;
                }
            }
        });

        purchaseInvoices.forEach(inv => {
            if (!inv || !Array.isArray(inv.items)) return;
            if (inv.items.some(matchesLine)) purchasesCount++;
        });

        let canDeletePerm = window.SerajAuth && typeof window.SerajAuth.canAccess === 'function'
            ? window.SerajAuth.canAccess('delete_product')
            : true;
        let isOwner = window.SerajAuth && typeof window.SerajAuth.isOwner === 'function'
            ? window.SerajAuth.isOwner()
            : true;

        return {
            product,
            stock: hasStock ? stock : 0,
            hasStock,
            linkedChildren,
            salesCount,
            purchasesCount,
            missingCostSalesCount,
            canArchive: canDeletePerm && !hasStock,
            canHardDelete: isOwner && canDeletePerm && !hasStock && linkedChildren.length === 0
        };
    },

    // تجميد اسم الصنف وتكلفته التاريخية داخل كل الفواتير قبل الحذف النهائي لحماية تقارير الأرباح
    freezeProductCostInInvoices: function(productObj) {
        if (!productObj) return { salesUpdated: 0, purchasesUpdated: 0 };
        let pidStr = String(productObj.id ?? '');
        let normProdName = window.Utils.normalizeName(productObj.name || '');
        let round2 = window.Utils.round2;
        let round4 = window.Utils.round4;

        let fallbackCost = round2(productObj.purchasePrice ?? productObj.buyPrice ?? productObj._lastValidPurchase ?? 0);
        if (fallbackCost <= 0 && Array.isArray(productObj.lots) && productObj.lots.length > 0) {
            for (let i = productObj.lots.length - 1; i >= 0; i--) {
                let lc = round2(productObj.lots[i]?.purchasePrice ?? productObj.lots[i]?.buyPrice ?? 0);
                if (lc > 0) { fallbackCost = lc; break; }
            }
        }

        const matchesLine = (it) => {
            if (!it) return false;
            if (it.id !== undefined && it.id !== null && String(it.id) === pidStr) return true;
            if (it.productId !== undefined && it.productId !== null && String(it.productId) === pidStr) return true;
            if (normProdName && it.name && window.Utils.normalizeName(it.name) === normProdName) return true;
            return false;
        };

        let salesUpdated = 0;
        let salesList = this.getSalesInvoices(true) || [];
        salesList.forEach(inv => {
            if (!inv || !Array.isArray(inv.items)) return;
            let invChanged = false;
            inv.items.forEach(it => {
                if (!matchesLine(it)) return;
                if (!it.name && productObj.name) { it.name = productObj.name; invChanged = true; }
                let qty = Math.abs(round4(it.qty ?? it.quantity ?? 0));
                let existingCost = round2(it.weightedUnitCost ?? it.purchasePrice ?? it.buyPrice ?? it.costPrice ?? 0);
                let frozenUnitCost = existingCost > 0 ? existingCost : fallbackCost;
                if (frozenUnitCost > 0) {
                    if (!(parseFloat(it.purchasePrice) > 0)) { it.purchasePrice = frozenUnitCost; invChanged = true; }
                    if (!(parseFloat(it.weightedUnitCost) > 0)) { it.weightedUnitCost = frozenUnitCost; invChanged = true; }
                    if (!(parseFloat(it.cogsTotal) > 0) && qty > 0) { it.cogsTotal = round2(qty * frozenUnitCost); invChanged = true; }
                }
                if (!it._frozenDeletedProduct) { it._frozenDeletedProduct = true; invChanged = true; }
            });
            if (invChanged) salesUpdated++;
        });
        if (salesUpdated > 0) {
            this.saveSalesInvoices(salesList, { source: 'customers', skipTreasuryDiff: true });
        }

        let purchasesUpdated = 0;
        let purchList = this.getPurchaseInvoices(true) || [];
        purchList.forEach(inv => {
            if (!inv || !Array.isArray(inv.items)) return;
            let invChanged = false;
            inv.items.forEach(it => {
                if (!matchesLine(it)) return;
                if (!it.name && productObj.name) { it.name = productObj.name; invChanged = true; }
                let existingBuy = round2(it.purchasePrice ?? it.buyPrice ?? 0);
                if (existingBuy <= 0 && fallbackCost > 0) {
                    it.purchasePrice = fallbackCost;
                    it.buyPrice = fallbackCost;
                    invChanged = true;
                }
                if (!it._frozenDeletedProduct) { it._frozenDeletedProduct = true; invChanged = true; }
            });
            if (invChanged) purchasesUpdated++;
        });
        if (purchasesUpdated > 0) {
            this.savePurchaseInvoices(purchList, null, { source: 'suppliers', skipTreasuryDiff: true });
        }

        return { salesUpdated, purchasesUpdated };
    },

    // أرشفة الصنف (إخفاء ناعم مع الاحتفاظ بالصورة لإمكانية إعادة التنشيط عند الشراء)
    archiveProduct: function(productId) {
        if (window.SerajAuth && typeof window.SerajAuth.canAccess === 'function' && !window.SerajAuth.canAccess('delete_product')) {
            return { ok: false, reason: 'forbidden', message: '⛔ هذه العملية مخصصة لصاحب المحل (المالك) فقط.' };
        }
        let info = this.inspectProductDependencies(productId);
        if (!info || !info.product) return { ok: false, reason: 'not_found', message: 'لم يتم العثور على الصنف.' };
        if (info.hasStock) {
            return { ok: false, reason: 'non_zero_stock', message: `⚠️ يمنع أرشفة صنف رصيده غير مصفّر (${info.stock.toFixed(2)})! قم بتسوية الرصيد إلى 0.00 أولاً.` };
        }
        let ok = this.deleteItem('products', info.product.id, 'soft');
        return { ok: Boolean(ok), mode: 'archive' };
    },

    // الحذف النهائي للصنف (للمالك فقط، بعد فحص التبعيات وتجميد التكاليف في الفواتير التاريخية ومسح الصورة وحذف السحابة)
    hardDeleteProduct: async function(productId) {
        if (window.SerajAuth && (!window.SerajAuth.isOwner() || !window.SerajAuth.canAccess('delete_product'))) {
            return { ok: false, reason: 'forbidden', message: '⛔ الحذف النهائي للأصناف مخصص لصاحب المحل (المالك) فقط.' };
        }
        let info = this.inspectProductDependencies(productId);
        if (!info || !info.product) {
            return { ok: false, reason: 'not_found', message: 'لم يتم العثور على الصنف.' };
        }
        if (info.hasStock) {
            return { ok: false, reason: 'non_zero_stock', message: `⚠️ يمنع حذف صنف رصيده غير مصفّر (${info.stock.toFixed(2)})! قم بتسوية الرصيد إلى 0.00 أولاً.` };
        }
        if (info.linkedChildren.length > 0) {
            let names = info.linkedChildren.map(c => c.name).join('، ');
            return { ok: false, reason: 'linked_children', message: `⛔ لا يمكن حذف هذا الصنف نهائياً لأنه مرتبط كصنف رئيسي (فك كراتين) للأصناف التالية: ${names}. فك الارتباط أولاً.` };
        }

        let targetProd = info.product;
        let frozenStats = this.freezeProductCostInInvoices(targetProd);

        let allProducts = safeParseJSON(localStorage.getItem('seraj_products'), []);
        let pidStr = String(targetProd.id);
        let cloudKey = _getDocCloudKey(targetProd);
        let remaining = allProducts.filter(p => p && String(p.id) !== pidStr);
        let remainingStr = JSON.stringify(remaining);

        _internalSetItem('seraj_products', remainingStr);
        localCollectionsCache['products'] = [...remaining];

        if (!window.SerajAuth.isOfflineSinglePlan()) {
            _internalSetItem('seraj_cloud_cache_products', remainingStr);
            enqueueOutboxOp('products', cloudKey, 'delete', null, true);
        }

        if (window.SerajMegaDB && typeof window.SerajMegaDB.set === 'function') {
            await window.SerajMegaDB.set('seraj_products', remainingStr);
        }
        if (window.ImagesDB && typeof window.ImagesDB.deleteImage === 'function') {
            await window.ImagesDB.deleteImage(pidStr);
        }
        if (typeof SmartVoice !== 'undefined' && typeof SmartVoice._invalidateShadowCache === 'function') {
            SmartVoice._invalidateShadowCache();
        }
        emitSerajUpdate('products', 'delete');
        return { ok: true, mode: 'hard', frozenStats };
    },

    saveProducts: function(data) {
        if (!Array.isArray(data)) return;
        let existingAll = safeParseJSON(localStorage.getItem('seraj_products'), []);
        let passedIds = new Set();
        let normMap = new Map();
        let cleaned = [];

        data.forEach(p => {
            if (!p) return;
            if (p.id === undefined || p.id === null) {
                p.id = window.Utils.generateUniqueId();
            }
            if (!p._cloudKey) p._cloudKey = _getDocCloudKey(p);
            passedIds.add(String(p.id));

            if (p.isDeleted || p.isArchived) {
                p.isArchived = true;
                p.isDeleted = true;
                cleaned.push(p);
                return;
            }

            // توحيد وتنظيف الدفعات وتحديث _lastValidPrice / _lastValidPurchase في كل عملية حفظ
            this.normalizeProductLots(p);

            let norm = window.Utils.normalizeName(p.name);
            if (!norm || !normMap.has(norm)) {
                if (norm) normMap.set(norm, p);
                cleaned.push(p);
            } else {
                let existing = normMap.get(norm);
                if (String(p.id) !== String(existing.id)) {
                    addToDeleteQueue('products', p.id);
                }
                if (Array.isArray(p.lots) && p.lots.length > 0) {
                    if (!Array.isArray(existing.lots)) existing.lots = [];
                    existing.lots.push(...p.lots);
                    this.normalizeProductLots(existing);
                }
            }
        });

        existingAll.forEach(oldP => {
            if (!oldP || oldP.id === undefined) return;
            if ((oldP.isArchived || oldP.isDeleted) && !passedIds.has(String(oldP.id))) {
                oldP.isArchived = true;
                oldP.isDeleted = true;
                cleaned.push(oldP);
            }
        });

        _internalSetItem('seraj_products', JSON.stringify(cleaned));
        if (typeof SmartVoice !== 'undefined') SmartVoice._invalidateShadowCache();
        saveArrayToQueueSafely('products', cleaned);
    },

    getCustomers: function(rawOnly = false, hideZeroOption = null) {
        let customers = safeParseJSON(localStorage.getItem('seraj_customers'), []).filter(c => c && !c.isArchived && !c.isDeleted);
        if (rawOnly) return customers;
        let calculated = this.calculateCustomerBalances(null, customers);

        let shouldHideZero = false;
        if (typeof hideZeroOption === 'boolean') shouldHideZero = hideZeroOption;
        else if (hideZeroOption && typeof hideZeroOption === 'object' && 'hideZero' in hideZeroOption) shouldHideZero = Boolean(hideZeroOption.hideZero);
        else shouldHideZero = Boolean(this._hideZeroCustomersByDefault || window.HIDE_ZERO_CUSTOMERS);

        let result = shouldHideZero ? calculated.filter(c => !c.isZeroCustomer) : calculated;

        try {
            Object.defineProperty(result, 'allWithZero', { value: calculated, enumerable: false, configurable: true });
            Object.defineProperty(result, 'activeOnly', { value: calculated.filter(c => !c.isZeroCustomer), enumerable: false, configurable: true });
            Object.defineProperty(result, 'fastSearch', {
                value: (q) => window.Utils.fastSearch(calculated, q, ['name', 'phone', 'id', 'notes']),
                enumerable: false,
                configurable: true
            });
        } catch (e) {}

        return result;
    },

    searchCustomers: function(query) {
        return window.Utils.fastSearch(this.getCustomers(false, false), query, ['name', 'phone', 'id', 'notes']);
    },

    setHideZeroCustomers: function(hide = true) {
        this._hideZeroCustomersByDefault = Boolean(hide);
        window.HIDE_ZERO_CUSTOMERS = Boolean(hide);
    },

    saveCustomers: function(data) {
        if (!Array.isArray(data)) return;
        let oldRawCustomers = safeParseJSON(localStorage.getItem('seraj_customers'), []);
        let oldNameById = new Map();
        oldRawCustomers.forEach(oc => {
            if (oc && oc.id !== undefined && oc.name) oldNameById.set(String(oc.id), String(oc.name).trim());
        });

        let dedup = this._deduplicateEntities(data, 'customers');
        let renamedMap = new Map();
        dedup.cleaned.forEach(c => {
            if (!c || c.id === undefined || !c.name) return;
            let newName = String(c.name).trim();
            let oldName = oldNameById.get(String(c.id));
            if (oldName && oldName !== newName) renamedMap.set(String(c.id), { oldName, newName });
        });

        if ((dedup.changed && dedup.idRedirectMap.size > 0) || renamedMap.size > 0) {
            let sales = safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []);
            let sChanged = false;
            sales.forEach(inv => {
                if (!inv) return;
                if (inv.customerId && dedup.idRedirectMap.has(String(inv.customerId))) { inv.customerId = dedup.idRedirectMap.get(String(inv.customerId)); sChanged = true; }
                if (inv.customerId && renamedMap.has(String(inv.customerId))) {
                    let newName = renamedMap.get(String(inv.customerId)).newName;
                    if (inv.customer !== newName) { inv.customer = newName; sChanged = true; }
                }
            });
            if (sChanged) this.saveSalesInvoices(sales, { source: 'customers', skipTreasuryDiff: true });

            let moves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
            let mChanged = false;
            moves.forEach(m => {
                if (!m) return;
                if (m.customerId && dedup.idRedirectMap.has(String(m.customerId))) { m.customerId = dedup.idRedirectMap.get(String(m.customerId)); mChanged = true; }
                if (m.customerId && renamedMap.has(String(m.customerId))) {
                    let newName = renamedMap.get(String(m.customerId)).newName;
                    if (m.customer !== newName) { m.customer = newName; mChanged = true; }
                }
            });
            if (mChanged) this.saveTreasuryMoves(moves);
        }

        let passedIds = new Set(dedup.cleaned.map(c => String(c?.id)));
        oldRawCustomers.forEach(oldC => {
            if (!oldC || oldC.id === undefined) return;
            let oId = String(oldC.id);
            if (!passedIds.has(oId) && !dedup.idRedirectMap.has(oId)) {
                let normOld = window.Utils.normalizeName(oldC.name);
                if (normOld && !dedup.normMap.has(normOld)) {
                    dedup.cleaned.push(oldC);
                    passedIds.add(oId);
                }
            }
        });

        // مزامنة أي سندات مضافة في c.transactions مع عقدة customer_vouchers المستقلة
        let standaloneList = this.getCustomerVouchers(true);
        let standaloneMap = new Map(standaloneList.map(v => [String(v?.id), v]));
        let standaloneChanged = false;
        let now = getServerNow();

        dedup.cleaned.forEach(c => {
            if (!c || !Array.isArray(c.transactions)) return;
            c.transactions.forEach(t => {
                if (!t || t.type === 'log') return;
                let tid = String(t.id || window.Utils.generateUniqueId('CV_'));
                t.id = tid;
                let normDate = window.Utils.normalizeDateStr(t.date, t.timestamp);
                let voucherObj = {
                    ...t,
                    id: tid,
                    customerId: String(c.id),
                    customerName: String(c.name || '').trim(),
                    date: normDate,
                    timestamp: window.Utils.alignTimestampWithDate(normDate, t.timestamp || now),
                    amount: window.Utils.round2(t.amount)
                };
                let prevV = standaloneMap.get(tid);
                if (!prevV || JSON.stringify(_stripComputedFieldsForDiff(prevV)) !== JSON.stringify(_stripComputedFieldsForDiff(voucherObj))) {
                    voucherObj._lastModified = now;
                    voucherObj._cloudKey = prevV?._cloudKey || window.Utils.generateUUID('CV');
                    standaloneMap.set(tid, voucherObj);
                    standaloneChanged = true;
                }
            });
        });

        if (standaloneChanged) {
            this.saveCustomerVouchers(Array.from(standaloneMap.values()));
        }

        let oldCache = safeParseJSON(localStorage.getItem('seraj_cloud_cache_customers'), []);
        let oldMap = new Map(oldCache.map(i => [String(i?.id), i]));

        let dataToSave = dedup.cleaned.map(c => {
            let temp = _stripComputedFieldsForDiff(c);
            if (temp.name) temp.name = String(temp.name).trim();
            if (temp.phone !== undefined && temp.phone !== null) temp.phone = String(temp.phone);
            // عدم تضخيم كائن العميل بالسندات في السحابة بعد فصلها في customer_vouchers
            delete temp.transactions;
            let oldC = oldMap.get(String(temp.id));
            if (!oldC || JSON.stringify(_stripComputedFieldsForDiff(oldC)) !== JSON.stringify(_stripComputedFieldsForDiff(temp))) {
                temp._lastModified = now;
            } else {
                temp._lastModified = oldC._lastModified || c._lastModified || now;
            }
            return temp;
        });

        _internalSetItem('seraj_customers', JSON.stringify(dataToSave));
        saveArrayToQueueSafely('customers', dataToSave);
    },

    getSuppliers: function(rawOnly = false, hideZeroOption = null) {
        let suppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []).filter(s => s && !s.isArchived && !s.isDeleted);
        if (rawOnly) return suppliers;
        let calculated = this.calculateSupplierBalances(null, suppliers);

        let shouldHideZero = false;
        if (typeof hideZeroOption === 'boolean') shouldHideZero = hideZeroOption;
        else if (hideZeroOption && typeof hideZeroOption === 'object' && 'hideZero' in hideZeroOption) shouldHideZero = Boolean(hideZeroOption.hideZero);

        let result = shouldHideZero ? calculated.filter(s => !s.isZeroBalance) : calculated;

        try {
            Object.defineProperty(result, 'allWithZero', { value: calculated, enumerable: false, configurable: true });
            Object.defineProperty(result, 'activeOnly', { value: calculated.filter(s => !s.isZeroBalance), enumerable: false, configurable: true });
            Object.defineProperty(result, 'fastSearch', {
                value: (q) => window.Utils.fastSearch(calculated, q, ['name', 'phone', 'id', 'notes']),
                enumerable: false,
                configurable: true
            });
        } catch (e) {}

        return result;
    },

    searchSuppliers: function(query) {
        return window.Utils.fastSearch(this.getSuppliers(false, false), query, ['name', 'phone', 'id', 'notes']);
    },

    saveSuppliers: function(data) {
        if (!Array.isArray(data)) return;
        let oldRawSuppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []);
        let oldNameById = new Map();
        oldRawSuppliers.forEach(os => {
            if (os && os.id !== undefined && os.name) oldNameById.set(String(os.id), String(os.name).trim());
        });

        let dedup = this._deduplicateEntities(data, 'suppliers');
        let renamedMap = new Map();
        dedup.cleaned.forEach(s => {
            if (!s || s.id === undefined || !s.name) return;
            let newName = String(s.name).trim();
            let oldName = oldNameById.get(String(s.id));
            if (oldName && oldName !== newName) renamedMap.set(String(s.id), { oldName, newName });
        });

        if ((dedup.changed && dedup.idRedirectMap.size > 0) || renamedMap.size > 0) {
            let purchases = safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []);
            let pChanged = false;
            purchases.forEach(inv => {
                if (!inv) return;
                if (inv.supplierId && dedup.idRedirectMap.has(String(inv.supplierId))) { inv.supplierId = dedup.idRedirectMap.get(String(inv.supplierId)); pChanged = true; }
                if (inv.supplierId && renamedMap.has(String(inv.supplierId))) {
                    let newName = renamedMap.get(String(inv.supplierId)).newName;
                    if (inv.supplier !== newName) { inv.supplier = newName; pChanged = true; }
                }
            });
            if (pChanged) this.savePurchaseInvoices(purchases, null, { source: 'suppliers', skipTreasuryDiff: true });

            let moves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
            let mChanged = false;
            moves.forEach(m => {
                if (!m) return;
                if (m.supplierId && dedup.idRedirectMap.has(String(m.supplierId))) { m.supplierId = dedup.idRedirectMap.get(String(m.supplierId)); mChanged = true; }
                if (m.supplierId && renamedMap.has(String(m.supplierId))) {
                    let newName = renamedMap.get(String(m.supplierId)).newName;
                    if (m.supplier !== newName) { m.supplier = newName; mChanged = true; }
                }
            });
            if (mChanged) this.saveTreasuryMoves(moves);
        }

        let passedIds = new Set(dedup.cleaned.map(s => String(s?.id)));
        oldRawSuppliers.forEach(oldS => {
            if (!oldS || oldS.id === undefined) return;
            let oId = String(oldS.id);
            if (!passedIds.has(oId) && !dedup.idRedirectMap.has(oId)) {
                let normOld = window.Utils.normalizeName(oldS.name);
                if (normOld && !dedup.normMap.has(normOld)) {
                    dedup.cleaned.push(oldS);
                    passedIds.add(oId);
                }
            }
        });

        let standaloneList = this.getSupplierVouchers(true);
        let standaloneMap = new Map(standaloneList.map(v => [String(v?.id), v]));
        let standaloneChanged = false;
        let now = getServerNow();

        dedup.cleaned.forEach(s => {
            if (!s || !Array.isArray(s.transactions)) return;
            s.transactions.forEach(t => {
                if (!t || t.type === 'log') return;
                let tid = String(t.id || window.Utils.generateUniqueId('SV_'));
                t.id = tid;
                let normDate = window.Utils.normalizeDateStr(t.date, t.timestamp);
                let voucherObj = {
                    ...t,
                    id: tid,
                    supplierId: String(s.id),
                    supplierName: String(s.name || '').trim(),
                    date: normDate,
                    timestamp: window.Utils.alignTimestampWithDate(normDate, t.timestamp || now),
                    amount: window.Utils.round2(t.amount)
                };
                let prevV = standaloneMap.get(tid);
                if (!prevV || JSON.stringify(_stripComputedFieldsForDiff(prevV)) !== JSON.stringify(_stripComputedFieldsForDiff(voucherObj))) {
                    voucherObj._lastModified = now;
                    voucherObj._cloudKey = prevV?._cloudKey || window.Utils.generateUUID('SV');
                    standaloneMap.set(tid, voucherObj);
                    standaloneChanged = true;
                }
            });
        });

        if (standaloneChanged) {
            this.saveSupplierVouchers(Array.from(standaloneMap.values()));
        }

        let oldCache = safeParseJSON(localStorage.getItem('seraj_cloud_cache_suppliers'), []);
        let oldMap = new Map(oldCache.map(i => [String(i?.id), i]));

        let dataToSave = dedup.cleaned.map(s => {
            let temp = _stripComputedFieldsForDiff(s);
            if (temp.name) temp.name = String(temp.name).trim();
            if (temp.phone !== undefined && temp.phone !== null) temp.phone = String(temp.phone);
            delete temp.transactions;
            let oldS = oldMap.get(String(temp.id));
            if (!oldS || JSON.stringify(_stripComputedFieldsForDiff(oldS)) !== JSON.stringify(_stripComputedFieldsForDiff(temp))) {
                temp._lastModified = now;
            } else {
                temp._lastModified = oldS._lastModified || s._lastModified || now;
            }
            return temp;
        });

        _internalSetItem('seraj_suppliers', JSON.stringify(dataToSave));
        saveArrayToQueueSafely('suppliers', dataToSave);
    },

    calculateCustomerBalances: function(targetCustomerId = null, preloadedCustomers = null) {
        let customers = preloadedCustomers || safeParseJSON(localStorage.getItem('seraj_customers'), []).filter(c => c && !c.isArchived && !c.isDeleted);
        let invoices = this.getSalesInvoices(true);
        let allMoves = this.getTreasuryMoves(false, true);
        let invoicesNeedSave = false;
        let round2 = window.Utils.round2;

        const getDayStartMs = (dateVal, fallbackTs) => {
            let t = window.Utils.getSafeTime(dateVal) || window.Utils.getSafeTime(fallbackTs) || 0;
            if (!t) return 0;
            let d = new Date(t);
            if (isNaN(d.getTime())) return 0;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        };

        const getOrderSeq = (idVal, idx) => {
            let num = window.Utils.extractSerialNum(idVal);
            if (!num) return idx;
            return (num >= 100 && num < 100000000) ? (9000000000000 + num) : num;
        };

        customers.forEach(c => {
            let cIdStr = String(c.id);
            let cNorm = window.Utils.normalizeName(c.name || '');

            let cInvs = invoices.filter(inv => {
                if (!inv) return false;
                let invCustNorm = window.Utils.normalizeName(inv.customer || inv.customerName || '');
                let isMatch = (
                    (inv.customerId !== undefined && inv.customerId !== null && String(inv.customerId) === cIdStr) ||
                    (cNorm !== '' && invCustNorm === cNorm)
                );
                return isMatch && inv.type !== 'canceled' && inv.isCanceled !== true && inv.type !== 'quotation' && inv.isDeleted !== true && inv.status !== 'deleted';
            });

            let validTransactions = this._collectUnifiedEntityTransactions(c, allMoves, false);
            c.transactions = validTransactions.map(t => {
                let cleanT = { ...t };
                delete cleanT._restoredFromTreasury;
                return cleanT;
            });

            let cDebit = round2(c.openingBalance);
            let cCredit = 0;
            let currentBal = round2(c.openingBalance);
            let openInvoices = [];
            let timelineEvents = [];
            let latestActivityMs = c.lastActivityDate ? window.Utils.getSafeTime(c.lastActivityDate) : 0;

            const applyPaymentReduction = (amount, allocatedList = null) => {
                let rem = round2(amount);
                if (rem <= 0) return;

                if (Array.isArray(allocatedList) && allocatedList.length > 0) {
                    allocatedList.forEach(alloc => {
                        if (!alloc || rem <= 0) return;
                        let targetInvId = String(alloc.id ?? alloc.invoiceId ?? '');
                        if (!targetInvId) return;
                        let targetEntry = openInvoices.find(oi => (String(oi.invRef.id) === targetInvId || String(oi.invRef.invoiceNo || '') === targetInvId) && oi.currentRem > 0);
                        if (targetEntry) {
                            let allocAmt = round2(alloc.deducted ?? alloc.amount) || rem;
                            let deduct = round2(Math.min(targetEntry.currentRem, allocAmt, rem));
                            targetEntry.currentRem = round2(targetEntry.currentRem - deduct);
                            targetEntry.settledByVouchers = round2(targetEntry.settledByVouchers + deduct);
                            rem = round2(rem - deduct);
                        }
                    });
                }

                if (rem > 0 && currentBal > 0) {
                    let payCurr = round2(Math.min(currentBal, rem));
                    currentBal = round2(currentBal - payCurr);
                    rem = round2(rem - payCurr);
                }

                if (rem > 0) {
                    for (let i = 0; i < openInvoices.length; i++) {
                        if (rem <= 0) break;
                        let oi = openInvoices[i];
                        if (oi.currentRem > 0) {
                            let deduct = round2(Math.min(oi.currentRem, rem));
                            oi.currentRem = round2(oi.currentRem - deduct);
                            oi.settledByVouchers = round2(oi.settledByVouchers + deduct);
                            rem = round2(rem - deduct);
                        }
                    }
                }

                if (rem > 0) {
                    currentBal = round2(currentBal - rem);
                }
            };

            cInvs.forEach((inv, idx) => {
                inv.calculatedRemaining = 0;
                inv.computedRemaining = 0;
                let dMs = getDayStartMs(inv.date, inv.timestamp);
                if (dMs > latestActivityMs) latestActivityMs = dMs;
                timelineEvents.push({ kind: 'invoice', priority: 1, dayMs: dMs, seq: getOrderSeq(inv.id, idx), data: inv });
            });

            validTransactions.forEach((t, idx) => {
                let dMs = getDayStartMs(t.date, t.timestamp);
                if (dMs > latestActivityMs) latestActivityMs = dMs;
                timelineEvents.push({ kind: 'voucher', priority: 2, dayMs: dMs, seq: getOrderSeq(t.id, idx), data: t });
            });

            if (latestActivityMs > 0) {
                c.lastActivityDate = window.Utils.getLocalDateString(latestActivityMs);
            }

            timelineEvents.sort((a, b) => {
                if (a.dayMs !== b.dayMs) return a.dayMs - b.dayMs;
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.seq - b.seq;
            });

            timelineEvents.forEach(ev => {
                if (ev.kind === 'invoice') {
                    let inv = ev.data;
                    let appliedAmount = this._getAppliedVoucherAmountForInvoice(inv, validTransactions, false);
                    let paidVal = round2(inv.paid);

                    if (inv.initialPaid === undefined || inv.initialPaid === null || isNaN(parseFloat(inv.initialPaid))) {
                        inv.initialPaid = Math.max(0, round2(paidVal - appliedAmount));
                        invoicesNeedSave = true;
                    }
                    let checkoutPaid = Math.max(0, round2(inv.initialPaid));

                    if (inv.initialRemaining === undefined || inv.initialRemaining === null || isNaN(parseFloat(inv.initialRemaining))) {
                        inv.initialRemaining = round2(inv.remaining);
                        invoicesNeedSave = true;
                    }

                    let req = this._computeInvoiceNetTotal(inv);
                    let isReturn = (inv.type === 'return' || inv.type === 'return_sale' || inv.type === 'sales_return');

                    if (!isReturn) {
                        cDebit = round2(cDebit + req);
                        cCredit = round2(cCredit + checkoutPaid);
                        let postCheckoutRem = round2(req - checkoutPaid);
                        if (postCheckoutRem > 0) {
                            let invEntry = { invRef: inv, req: req, checkoutPaid: checkoutPaid, currentRem: postCheckoutRem, settledByVouchers: 0 };
                            openInvoices.push(invEntry);
                            if (currentBal < 0) {
                                let useCredit = round2(Math.min(-currentBal, invEntry.currentRem));
                                currentBal = round2(currentBal + useCredit);
                                invEntry.currentRem = round2(invEntry.currentRem - useCredit);
                                invEntry.settledByVouchers = round2(invEntry.settledByVouchers + useCredit);
                            }
                        } else {
                            if (round2(inv.remaining) !== 0) {
                                inv.remaining = 0;
                                invoicesNeedSave = true;
                            }
                            if (postCheckoutRem < 0) {
                                applyPaymentReduction(Math.abs(postCheckoutRem));
                            }
                        }
                    } else {
                        cCredit = round2(cCredit + req);
                        cDebit = round2(cDebit + checkoutPaid);
                        let netReturnCredit = round2(req - checkoutPaid);
                        if (netReturnCredit > 0) applyPaymentReduction(netReturnCredit);
                        else if (netReturnCredit < 0) currentBal = round2(currentBal + Math.abs(netReturnCredit));
                    }
                } else {
                    let t = ev.data;
                    let amt = round2(t.amount);
                    if (amt <= 0) return;
                    if (t.type === 'payment') {
                        cDebit = round2(cDebit + amt);
                        currentBal = round2(currentBal + amt);
                    } else if (t.type === 'receipt') {
                        cCredit = round2(cCredit + amt);
                        applyPaymentReduction(amt, t.allocatedInvoices);
                    }
                }
            });

            let netDebt = round2(cDebit - cCredit);
            let actualDeferred = 0;

            // تحديث inv.paid و inv.remaining بعد تسوية السندات العامة والخاصة بدقة
            openInvoices.forEach(oi => {
                let roundedRem = round2(oi.currentRem);
                let expectedPaid = Math.min(oi.req, round2(oi.checkoutPaid + oi.settledByVouchers));
                oi.invRef.calculatedRemaining = roundedRem;
                oi.invRef.computedRemaining = roundedRem;

                if (Math.abs(round2(oi.invRef.remaining) - roundedRem) > 0.001) {
                    oi.invRef.remaining = roundedRem;
                    invoicesNeedSave = true;
                }
                if (Math.abs(round2(oi.invRef.paid) - expectedPaid) > 0.001) {
                    oi.invRef.paid = expectedPaid;
                    invoicesNeedSave = true;
                }
                actualDeferred = round2(actualDeferred + roundedRem);
            });

            currentBal = round2(netDebt - actualDeferred);

            c.balance = -netDebt;
            c.calculatedBalance = -netDebt;
            c.netBalanceVal = Math.abs(netDebt);
            c.isNetDebt = netDebt > 0;
            c.deferredInvoicesTotal = actualDeferred;
            c.displayCurrentBalance = Math.abs(currentBal);
            c.isCurrentBalDebt = currentBal > 0;
            let isZero = (Math.abs(netDebt) < 0.01 && actualDeferred < 0.01);
            c.isZeroCustomer = isZero;
            c.isZeroBalance = isZero;
            c.isZeroIdle = isZero;
            c.isIdleZero = isZero;
        });

        if (invoicesNeedSave && !window._isHydratingMegaDB && typeof this.saveSalesInvoices === 'function') {
            this._isCalculatingBalances = true;
            try {
                this.saveSalesInvoices(invoices, { source: 'customers', skipTreasuryDiff: true });
            } finally {
                this._isCalculatingBalances = false;
            }
        }

        if (targetCustomerId !== null && targetCustomerId !== undefined) {
            return customers.find(c => String(c.id) === String(targetCustomerId)) || null;
        }
        return customers;
    },

    calculateSupplierBalances: function(targetSupplierId = null, preloadedSuppliers = null) {
        let suppliers = preloadedSuppliers || safeParseJSON(localStorage.getItem('seraj_suppliers'), []).filter(s => s && !s.isArchived && !s.isDeleted);
        let invoices = this.getPurchaseInvoices(true);
        let allMoves = this.getTreasuryMoves(false, true);
        let invoicesNeedSave = false;
        let round2 = window.Utils.round2;

        const getDayStartMs = (dateVal, fallbackTs) => {
            let t = window.Utils.getSafeTime(dateVal) || window.Utils.getSafeTime(fallbackTs) || 0;
            if (!t) return 0;
            let d = new Date(t);
            if (isNaN(d.getTime())) return 0;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        };

        const getOrderSeq = (idVal, idx) => {
            let num = window.Utils.extractSerialNum(idVal);
            if (!num) return idx;
            return (num >= 100 && num < 100000000) ? (9000000000000 + num) : num;
        };

        suppliers.forEach(s => {
            let sIdStr = String(s.id);
            let sNorm = window.Utils.normalizeName(s.name || '');

            let sInvs = invoices.filter(inv => {
                if (!inv) return false;
                let invSuppNorm = window.Utils.normalizeName(inv.supplier || inv.supplierName || '');
                let isMatch = (
                    (inv.supplierId !== undefined && inv.supplierId !== null && String(inv.supplierId) === sIdStr) ||
                    (sNorm !== '' && invSuppNorm === sNorm)
                );
                return isMatch && inv.type !== 'canceled' && inv.isCanceled !== true && inv.type !== 'quotation' && inv.isDeleted !== true && inv.status !== 'deleted';
            });

            let validTransactions = this._collectUnifiedEntityTransactions(s, allMoves, true);
            s.transactions = validTransactions.map(t => {
                let cleanT = { ...t };
                delete cleanT._restoredFromTreasury;
                return cleanT;
            });

            let sTotalReq = round2(s.openingBalance);
            let sTotalPaid = 0;
            let currentBal = round2(s.openingBalance);
            let openInvoices = [];
            let timelineEvents = [];
            let latestActivityMs = s.lastActivityDate ? window.Utils.getSafeTime(s.lastActivityDate) : 0;

            const applySupplierPaymentReduction = (amount, allocatedList = null) => {
                let rem = round2(amount);
                if (rem <= 0) return;

                if (Array.isArray(allocatedList) && allocatedList.length > 0) {
                    allocatedList.forEach(alloc => {
                        if (!alloc || rem <= 0) return;
                        let targetInvId = String(alloc.id ?? alloc.invoiceId ?? '');
                        if (!targetInvId) return;
                        let targetEntry = openInvoices.find(oi => (String(oi.invRef.id) === targetInvId || String(oi.invRef.invoiceNo || '') === targetInvId) && oi.currentRem > 0);
                        if (targetEntry) {
                            let allocAmt = round2(alloc.deducted ?? alloc.amount) || rem;
                            let deduct = round2(Math.min(targetEntry.currentRem, allocAmt, rem));
                            targetEntry.currentRem = round2(targetEntry.currentRem - deduct);
                            targetEntry.settledByVouchers = round2(targetEntry.settledByVouchers + deduct);
                            rem = round2(rem - deduct);
                        }
                    });
                }

                if (rem > 0 && currentBal > 0) {
                    let payCurr = round2(Math.min(currentBal, rem));
                    currentBal = round2(currentBal - payCurr);
                    rem = round2(rem - payCurr);
                }

                if (rem > 0) {
                    for (let i = 0; i < openInvoices.length; i++) {
                        if (rem <= 0) break;
                        let oi = openInvoices[i];
                        if (oi.currentRem > 0) {
                            let deduct = round2(Math.min(oi.currentRem, rem));
                            oi.currentRem = round2(oi.currentRem - deduct);
                            oi.settledByVouchers = round2(oi.settledByVouchers + deduct);
                            rem = round2(rem - deduct);
                        }
                    }
                }

                if (rem > 0) {
                    currentBal = round2(currentBal - rem);
                }
            };

            sInvs.forEach((inv, idx) => {
                inv.calculatedRemaining = 0;
                inv.computedRemaining = 0;
                let dMs = getDayStartMs(inv.date, inv.timestamp);
                if (dMs > latestActivityMs) latestActivityMs = dMs;
                timelineEvents.push({ kind: 'invoice', priority: 1, dayMs: dMs, seq: getOrderSeq(inv.id, idx), data: inv });
            });

            validTransactions.forEach((t, idx) => {
                let dMs = getDayStartMs(t.date, t.timestamp);
                if (dMs > latestActivityMs) latestActivityMs = dMs;
                timelineEvents.push({ kind: 'voucher', priority: 2, dayMs: dMs, seq: getOrderSeq(t.id, idx), data: t });
            });

            if (latestActivityMs > 0) {
                s.lastActivityDate = window.Utils.getLocalDateString(latestActivityMs);
            }

            timelineEvents.sort((a, b) => {
                if (a.dayMs !== b.dayMs) return a.dayMs - b.dayMs;
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.seq - b.seq;
            });

            timelineEvents.forEach(ev => {
                if (ev.kind === 'invoice') {
                    let inv = ev.data;
                    let appliedAmount = this._getAppliedVoucherAmountForInvoice(inv, validTransactions, true);
                    let paidVal = round2(inv.paid);

                    if (inv.initialPaid === undefined || inv.initialPaid === null || isNaN(parseFloat(inv.initialPaid))) {
                        inv.initialPaid = Math.max(0, round2(paidVal - appliedAmount));
                        invoicesNeedSave = true;
                    }
                    let checkoutPaid = Math.max(0, round2(inv.initialPaid));

                    if (inv.initialRemaining === undefined || inv.initialRemaining === null || isNaN(parseFloat(inv.initialRemaining))) {
                        inv.initialRemaining = round2(inv.remaining);
                        invoicesNeedSave = true;
                    }

                    let req = this._computeInvoiceNetTotal(inv);
                    let isReturn = (inv.type === 'return' || inv.type === 'purchase_return' || inv.type === 'return_purchase');

                    if (!isReturn) {
                        sTotalReq = round2(sTotalReq + req);
                        sTotalPaid = round2(sTotalPaid + checkoutPaid);
                        let postCheckoutRem = round2(req - checkoutPaid);
                        if (postCheckoutRem > 0) {
                            let invEntry = { invRef: inv, req: req, checkoutPaid: checkoutPaid, currentRem: postCheckoutRem, settledByVouchers: 0 };
                            openInvoices.push(invEntry);
                            if (currentBal < 0) {
                                let useCredit = round2(Math.min(-currentBal, invEntry.currentRem));
                                currentBal = round2(currentBal + useCredit);
                                invEntry.currentRem = round2(invEntry.currentRem - useCredit);
                                invEntry.settledByVouchers = round2(invEntry.settledByVouchers + useCredit);
                            }
                        } else {
                            if (round2(inv.remaining) !== 0) {
                                inv.remaining = 0;
                                invoicesNeedSave = true;
                            }
                            if (postCheckoutRem < 0) {
                                applySupplierPaymentReduction(Math.abs(postCheckoutRem));
                            }
                        }
                    } else {
                        sTotalReq = round2(sTotalReq - req);
                        sTotalPaid = round2(sTotalPaid - checkoutPaid);
                        let netReturnReduction = round2(req - checkoutPaid);
                        if (netReturnReduction > 0) applySupplierPaymentReduction(netReturnReduction);
                        else if (netReturnReduction < 0) currentBal = round2(currentBal + Math.abs(netReturnReduction));
                    }
                } else {
                    let t = ev.data;
                    let amt = round2(t.amount);
                    if (amt <= 0) return;
                    if (t.type === 'receipt' || t.type === 'supplier_receipt') {
                        sTotalReq = round2(sTotalReq + amt);
                        currentBal = round2(currentBal + amt);
                    } else if (t.type === 'payment' || t.type === 'purchase_payment') {
                        sTotalPaid = round2(sTotalPaid + amt);
                        applySupplierPaymentReduction(amt, t.allocatedInvoices);
                    }
                }
            });

            let netDebt = round2(sTotalReq - sTotalPaid);
            let actualDeferred = 0;

            openInvoices.forEach(oi => {
                let roundedRem = round2(oi.currentRem);
                let expectedPaid = Math.min(oi.req, round2(oi.checkoutPaid + oi.settledByVouchers));
                oi.invRef.calculatedRemaining = roundedRem;
                oi.invRef.computedRemaining = roundedRem;

                if (Math.abs(round2(oi.invRef.remaining) - roundedRem) > 0.001) {
                    oi.invRef.remaining = roundedRem;
                    invoicesNeedSave = true;
                }
                if (Math.abs(round2(oi.invRef.paid) - expectedPaid) > 0.001) {
                    oi.invRef.paid = expectedPaid;
                    invoicesNeedSave = true;
                }
                actualDeferred = round2(actualDeferred + roundedRem);
            });

            currentBal = round2(netDebt - actualDeferred);

            s.balance = -netDebt;
            s.calculatedBalance = -netDebt;
            s.netBalanceVal = Math.abs(netDebt);
            s.isNetDebt = netDebt > 0;
            s.deferredInvoicesTotal = actualDeferred;
            s.displayCurrentBalance = Math.abs(currentBal);
            s.isCurrentBalDebt = currentBal > 0;
            let isZero = (Math.abs(netDebt) < 0.01 && actualDeferred < 0.01);
            s.isZeroCustomer = isZero;
            s.isZeroBalance = isZero;
            s.isZeroIdle = isZero;
            s.isIdleZero = isZero;
        });

        if (invoicesNeedSave && !window._isHydratingMegaDB && typeof this.savePurchaseInvoices === 'function') {
            this._isCalculatingBalances = true;
            try {
                this.savePurchaseInvoices(invoices, null, { source: 'suppliers', skipTreasuryDiff: true });
            } finally {
                this._isCalculatingBalances = false;
            }
        }

        if (targetSupplierId !== null && targetSupplierId !== undefined) {
            return suppliers.find(s => String(s.id) === String(targetSupplierId)) || null;
        }
        return suppliers;
    },

    // المحرك المركزي لكشف الحساب: يعرض صافي نهاية الفترة المحددة + حقل currentAllTimeNetDebt منفصل + تصحيح يوم 31 في lastMonth
    _buildUnifiedStatement: function(entityId, isSupplier = false, duration = 'allTime', customStartDate = null, customEndDate = null) {
        let entity = isSupplier
            ? this.calculateSupplierBalances(entityId)
            : this.calculateCustomerBalances(entityId);
        if (!entity) return null;

        let allInvoices = isSupplier ? this.getPurchaseInvoices(true) : this.getSalesInvoices(true);
        let allMoves = this.getTreasuryMoves(false, true);
        let eIdStr = String(entity.id);
        let eNorm = window.Utils.normalizeName(entity.name || '');
        let round2 = window.Utils.round2;
        let esc = window.Utils.sanitizeHTML;

        let entityInvoices = allInvoices.filter(inv => {
            if (!inv) return false;
            let invEntityNorm = window.Utils.normalizeName(isSupplier ? (inv.supplier || inv.supplierName || '') : (inv.customer || inv.customerName || ''));
            let invEntityId = isSupplier ? inv.supplierId : inv.customerId;
            let isMatch = (
                (invEntityId !== undefined && invEntityId !== null && String(invEntityId) === eIdStr) ||
                (eNorm !== '' && invEntityNorm === eNorm)
            );
            return isMatch && inv.type !== 'quotation' && !inv.isDeleted && inv.status !== 'deleted' && !inv.isCanceled && inv.type !== 'canceled';
        });

        let vouchers = this._collectUnifiedEntityTransactions(entity, allMoves, isSupplier);
        let allItems = [];

        let openingDebt = round2(entity.openingBalance);
        if (openingDebt !== 0) {
            allItems.push({
                date: window.Utils.normalizeDateStr(entity.createdAt || '2020-01-01'),
                title: 'رصيد افتتاحي',
                leh: openingDebt < 0 ? Math.abs(openingDebt) : 0,
                aleih: openingDebt > 0 ? openingDebt : 0,
                id: 0,
                notes: 'رصيد أول المدة'
            });
        }

        entityInvoices.forEach(inv => {
            let appliedAmount = this._getAppliedVoucherAmountForInvoice(inv, vouchers, isSupplier);
            let invPaid = round2(inv.paid);
            let checkoutPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null && !isNaN(parseFloat(inv.initialPaid)))
                ? Math.max(0, round2(inv.initialPaid))
                : Math.max(0, round2(invPaid - appliedAmount));
            let finalReq = this._computeInvoiceNetTotal(inv);

            let isReturn = isSupplier
                ? (inv.type === 'return' || inv.type === 'return_purchase' || inv.type === 'purchase_return')
                : (inv.type === 'return' || inv.type === 'return_sale' || inv.type === 'sales_return');

            let displayInvId = esc(inv.invoiceNo || inv.id);
            let invoiceTypeLabel = isSupplier
                ? (isReturn ? '<span style="color:#ff1a40; font-weight:bold;">فاتورة مرتجع مشتريات</span>' : 'فاتورة مشتريات')
                : (isReturn ? '<span style="color:#ff1a40; font-weight:bold;">فاتورة مرتجع بيع</span>' : 'فاتورة بيع');

            let normInvDate = window.Utils.normalizeDateStr(inv.date, inv.timestamp);

            if (isReturn) {
                allItems.push({ date: normInvDate, title: `${invoiceTypeLabel} رقم: ${displayInvId}`, leh: finalReq, aleih: 0, id: inv.id, notes: inv.notes || '---' });
            } else {
                allItems.push({ date: normInvDate, title: `${invoiceTypeLabel} رقم: ${displayInvId}`, leh: 0, aleih: finalReq, id: inv.id, notes: inv.notes || '---' });
            }

            if (checkoutPaid > 0) {
                let receiptLabel = isSupplier
                    ? (isReturn ? 'استرداد نقدي أثناء المرتجع' : 'سداد نقدي أثناء الشراء')
                    : (isReturn ? 'رد نقدي أثناء المرتجع' : 'تحصيل نقدي أثناء البيع');
                allItems.push({
                    date: normInvDate,
                    title: `${receiptLabel} (فاتورة ${displayInvId})`,
                    leh: isReturn ? 0 : checkoutPaid,
                    aleih: isReturn ? checkoutPaid : 0,
                    id: String(inv.id) + '_cash',
                    notes: '---'
                });
            }
        });

        vouchers.forEach(t => {
            let isPaymentReduceDebt = isSupplier
                ? (t.type === 'payment' || t.type === 'purchase_payment')
                : (t.type === 'receipt');
            let safeVId = esc(t.id);
            let titleText = isSupplier
                ? (isPaymentReduceDebt ? `سند سداد لمورد رقم ${safeVId}` : `سند استلام من مورد رقم ${safeVId}`)
                : (isPaymentReduceDebt ? `سند تحصيل نقدية رقم ${safeVId}` : `سند مديونية رقم ${safeVId}`);

            let isOfflineSingle = window.SerajAuth && window.SerajAuth.isOfflineSinglePlan();
            let safeDev = isOfflineSingle ? '' : esc(t._device || '');
            let safeModBy = isOfflineSingle ? '' : esc(t._lastModifiedBy || '');
            let editTag = (safeModBy && safeDev && safeModBy !== safeDev) ? `✏️ تعديل: ${safeModBy}` : '';
            let devName = safeDev ? `<br><span style="font-size:11px; color:#38bdf8;">💻 سُجل بواسطة: ${safeDev} ${editTag}</span>` : '';

            allItems.push({
                date: window.Utils.normalizeDateStr(t.date, t.timestamp),
                title: `${titleText} ${devName}`,
                leh: isPaymentReduceDebt ? round2(t.amount) : 0,
                aleih: !isPaymentReduceDebt ? round2(t.amount) : 0,
                id: t.id,
                notes: t.notes || '---'
            });
        });

        // تحديد نطاق الفترة بدقة محلية (مع إصلاح يوم 31 في lastMonth)
        let now = new Date();
        let todayStr = window.Utils.getLocalDateString(now);
        let rangeStartStr = null;
        let rangeEndStr = null;

        if (duration === 'custom' && customStartDate && customEndDate) {
            rangeStartStr = window.Utils.normalizeDateStr(customStartDate);
            rangeEndStr = window.Utils.normalizeDateStr(customEndDate);
        } else if (duration === 'today') {
            rangeStartStr = todayStr;
            rangeEndStr = todayStr;
        } else if (duration === 'yesterday') {
            let yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            rangeStartStr = window.Utils.getLocalDateString(yest);
            rangeEndStr = rangeStartStr;
        } else if (duration === '7days') {
            let d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
            rangeStartStr = window.Utils.getLocalDateString(d);
            rangeEndStr = todayStr;
        } else if (duration === '30days') {
            let d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
            rangeStartStr = window.Utils.getLocalDateString(d);
            rangeEndStr = todayStr;
        } else if (duration === 'thisMonth') {
            rangeStartStr = window.Utils.getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
            rangeEndStr = todayStr;
        } else if (duration === 'lastMonth') {
            let lm = window.Utils.getLastMonthRange(now);
            rangeStartStr = lm.start;
            rangeEndStr = lm.end;
        }

        let prevLeh = 0, prevAleih = 0;
        let combined = [];

        allItems.forEach(item => {
            if (!rangeStartStr || !rangeEndStr || !item.date) {
                combined.push(item);
                return;
            }
            let itemDateStr = window.Utils.normalizeDateStr(item.date);
            if (itemDateStr >= rangeStartStr && itemDateStr <= rangeEndStr) {
                combined.push(item);
            } else if (itemDateStr < rangeStartStr) {
                prevLeh = round2(prevLeh + item.leh);
                prevAleih = round2(prevAleih + item.aleih);
            }
        });

        combined.sort((a, b) => {
            let dateDiff = window.Utils.getSafeTime(a.date) - window.Utils.getSafeTime(b.date);
            if (dateDiff !== 0) return dateDiff;
            return window.Utils.extractSerialNum(a.id) - window.Utils.extractSerialNum(b.id);
        });

        let totalLeh = 0, totalAleih = 0;
        combined.forEach(item => {
            totalLeh = round2(totalLeh + item.leh);
            totalAleih = round2(totalAleih + item.aleih);
        });

        // الرصيد النهائي يعرض صافي نهاية الفترة المحددة، مع حقل منفصل للرصيد الإجمالي الحالي
        let periodEndNetDebt = round2((prevAleih + totalAleih) - (prevLeh + totalLeh));
        let currentAllTimeNetDebt = round2(-(entity.balance || 0));

        return {
            entity: entity,
            rows: combined,
            prevAleih: prevAleih,
            prevLeh: prevLeh,
            totalAleih: totalAleih,
            totalLeh: totalLeh,
            netDebt: duration === 'allTime' ? currentAllTimeNetDebt : periodEndNetDebt,
            periodEndNetDebt: periodEndNetDebt,
            currentAllTimeNetDebt: currentAllTimeNetDebt,
            isNetDebt: (duration === 'allTime' ? currentAllTimeNetDebt : periodEndNetDebt) > 0,
            rangeStart: rangeStartStr,
            rangeEnd: rangeEndStr
        };
    },

    getCustomerStatement: function(customerId, duration = 'allTime', customStartDate = null, customEndDate = null) {
        return this._buildUnifiedStatement(customerId, false, duration, customStartDate, customEndDate);
    },

    getSupplierStatement: function(supplierId, duration = 'allTime', customStartDate = null, customEndDate = null) {
        return this._buildUnifiedStatement(supplierId, true, duration, customStartDate, customEndDate);
    },
// ==================== [ نهاية الجزء الثاني 2/3 ] ====================

// ==================== [ بداية الجزء الثالث 3/3 ] ====================

    // =========================================================================
    // 15. تحديث وحذف العناصر (Tombstones + كاميرا الخزينة المحمية + منع الكاشير)
    // =========================================================================
    updateItem: function(colName, id, updatedItem) {
        if (!updatedItem) return false;
        let cleanCol = colName.replace(/^seraj_/, '');
        let targetId = String(id ?? updatedItem.id);
        let now = getServerNow();

        if (cleanCol === 'treasury_moves') {
            if (!window.SerajAuth.canAccess('reverse_treasury_move')) {
                window.SerajAlert('⛔ تعديل أو عكس حركات الخزينة مخصص لصاحب المحل (المالك) فقط.', 'error');
                return false;
            }
            if (updatedItem._isInvoice === true || updatedItem._isMergedInvoice === true || targetId.endsWith('_vouch') || targetId.endsWith('_cash') || targetId.endsWith('_inv_sale') || targetId.endsWith('_inv_purch')) {
                return false;
            }
            let rawMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
            let idx = rawMoves.findIndex(m => m && (String(m.id) === targetId || String(m.rawTreasuryId || '') === targetId) && !m._isReversed);

            if (idx > -1) {
                let oldMove = rawMoves[idx];
                oldMove._isReversed = true;
                oldMove._lastModified = now;
                oldMove._lastModifiedBy = myDeviceName;

                let oldAdd = window.Utils.round2(oldMove.amountAdd);
                let oldDed = window.Utils.round2(oldMove.amountDeduct);
                let oldAmt = window.Utils.round2(oldMove.amount || oldAdd || oldDed);
                let revDate = window.Utils.getLocalDateString(now);

                let revMove = {
                    id: window.Utils.generateUniqueId('REV_'),
                    _cloudKey: window.Utils.generateUUID('REV'),
                    type: 'correction',
                    vault: oldMove.vault || oldMove.treasury || 'main',
                    treasury: oldMove.vault || oldMove.treasury || 'main',
                    amountAdd: oldDed,
                    amountDeduct: oldAdd,
                    amount: oldAmt,
                    notes: `🔄 عكس لتعديل حركة: ${oldMove.notes || ('رقم ' + oldMove.id)}`,
                    date: revDate,
                    dateFormatted: new Date(now).toLocaleDateString('en-GB'),
                    timestamp: now,
                    invoiceNo: oldMove.invoiceNo || null,
                    customerId: oldMove.customerId || null,
                    customer: oldMove.customer || null,
                    supplierId: oldMove.supplierId || null,
                    supplier: oldMove.supplier || null,
                    _device: myDeviceName,
                    _lastModified: now,
                    _lastModifiedBy: localStorage.getItem('cashier_name') || myDeviceName,
                    _isReversal: true,
                    _reversedMoveId: String(oldMove.id)
                };
                rawMoves.unshift(revMove);
            }

            let cleanMove = { ...updatedItem };
            delete cleanMove._isInvoice;
            delete cleanMove._isMergedInvoice;
            delete cleanMove._isReversed;
            cleanMove.rawTreasuryId = targetId;
            cleanMove.id = window.Utils.generateUniqueId('EDT_');
            cleanMove._cloudKey = window.Utils.generateUUID('EDT');
            cleanMove.date = window.Utils.normalizeDateStr(cleanMove.date, now + 1);
            cleanMove.timestamp = now + 1;
            cleanMove.dateFormatted = new Date(now + 1).toLocaleDateString('en-GB');
            cleanMove.notes = cleanMove.notes
                ? (String(cleanMove.notes).startsWith('✏️') ? cleanMove.notes : `✏️ بعد التعديل: ${cleanMove.notes}`)
                : '✏️ حركة معدلة';
            cleanMove._lastModified = now + 1;
            cleanMove._lastModifiedBy = localStorage.getItem('cashier_name') || myDeviceName;

            rawMoves.unshift(cleanMove);
            this.saveTreasuryMoves(rawMoves);
            return true;
        }

        let list = this.getCollection(cleanCol, []);
        let idx = list.findIndex(item => item && String(item.id) === targetId);
        updatedItem.id = updatedItem.id ?? id;
        if (!updatedItem._cloudKey) updatedItem._cloudKey = _getDocCloudKey(updatedItem);
        updatedItem._lastModified = now;
        updatedItem._lastModifiedBy = myDeviceName;

        if (idx > -1) list[idx] = updatedItem;
        else list.push(updatedItem);

        this.saveCollection(cleanCol, list, true);
        if (cleanCol.includes('invoices')) {
            this.recalculateVaultBalances();
        }
        return true;
    },

    deleteItem: function(colName, id, mode = 'soft') {
        let cleanCol = colName.replace(/^seraj_/, '');
        let list = this.getCollection(cleanCol, []);
        let targetId = String(id);
        let now = getServerNow();

        if (cleanCol === 'treasury_moves') {
            if (!window.SerajAuth.canAccess('delete_treasury_move')) {
                window.SerajAlert('⛔ حذف أو عكس حركات الخزينة مخصص لصاحب المحل (المالك) فقط.', 'error');
                return false;
            }
            let deletedMove = list.find(item => item && (String(item.id) === targetId || String(item.rawTreasuryId || '') === targetId) && !item._isReversed) || null;

            if (deletedMove && !deletedMove._isReversal) {
                deletedMove._isReversed = true;
                deletedMove._lastModified = now;
                deletedMove._lastModifiedBy = myDeviceName;

                let oldAdd = window.Utils.round2(deletedMove.amountAdd);
                let oldDed = window.Utils.round2(deletedMove.amountDeduct);
                let oldAmt = window.Utils.round2(deletedMove.amount || oldAdd || oldDed);
                let revDate = window.Utils.getLocalDateString(now);

                let revMove = {
                    id: window.Utils.generateUniqueId('REV_'),
                    _cloudKey: window.Utils.generateUUID('REV'),
                    type: 'correction',
                    vault: deletedMove.vault || deletedMove.treasury || 'main',
                    treasury: deletedMove.vault || deletedMove.treasury || 'main',
                    amountAdd: oldDed,
                    amountDeduct: oldAdd,
                    amount: oldAmt,
                    notes: `🗑️ عكس لحذف حركة/سند: ${deletedMove.notes || ('رقم ' + deletedMove.id)}`,
                    date: revDate,
                    dateFormatted: new Date(now).toLocaleDateString('en-GB'),
                    timestamp: now,
                    invoiceNo: deletedMove.invoiceNo || null,
                    customerId: deletedMove.customerId || null,
                    customer: deletedMove.customer || null,
                    supplierId: deletedMove.supplierId || null,
                    supplier: deletedMove.supplier || null,
                    _device: myDeviceName,
                    _lastModified: now,
                    _lastModifiedBy: localStorage.getItem('cashier_name') || myDeviceName,
                    _isReversal: true,
                    _reversedMoveId: String(deletedMove.id)
                };
                list.unshift(revMove);
                this.saveTreasuryMoves(list);
            }

            // الحذف التبادلي بمعرف السند فقط (ممنوع استخدام invoiceNo لحماية السندات الجزئية المتعددة)
            let voucherLinkedIds = new Set([targetId]);
            if (deletedMove) {
                voucherLinkedIds.add(String(deletedMove.id));
                if (deletedMove.rawTreasuryId) voucherLinkedIds.add(String(deletedMove.rawTreasuryId));
            }

            // عكس السندات المستقلة (customer_vouchers / supplier_vouchers)
            let custVouchers = this.getCustomerVouchers(true);
            let cvChanged = false;
            custVouchers.forEach(v => {
                if (v && !v.isDeleted && (voucherLinkedIds.has(String(v.id)) || (v.rawTreasuryId && voucherLinkedIds.has(String(v.rawTreasuryId))))) {
                    v.isDeleted = true;
                    v.isCanceled = true;
                    v._lastModified = now;
                    v._lastModifiedBy = myDeviceName;
                    addToSyncQueue('customer_vouchers', v);
                    cvChanged = true;
                }
            });
            if (cvChanged) {
                _internalSetItem('seraj_customer_vouchers', JSON.stringify(custVouchers));
                this.calculateCustomerBalances();
            }

            let suppVouchers = this.getSupplierVouchers(true);
            let svChanged = false;
            suppVouchers.forEach(v => {
                if (v && !v.isDeleted && (voucherLinkedIds.has(String(v.id)) || (v.rawTreasuryId && voucherLinkedIds.has(String(v.rawTreasuryId))))) {
                    v.isDeleted = true;
                    v.isCanceled = true;
                    v._lastModified = now;
                    v._lastModifiedBy = myDeviceName;
                    addToSyncQueue('supplier_vouchers', v);
                    svChanged = true;
                }
            });
            if (svChanged) {
                _internalSetItem('seraj_supplier_vouchers', JSON.stringify(suppVouchers));
                this.calculateSupplierBalances();
            }

            this.recalculateVaultBalances();
            emitSerajUpdate(cleanCol, 'delete');
            return true;
        }

        // استخدام Tombstones ({ isDeleted: true }) بدلاً من الحذف الفيزيائي لحماية تزامن الأجهزة الأوفلاين
        let updated = false;
        let canceledInvoiceObj = null;
        let tombstoneItem = null;

        list.forEach(item => {
            if (item && String(item.id) === targetId) {
                if (cleanCol.includes('invoices')) {
                    item.isCanceled = true;
                    if (mode === 'hard') item.isDeleted = true;
                    canceledInvoiceObj = item;
                } else {
                    item.isArchived = true;
                    item.isDeleted = true;
                }
                item._deletedAt = now;
                item._lastModified = now;
                item._lastModifiedBy = myDeviceName;
                tombstoneItem = item;
                updated = true;
            }
        });

        if (updated) {
            this.saveCollection(cleanCol, list, true);
            if (tombstoneItem) {
                enqueueOutboxOp(cleanCol, _getDocCloudKey(tombstoneItem), 'upsert', tombstoneItem);
            }

            if (cleanCol.includes('invoices') && canceledInvoiceObj && canceledInvoiceObj.type !== 'quotation' && canceledInvoiceObj.type !== 'quote') {
                let rawMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
                let domain = (cleanCol === 'purchase_invoices') ? 'purchases' : 'sales';
                let origMove = this._findActiveInvoiceTreasuryMove(canceledInvoiceObj, rawMoves, domain);

                if (origMove) {
                    origMove._isReversed = true;
                    origMove._lastModified = now;
                    _internalSetItem('seraj_treasury_moves', JSON.stringify(rawMoves));
                    addToSyncQueue('treasury_moves', origMove);

                    let isPurch = (domain === 'purchases');
                    let isReturn = ['return', 'return_sale', 'sales_return', 'purchase_return', 'return_purchase'].includes(canceledInvoiceObj.type);
                    let checkoutPaid = (canceledInvoiceObj.initialPaid !== undefined && canceledInvoiceObj.initialPaid !== null && !isNaN(parseFloat(canceledInvoiceObj.initialPaid)))
                        ? Math.max(0, window.Utils.round2(canceledInvoiceObj.initialPaid))
                        : Math.max(0, window.Utils.round2(canceledInvoiceObj.paid));
                    let addAmt = 0, dedAmt = 0;
                    if (checkoutPaid > 0) {
                        if (isPurch) {
                            addAmt = isReturn ? 0 : checkoutPaid;
                            dedAmt = isReturn ? checkoutPaid : 0;
                        } else {
                            addAmt = isReturn ? checkoutPaid : 0;
                            dedAmt = isReturn ? 0 : checkoutPaid;
                        }
                    }
                    this.recordTreasuryTransaction({
                        type: 'correction',
                        vault: canceledInvoiceObj.vault || canceledInvoiceObj.treasury || canceledInvoiceObj.paymentMethod || 'main',
                        amountAdd: addAmt,
                        amountDeduct: dedAmt,
                        amount: checkoutPaid,
                        invoiceNo: canceledInvoiceObj.invoiceNo || canceledInvoiceObj.id,
                        invoiceDomain: domain,
                        customerId: canceledInvoiceObj.customerId || null,
                        customer: canceledInvoiceObj.customer || null,
                        supplierId: canceledInvoiceObj.supplierId || null,
                        supplier: canceledInvoiceObj.supplier || null,
                        _isReversal: true,
                        _reversedMoveId: String(origMove.id),
                        notes: `🗑️ إلغاء واسترداد ${isPurch ? 'فاتورة مشتريات' : 'فاتورة مبيعات'} رقم #${canceledInvoiceObj.invoiceNo || canceledInvoiceObj.id}`
                    });
                }
                this.recalculateVaultBalances();
            }
        }
        return updated;
    },

    // =========================================================================
    // 16. إدارة فواتير البيع والشراء (فصل البيع عن الشراء + منع الخصم المزدوج + بدون قفل 3 ثوانٍ)
    // =========================================================================
    getSalesInvoices: function(includeCanceled = true) {
        let invs = safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []);
        let normalized = invs.map(inv => {
            if (!inv) return null;
            inv.date = window.Utils.normalizeDateStr(inv.date, inv.timestamp);
            inv.timestamp = window.Utils.alignTimestampWithDate(inv.date, inv.timestamp);
            if (inv.type === 'return_sale' || inv.type === 'sales_return') inv.type = 'return';
            let remVal = inv.calculatedRemaining !== undefined ? parseFloat(inv.calculatedRemaining) : (parseFloat(inv.remaining) || 0);
            inv.computedRemaining = isNaN(remVal) ? 0 : window.Utils.round2(remVal);
            return inv;
        }).filter(Boolean);

        return includeCanceled ? normalized : normalized.filter(inv => !inv.isCanceled && inv.type !== 'canceled' && !inv.isDeleted && inv.status !== 'deleted');
    },

    saveSalesInvoices: function(data, options = {}) {
        if (!Array.isArray(data)) return;
        let oldCache = safeParseJSON(localStorage.getItem('seraj_sales_invoices') || localStorage.getItem('seraj_cloud_cache_sales_invoices'), []);
        let oldMap = new Map(oldCache.map(i => [String(i?.id), i]));
        let rawCustomers = safeParseJSON(localStorage.getItem('seraj_customers'), []);
        let allMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
        let now = getServerNow();
        let round2 = window.Utils.round2;
        let newlyCreatedInvoices = [];
        let editedInvoices = [];

        let opts = (options && typeof options === 'object') ? options : {};
        let isCustomerScreen = (opts.source === 'customers' || opts.skipTreasuryDiff === true)
            ? true
            : (opts.source ? false : (typeof renderCustomersList === 'function'));

        let cleanData = data.map(inv => {
            if (!inv) return null;
            try {
                let cleanInv = JSON.parse(JSON.stringify(inv));
                if (!cleanInv.id) cleanInv.id = window.Utils.generateInvoiceId('sales');
                if (!cleanInv.invoiceNo) cleanInv.invoiceNo = String(cleanInv.id);
                if (!cleanInv._cloudKey) cleanInv._cloudKey = window.Utils.generateUUID('SINV');

                cleanInv.date = window.Utils.normalizeDateStr(cleanInv.date, cleanInv.timestamp);
                cleanInv.timestamp = window.Utils.alignTimestampWithDate(cleanInv.date, cleanInv.timestamp || now);

                if (cleanInv.type === 'canceled' || cleanInv.status === 'deleted' || cleanInv.isDeleted) {
                    cleanInv.isCanceled = true;
                }
                if (cleanInv.type === 'return_sale' || cleanInv.type === 'sales_return') {
                    cleanInv.type = 'return';
                }
                if (cleanInv.customer) cleanInv.customer = String(cleanInv.customer).trim();

                // تقييد الخصم <= subTotal وتأكيد isNetTotal: true لمنع الخصم المزدوج
                let subTotal = Array.isArray(cleanInv.items) && cleanInv.items.length > 0
                    ? round2(cleanInv.items.reduce((s, it) => s + (parseFloat(it.total) || ((parseFloat(it.price) || 0) * (parseFloat(it.qty) || 0))), 0))
                    : round2(cleanInv.subTotal ?? cleanInv.total);
                let clampedDisc = Math.min(Math.max(0, round2(cleanInv.discount)), Math.max(0, subTotal));
                cleanInv.discount = clampedDisc;
                if (cleanInv.isNetTotal !== true) {
                    let netComputed = this._computeInvoiceNetTotal(cleanInv);
                    cleanInv.total = netComputed;
                    cleanInv.isNetTotal = true;
                } else {
                    cleanInv.total = Math.max(0, round2(cleanInv.total));
                }

                let oldInv = oldMap.get(String(cleanInv.id));

                if (!oldInv) {
                    if (cleanInv.initialPaid === undefined || cleanInv.initialPaid === null || isNaN(parseFloat(cleanInv.initialPaid))) {
                        cleanInv.initialPaid = Math.max(0, round2(cleanInv.paid));
                    }
                    // إزالة Math.max(0, ...) عن initialRemaining للسماح بالدفعات الزائدة (رصيد له)
                    if (cleanInv.initialRemaining === undefined || cleanInv.initialRemaining === null || isNaN(parseFloat(cleanInv.initialRemaining))) {
                        cleanInv.initialRemaining = round2(cleanInv.total - cleanInv.initialPaid);
                    }
                    if (!cleanInv.isCanceled && cleanInv.type !== 'quotation') {
                        newlyCreatedInvoices.push(cleanInv);
                    }
                } else if (!this._isCalculatingBalances) {
                    let oldPaid = round2(oldInv.paid);
                    let newPaid = round2(cleanInv.paid);
                    let oldTotal = round2(oldInv.total);
                    let newTotal = round2(cleanInv.total);
                    let oldInitPaid = (oldInv.initialPaid !== undefined && oldInv.initialPaid !== null && !isNaN(parseFloat(oldInv.initialPaid)))
                        ? Math.max(0, round2(oldInv.initialPaid))
                        : oldPaid;

                    let appliedVouchers = 0;
                    let cNorm = window.Utils.normalizeName(cleanInv.customer || cleanInv.customerName || '');
                    let matchedCust = rawCustomers.find(c => c && (String(c.id) === String(cleanInv.customerId) || (cNorm && window.Utils.normalizeName(c.name) === cNorm)));
                    if (matchedCust) {
                        let validTxs = this._collectUnifiedEntityTransactions(matchedCust, allMoves, false);
                        appliedVouchers = this._getAppliedVoucherAmountForInvoice(cleanInv, validTxs, false);
                    }

                    let explicitInitEdit = Boolean(cleanInv._editedInitialPaid);
                    delete cleanInv._editedInitialPaid;

                    let wasEditedInHistory = !isCustomerScreen && (explicitInitEdit || cleanInv.initialPaid === undefined || Math.abs(newTotal - oldTotal) > 0.001 || Math.abs(newPaid - oldPaid) > 0.001);
                    if (wasEditedInHistory) {
                        cleanInv.initialPaid = explicitInitEdit && cleanInv.initialPaid !== undefined
                            ? Math.max(0, round2(cleanInv.initialPaid))
                            : Math.max(0, round2(newPaid - appliedVouchers));
                        cleanInv.initialRemaining = round2(newTotal - cleanInv.initialPaid);
                        cleanInv.paid = Math.min(newTotal, round2(cleanInv.initialPaid + appliedVouchers));
                    } else {
                        if (cleanInv.initialPaid === undefined && oldInv.initialPaid !== undefined) cleanInv.initialPaid = oldInv.initialPaid;
                        if (cleanInv.initialRemaining === undefined && oldInv.initialRemaining !== undefined) cleanInv.initialRemaining = oldInv.initialRemaining;
                    }

                    let newInitPaid = Math.max(0, round2(cleanInv.initialPaid ?? cleanInv.paid));
                    let oldIsReturn = ['return', 'return_sale', 'sales_return'].includes(oldInv.type);
                    let newIsReturn = ['return', 'return_sale', 'sales_return'].includes(cleanInv.type);
                    let oldVault = oldInv.vault || oldInv.treasury || oldInv.paymentMethod || 'main';
                    let newVault = cleanInv.vault || cleanInv.treasury || cleanInv.paymentMethod || 'main';

                    if (!oldInv.isCanceled && cleanInv.isCanceled) {
                        editedInvoices.push({ action: 'cancel', oldInv, cleanInv, oldInitPaid, oldIsReturn, oldVault });
                    } else if (!isCustomerScreen && !cleanInv.isCanceled && cleanInv.type !== 'quotation') {
                        if (Math.abs(newInitPaid - oldInitPaid) > 0.009 || Math.abs(newTotal - oldTotal) > 0.009 || oldIsReturn !== newIsReturn || oldVault !== newVault) {
                            editedInvoices.push({ action: 'edit', oldInv, cleanInv, oldInitPaid, newInitPaid, oldIsReturn, newIsReturn, oldVault, newVault });
                        }
                    }
                }

                let remVal = cleanInv.calculatedRemaining !== undefined ? parseFloat(cleanInv.calculatedRemaining) : (parseFloat(cleanInv.remaining) || 0);
                cleanInv.computedRemaining = isNaN(remVal) ? 0 : round2(remVal);

                if (!oldInv || JSON.stringify(_stripComputedFieldsForDiff(oldInv)) !== JSON.stringify(_stripComputedFieldsForDiff(cleanInv))) {
                    cleanInv._lastModified = now;
                } else if (oldInv._lastModified) {
                    cleanInv._lastModified = oldInv._lastModified;
                }
                return cleanInv;
            } catch (err) {
                console.error('Sales JSON Clean Error:', err);
                return inv;
            }
        }).filter(Boolean);

        _internalSetItem('seraj_sales_invoices', JSON.stringify(cleanData));
        this._updateInvoiceCountersFromList('sales', cleanData, true);
        saveArrayToQueueSafely('sales_invoices', cleanData);

        if (!this._isCalculatingBalances && newlyCreatedInvoices.length > 0) {
            let currentMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
            newlyCreatedInvoices.forEach(newInv => {
                if (!this._hasTreasuryMoveForInvoice(newInv, currentMoves, 'sales')) {
                    let isReturn = ['return', 'return_sale', 'sales_return'].includes(newInv.type);
                    let paidAmt = Math.max(0, round2(newInv.initialPaid ?? newInv.paid));
                    let totalAmt = round2(newInv.total);
                    this.recordTreasuryTransaction({
                        type: isReturn ? 'return_sale' : 'sales',
                        invoiceDomain: 'sales',
                        vault: newInv.vault || newInv.treasury || newInv.paymentMethod || 'main',
                        amountAdd: isReturn ? 0 : paidAmt,
                        amountDeduct: isReturn ? paidAmt : 0,
                        amount: paidAmt,
                        date: newInv.date,
                        timestamp: newInv.timestamp || Date.now(),
                        invoiceNo: newInv.invoiceNo || newInv.id,
                        customerId: newInv.customerId || null,
                        customer: newInv.customer || null,
                        notes: `${isReturn ? 'فاتورة مرتجع بيع' : (paidAmt === 0 ? 'فاتورة مبيعات آجلة (مسدد 0)' : 'فاتورة مبيعات')} رقم #${newInv.invoiceNo || newInv.id}${newInv.customer ? ' - ' + newInv.customer : ''} (إجمالي: ${totalAmt})`
                    });
                }
            });
        }

        // بدون قفل الـ 3 ثوانٍ + تعليم الحركة الأصلية بـ _isReversed: true
        if (!this._isCalculatingBalances && editedInvoices.length > 0) {
            let tsNow = getServerNow();
            editedInvoices.forEach((item, idx) => {
                let rawMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
                let origMove = this._findActiveInvoiceTreasuryMove(item.cleanInv, rawMoves, 'sales');
                if (origMove) {
                    origMove._isReversed = true;
                    origMove._lastModified = tsNow;
                    _internalSetItem('seraj_treasury_moves', JSON.stringify(rawMoves));
                    addToSyncQueue('treasury_moves', origMove);
                }

                let displayNo = item.cleanInv.invoiceNo || item.cleanInv.id;
                if (item.action === 'cancel') {
                    this.recordTreasuryTransaction({
                        type: 'correction',
                        invoiceDomain: 'sales',
                        vault: item.oldVault,
                        amountAdd: item.oldIsReturn ? item.oldInitPaid : 0,
                        amountDeduct: item.oldIsReturn ? 0 : item.oldInitPaid,
                        amount: item.oldInitPaid,
                        date: window.Utils.getLocalDateString(tsNow),
                        timestamp: tsNow + (idx * 2),
                        invoiceNo: displayNo,
                        customerId: item.cleanInv.customerId || null,
                        customer: item.cleanInv.customer || null,
                        _isReversal: true,
                        _reversedMoveId: origMove ? String(origMove.id) : null,
                        notes: `🗑️ إلغاء واسترداد فاتورة مبيعات رقم #${displayNo}${item.cleanInv.customer ? ' - ' + item.cleanInv.customer : ''} (المدفوع المسترد: ${item.oldInitPaid})`
                    });
                } else if (item.action === 'edit') {
                    if (item.oldInitPaid > 0) {
                        this.recordTreasuryTransaction({
                            type: 'correction',
                            invoiceDomain: 'sales',
                            vault: item.oldVault,
                            amountAdd: item.oldIsReturn ? item.oldInitPaid : 0,
                            amountDeduct: item.oldIsReturn ? 0 : item.oldInitPaid,
                            amount: item.oldInitPaid,
                            date: window.Utils.getLocalDateString(tsNow),
                            timestamp: tsNow + (idx * 2),
                            invoiceNo: displayNo,
                            customerId: item.cleanInv.customerId || null,
                            customer: item.cleanInv.customer || null,
                            _isReversal: true,
                            _reversedMoveId: origMove ? String(origMove.id) : null,
                            notes: `🔄 عكس لتعديل فاتورة مبيعات رقم #${displayNo} (المدفوع السابق: ${item.oldInitPaid})`
                        });
                    }
                    let totalAmt = round2(item.cleanInv.total);
                    this.recordTreasuryTransaction({
                        type: item.newIsReturn ? 'return_sale' : 'sales',
                        invoiceDomain: 'sales',
                        vault: item.newVault,
                        amountAdd: item.newIsReturn ? 0 : item.newInitPaid,
                        amountDeduct: item.newIsReturn ? item.newInitPaid : 0,
                        amount: item.newInitPaid,
                        date: window.Utils.getLocalDateString(tsNow),
                        timestamp: tsNow + (idx * 2) + 1,
                        invoiceNo: displayNo,
                        customerId: item.cleanInv.customerId || null,
                        customer: item.cleanInv.customer || null,
                        notes: `✏️ بعد التعديل: ${item.newIsReturn ? 'فاتورة مرتجع بيع' : (item.newInitPaid === 0 ? 'فاتورة مبيعات آجلة (مسدد 0)' : 'فاتورة مبيعات')} رقم #${displayNo}${item.cleanInv.customer ? ' - ' + item.cleanInv.customer : ''} (إجمالي: ${totalAmt})`
                    });
                }
            });
        }

        if (!this._isCalculatingBalances) {
            this.recalculateVaultBalances();
        }
    },

    getPurchaseInvoices: function(includeCanceled = true) {
        let invs = safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []);
        let normalized = invs.map(inv => {
            if (!inv) return null;
            inv.date = window.Utils.normalizeDateStr(inv.date, inv.timestamp);
            inv.timestamp = window.Utils.alignTimestampWithDate(inv.date, inv.timestamp);
            if (inv.type === 'purchase_return' || inv.type === 'return_purchase') inv.type = 'return';
            let remVal = inv.calculatedRemaining !== undefined ? parseFloat(inv.calculatedRemaining) : (parseFloat(inv.remaining) || 0);
            inv.computedRemaining = isNaN(remVal) ? 0 : window.Utils.round2(remVal);
            return inv;
        }).filter(Boolean);

        return includeCanceled ? normalized : normalized.filter(inv => !inv.isCanceled && inv.type !== 'canceled' && !inv.isDeleted && inv.status !== 'deleted');
    },

    // تمرير null في newInvoiceItems يمنع تماماً مسح نواقص المفكرة عند تعديل فاتورة قديمة في purchases_history.html
    savePurchaseInvoices: function(data, newInvoiceItems = undefined, options = {}) {
        if (!Array.isArray(data)) return;
        let opts = (options && typeof options === 'object') ? options : {};
        let explicitlySkipNotesClean = (newInvoiceItems === null);

        if (newInvoiceItems && !Array.isArray(newInvoiceItems) && typeof newInvoiceItems === 'object') {
            opts = newInvoiceItems;
            newInvoiceItems = undefined;
        }

        let oldCache = safeParseJSON(localStorage.getItem('seraj_purchase_invoices') || localStorage.getItem('seraj_cloud_cache_purchase_invoices'), []);
        let oldMap = new Map(oldCache.map(i => [String(i?.id), i]));
        let rawSuppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []);
        let allMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
        let now = getServerNow();
        let round2 = window.Utils.round2;
        let autoDetectedNewItems = [];
        let newlyCreatedInvoices = [];
        let editedInvoices = [];

        let isSupplierScreen = (opts.source === 'suppliers' || opts.skipTreasuryDiff === true)
            ? true
            : (opts.source ? false : (typeof renderSuppliersList === 'function'));

        let cleanData = data.map(inv => {
            if (!inv) return null;
            try {
                let cleanInv = JSON.parse(JSON.stringify(inv));
                if (!cleanInv.id) cleanInv.id = window.Utils.generateInvoiceId('purchases');
                if (!cleanInv.invoiceNo) cleanInv.invoiceNo = String(cleanInv.id);
                if (!cleanInv._cloudKey) cleanInv._cloudKey = window.Utils.generateUUID('PINV');

                cleanInv.date = window.Utils.normalizeDateStr(cleanInv.date, cleanInv.timestamp);
                cleanInv.timestamp = window.Utils.alignTimestampWithDate(cleanInv.date, cleanInv.timestamp || now);

                if (cleanInv.type === 'canceled' || cleanInv.status === 'deleted' || cleanInv.isDeleted) {
                    cleanInv.isCanceled = true;
                }
                if (cleanInv.type === 'purchase_return' || cleanInv.type === 'return_purchase') {
                    cleanInv.type = 'return';
                }
                if (cleanInv.supplier) cleanInv.supplier = String(cleanInv.supplier).trim();

                let subTotal = Array.isArray(cleanInv.items) && cleanInv.items.length > 0
                    ? round2(cleanInv.items.reduce((s, it) => s + (parseFloat(it.total) || ((parseFloat(it.price) || 0) * (parseFloat(it.qty) || 0))), 0))
                    : round2(cleanInv.subTotal ?? cleanInv.total);
                let clampedDisc = Math.min(Math.max(0, round2(cleanInv.discount)), Math.max(0, subTotal));
                cleanInv.discount = clampedDisc;
                if (cleanInv.isNetTotal !== true) {
                    let netComputed = this._computeInvoiceNetTotal(cleanInv);
                    cleanInv.total = netComputed;
                    cleanInv.isNetTotal = true;
                } else {
                    cleanInv.total = Math.max(0, round2(cleanInv.total));
                }

                let oldInv = oldMap.get(String(cleanInv.id));

                if (!oldInv && !cleanInv.isCanceled && cleanInv.type !== 'return' && Array.isArray(cleanInv.items)) {
                    autoDetectedNewItems.push(...cleanInv.items);
                }

                if (!oldInv) {
                    if (cleanInv.initialPaid === undefined || cleanInv.initialPaid === null || isNaN(parseFloat(cleanInv.initialPaid))) {
                        cleanInv.initialPaid = Math.max(0, round2(cleanInv.paid));
                    }
                    if (cleanInv.initialRemaining === undefined || cleanInv.initialRemaining === null || isNaN(parseFloat(cleanInv.initialRemaining))) {
                        cleanInv.initialRemaining = round2(cleanInv.total - cleanInv.initialPaid);
                    }
                    if (!cleanInv.isCanceled && cleanInv.type !== 'quotation') {
                        newlyCreatedInvoices.push(cleanInv);
                    }
                } else if (!this._isCalculatingBalances) {
                    let oldPaid = round2(oldInv.paid);
                    let newPaid = round2(cleanInv.paid);
                    let oldTotal = round2(oldInv.total);
                    let newTotal = round2(cleanInv.total);
                    let oldInitPaid = (oldInv.initialPaid !== undefined && oldInv.initialPaid !== null && !isNaN(parseFloat(oldInv.initialPaid)))
                        ? Math.max(0, round2(oldInv.initialPaid))
                        : oldPaid;

                    let appliedVouchers = 0;
                    let sNorm = window.Utils.normalizeName(cleanInv.supplier || cleanInv.supplierName || '');
                    let matchedSupp = rawSuppliers.find(s => s && (String(s.id) === String(cleanInv.supplierId) || (sNorm && window.Utils.normalizeName(s.name) === sNorm)));
                    if (matchedSupp) {
                        let validTxs = this._collectUnifiedEntityTransactions(matchedSupp, allMoves, true);
                        appliedVouchers = this._getAppliedVoucherAmountForInvoice(cleanInv, validTxs, true);
                    }

                    let explicitInitEdit = Boolean(cleanInv._editedInitialPaid);
                    delete cleanInv._editedInitialPaid;

                    let wasEditedInHistory = !isSupplierScreen && (explicitInitEdit || cleanInv.initialPaid === undefined || Math.abs(newTotal - oldTotal) > 0.001 || Math.abs(newPaid - oldPaid) > 0.001);
                    if (wasEditedInHistory) {
                        cleanInv.initialPaid = explicitInitEdit && cleanInv.initialPaid !== undefined
                            ? Math.max(0, round2(cleanInv.initialPaid))
                            : Math.max(0, round2(newPaid - appliedVouchers));
                        cleanInv.initialRemaining = round2(newTotal - cleanInv.initialPaid);
                        cleanInv.paid = Math.min(newTotal, round2(cleanInv.initialPaid + appliedVouchers));
                    } else {
                        if (cleanInv.initialPaid === undefined && oldInv.initialPaid !== undefined) cleanInv.initialPaid = oldInv.initialPaid;
                        if (cleanInv.initialRemaining === undefined && oldInv.initialRemaining !== undefined) cleanInv.initialRemaining = oldInv.initialRemaining;
                    }

                    let newInitPaid = Math.max(0, round2(cleanInv.initialPaid ?? cleanInv.paid));
                    let oldIsReturn = ['return', 'return_purchase', 'purchase_return'].includes(oldInv.type);
                    let newIsReturn = ['return', 'return_purchase', 'purchase_return'].includes(cleanInv.type);
                    let oldVault = oldInv.vault || oldInv.treasury || oldInv.paymentMethod || 'main';
                    let newVault = cleanInv.vault || cleanInv.treasury || cleanInv.paymentMethod || 'main';

                    if (!oldInv.isCanceled && cleanInv.isCanceled) {
                        editedInvoices.push({ action: 'cancel', oldInv, cleanInv, oldInitPaid, oldIsReturn, oldVault });
                    } else if (!isSupplierScreen && !cleanInv.isCanceled && cleanInv.type !== 'quotation') {
                        if (Math.abs(newInitPaid - oldInitPaid) > 0.009 || Math.abs(newTotal - oldTotal) > 0.009 || oldIsReturn !== newIsReturn || oldVault !== newVault) {
                            editedInvoices.push({ action: 'edit', oldInv, cleanInv, oldInitPaid, newInitPaid, oldIsReturn, newIsReturn, oldVault, newVault });
                        }
                    }
                }

                let remVal = cleanInv.calculatedRemaining !== undefined ? parseFloat(cleanInv.calculatedRemaining) : (parseFloat(cleanInv.remaining) || 0);
                cleanInv.computedRemaining = isNaN(remVal) ? 0 : round2(remVal);

                if (!oldInv || JSON.stringify(_stripComputedFieldsForDiff(oldInv)) !== JSON.stringify(_stripComputedFieldsForDiff(cleanInv))) {
                    cleanInv._lastModified = now;
                } else if (oldInv._lastModified) {
                    cleanInv._lastModified = oldInv._lastModified;
                }
                return cleanInv;
            } catch (err) {
                console.error('Purchase JSON Clean Error:', err);
                return inv;
            }
        }).filter(Boolean);

        _internalSetItem('seraj_purchase_invoices', JSON.stringify(cleanData));
        this._updateInvoiceCountersFromList('purchases', cleanData, true);
        saveArrayToQueueSafely('purchase_invoices', cleanData);

        if (!this._isCalculatingBalances && newlyCreatedInvoices.length > 0) {
            let currentMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
            newlyCreatedInvoices.forEach(newInv => {
                if (!this._hasTreasuryMoveForInvoice(newInv, currentMoves, 'purchases')) {
                    let isReturn = ['return', 'return_purchase', 'purchase_return'].includes(newInv.type);
                    let paidAmt = Math.max(0, round2(newInv.initialPaid ?? newInv.paid));
                    let totalAmt = round2(newInv.total);
                    this.recordTreasuryTransaction({
                        type: isReturn ? 'return_purchase' : 'purchase',
                        invoiceDomain: 'purchases',
                        vault: newInv.vault || newInv.treasury || newInv.paymentMethod || 'main',
                        amountAdd: isReturn ? paidAmt : 0,
                        amountDeduct: isReturn ? 0 : paidAmt,
                        amount: paidAmt,
                        date: newInv.date,
                        timestamp: newInv.timestamp || Date.now(),
                        invoiceNo: newInv.invoiceNo || newInv.id,
                        supplierId: newInv.supplierId || null,
                        supplier: newInv.supplier || null,
                        notes: `${isReturn ? 'فاتورة مرتجع مشتريات' : (paidAmt === 0 ? 'فاتورة مشتريات آجلة (مسدد 0)' : 'فاتورة مشتريات')} رقم #${newInv.invoiceNo || newInv.id}${newInv.supplier ? ' - ' + newInv.supplier : ''} (إجمالي: ${totalAmt})`
                    });
                }
            });
        }

        if (!this._isCalculatingBalances && editedInvoices.length > 0) {
            let tsNow = getServerNow();
            editedInvoices.forEach((item, idx) => {
                let rawMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
                let origMove = this._findActiveInvoiceTreasuryMove(item.cleanInv, rawMoves, 'purchases');
                if (origMove) {
                    origMove._isReversed = true;
                    origMove._lastModified = tsNow;
                    _internalSetItem('seraj_treasury_moves', JSON.stringify(rawMoves));
                    addToSyncQueue('treasury_moves', origMove);
                }

                let displayNo = item.cleanInv.invoiceNo || item.cleanInv.id;
                if (item.action === 'cancel') {
                    this.recordTreasuryTransaction({
                        type: 'correction',
                        invoiceDomain: 'purchases',
                        vault: item.oldVault,
                        amountAdd: item.oldIsReturn ? 0 : item.oldInitPaid,
                        amountDeduct: item.oldIsReturn ? item.oldInitPaid : 0,
                        amount: item.oldInitPaid,
                        date: window.Utils.getLocalDateString(tsNow),
                        timestamp: tsNow + (idx * 2),
                        invoiceNo: displayNo,
                        supplierId: item.cleanInv.supplierId || null,
                        supplier: item.cleanInv.supplier || null,
                        _isReversal: true,
                        _reversedMoveId: origMove ? String(origMove.id) : null,
                        notes: `🗑️ إلغاء واسترداد فاتورة مشتريات رقم #${displayNo}${item.cleanInv.supplier ? ' - ' + item.cleanInv.supplier : ''} (المدفوع المسترد: ${item.oldInitPaid})`
                    });
                } else if (item.action === 'edit') {
                    if (item.oldInitPaid > 0) {
                        this.recordTreasuryTransaction({
                            type: 'correction',
                            invoiceDomain: 'purchases',
                            vault: item.oldVault,
                            amountAdd: item.oldIsReturn ? 0 : item.oldInitPaid,
                            amountDeduct: item.oldIsReturn ? item.oldInitPaid : 0,
                            amount: item.oldInitPaid,
                            date: window.Utils.getLocalDateString(tsNow),
                            timestamp: tsNow + (idx * 2),
                            invoiceNo: displayNo,
                            supplierId: item.cleanInv.supplierId || null,
                            supplier: item.cleanInv.supplier || null,
                            _isReversal: true,
                            _reversedMoveId: origMove ? String(origMove.id) : null,
                            notes: `🔄 عكس لتعديل فاتورة مشتريات رقم #${displayNo} (المدفوع السابق: ${item.oldInitPaid})`
                        });
                    }
                    let totalAmt = round2(item.cleanInv.total);
                    this.recordTreasuryTransaction({
                        type: item.newIsReturn ? 'return_purchase' : 'purchase',
                        invoiceDomain: 'purchases',
                        vault: item.newVault,
                        amountAdd: item.newIsReturn ? item.newInitPaid : 0,
                        amountDeduct: item.newIsReturn ? 0 : item.newInitPaid,
                        amount: item.newInitPaid,
                        date: window.Utils.getLocalDateString(tsNow),
                        timestamp: tsNow + (idx * 2) + 1,
                        invoiceNo: displayNo,
                        supplierId: item.cleanInv.supplierId || null,
                        supplier: item.cleanInv.supplier || null,
                        notes: `✏️ بعد التعديل: ${item.newIsReturn ? 'فاتورة مرتجع مشتريات' : (item.newInitPaid === 0 ? 'فاتورة مشتريات آجلة (مسدد 0)' : 'فاتورة مشتريات')} رقم #${displayNo}${item.cleanInv.supplier ? ' - ' + item.cleanInv.supplier : ''} (إجمالي: ${totalAmt})`
                    });
                }
            });
        }

        if (!this._isCalculatingBalances) {
            this.recalculateVaultBalances();
        }

        if (!explicitlySkipNotesClean) {
            let itemsToClean = (Array.isArray(newInvoiceItems) && newInvoiceItems.length > 0) ? newInvoiceItems : autoDetectedNewItems;
            if (itemsToClean.length > 0) {
                this.cleanSmartNotesAfterPurchase(itemsToClean);
            }
        }
    },

    cleanSmartNotesAfterPurchase: function(newInvoiceItems) {
        if (!newInvoiceItems || newInvoiceItems.length === 0) return;
        let smartNotesDB = this.getSmartNotes();
        let isModified = false;
        let purchasedNormNames = newInvoiceItems
            .map(item => window.Utils.normalizeName(item?.name || item?.text || ''))
            .filter(Boolean);

        if (purchasedNormNames.length === 0) return;

        for (let i = smartNotesDB.length - 1; i >= 0; i--) {
            let note = smartNotesDB[i];
            if (note && !note.isDeleted && Array.isArray(note.items) && note.items.length > 0) {
                let originalCount = note.items.length;
                note.items = note.items.filter(noteItem => {
                    let rawName = String(noteItem?.name || noteItem?.text || '').replace(/<[^>]*>?/gm, '').replace(/\(مؤرشف\)/g, '');
                    let normNoteItem = window.Utils.normalizeName(rawName);
                    return !purchasedNormNames.includes(normNoteItem);
                });

                if (note.items.length !== originalCount) {
                    isModified = true;
                    if (note.items.length === 0 && (!note.title || note.title.includes('بدون اسم') || note.title.includes('نواقص'))) {
                        note.isDeleted = true;
                        note._lastModified = getServerNow();
                    }
                }
            }
        }

        if (isModified) {
            this.saveSmartNotes(smartNotesDB);
        }
    },

    // فصل البيع عن الشراء تماماً عند فحص حركات الخزينة للفاتورة
    _findActiveInvoiceTreasuryMove: function(inv, rawMoves, domain = 'sales') {
        if (!inv || !Array.isArray(rawMoves)) return null;
        let invIdStr = String(inv.id ?? inv.invoiceNo ?? '').trim();
        let invNoStr = String(inv.invoiceNo ?? invIdStr).trim();
        if (!invIdStr) return null;

        let allowedTypes = (domain === 'purchases')
            ? ['purchase', 'return_purchase']
            : ['sales', 'return_sale'];

        return rawMoves.find(m => {
            if (!m || m._isReversed || m._isReversal) return false;
            if (!allowedTypes.includes(m.type)) return false;
            if (m.invoiceDomain && m.invoiceDomain !== domain) return false;
            let mInvNo = String(m.invoiceNo ?? '').trim();
            if (mInvNo && (mInvNo === invIdStr || mInvNo === invNoStr)) return true;
            if (m.notes) {
                let notesStr = String(m.notes);
                if (notesStr.includes(`#${invNoStr}`) || notesStr.includes(`#${invIdStr}`)) return true;
            }
            return false;
        }) || null;
    },

    _hasTreasuryMoveForInvoice: function(inv, rawMoves, domain = 'sales') {
        return Boolean(this._findActiveInvoiceTreasuryMove(inv, rawMoves, domain));
    },

    // =========================================================================
    // 17. كاميرا الخزينة والمصروفات والأرصدة
    // =========================================================================
    getTreasuryMoves: function(includeCanceled = true, rawOnly = false) {
        let rawMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
        let cleanedRaw = rawMoves.filter(m => {
            if (!m) return false;
            let mIdStr = String(m.id ?? '');
            return !(m._isInvoice === true || m._isMergedInvoice === true || mIdStr.endsWith('_vouch') || mIdStr.endsWith('_cash') || mIdStr.endsWith('_inv_sale') || mIdStr.endsWith('_inv_purch'));
        }).map(m => {
            let normDate = window.Utils.normalizeDateStr(m.date, m.timestamp);
            let alignedTs = window.Utils.alignTimestampWithDate(normDate, m.timestamp);
            let vKey = m.vault || m.treasury || 'main';
            if (vKey !== 'main' && vKey !== 'insta' && vKey !== 'wallet') {
                let low = String(vKey).toLowerCase();
                vKey = (low.includes('insta') || low.includes('انستا') || low.includes('إنستا')) ? 'insta' : ((low.includes('wallet') || low.includes('محفظ')) ? 'wallet' : 'main');
            }
            return { ...m, vault: vKey, treasury: vKey, date: normDate, timestamp: alignedTs };
        });

        return includeCanceled
            ? [...cleanedRaw]
            : cleanedRaw.filter(m => !m.isCanceled && m.type !== 'canceled' && m.type !== 'cancelled' && !m.isDeleted && m.status !== 'deleted');
    },

    saveTreasuryMoves: function(data) {
        if (!Array.isArray(data) || this._isSavingTreasury) return;
        this._isSavingTreasury = true;
        try {
            let now = getServerNow();
            let round2 = window.Utils.round2;
            let seenIds = new Set();

            let cleanedMoves = data.filter(m => {
                if (!m) return false;
                let mIdStr = String(m.id ?? '');
                return !(m._isInvoice === true || m._isMergedInvoice === true || mIdStr.endsWith('_vouch') || mIdStr.endsWith('_cash') || mIdStr.endsWith('_inv_sale') || mIdStr.endsWith('_inv_purch'));
            }).map((m, idx) => {
                let cleanM = { ...m };
                delete cleanM._isInvoice;
                delete cleanM._isMergedInvoice;

                if (cleanM.id === undefined || cleanM.id === null || cleanM.id === '') {
                    cleanM.id = window.Utils.generateUniqueId('TR_');
                } else if (String(cleanM.id).includes('.')) {
                    cleanM.id = window.Utils.sanitizeEntityId(cleanM.id);
                }
                if (!cleanM._cloudKey) cleanM._cloudKey = _getDocCloudKey(cleanM) || window.Utils.generateUUID('TR');

                let idStr = String(cleanM.id);
                if (seenIds.has(idStr)) return null;
                seenIds.add(idStr);

                if (!cleanM.vault && cleanM.treasury) {
                    let v = String(cleanM.treasury).toLowerCase();
                    cleanM.vault = (v.includes('insta') || v.includes('انستا') || v.includes('إنستا')) ? 'insta' : ((v.includes('wallet') || v.includes('محفظ')) ? 'wallet' : 'main');
                } else if (!cleanM.vault) {
                    cleanM.vault = 'main';
                }
                cleanM.treasury = cleanM.vault;

                let add = round2(cleanM.amountAdd);
                let ded = round2(cleanM.amountDeduct);
                let rawAmt = round2(cleanM.amount);
                if (add === 0 && ded === 0 && rawAmt > 0) {
                    let isOut = (cleanM.direction === 'out' || ['payment', 'customer_payment', 'supplier_payment', 'purchase', 'purchases', 'purchase_payment', 'expenses', 'expense', 'return_sale', 'sales_return'].includes(cleanM.type));
                    if (isOut) cleanM.amountDeduct = rawAmt;
                    else cleanM.amountAdd = rawAmt;
                }
                cleanM.amountAdd = round2(cleanM.amountAdd);
                cleanM.amountDeduct = round2(cleanM.amountDeduct);
                cleanM.amount = round2(cleanM.amountAdd || cleanM.amountDeduct || rawAmt);

                cleanM.date = window.Utils.normalizeDateStr(cleanM.date, cleanM.timestamp);
                cleanM.timestamp = window.Utils.alignTimestampWithDate(cleanM.date, cleanM.timestamp || (now + idx));
                if (!cleanM._lastModified) cleanM._lastModified = now;
                if (!cleanM._device) cleanM._device = myDeviceName;
                if (!cleanM._lastModifiedBy) cleanM._lastModifiedBy = myDeviceName;

                return cleanM;
            }).filter(Boolean);

            _internalSetItem('seraj_treasury_moves', JSON.stringify(cleanedMoves));
            saveArrayToQueueSafely('treasury_moves', cleanedMoves);
            this.recalculateVaultBalances();
        } finally {
            this._isSavingTreasury = false;
        }
    },

    getExpenses: function(includeCanceled = false) {
        let moves = this.getTreasuryMoves(includeCanceled, true);
        return moves.filter(m => {
            if (!m || (!includeCanceled && (m._isReversed || m._isReversal))) return false;
            let t = String(m.type || '').toLowerCase();
            return t === 'expenses' || t === 'expense';
        }).map(m => {
            let amt = window.Utils.round2(m.amountDeduct || m.amount || m.amountAdd);
            let normDate = window.Utils.normalizeDateStr(m.date, m.timestamp);
            return {
                ...m,
                amount: amt,
                date: normDate,
                timestamp: window.Utils.alignTimestampWithDate(normDate, m.timestamp)
            };
        });
    },

    getSalesReturns: function(includeCanceled = false) {
        let standaloneReturns = safeParseJSON(localStorage.getItem('seraj_sales_returns'), []);
        if (!Array.isArray(standaloneReturns) || standaloneReturns.length === 0) return [];
        let salesIds = new Set(safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []).map(i => String(i?.id)));
        return standaloneReturns.filter(r => {
            if (!r) return false;
            if (!includeCanceled && (r.isCanceled || r.isDeleted || r.status === 'deleted')) return false;
            return !salesIds.has(String(r.id));
        }).map(r => ({
            ...r,
            date: window.Utils.normalizeDateStr(r.date, r.timestamp)
        }));
    },

    getVaults: function() {
        return this.recalculateVaultBalances(true);
    },

    saveVaults: function(data) {
        if (this._isSavingVaults) return;
        let round2 = window.Utils.round2;
        let cleanVaults = {
            main: round2(data?.main),
            insta: round2(data?.insta),
            wallet: round2(data?.wallet)
        };
        let newStr = JSON.stringify(cleanVaults);
        if (newStr === localStorage.getItem('seraj_vaults_v2')) return;

        this._isSavingVaults = true;
        try {
            _internalSetItem('seraj_vaults_v2', newStr);
            if (cloudReady && navigator.onLine && !window.SerajAuth.isOfflineSinglePlan() && window.SerajAuth.isOwner()) {
                let ref = _getStoreCloudRef('vaults_v2');
                if (ref) ref.set(cleanVaults).catch(() => {});
            }
            emitSerajUpdate('vaults_v2', 'local');
        } finally {
            setTimeout(() => { this._isSavingVaults = false; }, 150);
        }
    },

    recalculateVaultBalances: function(autoSave = true) {
        let activeMoves = this.getTreasuryMoves(false, true);
        let vaults = { main: 0, insta: 0, wallet: 0 };
        let round2 = window.Utils.round2;

        activeMoves.forEach(m => {
            if (!m) return;
            let vKey = m.vault || 'main';
            if (vaults[vKey] === undefined) vKey = 'main';
            vaults[vKey] = round2(vaults[vKey] + (round2(m.amountAdd) - round2(m.amountDeduct)));
        });

        if (autoSave && !this._isSavingVaults) {
            this.saveVaults(vaults);
        }
        return vaults;
    },

    recordTreasuryTransaction: function(moveObj) {
        if (!moveObj) return null;
        let moves = this.getTreasuryMoves(true, true);
        let now = getServerNow();
        let round2 = window.Utils.round2;

        let vKey = moveObj.vault || moveObj.treasury || 'main';
        if (vKey !== 'main' && vKey !== 'insta' && vKey !== 'wallet') {
            let low = String(vKey).toLowerCase();
            vKey = (low.includes('insta') || low.includes('انستا') || low.includes('إنستا')) ? 'insta' : ((low.includes('wallet') || low.includes('محفظ')) ? 'wallet' : 'main');
        }

        let amountAdd = round2(moveObj.amountAdd);
        let amountDeduct = round2(moveObj.amountDeduct);
        if (amountAdd === 0 && amountDeduct === 0 && moveObj.amount) {
            let rawAmt = round2(moveObj.amount);
            if (moveObj.direction === 'out' || ['payment', 'customer_payment', 'supplier_payment', 'purchase', 'purchases', 'purchase_payment', 'expenses', 'expense', 'return_sale', 'sales_return'].includes(moveObj.type)) {
                amountDeduct = rawAmt;
            } else {
                amountAdd = rawAmt;
            }
        }

        let normDate = window.Utils.normalizeDateStr(moveObj.date, moveObj.timestamp);
        let alignedTs = window.Utils.alignTimestampWithDate(normDate, moveObj.timestamp || now);
        let localDateStr = new Date(alignedTs).toLocaleDateString('en-GB');

        let requestedId = moveObj.id !== undefined && moveObj.id !== null && moveObj.id !== ''
            ? window.Utils.sanitizeEntityId(moveObj.id)
            : window.Utils.generateUniqueId('TR_');

        let existingIdx = moves.findIndex(m => m && (String(m.id) === String(requestedId) || String(m.rawTreasuryId || '') === String(requestedId)) && !m._isReversed);
        let finalMoveId = requestedId;

        if (existingIdx > -1) {
            let oldMove = moves[existingIdx];
            oldMove._isReversed = true;
            oldMove._lastModified = now;

            let oldAdd = round2(oldMove.amountAdd);
            let oldDed = round2(oldMove.amountDeduct);
            let oldAmt = round2(oldMove.amount || oldAdd || oldDed);
            let revDate = window.Utils.getLocalDateString(now);

            let revMove = {
                id: window.Utils.generateUniqueId('REV_'),
                _cloudKey: window.Utils.generateUUID('REV'),
                type: 'correction',
                vault: oldMove.vault || oldMove.treasury || 'main',
                treasury: oldMove.vault || oldMove.treasury || 'main',
                amountAdd: oldDed,
                amountDeduct: oldAdd,
                amount: oldAmt,
                notes: `🔄 عكس لتعديل حركة/سند: ${oldMove.notes || ('رقم ' + oldMove.id)}`,
                date: revDate,
                dateFormatted: new Date(now).toLocaleDateString('en-GB'),
                timestamp: now,
                invoiceNo: oldMove.invoiceNo || null,
                customerId: oldMove.customerId || null,
                customer: oldMove.customer || null,
                supplierId: oldMove.supplierId || null,
                supplier: oldMove.supplier || null,
                _device: myDeviceName,
                _lastModified: now,
                _lastModifiedBy: localStorage.getItem('cashier_name') || myDeviceName,
                _isReversal: true,
                _reversedMoveId: String(oldMove.id)
            };
            moves.unshift(revMove);
            finalMoveId = window.Utils.generateUniqueId('TR_');
            alignedTs = now + 1;
        } else if (moves.some(m => m && String(m.id) === String(requestedId))) {
            finalMoveId = window.Utils.generateUniqueId('TR_');
            alignedTs = now + 1;
        }

        let newMove = {
            id: finalMoveId,
            _cloudKey: window.Utils.generateUUID('TR'),
            rawTreasuryId: String(requestedId),
            type: moveObj.type || 'direct',
            invoiceDomain: moveObj.invoiceDomain || null,
            vault: vKey,
            treasury: vKey,
            amountAdd: amountAdd,
            amountDeduct: amountDeduct,
            amount: round2(amountAdd || amountDeduct),
            notes: moveObj.notes || '',
            date: normDate,
            dateFormatted: localDateStr,
            timestamp: alignedTs,
            invoiceNo: moveObj.invoiceNo || null,
            allocatedInvoices: Array.isArray(moveObj.allocatedInvoices) ? moveObj.allocatedInvoices : [],
            customerId: moveObj.customerId || null,
            customer: moveObj.customer ? String(moveObj.customer).trim() : null,
            supplierId: moveObj.supplierId || null,
            supplier: moveObj.supplier ? String(moveObj.supplier).trim() : null,
            _isReversal: Boolean(moveObj._isReversal),
            _reversedMoveId: moveObj._reversedMoveId || null,
            _device: moveObj._device || myDeviceName,
            _lastModified: moveObj._lastModified || alignedTs,
            _lastModifiedBy: moveObj._lastModifiedBy || localStorage.getItem('cashier_name') || myDeviceName
        };

        moves.unshift(newMove);
        this.saveTreasuryMoves(moves);
        return newMove;
    },

    // =========================================================================
    // 18. محرك الحسابات المالية الموحد DB.getFinancialSummary(startIso, endIso)
    // - توحيد المبيعات، المرتجعات (مع خصم المرتجع)، COGS بنظام FIFO، المصروفات،
    //   الأرباح، الجرد (فصل الأصول الموجبة عن العجز السالب)، والنواقص وطلبات الموردين
    // =========================================================================
    getFinancialSummary: function(startIso = null, endIso = null) {
        let round2 = window.Utils.round2;
        let round4 = window.Utils.round4;
        let startStr = startIso ? window.Utils.normalizeDateStr(startIso) : null;
        let endStr = endIso ? window.Utils.normalizeDateStr(endIso) : null;

        const inRange = (dateStr) => {
            if (!startStr && !endStr) return true;
            let d = window.Utils.normalizeDateStr(dateStr);
            if (startStr && d < startStr) return false;
            if (endStr && d > endStr) return false;
            return true;
        };

        let sales = this.getSalesInvoices(false);
        let purchases = this.getPurchaseInvoices(false);
        let expenses = this.getExpenses(false);
        let allProductsForCost = this.getProducts(true);
        let products = allProductsForCost.filter(p => p && !p.isArchived && !p.isDeleted);
        let vaults = this.getVaults();
        let customers = this.getCustomers(false, false);
        let suppliers = this.getSuppliers(false, false);

        let prodById = new Map();
        let prodByNorm = new Map();
        allProductsForCost.forEach(p => {
            if (!p) return;
            if (p.id !== undefined && p.id !== null) prodById.set(String(p.id), p);
            if (p.name) prodByNorm.set(window.Utils.normalizeName(p.name), p);
        });

        let grossSales = 0;
        let salesDiscounts = 0;
        let salesReturnsTotal = 0;
        let salesReturnsCOGS = 0;
        let salesCOGS = 0;
        let salesCount = 0;
        let salesReturnCount = 0;
        let soldQtyByProd = new Map();

        sales.forEach(inv => {
            if (!inv || inv.type === 'quotation' || !inRange(inv.date)) return;
            let isReturn = ['return', 'return_sale', 'sales_return'].includes(inv.type);
            let netVal = this._computeInvoiceNetTotal(inv);
            let invDisc = Math.max(0, round2(inv.discount));

            // حساب تكلفة البضاعة المباعة (COGS) من FIFO الفعلي المسجل على الصنف
            let invCost = 0;
            (Array.isArray(inv.items) ? inv.items : []).forEach(it => {
                if (!it) return;
                let qty = round4(it.qty ?? it.quantity ?? 0);
                if (qty <= 0) return;
                let unitCost = round2(it.weightedUnitCost ?? it.purchasePrice ?? it.buyPrice ?? it.costPrice ?? 0);
                if (unitCost <= 0) {
                    let pRef = (it.id !== undefined && it.id !== null)
                        ? prodById.get(String(it.id))
                        : (it.productId !== undefined && it.productId !== null ? prodById.get(String(it.productId)) : null);
                    if (!pRef && it.name) pRef = prodByNorm.get(window.Utils.normalizeName(it.name));
                    if (pRef) {
                        unitCost = round2(pRef.purchasePrice || pRef.buyPrice || pRef._lastValidPurchase || 0);
                        if (unitCost <= 0 && Array.isArray(pRef.lots) && pRef.lots.length > 0) {
                            for (let li = pRef.lots.length - 1; li >= 0; li--) {
                                let lc = round2(pRef.lots[li]?.purchasePrice || pRef.lots[li]?.buyPrice || 0);
                                if (lc > 0) { unitCost = lc; break; }
                            }
                        }
                    }
                }
                let lineCost = (it.cogsTotal !== undefined && it.cogsTotal > 0) ? round2(it.cogsTotal) : round2(qty * unitCost);
                invCost = round2(invCost + lineCost);

                let pid = String(it.id ?? it.productId ?? '');
                if (pid) {
                    let prev = soldQtyByProd.get(pid) || 0;
                    soldQtyByProd.set(pid, round4(prev + (isReturn ? -qty : qty)));
                }
            });

            if (isReturn) {
                salesReturnsTotal = round2(salesReturnsTotal + netVal);
                salesReturnsCOGS = round2(salesReturnsCOGS + invCost);
                salesReturnCount++;
            } else {
                grossSales = round2(grossSales + netVal);
                salesDiscounts = round2(salesDiscounts + invDisc);
                salesCOGS = round2(salesCOGS + invCost);
                salesCount++;
            }
        });

        let grossPurchases = 0;
        let purchaseReturnsTotal = 0;
        let purchasesCount = 0;
        let lastSupplierByProd = new Map();
        const ghostSuppliers = new Set(['', 'عام', 'مورد عام', 'مورد نقدي', 'نقدي', 'غير محدد', 'بدون مورد', '---', 'null', 'undefined']);

        purchases.forEach(inv => {
            if (!inv || inv.type === 'quotation') return;
            let suppName = String(inv.supplier || inv.supplierName || '').trim();
            let suppNorm = window.Utils.normalizeName(suppName);
            let isRealSupplier = suppName && !ghostSuppliers.has(suppNorm);

            if (isRealSupplier && Array.isArray(inv.items)) {
                inv.items.forEach(it => {
                    if (!it) return;
                    let pid = String(it.id ?? it.productId ?? '');
                    if (pid && !lastSupplierByProd.has(pid)) {
                        lastSupplierByProd.set(pid, { id: inv.supplierId || null, name: suppName });
                    }
                });
            }

            if (!inRange(inv.date)) return;
            let isReturn = ['return', 'return_purchase', 'purchase_return'].includes(inv.type);
            let netVal = this._computeInvoiceNetTotal(inv);
            if (isReturn) {
                purchaseReturnsTotal = round2(purchaseReturnsTotal + netVal);
            } else {
                grossPurchases = round2(grossPurchases + netVal);
                purchasesCount++;
            }
        });

        let totalExpenses = 0;
        expenses.forEach(exp => {
            if (exp && inRange(exp.date)) {
                totalExpenses = round2(totalExpenses + round2(exp.amount));
            }
        });

        let netSales = round2(grossSales - salesReturnsTotal);
        let netCOGS = round2(salesCOGS - salesReturnsCOGS);
        let grossProfit = round2(netSales - netCOGS);
        let netProfit = round2(grossProfit - totalExpenses);
        let netPurchases = round2(grossPurchases - purchaseReturnsTotal);
        let profitMarginPct = netSales > 0 ? round2((netProfit / netSales) * 100) : 0;

        // تقارير الجرد: فصل قيمة الأصول الموجبة عن العجز السالب + معادلة النواقص وطلبات الموردين
        let positiveAssetsCost = 0;
        let positiveAssetsSell = 0;
        let negativeDeficitCost = 0;
        let negativeDeficitQty = 0;
        let shortages = [];
        let supplierOrders = {};

        products.forEach(p => {
            if (!p) return;
            this.normalizeProductLots(p);
            let stock = round4(p.stock);
            let buyP = round2(p.purchasePrice || p._lastValidPurchase || 0);
            let sellP = round2(p.price || p._lastValidPrice || 0);

            if (stock > 0.0001) {
                // حساب قيمة المخزون الموجب من الدفعات الفعلية
                let lotCostSum = 0;
                (p.lots || []).forEach(l => {
                    let ls = round4(l.stock);
                    if (ls > 0.0001) lotCostSum += ls * (round2(l.purchasePrice) || buyP);
                });
                positiveAssetsCost = round2(positiveAssetsCost + (lotCostSum > 0 ? lotCostSum : (stock * buyP)));
                positiveAssetsSell = round2(positiveAssetsSell + (stock * sellP));
            } else if (stock < -0.0001) {
                let absDef = Math.abs(stock);
                negativeDeficitQty = round4(negativeDeficitQty + absDef);
                negativeDeficitCost = round2(negativeDeficitCost + (absDef * buyP));
            }

            // معادلة النواقص: requiredQty = Math.ceil(sold - stock)
            let soldInPeriod = round4(soldQtyByProd.get(String(p.id)) || 0);
            let minLimit = round4(p.minStock || 0);
            let targetLevel = Math.max(soldInPeriod, minLimit);
            let requiredQty = Math.ceil(targetLevel - stock);

            if (requiredQty > 0 && (soldInPeriod > 0 || stock <= minLimit)) {
                let suppInfo = lastSupplierByProd.get(String(p.id)) || null;
                let suppFromProd = String(p.supplier || p.supplierName || '').trim();
                if (!suppInfo && suppFromProd && !ghostSuppliers.has(window.Utils.normalizeName(suppFromProd))) {
                    suppInfo = { id: p.supplierId || null, name: suppFromProd };
                }

                let row = {
                    productId: p.id,
                    name: p.name || '',
                    stock: stock,
                    sold: soldInPeriod,
                    minStock: minLimit,
                    requiredQty: requiredQty,
                    purchasePrice: buyP,
                    estimatedCost: round2(requiredQty * buyP),
                    supplier: suppInfo ? suppInfo.name : null,
                    supplierId: suppInfo ? suppInfo.id : null
                };
                shortages.push(row);

                if (suppInfo && suppInfo.name) {
                    if (!supplierOrders[suppInfo.name]) {
                        supplierOrders[suppInfo.name] = { supplierId: suppInfo.id, supplierName: suppInfo.name, items: [], totalCost: 0 };
                    }
                    supplierOrders[suppInfo.name].items.push(row);
                    supplierOrders[suppInfo.name].totalCost = round2(supplierOrders[suppInfo.name].totalCost + row.estimatedCost);
                }
            }
        });

        let totalCustomersDebt = 0;
        let totalCustomersCredit = 0;
        customers.forEach(c => {
            if (!c) return;
            if (c.isNetDebt) totalCustomersDebt = round2(totalCustomersDebt + c.netBalanceVal);
            else totalCustomersCredit = round2(totalCustomersCredit + c.netBalanceVal);
        });

        let totalSuppliersDebt = 0;
        let totalSuppliersCredit = 0;
        suppliers.forEach(s => {
            if (!s) return;
            if (s.isNetDebt) totalSuppliersDebt = round2(totalSuppliersDebt + s.netBalanceVal);
            else totalSuppliersCredit = round2(totalSuppliersCredit + s.netBalanceVal);
        });

        let totalCashInVaults = round2(vaults.main + vaults.insta + vaults.wallet);

        return {
            range: { start: startStr, end: endStr },
            grossSales,
            salesDiscounts,
            salesReturnsTotal,
            netSales,
            netCOGS,
            grossProfit,
            totalExpenses,
            netProfit,
            profitMarginPct,
            salesCount,
            salesReturnCount,
            grossPurchases,
            purchaseReturnsTotal,
            netPurchases,
            purchasesCount,
            vaults,
            totalCashInVaults,
            inventory: {
                positiveAssetsCost,
                positiveAssetsSell,
                negativeDeficitCost,
                negativeDeficitQty,
                netInventoryCost: round2(positiveAssetsCost - negativeDeficitCost),
                productsCount: products.length
            },
            receivables: {
                customersDebt: totalCustomersDebt,
                customersCredit: totalCustomersCredit,
                suppliersDebt: totalSuppliersDebt,
                suppliersCredit: totalSuppliersCredit
            },
            shortages,
            supplierOrders: Object.values(supplierOrders),
            archivedIncluded: false
        };
    },

    // =========================================================================
    // 19. إعدادات المحل الديناميكية (White-Label 100%) والنوتة الذكية
    // =========================================================================
    getStoreSettings: function() {
        let saved = safeParseJSON(localStorage.getItem('seraj_store_settings'), {});
        let fallbackName = localStorage.getItem('seraj_store_name') || window.APP_BRAND_CONFIG.appName;
        let fallbackPhone = localStorage.getItem('seraj_store_phone') || '';
        let fallbackFooter = localStorage.getItem('seraj_receipt_footer') || 'شكراً لزيارتكم';
        let fallbackBalance = localStorage.getItem('seraj_print_balance') || 'yes';
        return {
            shopName: saved.shopName || fallbackName,
            shopPhone: saved.shopPhone !== undefined ? saved.shopPhone : fallbackPhone,
            shopAddress: saved.shopAddress || '',
            footerNote: saved.footerNote !== undefined ? saved.footerNote : fallbackFooter,
            printBalance: saved.printBalance !== undefined ? saved.printBalance : fallbackBalance,
            deviceId: myDeviceName
        };
    },

    saveStoreSettings: function(settings = {}) {
        let merged = { ...this.getStoreSettings(), ...settings };
        _internalSetItem('seraj_store_settings', JSON.stringify(merged));
        _internalSetItem('seraj_store_name', String(merged.shopName || ''));
        _internalSetItem('seraj_store_phone', String(merged.shopPhone || ''));
        _internalSetItem('seraj_receipt_footer', String(merged.footerNote || ''));
        _internalSetItem('seraj_print_balance', String(merged.printBalance || 'yes'));
        emitSerajUpdate('store_settings', 'local');
        return merged;
    },

    getSmartNotes: function(includeDeleted = false) {
        let notes = safeParseJSON(localStorage.getItem('seraj_smart_notes'), []);
        let normalized = notes.map((n, idx) => {
            if (!n) return null;
            return {
                ...n,
                id: String(n.id ?? n.noteId ?? n.timestamp ?? idx),
                date: window.Utils.normalizeDateStr(n.date, n.timestamp)
            };
        }).filter(Boolean);
        return includeDeleted ? normalized : normalized.filter(n => !n.isDeleted);
    },

    saveSmartNotes: function(data) {
        if (this._isSavingSmartNotes) return;
        if (!Array.isArray(data)) data = [];
        this._isSavingSmartNotes = true;

        try {
            if (window.SerajAuth.isOfflineSinglePlan()) {
                let nowLocal = Date.now();
                let cleanLocalNotes = data.filter(Boolean).map((n, idx) => ({
                    ...n,
                    id: String(n.id ?? n.noteId ?? n.timestamp ?? (nowLocal + idx)),
                    date: window.Utils.normalizeDateStr(n.date, n.timestamp),
                    _lastModified: n._lastModified || nowLocal
                }));
                _internalSetItem('seraj_smart_notes', JSON.stringify(cleanLocalNotes));
                localCollectionsCache['smart_notes'] = [...cleanLocalNotes];
                emitSerajUpdate('smart_notes', 'local');
                return;
            }
            let oldNotes = safeParseJSON(localStorage.getItem('seraj_cloud_cache_smart_notes'), []);
            let oldMap = new Map(oldNotes.map(n => [String(n?.id), n]));
            let newIds = new Set();
            let now = getServerNow();

            data.forEach((n, idx) => {
                if (!n) return;
                if (n.id === undefined || n.id === null) n.id = n.noteId || n.timestamp || (now + idx);
                n.id = String(n.id);
                if (!n._cloudKey) n._cloudKey = _getDocCloudKey(n);
                n.date = window.Utils.normalizeDateStr(n.date, n.timestamp);
                newIds.add(n.id);

                let oldN = oldMap.get(n.id);
                let oldCopy = oldN ? { ...oldN, id: String(oldN.id) } : null;
                let newCopy = { ...n };
                if (oldCopy) { delete oldCopy._lastModified; delete oldCopy._senderUid; delete oldCopy.updatedBy; }
                delete newCopy._lastModified; delete newCopy._senderUid; delete newCopy.updatedBy;

                if (!oldCopy || JSON.stringify(oldCopy) !== JSON.stringify(newCopy)) {
                    n._lastModified = now;
                    n.updatedBy = myDeviceName;
                    n._senderUid = myDeviceUid;
                    addToSyncQueue('smart_notes', n);
                }
            });

            // تحويل الملاحظات المحذوفة إلى Tombstones بدلاً من الحذف الفيزيائي
            let finalNotes = [...data];
            oldNotes.forEach(oldN => {
                if (oldN && oldN.id !== undefined && !newIds.has(String(oldN.id)) && !oldN.isDeleted) {
                    let tomb = { ...oldN, isDeleted: true, _lastModified: now, _lastModifiedBy: myDeviceName };
                    finalNotes.push(tomb);
                    addToSyncQueue('smart_notes', tomb);
                }
            });

            _internalSetItem('seraj_smart_notes', JSON.stringify(finalNotes));
            _internalSetItem('seraj_cloud_cache_smart_notes', JSON.stringify(finalNotes));
            localCollectionsCache['smart_notes'] = [...finalNotes];
            scheduleSyncQueue(1000);
            emitSerajUpdate('smart_notes', 'local');
        } finally {
            this._isSavingSmartNotes = false;
        }
    },

    getAggregatedData: function() {
        return {
            sales: this.getSalesInvoices(true),
            purchases: this.getPurchaseInvoices(true),
            products: this.getProducts(true),
            customers: this.getCustomers(false, false),
            suppliers: this.getSuppliers(false, false),
            customer_vouchers: this.getCustomerVouchers(true),
            supplier_vouchers: this.getSupplierVouchers(true),
            treasuryMoves: this.getTreasuryMoves(true, true),
            expenses: this.getExpenses(false),
            smartNotes: this.getSmartNotes(true)
        };
    },

    // =========================================================================
    // 21. النسخ الاحتياطي والاستعادة وتصفير المصنع (Allowlist صارمة + Web Share + GAS Email)
    // =========================================================================
    _BACKUP_ALLOWLIST: [
        'seraj_products',
        'seraj_customers',
        'seraj_suppliers',
        'seraj_customer_vouchers',
        'seraj_supplier_vouchers',
        'seraj_sales_invoices',
        'seraj_purchase_invoices',
        'seraj_treasury_moves',
        'seraj_smart_notes',
        'seraj_vaults_v2',
        'seraj_invoice_counters',
        'seraj_store_settings'
    ],

    // بناء حزمة النسخ الاحتياطي Data.json بـ Allowlist صارمة تستبعد seraj_store_id وأي مفاتيح حساسة
    backupData: function() {
        let dataMap = {};
        this._BACKUP_ALLOWLIST.forEach(key => {
            let raw = localStorage.getItem(key);
            if (raw !== null && raw !== undefined) {
                dataMap[key] = safeParseJSON(raw, raw);
            }
        });
        return {
            format: 'seraj_pos_backup_v5',
            version: window.APP_BRAND_CONFIG.version,
            exportedAt: Date.now(),
            dateFormatted: window.Utils.getLocalDateString(),
            deviceName: myDeviceName,
            data: dataMap
        };
    },

    // تصدير ومشاركة Data.json عبر Web Share API (Drive/Gmail/WhatsApp) أو تنزيل مباشر
    exportOfflineDataJSON: async function(preferShare = true) {
        if (!window.SerajAuth.canAccess('export_backup')) {
            window.SerajAlert('⛔ تصدير النسخة الاحتياطية مخصص لصاحب المحل (المالك) فقط.', 'error');
            return false;
        }
        let backupObj = this.backupData();
        let jsonStr = JSON.stringify(backupObj, null, 2);
        let dateTag = window.Utils.getLocalDateString();
        let fileName = `Data_${dateTag}.json`;
        let blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });

        _internalSetItem('seraj_last_offline_backup_ts', String(Date.now()));

        if (preferShare && navigator.share) {
            try {
                let file = new File([blob], fileName, { type: 'application/json' });
                if (!navigator.canShare || navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: `نسخة احتياطية - ${this.getStoreSettings().shopName}`,
                        text: `نسخة احتياطية لبيانات المحل بتاريخ ${dateTag}`
                    });
                    return true;
                }
            } catch (err) {
                if (err && err.name === 'AbortError') return false;
            }
        }

        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 10000);
        return true;
    },

    // تصدير ملف الصور المستقل Images.json (اختياري)
    exportImagesBackupJSON: async function(preferShare = true) {
        if (!window.SerajAuth.canAccess('export_backup')) {
            window.SerajAlert('⛔ تصدير نسخ الصور مخصص لصاحب المحل (المالك) فقط.', 'error');
            return false;
        }
        showCloudStatus('⏳ جاري تجهيز ملف الصور Images.json...');
        let imgPayload = await window.ImagesDB.exportAllImagesJSON();
        let blob = new Blob([JSON.stringify(imgPayload)], { type: 'application/json;charset=utf-8' });
        let fileName = `Images_${window.Utils.getLocalDateString()}.json`;

        if (preferShare && navigator.share) {
            try {
                let file = new File([blob], fileName, { type: 'application/json' });
                if (!navigator.canShare || navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: fileName });
                    return true;
                }
            } catch (err) {
                if (err && err.name === 'AbortError') return false;
            }
        }

        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 10000);
        return true;
    },

    // استعادة البيانات بـ Allowlist صارمة + تأكيد كتابة "تأكيد" + نسخة احتياطية إجبارية مسبقة + رفع system_epoch
    restoreData: async function(backupPayload, skipConfirmation = false) {
        if (!window.SerajAuth.canAccess('restore_backup')) {
            window.SerajAlert('⛔ استعادة النسخة الاحتياطية مخصصة لصاحب المحل (المالك) فقط.', 'error');
            return false;
        }
        let parsed = (typeof backupPayload === 'string') ? safeParseJSON(backupPayload, null) : backupPayload;
        if (!parsed || typeof parsed !== 'object') {
            window.SerajAlert('❌ ملف النسخة الاحتياطية غير صالح أو تالف.', 'error');
            return false;
        }

        // دعم ملف الصور Images.json مباشرة إن أخطأ المستخدم ورفعه هنا
        if (parsed.format === 'seraj_images_backup_v5' && parsed.images) {
            let count = await window.ImagesDB.importAllImagesJSON(parsed);
            window.SerajAlert(`✅ تم استعادة (${count}) صورة بنجاح.`, 'success');
            return true;
        }

        let sourceMap = (parsed.data && typeof parsed.data === 'object') ? parsed.data : parsed;
        let allowSet = new Set(this._BACKUP_ALLOWLIST);
        let validKeys = Object.keys(sourceMap).filter(k => allowSet.has(k));
        if (validKeys.length === 0) {
            window.SerajAlert('❌ لم يتم العثور على بيانات صالحة داخل هذا الملف.', 'error');
            return false;
        }

        if (!skipConfirmation) {
            let ok = await window.SerajDestructiveConfirm(
                'استرجاع نسخة احتياطية',
                'سيتم استبدال بيانات المحل الحالية ببيانات النسخة المختارة وتحديث جميع الأجهزة المتصلة.'
            );
            if (!ok) return false;
        }

        // نسخة احتياطية إجبارية مسبقة قبل الاستعادة
        await this.exportOfflineDataJSON(false);

        let now = getServerNow();
        validKeys.forEach(k => {
            let val = sourceMap[k];
            let strVal = typeof val === 'string' ? val : JSON.stringify(val);
            _internalSetItem(k, strVal);
            let cleanCol = k.replace(/^seraj_/, '');
            if (SYNCED_COLLECTIONS.includes(cleanCol)) {
                _internalSetItem('seraj_cloud_cache_' + cleanCol, strVal);
                localCollectionsCache[cleanCol] = Array.isArray(val) ? val : safeParseJSON(strVal, []);
            }
        });

        _saveOutbox([]);

        // في الباقات السحابية: رفع البيانات المستعادة وتحديث system_epoch لإجبار الأجهزة الأوفلاين على التحديث
        if (!window.SerajAuth.isOfflineSinglePlan() && cloudReady && navigator.onLine) {
            let storeRef = _getStoreCloudRef();
            if (storeRef) {
                try {
                    let cloudPayload = {};
                    SYNCED_COLLECTIONS.forEach(col => {
                        let arr = safeParseJSON(localStorage.getItem('seraj_' + col), []);
                        let objMap = {};
                        arr.forEach(item => {
                            if (item && item.id !== undefined) {
                                item._lastModified = now;
                                objMap[_getDocCloudKey(item)] = item;
                            }
                        });
                        cloudPayload[col] = objMap;
                    });
                    cloudPayload.vaults_v2 = this.recalculateVaultBalances(false);
                    cloudPayload.invoice_counters = safeParseJSON(localStorage.getItem('seraj_invoice_counters'), { sales: {}, purchases: {} });
                    _internalSetItem('seraj_system_epoch', String(now));
                    await storeRef.update(cloudPayload);
                    await storeRef.child('meta/system_epoch').set(now);
                } catch (e) {
                    console.error('Restore Cloud Push Error:', e);
                }
            }
        }

        this.migrateOldData();
        _broadcastTabChange('reload_required', 'all', null);
        window.SerajAlert('✅ تمت استعادة النسخة الاحتياطية بنجاح! سيتم إعادة تشغيل التطبيق الآن.', 'success', () => {
            window.location.reload();
        });
        return true;
    },

    // تصفير المصنع المحمي: يتطلب المالك + كتابة "تأكيد" + نسخة إجبارية مسبقة + عدم مسح Store_Backups + رفع system_epoch
    wipeStoreData: async function() {
        if (!window.SerajAuth.canAccess('factory_reset')) {
            window.SerajAlert('⛔ تصفير المصنع مخصص لصاحب المحل (المالك) فقط.', 'error');
            return false;
        }
        let ok = await window.SerajDestructiveConfirm(
            'تصفير مصنع كامل لبيانات المحل',
            'سيتم مسح جميع الأصناف والفواتير والعملاء والموردين وحركات الخزينة نهائياً (مع الإبقاء على النسخ السحابية المحمية).'
        );
        if (!ok) return false;

        // نسخة احتياطية إجبارية مسبقة
        await this.exportOfflineDataJSON(false);

        let now = getServerNow();
        SYNCED_COLLECTIONS.forEach(col => {
            _internalSetItem('seraj_' + col, '[]');
            _internalSetItem('seraj_cloud_cache_' + col, '[]');
            _internalSetItem('seraj_last_sync_ts_' + col, String(now));
            localCollectionsCache[col] = [];
        });
        _internalSetItem('seraj_vaults_v2', JSON.stringify({ main: 0, insta: 0, wallet: 0 }));
        _saveOutbox([]);

        if (!window.SerajAuth.isOfflineSinglePlan() && cloudReady && navigator.onLine) {
            let storeRef = _getStoreCloudRef();
            if (storeRef) {
                try {
                    let wipeUpdates = {
                        vaults_v2: { main: 0, insta: 0, wallet: 0 },
                        'meta/system_epoch': now
                    };
                    SYNCED_COLLECTIONS.forEach(col => { wipeUpdates[col] = null; });
                    // ملاحظة دستورية: Store_Backups/{storeId}/snapshots معزول تماماً ولا يُمس أبداً
                    _internalSetItem('seraj_system_epoch', String(now));
                    await storeRef.update(wipeUpdates);
                } catch (e) {
                    console.error('Wipe Cloud Error:', e);
                }
            }
        }

        _broadcastTabChange('reload_required', 'all', null);
        window.SerajAlert('✅ تم تصفير بيانات المحل بنجاح (وتم حفظ نسخة احتياطية مسبقة).', 'success', () => {
            window.location.reload();
        });
        return true;
    },

    // =========================================================================
    // 22. النسخ التلقائي اليومي والإيميل الليلي عبر Google Apps Script (منقول من ai_assistant.html)
    // محمي بـ secretToken وإيميل ثابت + التحقق الحقيقي من الاستجابة
    // =========================================================================
    getAppsScriptConfig: function() {
        return safeParseJSON(localStorage.getItem('seraj_gas_backup_config'), {
            url: '',
            secretToken: '',
            email: '',
            enabled: false
        });
    },

    saveAppsScriptConfig: function(cfg = {}) {
        let current = this.getAppsScriptConfig();
        let next = {
            url: String(cfg.url ?? current.url ?? '').trim(),
            secretToken: String(cfg.secretToken ?? current.secretToken ?? '').trim(),
            email: String(cfg.email ?? current.email ?? '').trim(),
            enabled: cfg.enabled !== undefined ? Boolean(cfg.enabled) : Boolean(current.enabled)
        };
        _internalSetItem('seraj_gas_backup_config', JSON.stringify(next));
        return next;
    },

    sendToAppsScript: async function(payloadObj) {
        let cfg = this.getAppsScriptConfig();
        if (!cfg.url || !cfg.secretToken) {
            return { ok: false, reason: 'missing_config' };
        }
        if (!navigator.onLine) {
            return { ok: false, reason: 'offline' };
        }

        try {
            let body = JSON.stringify({
                ...payloadObj,
                secretToken: cfg.secretToken,
                toEmail: cfg.email || '',
                storeName: this.getStoreSettings().shopName,
                deviceName: myDeviceName,
                sentAt: Date.now()
            });

            let res = await fetch(cfg.url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: body
            });

            if (!res.ok) {
                return { ok: false, status: res.status, reason: 'http_error' };
            }
            let text = await res.text();
            let json = safeParseJSON(text, null);
            if (json && (json.ok === true || json.success === true || json.status === 'ok' || json.status === 'success')) {
                return { ok: true, response: json };
            }
            return { ok: false, reason: 'invalid_response', raw: text.slice(0, 200) };
        } catch (err) {
            return { ok: false, reason: 'network_error', error: err.message };
        }
    },

    queueEmailReport: function(reportObj) {
        if (!reportObj) return false;
        let q = safeParseJSON(localStorage.getItem('seraj_email_queue'), []);
        q.push({
            id: window.Utils.generateUUID('MAIL'),
            createdAt: Date.now(),
            retries: 0,
            payload: reportObj
        });
        _internalSetItem('seraj_email_queue', JSON.stringify(q.slice(-30)));
        if (navigator.onLine) {
            this.flushEmailQueue();
        }
        return true;
    },

    flushEmailQueue: async function() {
        if (!navigator.onLine) return false;
        let cfg = this.getAppsScriptConfig();
        if (!cfg.enabled || !cfg.url || !cfg.secretToken) return false;

        let q = safeParseJSON(localStorage.getItem('seraj_email_queue'), []);
        if (!Array.isArray(q) || q.length === 0) return true;

        let remaining = [];
        for (let i = 0; i < q.length; i++) {
            let entry = q[i];
            if (!entry || !entry.payload) continue;
            let result = await this.sendToAppsScript(entry.payload);
            if (!result.ok) {
                entry.retries = (entry.retries || 0) + 1;
                if (entry.retries < 5) remaining.push(entry);
            }
        }
        _internalSetItem('seraj_email_queue', JSON.stringify(remaining));
        return remaining.length === 0;
    },

    checkAutoNightlyEmail: async function() {
        let cfg = this.getAppsScriptConfig();
        if (!cfg.enabled || !cfg.url || !cfg.secretToken) return false;

        let todayStr = window.Utils.getLocalDateString();
        let lastSentDay = localStorage.getItem('seraj_last_nightly_email_day') || '';
        if (lastSentDay === todayStr) return false;

        // فحص وجود بيانات حقيقية قبل الإرسال
        let hasData = (this.getProducts(true).length > 0 || this.getSalesInvoices(true).length > 0 || this.getPurchaseInvoices(true).length > 0);
        if (!hasData) return false;

        let summary = this.getFinancialSummary(todayStr, todayStr);
        let payload = {
            action: 'daily_backup_and_report',
            date: todayStr,
            summary: summary,
            backupData: this.backupData()
        };

        let result = await this.sendToAppsScript(payload);
        if (result.ok) {
            _internalSetItem('seraj_last_nightly_email_day', todayStr);
            _internalSetItem('seraj_last_offline_backup_ts', String(Date.now()));
            return true;
        } else if (result.reason === 'offline') {
            this.queueEmailReport(payload);
        }
        return false;
    },

    // =========================================================================
    // 23. إدارة الثيمات (:root.seraj-light-theme + الألوان الصلبة)
    // =========================================================================
    applySavedTheme: function() {
        let b = localStorage.getItem('seraj_theme_border');
        let g = localStorage.getItem('seraj_theme_glow');
        let bg1 = localStorage.getItem('seraj_theme_bg1');
        let bg2 = localStorage.getItem('seraj_theme_bg2');
        let card = localStorage.getItem('seraj_theme_card');
        let text = localStorage.getItem('seraj_theme_text');
        let mode = localStorage.getItem('seraj_theme_mode') || '';
        let root = document.documentElement;

        if (b && g) {
            root.style.setProperty('--neon-border', b);
            root.style.setProperty('--neon-glow', g);
            if (bg1) {
                root.style.setProperty('--bg-dark-1', bg1);
                root.style.setProperty('--bg-dark-solid', bg1);
                root.style.setProperty('--bg-main', bg1);
            }
            if (bg2) {
                root.style.setProperty('--bg-dark-2', bg2);
                root.style.setProperty('--table-header-bg', bg2);
            }
            if (card) {
                let solidCard = String(card).trim().toLowerCase().startsWith('rgba') ? (bg2 || '#0f172a') : card;
                root.style.setProperty('--card-bg', solidCard);
                root.style.setProperty('--card-bg-alt', solidCard);
                root.style.setProperty('--card-bg-solid', solidCard);
            }
            if (text) {
                root.style.setProperty('--text-main', text);
                root.style.setProperty('--text-white', text);
            }
        }

        let isLight = mode === 'light' || (text && !['#ffffff', '#fff', 'white'].includes(String(text).trim().toLowerCase()));
        root.classList.toggle('seraj-light-theme', Boolean(isLight));
    }
};

// =========================================================================
// 24. حارس النسخ الاحتياطي السحابي المحمي (Store_Backups/{storeId}/snapshots/{YYYY-MM-DD})
// - لا يعمل قبل اكتمال Hydration أو إذا كانت البيانات المحلية فارغة
// - يحتفظ بآخر 7 لقطات فقط ولا يُمسح أبداً عند wipeStoreData
// =========================================================================
async function checkAndRunAutoCloudBackup() {
    if (window.SerajAuth.isOfflineSinglePlan()) return false;
    if (!window.SerajMegaDB.isReady || window._isHydratingMegaDB) return false;
    if (!cloudReady || !navigator.onLine || !window.dbCloud) return false;

    let activeStoreId = getActiveStoreId();
    if (!activeStoreId) return false;

    let todayStr = window.Utils.getLocalDateString();
    let lastBackupDay = localStorage.getItem('seraj_last_cloud_backup_day') || '';
    if (lastBackupDay === todayStr) return false;

    // حارس صارم: ممنوع أخذ نسخة احتياطية إذا كانت البيانات المحلية فارغة (حماية من الكتابة الفارغة فوق النسخة)
    let productsCount = window.DB.getProducts(true).length;
    let salesCount = window.DB.getSalesInvoices(true).length;
    let purchasesCount = window.DB.getPurchaseInvoices(true).length;
    let customersCount = window.DB.getCustomers(true).length;
    if (productsCount === 0 && salesCount === 0 && purchasesCount === 0 && customersCount === 0) {
        return false;
    }

    try {
        let backupsBase = `${window.APP_BRAND_CONFIG.backupsRoot}/${activeStoreId}/snapshots`;
        let snapPayload = {
            ...window.DB.backupData(),
            storeId: activeStoreId,
            snapshotDate: todayStr,
            counts: { products: productsCount, sales: salesCount, purchases: purchasesCount, customers: customersCount }
        };

        await window.dbCloud.ref(`${backupsBase}/${todayStr}`).set(snapPayload);
        _internalSetItem('seraj_last_cloud_backup_day', todayStr);
        _internalSetItem('seraj_last_backup_timestamp', String(getServerNow()));

        // الاحتفاظ بآخر 7 لقطات فقط وحذف الأقدم تلقائياً
        let allSnap = await window.dbCloud.ref(backupsBase).once('value');
        if (allSnap.exists()) {
            let keys = Object.keys(allSnap.val() || {}).sort();
            if (keys.length > 7) {
                let toDelete = keys.slice(0, keys.length - 7);
                let delPatch = {};
                toDelete.forEach(k => { delPatch[k] = null; });
                await window.dbCloud.ref(backupsBase).update(delPatch);
            }
        }
        return true;
    } catch (err) {
        console.error('Auto Cloud Backup Error:', err);
        return false;
    }
}

// =========================================================================
// 25. المحرك الصوتي الخفيف والذكي (SmartVoice V5)
// - يعمل في البيع والشراء والمخزن مع تطبيع الهمزات والتاء المربوطة قبل Regex الفصل بحرف «و»
// - مطابقة ذكية خفيفة (تطابق تام + مطابقة كلمات مرجحة)
// - إدارة القاموس والوحدات من نافذة صغيرة داخل إعدادات index.html
// =========================================================================
window.cleanExcelText = function(text) {
    if (!text) return '';
    let t = String(text);
    if (typeof t.normalize === 'function') t = t.normalize('NFKC');
    return t.replace(/_x000d_/gi, ' ')
        .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const DefaultVoiceConfig = {
    settings: {
        letterTolerance: 65,
        numberMagnet: 80,
        searchThreshold: 60,
        mergeDuplicates: true,
        ignoreQuantitiesMode: false,
        firstWordBonus: 25
    },
    units: [
        'وات', 'واط', 'امبير', 'فولت', 'ملي', 'مللي', 'مم', 'سم', 'سنتي', 'متر',
        'بوصه', 'حصان', 'فاز', 'طرف', 'خط', 'مخرج', 'عين', 'ليد', 'تكه',
        'ركبه', 'حركه', 'سرعه', 'شمعه', 'لتر', 'كيلو', 'جرام', 'طن', 'كيه', 'يو'
    ],
    dictionary: {
        'city': 'سيتي', 'tiger': 'تايجر', 'joyroom': 'جيروم', 'uf': 'يو اف',
        'mk': 'ام كي', 'kh': 'كي اتش', 'bm': 'بي ام', 'b.m': 'بي ام',
        'dcl': 'دي سي ال', 'dc': 'دي سي', 'ac': 'اي سي', 'hp': 'اتش بي',
        'jbl': 'جي بي ال', 'sky': 'سكاي', 'fast': 'فاست', 'fit': 'فت',
        't.c': 'تيبسي', 'tc': 'تيبسي', 'تايب سي': 'تيبسي', 'تيب سي': 'تيبسي',
        'micro': 'ميكرو', 'mikro': 'ميكرو', 'led': 'ليد', 'لد': 'ليد',
        'ورم': 'وارم', 'warm': 'وارم', 'شفشق': 'شفشاء', 'قلاووظ': 'كلاوز',
        'قلاوظ': 'كلاوز', 'قلوظ': 'كلاوز', 'بانل': 'بنل', 'اسبط': 'اسبوت',
        'سبوت': 'اسبوت', 'موتور': 'ماتور', 'اتوماتيك': 'توماتيك', 'اوتوماتيك': 'توماتيك',
        'اطار': 'ايطار', 'ترانس': 'ترنس', 'ابليك': 'ابلك', 'شاسيه': 'شسيه', 'بريزة': 'بريزه'
    }
};

Object.assign(window.DB, {
    _activeVoiceProfile: localStorage.getItem('seraj_active_voice_profile') || 'sales',

    _getVoiceStorageKey: function(subKey, profileName) {
        let storePrefix = getActiveStoreId() || 'local';
        let prof = profileName || this._activeVoiceProfile || 'sales';
        if (subKey === 'dict' || subKey === 'units') {
            return `seraj_voice_${storePrefix}_${subKey}`;
        }
        return `seraj_voice_${storePrefix}_${prof}_${subKey}`;
    },

    getActiveVoiceProfile: function() {
        return this._activeVoiceProfile || 'sales';
    },

    setActiveVoiceProfile: function(profileName) {
        if (['sales', 'purchases', 'inventory'].includes(profileName)) {
            this._activeVoiceProfile = profileName;
            _internalSetItem('seraj_active_voice_profile', profileName);
        }
    },

    getVoiceSettings: function(profileName) {
        let prof = profileName || this._activeVoiceProfile || 'sales';
        let saved = localStorage.getItem(this._getVoiceStorageKey('settings', prof));
        let baseDefaults = { ...DefaultVoiceConfig.settings };
        if (prof === 'inventory') {
            baseDefaults.ignoreQuantitiesMode = true;
            baseDefaults.mergeDuplicates = false;
        }
        if (saved) {
            try { return { ...baseDefaults, ...JSON.parse(saved) }; } catch (e) {}
        }
        return baseDefaults;
    },

    saveVoiceSettings: function(newSettings, profileName) {
        let prof = profileName || this._activeVoiceProfile || 'sales';
        let merged = { ...this.getVoiceSettings(prof), ...newSettings };
        _internalSetItem(this._getVoiceStorageKey('settings', prof), JSON.stringify(merged));
        this._syncVoiceConfigToCloud();
    },

    getVoiceUnits: function() {
        let saved = localStorage.getItem(this._getVoiceStorageKey('units'));
        if (saved !== null) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return [...DefaultVoiceConfig.units];
    },

    saveVoiceUnits: function(unitsArray) {
        let cleanArr = [...new Set((unitsArray || []).map(u => String(u).trim()).filter(Boolean))];
        _internalSetItem(this._getVoiceStorageKey('units'), JSON.stringify(cleanArr));
        if (typeof SmartVoice !== 'undefined') SmartVoice._invalidateShadowCache();
        this._syncVoiceConfigToCloud();
    },

    getVoiceDictionary: function() {
        let saved = localStorage.getItem(this._getVoiceStorageKey('dict'));
        if (saved !== null) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return { ...DefaultVoiceConfig.dictionary };
    },

    saveVoiceDictionary: function(dictObj) {
        _internalSetItem(this._getVoiceStorageKey('dict'), JSON.stringify(dictObj || {}));
        if (typeof SmartVoice !== 'undefined') SmartVoice._invalidateShadowCache();
        this._syncVoiceConfigToCloud();
    },

    autoLearnFromInventory: function() {
        let products = this.getProducts() || [];
        let learnedUnits = new Set(this.getVoiceUnits());
        let unitCandidates = {};

        products.forEach(p => {
            if (!p || !p.name) return;
            let clean = window.cleanExcelText(p.name)
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
                .replace(/(\d+)([^\d\s\.])/g, '$1 $2');
            let tokens = clean.split(/\s+/);
            for (let i = 0; i < tokens.length - 1; i++) {
                if (!isNaN(tokens[i]) && isNaN(tokens[i + 1]) && tokens[i + 1].length >= 2 && tokens[i + 1].length <= 6) {
                    let w = tokens[i + 1];
                    unitCandidates[w] = (unitCandidates[w] || 0) + 1;
                }
            }
        });

        let addedCount = 0;
        for (let u in unitCandidates) {
            if (unitCandidates[u] >= 3 && !learnedUnits.has(u)) {
                learnedUnits.add(u);
                addedCount++;
            }
        }
        let finalUnits = Array.from(learnedUnits);
        this.saveVoiceUnits(finalUnits);
        return { totalUnits: finalUnits.length, newlyLearned: addedCount };
    },

    _syncVoiceConfigToCloud: function() {
        if (cloudReady && navigator.onLine && !window.SerajAuth.isOfflineSinglePlan()) {
            let ref = _getStoreCloudRef('voice_studio_v5');
            if (!ref) return;
            ref.set({
                sales: { settings: this.getVoiceSettings('sales') },
                purchases: { settings: this.getVoiceSettings('purchases') },
                inventory: { settings: this.getVoiceSettings('inventory') },
                units: this.getVoiceUnits(),
                dictionary: this.getVoiceDictionary(),
                updatedAt: getServerNow()
            }).catch(() => {});
        }
    }
});

const SmartVoice = {
    _shadowCache: null,
    _shadowCacheCount: 0,
    _dictEntriesCache: null,
    _unitsSetCache: null,

    _invalidateShadowCache: function() {
        this._shadowCache = null;
        this._shadowCacheCount = 0;
        this._dictEntriesCache = null;
        this._unitsSetCache = null;
    },

    _escapeRegex: function(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    // تطبيع الهمزات والتاء المربوطة والألف المقصورة والأرقام الهندية
    peeler: function(text) {
        if (!text) return '';
        return String(text)
            .replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .replace(/[أإآءئؤ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    },

    _getCompiledDict: function() {
        if (this._dictEntriesCache) return this._dictEntriesCache;
        let dictObj = (window.DB && typeof window.DB.getVoiceDictionary === 'function')
            ? window.DB.getVoiceDictionary()
            : DefaultVoiceConfig.dictionary;
        let entries = Object.entries(dictObj || {})
            .map(([k, v]) => ({ k: this.peeler(k), v: this.peeler(v) }))
            .filter(e => e.k && e.k !== e.v)
            .sort((a, b) => b.k.length - a.k.length)
            .map(e => ({
                regex: new RegExp(`(^|[\\s\\+\\-\\/،,])${this._escapeRegex(e.k)}(?=$|[\\s\\+\\-\\/،,])`, 'g'),
                v: e.v
            }));
        this._dictEntriesCache = entries;
        return entries;
    },

    _getProtectedUnitsSet: function() {
        if (this._unitsSetCache) return this._unitsSetCache;
        let unitsArr = (window.DB && typeof window.DB.getVoiceUnits === 'function')
            ? window.DB.getVoiceUnits()
            : DefaultVoiceConfig.units;
        this._unitsSetCache = new Set((unitsArr || []).map(u => this.peeler(u)).filter(Boolean));
        return this._unitsSetCache;
    },

    applyDictionary: function(peeledText) {
        if (!peeledText) return '';
        let out = peeledText;
        let entries = this._getCompiledDict();
        for (let i = 0; i < entries.length; i++) {
            out = out.replace(entries[i].regex, `$1${entries[i].v}`);
        }
        return out.replace(/\s+/g, ' ').trim();
    },

    convertSpokenNumbers: function(peeledText) {
        if (!peeledText) return '';
        const spokenMap = [
            ['نص دسته', '6'], ['نصف دسته', '6'], ['دسته', '12'],
            ['خمستاشر', '15'], ['اتناشر', '12'], ['حداشر', '11'],
            ['واحده', '1'], ['واحد', '1'], ['اثنين', '2'], ['اتنين', '2'],
            ['ثلاثه', '3'], ['تلاته', '3'], ['تلات', '3'],
            ['ارباعه', '4'], ['اربعه', '4'], ['اربع', '4'],
            ['خمسه', '5'], ['خمس', '5'],
            ['سته', '6'], ['ست', '6'],
            ['سبعه', '7'], ['سبع', '7'],
            ['ثمانيه', '8'], ['تمانيه', '8'], ['تمن', '8'],
            ['تسعه', '9'], ['تسع', '9'],
            ['عشره', '10'], ['عشر', '10'],
            ['عشرين', '20'], ['تلاتين', '30'], ['اربعين', '40'], ['خمسين', '50'],
            ['ستين', '60'], ['سبعين', '70'], ['تمانين', '80'], ['تسعين', '90'],
            ['مائه', '100'], ['ميه', '100'], ['ميتين', '200'], ['خمسميه', '500'], ['الف', '1000']
        ];
        let out = peeledText;
        for (let i = 0; i < spokenMap.length; i++) {
            let [word, num] = spokenMap[i];
            let reg = new RegExp(`(^|[\\s\\+])${word}(?=$|[\\s\\+])`, 'g');
            out = out.replace(reg, `$1${num}`);
        }
        return out.replace(/\s+/g, ' ').trim();
    },

    prepareInventoryShadow: function(inventoryDB) {
        if (!Array.isArray(inventoryDB)) inventoryDB = [];
        if (this._shadowCache && this._shadowCacheCount === inventoryDB.length) {
            return this._shadowCache;
        }
        this._shadowCache = inventoryDB.filter(Boolean).map(item => {
            let rawName = item.name || String(item);
            let peeled = this.peeler(rawName);
            let dictPeeled = this.applyDictionary(peeled);
            let tokens = dictPeeled.split(/\s+/).filter(Boolean);
            let nums = tokens.filter(t => /^\d+(?:\.\d+)?$/.test(t));
            return {
                itemObj: item,
                id: item.id,
                original: rawName,
                peeled: peeled,
                dictPeeled: dictPeeled,
                tokens: tokens,
                nums: nums
            };
        });
        this._shadowCacheCount = inventoryDB.length;
        return this._shadowCache;
    },

    // مطابقة ذكية خفيفة على رامات الموبايل (تطابق تام -> نقاط كلمات وأرقام)
    _findBestLightMatch: function(dictSpoken, shadowList, threshold = 60) {
        if (!dictSpoken || !shadowList.length) return null;
        let queryTokens = dictSpoken.split(/\s+/).filter(Boolean);
        if (queryTokens.length === 0) return null;
        let queryNums = queryTokens.filter(t => /^\d+(?:\.\d+)?$/.test(t));

        let best = null;
        let bestScore = 0;

        for (let i = 0; i < shadowList.length; i++) {
            let candidate = shadowList[i];
            if (candidate.dictPeeled === dictSpoken || candidate.peeled === dictSpoken) {
                return { match: candidate, score: 100 };
            }

            let matchedCount = 0;
            for (let q = 0; q < queryTokens.length; q++) {
                let qt = queryTokens[q];
                if (candidate.tokens.includes(qt)) {
                    matchedCount += 1;
                } else if (qt.length >= 3 && candidate.dictPeeled.includes(qt)) {
                    matchedCount += 0.75;
                }
            }
            if (matchedCount === 0) continue;

            // مكافأة تطابق الأرقام (مغناطيس الأرقام: 9 وات != 12 وات)
            let numPenalty = 0;
            if (queryNums.length > 0 && candidate.nums.length > 0) {
                let allNumsMatch = queryNums.every(n => candidate.nums.includes(n));
                if (!allNumsMatch) numPenalty = 30;
            }

            let coverageQ = (matchedCount / queryTokens.length) * 75;
            let coverageC = (matchedCount / Math.max(1, candidate.tokens.length)) * 25;
            let firstBonus = (candidate.tokens[0] === queryTokens[0]) ? 10 : 0;
            let score = Math.min(99, Math.round(coverageQ + coverageC + firstBonus - numPenalty));

            if (score > bestScore) {
                bestScore = score;
                best = candidate;
            }
        }

        if (best && bestScore >= threshold) {
            return { match: best, score: bestScore };
        }
        return null;
    },

    analyzeFullText: function(rawText, customInventoryDB, profileOverride) {
        let activeProfile = profileOverride || (window.DB && typeof window.DB.getActiveVoiceProfile === 'function' ? window.DB.getActiveVoiceProfile() : 'sales');
        if (!rawText || !String(rawText).trim()) return { queue: [], logsHTML: '', activeProfile: activeProfile };

        let settings = (window.DB && typeof window.DB.getVoiceSettings === 'function')
            ? window.DB.getVoiceSettings(activeProfile)
            : DefaultVoiceConfig.settings;
        let ignoreQtyMode = (activeProfile === 'inventory') || Boolean(settings.ignoreQuantitiesMode);
        let mergeDuplicates = (settings.mergeDuplicates !== false) && !ignoreQtyMode;
        let threshold = parseInt(settings.searchThreshold, 10) || 60;
        let protectedUnits = this._getProtectedUnitsSet();

        let inventoryDB = Array.isArray(customInventoryDB) ? customInventoryDB : (window.DB && typeof window.DB.getProducts === 'function' ? window.DB.getProducts() : []);
        let shadowList = this.prepareInventoryShadow(inventoryDB);

        // تطبيع الهمزات والتاء المربوطة والأرقام أولاً قبل Regex الفصل بحرف «و»
        let preNormalized = String(rawText)
            .replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .replace(/[أإآءئؤ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي');

        let working = preNormalized
            .replace(/(?:زائد|[\.،,؛!\?؟\n])/g, ' + ')
            .replace(/\s+و\s+/g, ' + ')
            .replace(/(^|\s)و(?=\d|واحد|واحده|اتنين|اثنين|تلاته|ثلاثه|اربعه|ارباعه|خمسه|سته|سبعه|تمانيه|ثمانيه|تسعه|عشره|دسته|نص\s+دسته)/g, ' + ');

        let chunks = working.split('+').map(c => c.trim()).filter(Boolean);
        let extractedQueue = [];
        let logs = [];
        const esc = window.Utils.sanitizeHTML;

        chunks.forEach((chunk, idx) => {
            let chunkPeeledRaw = this.peeler(chunk);
            if (!chunkPeeledRaw) return;

            let directFullMatch = shadowList.find(dbItem => dbItem.peeled === chunkPeeledRaw);
            let qty = 1;
            let spokenName = chunk.trim();

            if (!directFullMatch) {
                let normalizedChunk = this.convertSpokenNumbers(chunkPeeledRaw)
                    .replace(/^(?:عندك|هاتلي|هات|عاوز|عايز|اديني|ضيف|حط|لو\s+سمحت)\s+/g, '')
                    .replace(/(\d+(?:\.\d+)?)([^\d\s\.])/g, '$1 $2');

                let words = normalizedChunk.split(/\s+/).filter(Boolean);
                if (words.length === 0) return;

                let fullNormDict = this.applyDictionary(words.join(' '));
                let fullDictExists = shadowList.some(dbItem => dbItem.peeled === words.join(' ') || dbItem.dictPeeled === fullNormDict);

                if (words.length > 1 && !fullDictExists && /^\d+(?:\.\d+)?$/.test(words[0])) {
                    let nextWord = this.peeler(words[1]);
                    if (!protectedUnits.has(nextWord)) {
                        let parsedQ = parseFloat(words[0]) || 1;
                        if (!ignoreQtyMode) qty = parsedQ;
                        words.shift();
                    }
                }
                spokenName = words.join(' ').trim();
            }

            if (!spokenName) return;

            let peeledSpoken = this.peeler(spokenName);
            let dictSpoken = this.applyDictionary(peeledSpoken);

            let bestResult = directFullMatch
                ? { match: directFullMatch, score: 100 }
                : this._findBestLightMatch(dictSpoken, shadowList, threshold);

            if (bestResult && bestResult.match) {
                let matchedItem = bestResult.match;
                let pObj = matchedItem.itemObj;
                let sellP = window.Utils.round2(pObj.price ?? pObj.sellPrice ?? pObj._lastValidPrice ?? 0);
                let buyP = window.Utils.round2(pObj.purchasePrice ?? pObj.buyPrice ?? pObj._lastValidPurchase ?? 0);

                extractedQueue.push({
                    id: matchedItem.id,
                    product: pObj,
                    qty: qty,
                    displayQty: ignoreQtyMode ? '' : qty,
                    name: matchedItem.original,
                    cleanName: matchedItem.original,
                    price: activeProfile === 'purchases' ? (buyP || sellP) : (sellP || buyP),
                    sellPrice: sellP,
                    purchasePrice: buyP,
                    score: bestResult.score,
                    isExactMatch: bestResult.score === 100
                });
                logs.push(`<div class="log-item log-success">طلب #${idx + 1}: ✅ ${esc(matchedItem.original)} (${bestResult.score}%) - كمية: ${ignoreQtyMode ? '-' : qty}</div>`);
            } else {
                extractedQueue.push({
                    id: null,
                    product: null,
                    qty: qty,
                    displayQty: ignoreQtyMode ? '' : qty,
                    name: dictSpoken || spokenName,
                    cleanName: dictSpoken || spokenName,
                    price: 0,
                    sellPrice: 0,
                    purchasePrice: 0,
                    score: 0,
                    isExactMatch: false
                });
                logs.push(`<div class="log-item log-anchor">طلب #${idx + 1}: 🔎 ${esc(dictSpoken || spokenName)} - كمية: ${ignoreQtyMode ? '-' : qty}</div>`);
            }
        });

        if (mergeDuplicates && extractedQueue.length > 1) {
            let mergedMap = new Map();
            extractedQueue.forEach(item => {
                let mergeKey = item.id !== null && item.id !== undefined
                    ? ('id_' + String(item.id))
                    : ('txt_' + this.peeler(item.cleanName || item.name));
                if (mergedMap.has(mergeKey)) {
                    let prev = mergedMap.get(mergeKey);
                    prev.qty = window.Utils.round2((parseFloat(prev.qty) || 0) + (parseFloat(item.qty) || 0));
                    prev.displayQty = prev.qty;
                } else {
                    mergedMap.set(mergeKey, { ...item });
                }
            });
            extractedQueue = Array.from(mergedMap.values());
        }

        return { queue: extractedQueue, logsHTML: logs.join(''), activeProfile: activeProfile };
    },

    parseCommand: function(rawChunk, inventoryDB, profileOverride) {
        let res = this.analyzeFullText(rawChunk, inventoryDB, profileOverride);
        return (res.queue && res.queue.length > 0) ? res.queue[0] : null;
    }
};

window.SmartVoice = SmartVoice;

// =========================================================================
// 26. اعتراض localStorage وحارس الأرقام السالبة وبوابة التشغيل (SerajMegaDB.ready)
// =========================================================================
localStorage.setItem = function(key, value) {
    if (_isInternalSetItem) {
        return _origSetItem(key, value);
    }

    if (key === 'seraj_smart_notes' && window.DB && !window.DB._isSavingSmartNotes) {
        _origSetItem(key, value);
        try {
            let parsed = JSON.parse(value);
            if (Array.isArray(parsed)) window.DB.saveSmartNotes(parsed);
        } catch (e) {}
        return;
    }

    if (key === 'seraj_treasury_moves' && window.DB && !window.DB._isSavingTreasury) {
        try {
            let parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                window.DB.saveTreasuryMoves(parsed);
                return;
            }
        } catch (e) {}
    }

    if (key === 'seraj_vaults_v2' && window.DB && !window.DB._isSavingVaults) {
        try {
            let parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object') {
                window.DB.saveVaults(parsed);
                return;
            }
        } catch (e) {}
    }

    _origSetItem(key, value);
};

// حارس الأرقام السالبة (يسمح بالسالب فقط للحقول الموسومة صراحةً بـ data-allow-negative="true" كجرد المخزن)
document.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
        if (e.target.getAttribute('data-allow-negative') === 'true') return;
        if (e.key === '-' || e.key === 'Minus') e.preventDefault();
    }
}, true);

document.addEventListener('input', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
        if (e.target.getAttribute('data-allow-negative') === 'true') return;
        if (e.target.value && String(e.target.value).includes('-')) {
            e.target.value = String(e.target.value).replace(/-/g, '');
        }
    }
}, true);

// تطبيق الثيم فوراً لمنع الوميض ثم انتظار بوابة SerajMegaDB.ready قبل الترحيل وتشغيل السحابة
window.DB.applySavedTheme();

window.SerajMegaDB.ready.then(() => {
    window.DB.migrateOldData();
    window.DB.applySavedTheme();
    window.SerajAuth.applyRoleGuards();
    initCloud();
});
// ==================== [ نهاية الجزء الثالث 3/3 - اكتمل الملف db.js ] ====================