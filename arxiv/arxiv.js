/** @type {any} */
const html2canvas = window.html2canvas;

import { 
    db, 
    collection, 
    getDocs, 
    query, 
    doc, 
    deleteDoc, 
    where 
} from "../firebase.js";

const archiveListContainer = document.getElementById('archive-list-container');
const archiveSearchInput = document.getElementById('archive-search-input');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const totalSumSpan = document.getElementById('total-sum');
const totalYolSpan = document.getElementById('total-yol-sum');
const totalXidmetSpan = document.getElementById('total-xidmet-sum');

let allArchivedInvoices = [];

document.addEventListener('DOMContentLoaded', () => {
    const fpConfig = {
        dateFormat: "d.m.Y",
        onChange: function() {
            filterAndRender();
        }
    };

    // Bu günkü tarix
    const now = new Date();
    
    // 1 ay bundan əvvəlki tarix
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    if (window.flatpickr) {
        // Başlanğıc tarixi: 1 ay əvvəl
        window.flatpickr("#start-date", {
            ...fpConfig,
            defaultDate: oneMonthAgo
        });

        // Bitiş tarixi: Bu gün
        window.flatpickr("#end-date", {
            ...fpConfig,
            defaultDate: now
        });
    }

    fetchArchiveList();

    if (archiveSearchInput) {
        archiveSearchInput.addEventListener('input', filterAndRender);
    }
});

// Qalan funksiyalar əvvəlki kimi qalır...
async function fetchArchiveList() {
    if (!archiveListContainer) return;
    
    archiveListContainer.innerHTML = `
        <div class="loading-spinner-wrapper">
            <div class="loading-spinner"></div>
            <span style="font-size: 13px; color: #94a3b8;">Məlumatlar yüklənir...</span>
        </div>
    `;
    
    try {
        const q = query(
            collection(db, "waiting_invoices"), 
            where("status", "==", "archived")
        );
        const snap = await getDocs(q);
        
        allArchivedInvoices = [];
        snap.forEach(docSnap => {
            allArchivedInvoices.push({ id: docSnap.id, ...docSnap.data() });
        });

        filterAndRender();
    } catch (e) { 
        console.error("Arxiv yüklənmə xətası:", e);
        archiveListContainer.innerHTML = '<div style="text-align:center; color:#ef4444; padding: 20px;">Məlumatları yükləmək mümkün olmadı.</div>';
    }
}

function filterAndRender() {
    const searchTerm = archiveSearchInput ? archiveSearchInput.value.toLowerCase().trim() : '';
    
    const startDateVal = startDateInput.value ? startDateInput.value.split('.').reverse().join('-') : null;
    const endDateVal = endDateInput.value ? endDateInput.value.split('.').reverse().join('-') : null;

    const startDate = startDateVal ? new Date(startDateVal) : null;
    const endDate = endDateVal ? new Date(endDateVal) : null;
    
    if (endDate) {
        endDate.setHours(23, 59, 59, 999);
    }

    const filtered = allArchivedInvoices.filter(item => {
        const matchesSearch = item.customerName && item.customerName.toLowerCase().includes(searchTerm);
        
        let matchesDate = true;
        const itemDate = item.updatedAt?.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt || 0);

        if (startDate && itemDate < startDate) matchesDate = false;
        if (endDate && itemDate > endDate) matchesDate = false;

        // Əgər axtarış xanasına yazı yazılıbsa, tarix şərtini nəzərə alma (true qaytarsın)
        if (searchTerm !== "") {
            return matchesSearch;
        }

        return matchesSearch && matchesDate;
    });

    filtered.sort((a, b) => {
        const timeA = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt || 0).getTime();
        const timeB = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt || 0).getTime();
        return timeB - timeA;
    });

    renderArchiveUI(filtered);
}

