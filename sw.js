// =========================================================================
// ⚙️ Service Worker — نظام الكاشير التجاري (V5 Commercial Offline-First)
// مسارات نسبية (./) + مكتبات محلية للعمل أوفلاين 100% + Stale-While-Revalidate آمن
// =========================================================================

const CACHE_NAME = 'pos-commercial-v5-cache-02';

const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './db.js',
    './print_manager.js',
    './ai_brain.js',
    './manifest.json',
    './icon.png',

    // المكتبات المحلية للعمل أوفلاين (Excel / PDF / Barcode)
    './libs/xlsx.full.min.js',
    './libs/html2pdf.bundle.min.js',
    './libs/html5-qrcode.min.js',

    // الصفحات التشغيلية الأساسية
    './store.html',
    './purchases.html',
    './purchases_history.html',
    './sales.html',
    './history.html',
    './suppliers.html',
    './customers.html',
    './treasury.html',
    './smart_accountant.html',
    './ai_assistant.html',

    // صور وخلفيات الشاشة الرئيسية
    './store.jpg',
    './buy.jpg',
    './sales.jpg',
    './suppliers.jpg',
    './customers.jpg',
    './safe.jpg',
    './ai.jpg',

    // صفحات التقارير المعتمدة
    './purchases_detailed.html',
    './purchases_summary.html',
    './purchases_unpaid.html',
    './sales_detailed.html',
    './sales_summary.html',
    './sales_unpaid.html',
    './supplier_invoices.html',
    './supplier_products.html',
    './supplier_statement.html',
    './suppliers_debt.html',
    './customer_products.html',
    './customer_statement.html',
    './customers_debt.html',
    './inventory_detailed.html',
    './inventory_summary.html',
    './expenses_detailed.html',
    './expenses_summary.html',
    './profit_detailed.html',
    './profit_summary.html',
    './profit_margin.html'
];

// 1. مرحلة التثبيت وتخزين جميع ملفات التطبيق والمكتبات المحلية بأمان
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            const BATCH_SIZE = 6;
            for (let i = 0; i < urlsToCache.length; i += BATCH_SIZE) {
                const chunk = urlsToCache.slice(i, i + BATCH_SIZE);
                await Promise.allSettled(chunk.map(async (url) => {
                    try {
                        const req = new Request(url, { cache: 'reload' });
                        const response = await fetch(req);
                        if (response && response.ok) {
                            await cache.put(url, response);
                        }
                    } catch (err) {
                        console.warn('SW Precache Skip:', url);
                    }
                }));
            }
        })
    );
});

// 2. مرحلة التنشيط ومسح أي إصدارات كاش قديمة فوراً
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// 3. دعم التحديث الفوري عند الطلب من واجهة التطبيق
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// 4. إدارة الطلبات (Stale-While-Revalidate مع event.waitUntil سليم وتضييق استثناءات الشبكة)
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // استثناء طلبات قواعد البيانات والمصادقة و Gemini API فقط (دون استثناء باقي googleapis) و Apps Script
    if (
        url.hostname.includes('firestore') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('identitytoolkit') ||
        url.hostname.includes('securetoken') ||
        url.hostname === 'generativelanguage.googleapis.com' ||
        url.hostname === 'script.google.com' ||
        url.hostname === 'script.googleusercontent.com' ||
        url.hostname === 'accounts.google.com' ||
        url.hostname === 'oauth2.googleapis.com'
    ) {
        return;
    }

    const isSameOriginHtml = (url.origin === self.location.origin) && (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/');
    const cacheKey = (isSameOriginHtml && url.search) ? (url.origin + url.pathname) : request;

    const fetchPromise = fetch(request).then(networkResponse => {
        if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
            const responseClone = networkResponse.clone();
            return caches.open(CACHE_NAME)
                .then(cache => cache.put(cacheKey, responseClone))
                .then(() => networkResponse)
                .catch(() => networkResponse);
        }
        return networkResponse;
    });

    // ضمان استمرار عمل الـ Service Worker لحين اكتمال تحديث الكاش في الخلفية بدون أخطاء غير معالجة
    event.waitUntil(fetchPromise.catch(() => {}));

    event.respondWith(
        caches.match(request, { ignoreSearch: true }).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetchPromise.catch(() => {
                const acceptHeader = request.headers.get('accept') || '';
                if (request.mode === 'navigate' || acceptHeader.includes('text/html')) {
                    return caches.match('./index.html', { ignoreSearch: true }).then(
                        fallback => fallback || new Response('التطبيق يعمل في وضع عدم الاتصال.', {
                            status: 503,
                            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                        })
                    );
                }
                return new Response('', { status: 503, statusText: 'Offline' });
            });
        })
    );
});

