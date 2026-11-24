// =========================================================================
// 🖨️ مدير الطباعة والتصدير المركزي (Print Manager - V5 Commercial)
// الوظيفة: التصدير (PDF / Excel)، الطباعة الحرارية (80mm - RawBT Image / USB)،
// طباعة الأوراق والتقارير (A4)، وكشوفات الحساب الموحدة بهوية ديناميكية كاملة.
// =========================================================================

const PrintManager = {

    /**
     * 🏷️ قراءة بيانات الهوية التجارية للمحل ديناميكياً (White-Label 100%)
     */
    getShopBranding: function() {
        const brandFallback = (window.APP_BRAND_CONFIG && window.APP_BRAND_CONFIG.appName)
            ? window.APP_BRAND_CONFIG.appName
            : 'نظام الكاشير الذكي';

        let settings = (window.DB && typeof window.DB.getStoreSettings === 'function')
            ? window.DB.getStoreSettings()
            : {};

        return {
            shopName: String(settings.shopName || localStorage.getItem('seraj_store_name') || brandFallback).trim(),
            shopPhone: String(settings.shopPhone !== undefined ? settings.shopPhone : (localStorage.getItem('seraj_store_phone') || '')).trim(),
            shopAddress: String(settings.shopAddress || '').trim(),
            footerNote: String(settings.footerNote !== undefined ? settings.footerNote : (localStorage.getItem('seraj_receipt_footer') || 'شكراً لتعاملكم معنا!')).trim(),
            printBalance: String(settings.printBalance !== undefined ? settings.printBalance : (localStorage.getItem('seraj_print_balance') || 'yes')).trim()
        };
    },

    /**
     * 🛡️ دوال التعقيم وتنسيق العملة والتاريخ المحلي الموحدة
     */
    _safe: function(val) {
        if (window.Utils && typeof window.Utils.sanitizeHTML === 'function') {
            return window.Utils.sanitizeHTML(val);
        }
        return String(val ?? '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    },

    _money: function(val) {
        if (window.Utils && typeof window.Utils.formatCurrency === 'function') {
            return window.Utils.formatCurrency(val);
        }
        const n = parseFloat(val);
        return isNaN(n) ? '0.00' : (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
    },

    _todayISO: function() {
        if (window.Utils && typeof window.Utils.getLocalDateString === 'function') {
            return window.Utils.getLocalDateString();
        }
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    /**
     * 🖨️ محرك طباعة iframe الآمن بدون سباق onload (إصلاح سباق USB / A4)
     */
    _printHtmlViaSafeIframe: function(fullHtmlDocument) {
        return new Promise((resolve) => {
            const existingFrame = document.getElementById('seraj-active-print-frame');
            if (existingFrame && existingFrame.parentNode) {
                try { existingFrame.parentNode.removeChild(existingFrame); } catch (e) {}
            }

            const printFrame = document.createElement('iframe');
            printFrame.id = 'seraj-active-print-frame';
            printFrame.setAttribute('aria-hidden', 'true');
            printFrame.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden; pointer-events:none;';

            let hasPrinted = false;
            let cleanedUp = false;
            let cleanupTimer = null;

            const cleanup = () => {
                if (cleanedUp) return;
                cleanedUp = true;
                if (cleanupTimer) clearTimeout(cleanupTimer);
                try {
                    if (printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
                } catch (e) {}
                resolve(true);
            };

            const triggerPrint = () => {
                if (hasPrinted) return;
                hasPrinted = true;
                try {
                    const win = printFrame.contentWindow;
                    if (!win) return cleanup();
                    win.focus();
                    win.onafterprint = cleanup;
                    win.print();
                    cleanupTimer = setTimeout(cleanup, 60000);
                } catch (err) {
                    console.error('Iframe Print Error:', err);
                    cleanup();
                }
            };

            // ربط onload قبل الإدراج والكتابة لمنع سباق الحدث نهائياً
            printFrame.onload = () => {
                setTimeout(triggerPrint, 80);
            };

            document.body.appendChild(printFrame);

            try {
                if ('srcdoc' in printFrame) {
                    printFrame.srcdoc = fullHtmlDocument;
                } else {
                    const doc = printFrame.contentDocument || (printFrame.contentWindow && printFrame.contentWindow.document);
                    if (doc) {
                        doc.open();
                        doc.write(fullHtmlDocument);
                        doc.close();
                    }
                }
            } catch (writeErr) {
                console.error('Iframe Write Error:', writeErr);
                cleanup();
                return;
            }

            // شبكة أمان في حال لم يطلق المتصفح حدث onload
            setTimeout(triggerPrint, 700);
        });
    },

    /**
     * 📦 التأكد من توفر مكتبة html2canvas/html2pdf (من /libs/ المحلية أولاً للعمل أوفلاين)
     */
    _ensureHtml2PdfLib: function() {
        return new Promise((resolve) => {
            if (typeof window.html2canvas === 'function' || typeof window.html2pdf === 'function') {
                return resolve(true);
            }
            const localScript = document.createElement('script');
            localScript.src = './libs/html2pdf.bundle.min.js';
            localScript.onload = () => resolve(true);
            localScript.onerror = () => {
                if (!navigator.onLine) return resolve(false);
                const cdnScript = document.createElement('script');
                cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                cdnScript.onload = () => resolve(true);
                cdnScript.onerror = () => resolve(false);
                document.head.appendChild(cdnScript);
            };
            document.head.appendChild(localScript);
        });
    },

    /**
     * 📲 تحويل الإيصال الحراري إلى صورة عالية التباين وإرساله إلى RawBT
     * (يدعم العربية والـ RTL والجدول 100% بدلاً من كسر الترميز النصي)
     */
    _sendThermalToRawBT: async function(receiptBodyHtml, plainTextFallback) {
        const hasLib = await this._ensureHtml2PdfLib();
        const isAndroid = /Android/i.test(navigator.userAgent || '');

        if (hasLib) {
            let hostWrap = null;
            try {
                hostWrap = document.createElement('div');
                hostWrap.style.cssText = 'position:fixed; inset:0; overflow:hidden; opacity:0; pointer-events:none; z-index:-1;';
                const host = document.createElement('div');
                host.style.cssText = 'position:relative; width:576px; background:#ffffff; color:#000000; direction:rtl; padding:14px 16px; box-sizing:border-box; font-family:Tahoma, Arial, sans-serif;';
                host.innerHTML = receiptBodyHtml;
                hostWrap.appendChild(host);
                document.body.appendChild(hostWrap);

                let canvas = null;
                if (typeof window.html2canvas === 'function') {
                    canvas = await window.html2canvas(host, {
                        scale: 1,
                        backgroundColor: '#ffffff',
                        useCORS: true,
                        logging: false,
                        scrollX: 0,
                        scrollY: 0,
                        x: 0,
                        y: 0,
                        width: 576,
                        windowWidth: 576
                    });
                } else if (typeof window.html2pdf === 'function') {
                    canvas = await window.html2pdf().set({
                        html2canvas: { scale: 1, backgroundColor: '#ffffff', useCORS: true, logging: false, scrollX: 0, scrollY: 0, x: 0, y: 0, width: 576, windowWidth: 576 }
                    }).from(host).toCanvas().get('canvas');
                }

                if (hostWrap && hostWrap.parentNode) hostWrap.parentNode.removeChild(hostWrap);
                hostWrap = null;

                if (canvas) {
                    const pngDataUrl = canvas.toDataURL('image/png');
                    if (isAndroid) {
                        window.location.href = `intent:${pngDataUrl}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
                    } else {
                        window.location.href = `rawbt:${pngDataUrl}`;
                    }
                    return true;
                }
            } catch (err) {
                console.error('RawBT Image Render Error:', err);
                if (hostWrap && hostWrap.parentNode) hostWrap.parentNode.removeChild(hostWrap);
            }
        }

        // بديل طوارئ ESC/POS نصي نظيف بترميز UTF-8 في حال غياب مكتبة الرسم
        try {
            const escPosPayload = '\x1B\x40' + plainTextFallback + '\n\n\n\x1D\x56\x41\x03';
            const b64 = btoa(unescape(encodeURIComponent(escPosPayload)));
            if (isAndroid) {
                window.location.href = `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
            } else {
                window.location.href = `rawbt:base64,${b64}`;
            }
            return true;
        } catch (fallbackErr) {
            console.error('RawBT Fallback Error:', fallbackErr);
            if (typeof window.SerajAlert === 'function') {
                window.SerajAlert('تعذر الاتصال بتطبيق RawBT للطباعة البلوتوث.', 'error');
            }
            return false;
        }
    },

    /**
     * 🧮 استخراج بيانات الفاتورة الموحدة (بيع / شراء / مرتجع / عرض سعر) بدون خصم مزدوج
     */
    _normalizeInvoiceForPrint: function(invoiceData) {
        const invNo = invoiceData.invoiceNo || invoiceData.id || '';
        const isPurchase = Boolean(
            invoiceData.isPurchase ||
            invoiceData.domain === 'purchases' ||
            invoiceData.type === 'purchase' ||
            invoiceData.type === 'purchase_return' ||
            invoiceData.type === 'return_purchase' ||
            (!invoiceData.customer && !invoiceData.customerName && (invoiceData.supplier || invoiceData.supplierName))
        );
        const partyLabel = isPurchase ? 'المورد' : 'العميل';
        const partyName = isPurchase
            ? (invoiceData.supplierName || invoiceData.supplier || 'مورد نقدي')
            : (invoiceData.customerName || invoiceData.customer || 'عميل نقدي');

        const isQuote = Boolean(invoiceData.isQuotation || invoiceData.documentType === 'quotation' || invoiceData.type === 'quotation' || invoiceData.type === 'quote');
        const isReturn = Boolean(['return', 'return_sale', 'sales_return', 'return_purchase', 'purchase_return'].includes(invoiceData.type));

        const items = Array.isArray(invoiceData.items) ? invoiceData.items : [];
        const itemsSubTotal = items.reduce((s, it) => {
            const line = it.total !== undefined ? parseFloat(it.total) : ((parseFloat(it.price) || 0) * (parseFloat(it.qty ?? it.quantity) || 0));
            return s + (isNaN(line) ? 0 : line);
        }, 0);

        const rawDiscount = Math.max(0, parseFloat(invoiceData.discount) || 0);
        const discountVal = itemsSubTotal > 0 ? Math.min(rawDiscount, itemsSubTotal) : rawDiscount;

        let netTotal = 0;
        if (window.DB && typeof window.DB._computeInvoiceNetTotal === 'function' && invoiceData.total !== undefined) {
            netTotal = window.DB._computeInvoiceNetTotal(invoiceData);
        } else if (invoiceData.totalAmount !== undefined) {
            netTotal = Math.max(0, parseFloat(invoiceData.totalAmount) || 0);
        } else if (invoiceData.total !== undefined) {
            netTotal = Math.max(0, parseFloat(invoiceData.total) || 0);
        } else {
            netTotal = Math.max(0, itemsSubTotal - discountVal);
        }

        const paidVal = Math.max(0, parseFloat(invoiceData.paid) || 0);
        const remVal = invoiceData.remaining !== undefined
            ? (parseFloat(invoiceData.remaining) || 0)
            : (netTotal - paidVal);

        let title = isPurchase ? 'فاتورة مشتريات' : 'فاتورة بيع';
        if (invoiceData.isCanceled) title = 'فاتورة ملغاة';
        else if (isQuote) title = 'عرض سعر (مسودة)';
        else if (isReturn) title = isPurchase ? 'فاتورة مرتجع مشتريات' : 'فاتورة مرتجع مبيعات';

        return {
            invNo,
            isPurchase,
            partyLabel,
            partyName,
            isQuote,
            isReturn,
            items,
            itemsSubTotal,
            discountVal,
            netTotal,
            paidVal,
            remVal,
            title,
            dateStr: invoiceData.date || this._todayISO(),
            notes: invoiceData.notes || ''
        };
    },

    /**
     * 📊 الدالة الأولى: تصدير البيانات العامة إلى Excel (يحفظ الباركود والموبايل كـ String)
     */
    exportToExcel: function(dataArray, filename = 'DataExport') {
        if (typeof showLoading === 'function') showLoading('جاري تصدير ملف الإكسيل...');
        try {
            if (typeof window.exportToExcel === 'function' && window.exportToExcel !== this.exportToExcel) {
                return window.exportToExcel(dataArray, filename);
            }
            if (typeof XLSX === 'undefined') {
                console.error('مكتبة SheetJS (XLSX) غير متوفرة في هذه الصفحة.');
                return false;
            }
            const worksheet = Array.isArray(dataArray) && Array.isArray(dataArray[0])
                ? XLSX.utils.aoa_to_sheet(dataArray)
                : XLSX.utils.json_to_sheet(dataArray || []);

            Object.keys(worksheet).forEach(addr => {
                if (addr.startsWith('!')) return;
                const cell = worksheet[addr];
                if (cell && typeof cell.v === 'string' && /^0\d{7,}$|^\d{10,}$/.test(cell.v.trim())) {
                    cell.t = 's';
                    cell.z = '@';
                }
            });
            worksheet['!dir'] = 'rtl';

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
            const cleanName = String(filename || 'DataExport').replace(/\.(xls|xlsx)$/i, '') + '.xlsx';
            XLSX.writeFile(workbook, cleanName);
            return true;
        } catch (err) {
            console.error('Excel Export Error:', err);
            return false;
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    },

    /**
     * 📄 الدالة الثانية: تصدير/معاينة PDF عبر المحرك الموحد window.Utils.downloadRealPDF
     */
    exportToPDF: function(elementIdOrHtml, filename = 'Document') {
        const cleanName = String(filename || 'Document').replace(/\.pdf$/i, '') + '.pdf';
        if (window.Utils && typeof window.Utils.downloadRealPDF === 'function') {
            return window.Utils.downloadRealPDF(elementIdOrHtml, cleanName);
        }
        return Promise.resolve(false);
    },

    /**
     * 📄 الدالة الثالثة: معاينة PDF الموحدة عبر window.Utils.downloadRealPDF
     */
    previewPDF: function(elementIdOrHtml, fileName = 'Report') {
        return this.exportToPDF(elementIdOrHtml, fileName);
    },

    /**
     * 🧾 الدالة الرابعة: الطباعة الحرارية المباشرة (80mm — RawBT Image / USB Safe Iframe)
     */
    printThermalReceipt: async function(invoiceData, skipAsk = false) {
        if (!invoiceData) return false;
        const printMode = localStorage.getItem('seraj_auto_print_setting') || 'ask';
        const connType = localStorage.getItem('seraj_printer_type') || 'usb';
        const brand = this.getShopBranding();

        if (!skipAsk && printMode === 'none') return false;

        if (!skipAsk && printMode === 'ask') {
            let isConfirmed = false;
            if (typeof window.SerajConfirm === 'function') {
                isConfirmed = await window.SerajConfirm('هل تريد طباعة هذه الفاتورة حرارياً (80mm)؟');
            } else {
                isConfirmed = confirm('هل تريد طباعة هذه الفاتورة؟');
            }
            if (!isConfirmed) return false;
        }

        const safe = this._safe.bind(this);
        const money = this._money.bind(this);
        const norm = this._normalizeInvoiceForPrint(invoiceData);

        let rowsHtml = '';
        let plainLines = [
            brand.shopName,
            brand.shopPhone ? `ت: ${brand.shopPhone}` : '',
            brand.shopAddress ? brand.shopAddress : '',
            '--------------------------------',
            `${norm.title} #${norm.invNo}`,
            `التاريخ: ${norm.dateStr}`,
            `${norm.partyLabel}: ${norm.partyName}`,
            '--------------------------------'
        ].filter(Boolean);

        norm.items.forEach(item => {
            const qty = parseFloat(item.qty ?? item.quantity ?? 1) || 1;
            const unitPrice = parseFloat(item.price) || 0;
            const totalRow = item.total !== undefined ? parseFloat(item.total) : (qty * unitPrice);
            const itemName = item.name || 'صنف';
            rowsHtml += `
                <tr>
                    <td style="text-align:right; padding:5px 2px; border-bottom:1px dotted #000; font-weight:bold;">${safe(itemName)}</td>
                    <td style="text-align:center; padding:5px 2px; border-bottom:1px dotted #000; font-weight:bold;">${safe(qty)}</td>
                    <td style="text-align:left; padding:5px 2px; border-bottom:1px dotted #000; font-weight:bold; direction:ltr;">${money(totalRow)}</td>
                </tr>`;
            plainLines.push(`${itemName} | ${qty} × ${money(unitPrice)} = ${money(totalRow)}`);
        });

        let balanceHtml = '';
        const isCashParty = (!norm.partyName || ['نقدي', 'عميل نقدي', 'عميل طياري', 'مبيعات نقدية', 'مورد نقدي'].includes(norm.partyName));
        if (brand.printBalance === 'yes' && !isCashParty && !norm.isQuote && !invoiceData.isCanceled) {
            if (invoiceData.prevBalance !== undefined || invoiceData.currentBalance !== undefined) {
                const prev = parseFloat(invoiceData.prevBalance) || 0;
                const curr = invoiceData.currentBalance !== undefined
                    ? (parseFloat(invoiceData.currentBalance) || 0)
                    : (norm.isReturn ? (prev + norm.remVal) : (prev - norm.remVal));
                const prevText = prev < -0.009 ? `${money(Math.abs(prev))} (عليه)` : (prev > 0.009 ? `${money(prev)} (له)` : '0.00');
                const currText = curr < -0.009 ? `${money(Math.abs(curr))} (عليه)` : (curr > 0.009 ? `${money(curr)} (له)` : '0.00');
                balanceHtml = `<div style="border:2px solid #000; padding:6px; margin-top:8px; text-align:right; font-size:15px; font-weight:bold;"><div>حساب سابق: ${safe(prevText)}</div><div>إجمالي الحساب: ${safe(currText)}</div></div>`;
                plainLines.push(`حساب سابق: ${prevText}`, `إجمالي الحساب: ${currText}`);
            } else if (invoiceData.customerPreviousBalance !== undefined) {
                const prevBal = parseFloat(invoiceData.customerPreviousBalance) || 0;
                const finalBal = prevBal + norm.remVal;
                balanceHtml = `<div style="border:2px solid #000; padding:6px; margin-top:8px; text-align:right; font-size:15px; font-weight:bold;"><div>رصيد سابق: ${money(prevBal)}</div><div>إجمالي الحساب: ${money(finalBal)}</div></div>`;
                plainLines.push(`رصيد سابق: ${money(prevBal)}`, `إجمالي الحساب: ${money(finalBal)}`);
            }
        }

        plainLines.push(
            '--------------------------------',
            norm.discountVal > 0 ? `الخصم: ${money(norm.discountVal)}` : '',
            `الصافي: ${money(norm.netTotal)}`,
            `المدفوع: ${money(norm.paidVal)}`,
            `المتبقي: ${money(norm.remVal)}`,
            '--------------------------------',
            brand.footerNote
        );

        const isBluetooth = (connType === 'bluetooth');
        const fontBase = isBluetooth ? '22px' : '13px';
        const titleSize = isBluetooth ? '30px' : '18px';
        const tableSize = isBluetooth ? '20px' : '13px';

        const receiptInnerHtml = `
            <div style="position:relative; color:#000; background:#fff; direction:rtl; font-family:Tahoma, Arial, sans-serif; font-size:${fontBase}; line-height:1.45;">
                ${invoiceData.isCanceled ? `<div style="position:absolute; top:32%; left:10%; right:10%; text-align:center; font-size:${isBluetooth ? '76px' : '46px'}; font-weight:bold; color:rgba(0,0,0,0.18); transform:rotate(-35deg); pointer-events:none;">ملغـــاة</div>` : ''}
                <div style="text-align:center; margin-bottom:10px; border-bottom:2px dashed #000; padding-bottom:8px;">
                    <div style="font-size:${titleSize}; font-weight:bold; margin:0;">${safe(brand.shopName)}</div>
                    ${brand.shopPhone ? `<div style="margin:3px 0; font-weight:bold;">ت: ${safe(brand.shopPhone)}</div>` : ''}
                    ${brand.shopAddress ? `<div style="margin:3px 0; font-weight:bold;">${safe(brand.shopAddress)}</div>` : ''}
                    <div style="margin-top:4px; font-weight:bold;">${safe(norm.title)}</div>
                </div>
                <div style="margin-bottom:8px; font-weight:bold;">
                    <div>رقم: <span dir="ltr">${safe(norm.invNo)}</span></div>
                    <div>التاريخ: ${safe(norm.dateStr)}</div>
                    <div>${safe(norm.partyLabel)}: ${safe(norm.partyName)}</div>
                </div>
                <table style="width:100%; border-collapse:collapse; margin-bottom:8px; font-size:${tableSize};">
                    <thead>
                        <tr>
                            <th style="text-align:right; padding:5px 2px; border-top:2px dashed #000; border-bottom:2px dashed #000;">الصنف</th>
                            <th style="text-align:center; padding:5px 2px; border-top:2px dashed #000; border-bottom:2px dashed #000;">كمية</th>
                            <th style="text-align:left; padding:5px 2px; border-top:2px dashed #000; border-bottom:2px dashed #000;">إجمالي</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <div style="border-top:2px dashed #000; padding-top:6px; text-align:left; font-weight:bold;">
                    ${norm.discountVal > 0 ? `<div>قبل الخصم: ${money(norm.itemsSubTotal)}</div><div>الخصم: ${money(norm.discountVal)}</div>` : ''}
                    <div style="font-size:${isBluetooth ? '26px' : '15px'};">الصافي: ${money(norm.netTotal)}</div>
                    <div>المدفوع: ${money(norm.paidVal)}</div>
                    <div>المتبقي: ${money(norm.remVal)}</div>
                </div>
                ${balanceHtml}
                ${norm.notes ? `<div style="margin-top:6px; font-weight:bold; border-top:1px dotted #000; padding-top:4px;">ملاحظات: ${safe(norm.notes)}</div>` : ''}
                <div style="text-align:center; margin-top:12px; border-top:2px dashed #000; padding-top:8px; font-weight:bold;">
                    ${safe(brand.footerNote)}
                </div>
            </div>
        `;

        if (isBluetooth) {
            return await this._sendThermalToRawBT(receiptInnerHtml, plainLines.filter(Boolean).join('\n'));
        }

        const fullThermalDoc = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${safe(norm.title)} #${safe(norm.invNo)}</title><style>@page{size:80mm auto;margin:0;}body{margin:0;padding:4mm 2mm;background:#fff;color:#000;width:74mm;box-sizing:border-box;font-family:Tahoma,Arial,sans-serif;}</style></head><body>${receiptInnerHtml}</body></html>`;
        return await this._printHtmlViaSafeIframe(fullThermalDoc);
    },

    /**
     * 🖨️ طباعة فاتورة كاملة على ورقة (A4) — مفصولة تماماً عن الطباعة الحرارية 80mm
     */
    printA4Invoice: async function(invoiceData, asPDFPreview = false) {
        if (!invoiceData) return false;
        const brand = this.getShopBranding();
        const safe = this._safe.bind(this);
        const money = this._money.bind(this);
        const norm = this._normalizeInvoiceForPrint(invoiceData);

        let rowsHtml = norm.items.map((item, idx) => {
            const qty = parseFloat(item.qty ?? item.quantity ?? 1) || 1;
            const unitPrice = parseFloat(item.price) || 0;
            const totalRow = item.total !== undefined ? parseFloat(item.total) : (qty * unitPrice);
            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td style="text-align:right;">${safe(item.name || 'صنف')}</td>
                    <td>${safe(qty)}</td>
                    <td dir="ltr">${money(unitPrice)}</td>
                    <td dir="ltr">${money(totalRow)}</td>
                </tr>`;
        }).join('');

        const invoiceHtml = `
            <div style="background:#fff; color:#000; direction:rtl; font-family:Tahoma, Arial, sans-serif; padding:10px;">
                <div style="text-align:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:16px;">
                    <h1 style="margin:0; font-size:26px; color:#000;">${safe(brand.shopName)}</h1>
                    ${brand.shopPhone ? `<div style="margin-top:4px; font-size:14px; font-weight:bold;">هاتف: ${safe(brand.shopPhone)}</div>` : ''}
                    ${brand.shopAddress ? `<div style="margin-top:2px; font-size:13px;">${safe(brand.shopAddress)}</div>` : ''}
                    <div style="margin-top:6px; font-size:18px; font-weight:bold;">${safe(norm.title)}</div>
                </div>
                <div style="display:flex; justify-content:space-between; border:2px solid #000; border-radius:6px; padding:10px 14px; margin-bottom:16px; font-size:14px; font-weight:bold;">
                    <div>
                        <div>رقم المستند: <span dir="ltr">${safe(norm.invNo)}</span></div>
                        <div style="margin-top:6px;">${safe(norm.partyLabel)}: ${safe(norm.partyName)}</div>
                    </div>
                    <div style="text-align:left;">
                        <div>التاريخ: ${safe(norm.dateStr)}</div>
                        ${norm.notes ? `<div style="margin-top:6px;">ملاحظات: ${safe(norm.notes)}</div>` : ''}
                    </div>
                </div>
                <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
                    <thead>
                        <tr>
                            <th style="width:8%; background:#e2e8f0; border:1px solid #000; padding:8px;">#</th>
                            <th style="width:44%; background:#e2e8f0; border:1px solid #000; padding:8px; text-align:right;">الصنف</th>
                            <th style="width:14%; background:#e2e8f0; border:1px solid #000; padding:8px;">الكمية</th>
                            <th style="width:17%; background:#e2e8f0; border:1px solid #000; padding:8px;">السعر</th>
                            <th style="width:17%; background:#e2e8f0; border:1px solid #000; padding:8px;">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <div style="display:flex; justify-content:flex-end;">
                    <table style="width:320px; border-collapse:collapse;">
                        <tbody>
                            ${norm.discountVal > 0 ? `<tr><td style="text-align:right; background:#f8fafc;">قبل الخصم</td><td dir="ltr">${money(norm.itemsSubTotal)}</td></tr><tr><td style="text-align:right; background:#f8fafc;">الخصم</td><td dir="ltr">${money(norm.discountVal)}</td></tr>` : ''}
                            <tr><td style="text-align:right; background:#e2e8f0; font-size:16px;">الصافي النهائي</td><td dir="ltr" style="font-size:16px;">${money(norm.netTotal)}</td></tr>
                            <tr><td style="text-align:right; background:#f8fafc;">المدفوع</td><td dir="ltr" style="color:#16a34a;">${money(norm.paidVal)}</td></tr>
                            <tr><td style="text-align:right; background:#f8fafc;">المتبقي</td><td dir="ltr" style="color:${norm.remVal > 0.009 ? '#dc2626' : '#16a34a'};">${money(norm.remVal)}</td></tr>
                        </tbody>
                    </table>
                </div>
                <div style="text-align:center; margin-top:24px; border-top:2px dashed #000; padding-top:12px; font-size:14px; font-weight:bold;">
                    ${safe(brand.footerNote)}
                </div>
            </div>
        `;

        if (asPDFPreview) {
            return await this.exportToPDF(invoiceHtml, `Invoice_${norm.invNo}`);
        }

        const fullA4Doc = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${safe(norm.title)} #${safe(norm.invNo)}</title><style>@page{size:A4 portrait;margin:10mm;}body{margin:0;padding:8px;background:#fff;color:#000;font-family:Tahoma,Arial,sans-serif;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #000;padding:8px;text-align:center;font-weight:bold;}</style></head><body>${invoiceHtml}</body></html>`;
        return await this._printHtmlViaSafeIframe(fullA4Doc);
    },

    /**
     * 🖨️ طباعة أي تقرير HTML على ورقة A4 مباشرة (مفيد لحركة الخزينة والتقارير لمنع الورقة البيضاء)
     */
    printA4HTML: async function(innerHtml, docTitle = 'تقرير') {
        const brand = this.getShopBranding();
        const safe = this._safe.bind(this);
        const safeRich = (window.Utils && typeof window.Utils.sanitizeRichHTML === 'function')
            ? window.Utils.sanitizeRichHTML(innerHtml)
            : innerHtml;

        const fullDoc = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${safe(docTitle)}</title><style>@page{size:A4 portrait;margin:10mm;}body{margin:0;padding:10px;background:#fff;color:#000;font-family:Tahoma,Arial,sans-serif;direction:rtl;}table{width:100%;border-collapse:collapse;margin-top:12px;}thead{display:table-header-group;}tr{page-break-inside:avoid;}th{background:#e2e8f0;color:#000;border:1px solid #000;padding:8px;text-align:center;font-weight:bold;}td{border:1px solid #333;padding:8px;text-align:center;font-weight:bold;}.val-red,.val-out,.text-danger{color:#dc2626 !important;}.val-green,.val-in,.text-success{color:#16a34a !important;}</style></head><body><div style="text-align:center;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:14px;"><h2 style="margin:0;">${safe(brand.shopName)}</h2>${brand.shopPhone ? `<div style="font-size:13px;margin-top:3px;">${safe(brand.shopPhone)}</div>` : ''}<div style="font-size:16px;font-weight:bold;margin-top:4px;">${safe(docTitle)} — ${safe(this._todayISO())}</div></div>${safeRich}</body></html>`;
        return await this._printHtmlViaSafeIframe(fullDoc);
    },

    // =========================================================================
    // 📊 دوال كشف الحساب الموحدة (عميل / مورد — PDF عبر downloadRealPDF و Excel)
    // =========================================================================

    /**
     * 📄 الدالة الخامسة: تصدير ومعاينة كشف الحساب إلى PDF (يحافظ على ألوان الديون وهوية المحل)
     */
    exportStatementToPDF: function(person, durationText, tableBodyId = 'statementTableBody', isSupplier = false) {
        if (!person) return Promise.resolve(false);
        const brand = this.getShopBranding();
        const safe = this._safe.bind(this);
        const localDateStr = this._todayISO();

        const tableRows = Array.from(document.querySelectorAll('#' + tableBodyId + ' tr'));
        const hasFourCols = tableRows.some(tr => tr.querySelectorAll('td').length === 4);
        let rowsHtml = '';

        const statementTitle = isSupplier ? 'كشف حساب مورد' : 'كشف حساب عميل';
        const col1Header = isSupplier ? 'تسديد منا (عليه)' : 'عليه (مديونية)';
        const col2Header = isSupplier ? 'مديونية علينا (له)' : 'له (تسديد)';

        tableRows.forEach(tr => {
            const cells = tr.querySelectorAll('td');

            if (cells.length === 1) {
                const spanCount = hasFourCols ? 4 : 3;
                rowsHtml += `<tr><td colspan="${spanCount}" style="text-align:center; font-weight:bold; color:#000;">${safe(cells[0].innerText.trim())}</td></tr>`;
            } else if (cells.length === 4) {
                const titleText = cells[0].querySelector('div:first-child') ? cells[0].querySelector('div:first-child').innerText.trim() : cells[0].innerText.split('\n')[0].trim();
                const dateText = cells[0].querySelector('div:nth-child(2)') ? cells[0].querySelector('div:nth-child(2)').innerText.trim() : '';
                const notesText = cells[1].innerText.trim();
                const col1Val = cells[2].innerText.trim();
                const col2Val = cells[3].innerText.trim();

                rowsHtml += `
                <tr>
                    <td style="text-align:right; width:35%; color:#000;"><strong>${safe(titleText)}</strong><br><span style="font-size:12px; color:#555;">${safe(dateText)}</span></td>
                    <td style="text-align:center; font-size:13px; width:35%; color:#000;">${safe(notesText)}</td>
                    <td style="text-align:center; font-weight:bold; font-size:15px; width:15%; color:#dc2626;">${safe(col1Val)}</td>
                    <td style="text-align:center; font-weight:bold; font-size:15px; width:15%; color:#16a34a;">${safe(col2Val)}</td>
                </tr>`;
            } else if (cells.length === 3) {
                const isSummaryRow = tr.innerText.includes('إجمالي الحركات') || tr.innerText.includes('رصيد حساب سابق');
                const rowBg = isSummaryRow ? 'background-color:#f3f4f6;' : 'background-color:#ffffff;';
                const col1Val = cells[1].innerText.trim();
                const col2Val = cells[2].innerText.trim();

                if (hasFourCols) {
                    rowsHtml += `
                    <tr style="${rowBg}">
                        <td colspan="2" style="text-align:right; font-weight:bold; color:#000; ${rowBg}">${safe(cells[0].innerText.trim())}</td>
                        <td style="text-align:center; font-weight:bold; font-size:15px; color:#dc2626; ${rowBg}">${safe(col1Val)}</td>
                        <td style="text-align:center; font-weight:bold; font-size:15px; color:#16a34a; ${rowBg}">${safe(col2Val)}</td>
                    </tr>`;
                } else {
                    const firstCellContent = isSummaryRow
                        ? `<strong>${safe(cells[0].innerText.trim())}</strong>`
                        : safe(cells[0].innerText.trim()).replace(/\n/g, '<br>');
                    rowsHtml += `
                    <tr style="${rowBg}">
                        <td style="text-align:right; width:60%; color:#000; ${rowBg}">${firstCellContent}</td>
                        <td style="text-align:center; font-weight:bold; font-size:15px; width:20%; color:#dc2626; ${rowBg}">${safe(col1Val)}</td>
                        <td style="text-align:center; font-weight:bold; font-size:15px; width:20%; color:#16a34a; ${rowBg}">${safe(col2Val)}</td>
                    </tr>`;
                }
            } else if (cells.length === 2) {
                const titleText = cells[0].innerText.trim();
                const netTextRaw = cells[1].innerText.trim();
                let finalColor = '#000000';
                if (netTextRaw.includes('عليه')) finalColor = '#dc2626';
                else if (netTextRaw.includes('له')) finalColor = '#16a34a';

                const titleSpan = hasFourCols ? 'colspan="2"' : '';
                rowsHtml += `
                <tr style="background-color:#f3f4f6;">
                    <td ${titleSpan} style="text-align:right; font-size:16px; font-weight:bold; color:#000; background-color:#f3f4f6;">${safe(titleText)}</td>
                    <td colspan="2" style="text-align:center; font-size:18px; font-weight:bold; color:${finalColor}; background-color:#f3f4f6;">${safe(netTextRaw)}</td>
                </tr>`;
            }
        });

        const tableHeadHtml = hasFourCols
            ? `<tr>
                    <th style="text-align:right; width:35%;">البيان والتاريخ</th>
                    <th style="text-align:center; width:35%;">الملاحظات</th>
                    <th style="width:15%; color:#dc2626;">${col1Header}</th>
                    <th style="width:15%; color:#16a34a;">${col2Header}</th>
               </tr>`
            : `<tr>
                    <th style="text-align:right; width:60%;">البيان، التاريخ والملاحظات</th>
                    <th style="width:20%; color:#dc2626;">${col1Header}</th>
                    <th style="width:20%; color:#16a34a;">${col2Header}</th>
               </tr>`;

        const statementHtml = `
            <div style="background:#ffffff; padding:12px; font-family:Tahoma, Arial, sans-serif; direction:rtl; color:#000;">
                <div style="text-align:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:18px;">
                    <h1 style="margin:0; font-size:28px; font-weight:bold; color:#000;">${safe(brand.shopName)}</h1>
                    ${brand.shopPhone ? `<div style="margin-top:4px; font-size:14px; font-weight:bold;">ت: ${safe(brand.shopPhone)}</div>` : ''}
                    ${brand.shopAddress ? `<div style="margin-top:2px; font-size:13px;">${safe(brand.shopAddress)}</div>` : ''}
                    <p style="margin:6px 0 0 0; color:#000; font-size:18px; font-weight:bold;">${statementTitle}</p>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:16px; font-size:15px; background:#fff; padding:12px; border:2px solid #000; color:#000; border-radius:6px;">
                    <div>
                        <div style="margin-bottom:6px;"><strong>الاسم:</strong> <span style="font-size:17px; font-weight:bold;">${safe(person.name)}</span></div>
                        <div><strong>رقم الموبايل:</strong> <span dir="ltr">${safe(person.phone || '---')}</span></div>
                    </div>
                    <div style="text-align:left;">
                        <div style="margin-bottom:6px;"><strong>تاريخ الكشف:</strong> ${safe(localDateStr)}</div>
                        <div><strong>الفترة الزمنية:</strong> ${safe(durationText || 'مدى العمل')}</div>
                    </div>
                </div>
                <table>
                    <thead>${tableHeadHtml}</thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <div style="text-align:center; margin-top:22px; font-size:14px; color:#000; border-top:2px dashed #000; padding-top:12px; font-weight:bold;">
                    ${safe(brand.footerNote)}
                </div>
            </div>`;

        const safeFileName = 'Statement_' + String(person.name || 'Account').trim().replace(/\s+/g, '_') + '.pdf';
        return this.exportToPDF(statementHtml, safeFileName);
    },

    /**
     * 📊 الدالة السادسة: تصدير كشف الحساب إلى Excel (يحافظ على أرقام الموبايل كنص وهوية المحل)
     */
    exportStatementToExcel: function(person, durationText = '', tableBodyId = 'statementTableBody', isSupplier = false) {
        if (!person) return false;
        if (typeof showLoading === 'function') showLoading('جاري تجهيز ملف الإكسيل...');

        try {
            if (typeof XLSX === 'undefined') {
                console.error('مكتبة SheetJS (XLSX) غير متوفرة.');
                return false;
            }

            const brand = this.getShopBranding();
            const safeDuration = durationText || (document.getElementById('currentDurationLabelOutside')?.innerText || 'مدى العمل');
            const safeTableBodyId = tableBodyId || 'statementTableBody';
            const todayStr = this._todayISO();

            const tableRows = document.querySelectorAll('#' + safeTableBodyId + ' tr');
            const statementTitle = isSupplier ? 'كشف حساب مورد' : 'كشف حساب عميل';
            const col1Title = isSupplier ? 'تسديد منا (عليه)' : 'عليه (مديونية)';
            const col2Title = isSupplier ? 'مديونية علينا (له)' : 'له (تسديد)';

            const excelData = [
                [`${brand.shopName} - ${statementTitle}`],
                ['الاسم:', String(person.name || ''), 'رقم الموبايل:', String(person.phone || '---')],
                ['تاريخ الكشف:', todayStr, 'الفترة الزمنية:', safeDuration],
                [],
                ['البيان والتاريخ والملاحظات', 'ملاحظات إضافية', col1Title, col2Title]
            ];

            tableRows.forEach(tr => {
                const cells = tr.querySelectorAll('td');
                if (cells.length === 1) {
                    excelData.push([cells[0].innerText.replace(/\n+/g, ' - ').trim(), '', '', '']);
                } else if (cells.length === 4) {
                    excelData.push([
                        cells[0].innerText.replace(/\n+/g, ' - ').trim(),
                        cells[1].innerText.trim(),
                        cells[2].innerText.trim(),
                        cells[3].innerText.trim()
                    ]);
                } else if (cells.length === 3) {
                    excelData.push([
                        cells[0].innerText.replace(/\n+/g, ' | ').trim(),
                        '',
                        cells[1].innerText.trim(),
                        cells[2].innerText.trim()
                    ]);
                } else if (cells.length === 2) {
                    excelData.push([
                        cells[0].innerText.replace(/\n+/g, ' - ').trim(),
                        '',
                        cells[1].innerText.trim(),
                        ''
                    ]);
                }
            });

            const worksheet = XLSX.utils.aoa_to_sheet(excelData);
            worksheet['!cols'] = [{ wch: 34 }, { wch: 28 }, { wch: 16 }, { wch: 16 }];
            worksheet['!dir'] = 'rtl';

            // ضمان حفظ رقم الموبايل كنص (String) داخل الشيت
            if (worksheet['D2']) {
                worksheet['D2'].t = 's';
                worksheet['D2'].z = '@';
            }

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Statement');

            const fileName = 'Statement_' + String(person.name || 'Account').trim().replace(/\s+/g, '_') + '.xlsx';
            XLSX.writeFile(workbook, fileName);
            return true;
        } catch (err) {
            console.error('Statement Excel Error:', err);
            return false;
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    }
};

window.PrintManager = PrintManager;