function renderArchiveUI(list) {
    if (!archiveListContainer) return;
    archiveListContainer.innerHTML = '';

    let totalSum = 0;
    let totalYolSum = 0;      // <--- Yeni yol xərci dəyişəni
    let totalXidmetSum = 0;   // <--- Yeni xidmət haqqı dəyişəni

    if (list.length === 0) {
        archiveListContainer.innerHTML = '<p style="font-size:13px; color:#9ca3af; text-align:center; padding: 20px;">Seçilmiş tarix aralığında arxivdə heç bir qaimə tapılmadı.</p>';
        if (totalSumSpan) totalSumSpan.innerText = '0.00';
        if (totalYolSpan) totalYolSpan.innerText = '0.00';
        if (totalXidmetSpan) totalXidmetSpan.innerText = '0.00';
        return;
    }

    list.forEach((data) => {
        const docId = data.id;
        const formattedDate = formatDate(data.updatedAt);

        let invoiceTotal = 0;
        if (data.items && Array.isArray(data.items)) {
            data.items.forEach(item => {
                const price = parseFloat(item.price) || 0;
                const qty = parseFloat(item.quantity || item.count || 1) || 1;
                const itemTotal = price * qty;
                invoiceTotal += itemTotal;

                // Məhsul adlarına görə yoxlama və ayrı toplama
                const itemNameLower = (item.name || item.title || '').trim().toLowerCase();
                if (itemNameLower === 'yol xerci') {
                    totalYolSum += itemTotal;
                } else if (itemNameLower === 'xidmet haqqi') {
                    totalXidmetSum += itemTotal;
                }
            });
        }
        totalSum += invoiceTotal;


        const div = document.createElement('div');
        div.className = 'archive-item';
        div.style.cssText = "background: #111827; padding: 12px; margin-bottom: 10px; border-radius: 8px; border: 1px solid #374151; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box; gap: 4px;";
        
        div.innerHTML = `
            <div style="flex: 1; min-width: 0; overflow: hidden;">
                <strong style="color:#ffffff; font-size: 14px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.customerName}</strong>
                <span style="display:block; font-size:11px; color:#a5b4fc; margin-top:2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.items ? data.items.length : 0} məhsul — Cəmi: ${invoiceTotal.toFixed(2)} AZN</span>
                <span style="display:block; font-size:10px; color:#9ca3af; margin-top:2px;">📅 ${formattedDate}</span>
            </div>
            <div class="archive-actions-wrapper" style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                <button class="btn-view-archive">Bax</button>
                <button class="btn-share-archive">Paylaş</button>
                <div class="dynamic-action-area" style="display: inline-flex; align-items: center;">
                    <button class="btn-delete-archive">Sil</button>
                </div>
            </div>
        `;

        // Bax düyməsi
        const btnView = div.querySelector('.btn-view-archive');
        btnView.addEventListener('click', () => {
            let productsHTML = '';
            if (data.items && data.items.length > 0) {
                data.items.forEach((item, idx) => {
                    const pName = item.name || item.title || 'Məhsul';
                    const pPrice = parseFloat(item.price) || 0;
                    const pQty = parseFloat(item.quantity || item.count || 1) || 1;
                    const itemTotal = pQty * pPrice;

                    productsHTML += `
                        <div style="padding: 10px 12px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                                <span style="background: #1e293b; color: #38bdf8; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 11px; font-weight: bold; flex-shrink: 0;">${idx + 1}</span>
                                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    <span style="color: #fff; font-weight: 500;">${pName}</span>
                                    <span style="color: #64748b; font-size: 11px; display: block;">${pQty} ədəd × ${pPrice.toFixed(2)} AZN</span>
                                </div>
                            </div>
                            <span style="color: #38bdf8; font-weight: 600; flex-shrink: 0; margin-left: 10px;">${itemTotal.toFixed(2)} AZN</span>
                        </div>
                    `;
                });
            } else {
                productsHTML = "<p style='color: #64748b; text-align: center; padding: 15px; margin: 0; font-size: 13px;'>Məhsul yoxdur.</p>";
            }

            const modalContent = document.getElementById('archive-modal-content');
            modalContent.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
                    <span style="color: #94a3b8;">Müştəri:</span>
                    <strong style="color: #fff;">${data.customerName}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 13px;">
                    <span style="color: #94a3b8;">Tarix:</span>
                    <span style="color: #e2e8f0;">${formattedDate}</span>
                </div>
                
                <div style="font-size: 13px; color: #94a3b8; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Məhsullar</div>
                
                <div style="background: #0f172a; border-radius: 8px; border: 1px solid #334155; overflow: hidden; max-height: 45vh; overflow-y: auto;">
                    ${productsHTML}
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid #334155;">
                    <span style="font-size: 13px; color: #94a3b8; font-weight: 600;">Cəmi Məbləğ:</span>
                    <span style="color: #34d399; font-size: 16px; font-weight: bold;">${invoiceTotal.toFixed(2)} AZN</span>
                </div>
            `;

            const modal = document.getElementById('archive-modal');
            modal.style.display = 'flex';

            document.getElementById('close-archive-modal').onclick = () => {
                modal.style.display = 'none';
            };

            modal.onclick = (e) => {
                if (e.target === modal) modal.style.display = 'none';
            };
        });

        // Paylaş düyməsi
        const btnShare = div.querySelector('.btn-share-archive');
        btnShare.addEventListener('click', () => {
            openArchiveShareModal(data, formattedDate);
        });

        // Sil düyməsi
        const actionArea = div.querySelector('.dynamic-action-area');
        const btnDelete = div.querySelector('.btn-delete-archive');

        btnDelete.addEventListener('click', (e) => {
            e.stopPropagation();
            actionArea.innerHTML = `
                <div style="display: inline-flex; align-items: center; gap: 4px;">
                    <button class="btn-confirm-yes" style="background: #ef4444 !important; color: #ffffff !important; border: none !important; padding: 6px 12px !important; border-radius: 6px !important; cursor: pointer !important; font-size: 12px !important; font-weight: 600 !important;">Bəli</button>
                    <button class="btn-confirm-no" style="background: #4b5563 !important; color: #ffffff !important; border: none !important; padding: 6px 12px !important; border-radius: 6px !important; cursor: pointer !important; font-size: 12px !important; font-weight: 600 !important;">Xeyr</button>
                </div>
            `;

            actionArea.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                eSub.stopPropagation();
                renderArchiveUI(list);
            });

            actionArea.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                eSub.stopPropagation();
                try {
                    await deleteDoc(doc(db, "waiting_invoices", docId));
                    fetchArchiveList();
                } catch (err) {
                    alert("Silinmə zamanı xəta baş verdi!");
                }
            });
        });

        archiveListContainer.appendChild(div);
    });
if (totalSumSpan) {
        totalSumSpan.innerText = totalSum.toFixed(2);
    }
    if (totalYolSpan) {
        totalYolSpan.innerText = totalYolSum.toFixed(2);
    }
    if (totalXidmetSpan) {
        totalXidmetSpan.innerText = totalXidmetSum.toFixed(2);
    }
}

// Format seçimi pəncərəsi
function openArchiveShareModal(data, formattedDate) {
    let choiceModal = document.getElementById('archive-share-choice-modal');
    if (!choiceModal) {
        choiceModal = document.createElement('div');
        choiceModal.id = 'archive-share-choice-modal';
        Object.assign(choiceModal.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.7)', zIndex: '999999', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px'
        });
        choiceModal.innerHTML = `
            <div class="share-choice-box" style="background: #1e293b; padding: 24px; border-radius: 12px; width: 100%; max-width: 320px; text-align: center; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="color: #fff; margin-bottom: 16px; font-size: 18px;">Paylaşma üsulunu seçin</h3>
                <div class="share-choice-buttons" style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <button type="button" id="arc-download-img" class="share-choice-btn" style="flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 15px 10px; cursor: pointer; color: #fff; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                        <span class="share-choice-icon" style="font-size: 24px;">🖼️</span>
                        <span style="font-size: 13px; font-weight: 600;">Şəkil</span>
                    </button>
                    <button type="button" id="arc-download-pdf" class="share-choice-btn" style="flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 15px 10px; cursor: pointer; color: #fff; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                        <span class="share-choice-icon" style="font-size: 24px;">📄</span>
                        <span style="font-size: 13px; font-weight: 600;">PDF</span>
                    </button>
                </div>
                <button type="button" id="arc-close-modal" class="share-choice-cancel" style="background: transparent; border: none; color: #94a3b8; font-size: 13px; font-weight: 600; cursor: pointer; padding: 5px;">Ləğv et</button>
            </div>
        `;
        document.body.appendChild(choiceModal);
    } else {
        choiceModal.style.display = 'flex';
    }

    document.getElementById('arc-close-modal').onclick = () => {
        choiceModal.style.display = 'none';
    };

    // Şəkil seçildikdə
    document.getElementById('arc-download-img').onclick = async () => {
        choiceModal.style.display = 'none';
        
        let overlay = showLoadingOverlay();
        try {
            const file = await prepareArchiveImageFile(data, formattedDate);
            await new Promise(resolve => setTimeout(resolve, 4000));
            overlay.remove();

            if (file) {
                await executeShareOrDownload(file, `Qaime_${data.customerName || 'musteri'}.png`);
            }
        } catch (err) {
            console.error(err);
            overlay.remove();
            alert("Şəkil yaradılarkən xəta baş verdi.");
        }
    };

    // PDF seçildikdə
    document.getElementById('arc-download-pdf').onclick = async () => {
        choiceModal.style.display = 'none';
        
        let overlay = showLoadingOverlay();
        try {
            const file = await prepareArchivePDFFile(data, formattedDate);
            await new Promise(resolve => setTimeout(resolve, 4000));
            overlay.remove();

            if (file) {
                await executeShareOrDownload(file, `Qaime_${data.customerName || 'musteri'}.pdf`);
            }
        } catch (err) {
            console.error(err);
            overlay.remove();
            alert("PDF yaradılarkən xəta baş verdi.");
        }
    };
}

function showLoadingOverlay() {
    let overlay = document.createElement('div');
    overlay.id = 'pdf-capture-overlay';
    Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: '#0b132b', zIndex: '999999999', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#ffffff', fontSize: '15px', fontWeight: '600', gap: '14px'
    });
    overlay.innerHTML = `
        <div style="width:34px; height:34px; border:3px solid rgba(255,255,255,0.2); border-top-color:#5bc0be; border-radius:50%; animation: qaimeShareSpin 0.8s linear infinite;"></div>
        <div>Hazırlanır...</div>
        <style>@keyframes qaimeShareSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

async function executeShareOrDownload(file, defaultFilename) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: '',
                text: '',
                files: [file]
            });
        } catch (shareErr) {
            if (shareErr.name !== 'AbortError') {
                console.error("Paylaşım xətası:", shareErr);
                downloadFallback(file, defaultFilename);
            }
        }
    } else {
        downloadFallback(file, defaultFilename);
    }
}

function downloadFallback(file, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = filename;
    link.click();
}

async function prepareArchiveImageFile(data, formattedDate) {
    const container = createInvoiceRenderContainer(data, formattedDate);
    document.body.appendChild(container);
    try {
        const canvas = await html2canvas(container, { scale: 2, useCORS: true });
        return await new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const file = new File([blob], `Qaime_${data.customerName || 'musteri'}.png`, { type: 'image/png' });
                resolve(file);
            }, 'image/png');
        });
    } finally {
        container.remove();
    }
}

async function prepareArchivePDFFile(data, formattedDate) {
    const container = createInvoiceRenderContainer(data, formattedDate);
    // Şəkildə olduğu kimi elementi ekrana yerləşdiririk
    Object.assign(container.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        zIndex: '999999998',
        opacity: '1',
        pointerEvents: 'none',
        width: '794px'
    });
    document.body.appendChild(container);
    
    try {
        // Şriftlərin və şəkillərin tam yüklənməsini gözləyirik
        await new Promise(resolve => setTimeout(resolve, 400));

        const canvas = await html2canvas(container, {
            scale: 1.5,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            imageTimeout: 0,
            windowWidth: 794,
            scrollX: 0,
            scrollY: 0
        });

        // jsPDF vasitəsilə canvas-ı PDF-ə çeviririk
        const pdfBlob = buildPdfBlobFromCanvas(canvas);
        return new File([pdfBlob], `Qaime_${data.customerName || 'musteri'}.pdf`, { type: 'application/pdf' });
    } finally {
        container.remove();
    }
}

//jsPDF və canvas-dan PDF blob düzəldən köməkçi funksiya
function buildPdfBlobFromCanvas(canvas) {
   const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || (window.html2pdf && window.html2pdf.jsPDF);
    if (!jsPDFCtor) throw new Error('jsPDF kitabxanası tapılmadı');

    const pageWidthMM = 210;   
    const pageHeightMM = 297;  
    const marginMM = 6;
    const usableWidthMM = pageWidthMM - marginMM * 2;
    const usableHeightMM = pageHeightMM - marginMM * 2;

    const imgHeightMM = (canvas.height * usableWidthMM) / canvas.width;
    const pdf = new jsPDFCtor({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    if (imgHeightMM <= usableHeightMM) {
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData, 'JPEG', marginMM, marginMM, usableWidthMM, imgHeightMM);
    } else {
        const pxPerMM = canvas.width / usableWidthMM;
        const pageContentHeightPx = Math.floor(usableHeightMM * pxPerMM);

        let yOffsetPx = 0;
        let first = true;
        while (yOffsetPx < canvas.height) {
            if (!first) pdf.addPage();
            first = false;

            const sliceHeightPx = Math.min(pageContentHeightPx, canvas.height - yOffsetPx);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeightPx;
            sliceCanvas.getContext('2d').drawImage(
                canvas, 0, yOffsetPx, canvas.width, sliceHeightPx,
                0, 0, canvas.width, sliceHeightPx
            );
            const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.98);
            const sliceHeightMM = (sliceHeightPx * usableWidthMM) / canvas.width;
            pdf.addImage(sliceData, 'JPEG', marginMM, marginMM, usableWidthMM, sliceHeightMM);

            yOffsetPx += sliceHeightPx;
        }
    }

    return pdf.output('blob');
}

function createInvoiceRenderContainer(data, formattedDate) {
    let tableRowsHTML = "";
    let grandTotal = 0;

    if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item, index) => {
            const pQty = parseFloat(item.quantity || item.count || 1) || 1;
            const pPrice = parseFloat(item.price) || 0;
            const rowTotal = pQty * pPrice;
            grandTotal += rowTotal;

            tableRowsHTML += `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 10px 4px; font-size: 13px; color: #374151;">${index + 1}</td>
                    <td style="padding: 10px 4px; font-size: 13px; font-weight: 700; color: #111111;">${item.name || item.title || 'Məhsul'}</td>
                    <td style="padding: 10px 4px; font-size: 13px; text-align: center; color: #374151; width: 80px;">${pQty}</td>
                    <td style="padding: 10px 4px; font-size: 13px; text-align: right; color: #374151; width: 100px;">${pPrice.toFixed(2)}</td>
                    <td style="padding: 10px 4px; font-size: 13px; text-align: right; font-weight: 700; color: #111111; width: 100px;">${rowTotal.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    const container = document.createElement('div');
    container.style.cssText = "position: absolute; left: -9999px; top: 0; width: 794px; padding: 40px; background: #ffffff; font-family: Arial, sans-serif; color: #111111; box-sizing: border-box;";
    container.innerHTML = `
        <div class="invoice-preview-container" style="background: #ffffff; color: #000000; padding: 40px; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; box-sizing: border-box;">
    
    <!-- Üst Hissə -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
        <div>
            <h1 style="font-size: 26px; font-weight: 900; margin: 0 0 10px 0; letter-spacing: 0.5px;">SATIŞ QAİMƏSİ</h1>
            <div style="font-size: 13px; color: #555; margin-bottom: 6px;">Kimə (Müştəri):</div>
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px; display: inline-block; min-width: 200px;">${data.customerName || 'Müştəri'}</div>
            <div style="font-size: 12px; color: #666; margin-top: 6px;">📅 Tarix: ${formattedDate}</div>
        </div>

        <div style="text-align: right;">
            <h2 style="font-size: 20px; font-weight: 900; margin: 0 0 4px 0;">ARAZ ELECTRON</h2>
            <div style="font-size: 11px; color: #555; margin-bottom: 8px;">Elektronika və Texniki Dəstək Xidmətləri</div>
            <div style="font-size: 11px; color: #444; line-height: 1.5;">
                📍 Beyləqan r. Magistral yol<br>
                🌐 arazelectron.com<br>
                ✉️ info@arazelectron.com<br>
                📞 +994514280906
            </div>
        </div>
    </div>

    <!-- Cədvəl Hissəsi -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
        <thead>
            <tr style="border-bottom: 2px solid #000; text-align: left;">
                <th style="padding: 8px 4px; width: 40px;">#</th>
                <th style="padding: 8px 4px;">MƏHSULUN ADI</th>
                <th style="padding: 8px 4px; text-align: center; width: 80px;">MİQDAR</th>
                <th style="padding: 8px 4px; text-align: right; width: 100px;">QİYMƏT</th>
                <th style="padding: 8px 4px; text-align: right; width: 100px;">CƏMİ</th>
            </tr>
        </thead>
        <tbody>
            ${tableRowsHTML}
        </tbody>
    </table>

   <!-- Alt Hissə: Möhür və Yekun Məbləğ -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px;">
        <div style="width: 110px; height: 110px; display: flex; align-items: center; justify-content: center;">
            <img src="../mohur.png" alt="Möhür" style="width: 86.67px; height: 130px; object-fit: contain;">
        </div>

        <div style="text-align: right;">
            <span style="font-size: 15px; font-weight: 600; color: #222;">Yekun Ödəniş: </span>
            <span style="font-size: 22px; font-weight: 900; color: #000; margin-left: 8px;">${grandTotal.toFixed(2)} AZN</span>
        </div>
    </div>

    <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 10px;">
        Blokbitaniyaya və Hard Diskə zəmanət verilmir.
    </div>
</div>
    `;
    return container;
}

function formatDate(firestoreTimestamp) {
    if (!firestoreTimestamp) return "";
    const date = firestoreTimestamp.toDate ? firestoreTimestamp.toDate() : new Date(firestoreTimestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}