// 1. Bütün lazım olan Firestore metodlarını və db-ni təhlükəsiz şəkildə yalnız bir yerdən import edirik
import { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp,
    doc, 
    updateDoc, 
    deleteDoc, 
    where 
} from "./firebase.js";

// 2. Service Worker qeydiyyatı
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=3', { scope: '/cosqun-qaime/' })
        .then(() => console.log("Service Worker aktivləşdirildi."))
        .catch(err => console.error("SW qeydiyyat xətası:", err));
}

// DAHA DA BÖYÜDÜLMÜŞ BİLDİRİŞ FUNKSİYASI
function showNotification(message, type = 'success') {
    const oldNotification = document.getElementById('custom-notification');
    if (oldNotification) oldNotification.remove();

    const notification = document.createElement('div');
    notification.id = 'custom-notification';
    notification.innerText = message;

    Object.assign(notification.style, {
        position: 'fixed',
        top: '25px',
        right: '25px',
        padding: '22px 40px',          // Daha geniş padding
        borderRadius: '12px',
        color: '#ffffff',
        fontWeight: 'bold',            
        fontSize: '22px',              // Daha böyük şrift ölçüsü
        zIndex: '9999999', 
        boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
        transition: 'all 0.3s ease',
        opacity: '0',
        transform: 'translateY(-20px)'
    });

    if (type === 'success') {
        notification.style.backgroundColor = '#10b981';
        notification.style.borderLeft = '10px solid #047857'; 
    } else {
        notification.style.backgroundColor = '#ef4444';
        notification.style.borderLeft = '10px solid #b91c1c'; 
    }

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

const itemsBody = document.getElementById('invoice-items-body');
const btnAddItem = document.getElementById('btn-add-item');
const customerInput = document.getElementById('customer-input');
const totalPriceView = document.getElementById('total-price-view');
const waitingListContainer = document.getElementById('waiting-list-container');
const btnNewInvoice = document.getElementById('btn-new-invoice');
const selectTemplate = document.getElementById('select-template');
const dateInput = document.getElementById('invoice-date-input');
const btnSharePdf = document.getElementById('btn-share-pdf');

// Elementlər bir dəfə burada elan olunur:
const btnOpenArchiveModal = document.getElementById('btn-open-archive-modal');
const archiveModal = document.getElementById('archive-modal');
const archiveModalClose = document.getElementById('archive-modal-close');
const archiveListContainer = document.getElementById('archive-list-container');
const archiveSearchInput = document.getElementById('archive-search-input');
const openTemplateModalBtn = document.getElementById('open-template-modal-btn');
const customSelectModal = document.getElementById('custom-select-modal');
const customModalClose = document.getElementById('custom-modal-close');
const templateSearchInput = document.getElementById('template-search-input');
const templateListContainer = document.getElementById('template-list-container');
const selectedTemplateText = document.getElementById('selected-template-text');

let allLoadedTemplates = []; // Bütün şablonları yadda saxlamaq üçün
let invoiceItems = [{ name: '', qty: 1, price: 0 }];
let currentActiveDocId = null;
let dbProductsList = []; 
let allWaitingInvoices = []; 
let allArchivedInvoices = [];

document.addEventListener('DOMContentLoaded', () => {
    // Əvvəlki yarımçıq qaiməni yoxlayırıq
    const savedDraft = localStorage.getItem('invoice_draft');
    if (savedDraft) {
        try {
            const draft = JSON.parse(savedDraft);
            if (customerInput) customerInput.value = draft.customerName || '';
            if (dateInput && draft.invoiceDate) dateInput.value = draft.invoiceDate;
            if (draft.items && draft.items.length > 0) {
                invoiceItems = draft.items;
            }
            currentActiveDocId = draft.currentActiveDocId || null;
            if (currentActiveDocId && btnWaiting) {
                btnWaiting.textContent = 'Yenilə';
            }
        } catch (e) {
            console.error("Draft yüklənmə xətası:", e);
        }
    }

    renderItems();
    fetchWaitingList();
    loadGlobalProductsAndTemplates();
    if (!savedDraft) setTodayDate();
    
    const dropdown = document.getElementById('custom-dropdown');
    if (dropdown) {
        dropdown.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.dropdown-item');
            if (!itemEl) return;

            const targetIndex = parseInt(dropdown.getAttribute('data-target-index'));
            if (isNaN(targetIndex)) return;

            invoiceItems[targetIndex].name = itemEl.textContent;
            invoiceItems[targetIndex].price = parseFloat(itemEl.dataset.price) || 0;
            
            renderItems();
            dropdown.style.display = 'none';
        });

        document.addEventListener('click', (e) => {
            if (!e.target.classList.contains('item-name') && !e.target.closest('#custom-dropdown')) {
                dropdown.style.display = 'none';
            }
        });
    }

    const waitingSearchInput = document.getElementById('waiting-search-input');
    if (waitingSearchInput) {
        waitingSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const filtered = allWaitingInvoices.filter(item => 
                item.customerName.toLowerCase().includes(searchTerm)
            );
            renderWaitingList(filtered);
        });
    }

    if (typeof fetchArchiveList === 'function') {
        fetchArchiveList(); 
    }

    if (btnOpenArchiveModal && archiveModal) {
        btnOpenArchiveModal.addEventListener('click', () => {
            btnOpenArchiveModal.classList.add('clicked');
            setTimeout(() => btnOpenArchiveModal.classList.remove('clicked'), 300);
            archiveModal.style.display = 'flex';
            if (typeof fetchArchiveList === 'function') fetchArchiveList();
        });
    }

    if (archiveModalClose && archiveModal) {
        archiveModalClose.addEventListener('click', () => {
            archiveModal.style.display = 'none';
        });
    }

    if (archiveModal) {
        archiveModal.addEventListener('click', (e) => {
            if (e.target === archiveModal) archiveModal.style.display = 'none';
        });
    }

    if (archiveSearchInput) {
        archiveSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const filtered = allArchivedInvoices.filter(item => 
                item.customerName.toLowerCase().includes(searchTerm)
            );
            renderArchiveList(filtered);
        });
    }

// Şablon modalını açmaq və birdəfəyə yükləmək
if (openTemplateModalBtn && customSelectModal) {
    openTemplateModalBtn.addEventListener('click', async () => {
        customSelectModal.style.display = 'flex';
        if (templateSearchInput) {
            templateSearchInput.value = '';
        }
        
        if (templateListContainer) {
            templateListContainer.innerHTML = '<div class="loading-wrapper" style="padding: 30px; text-align: center;"><div class="sharp-ring-loader"></div></div>';
        }
        
        // Həm məhsulları, həm də bütün şablonları tam yeniləyirik
        await loadGlobalProductsAndTemplates();
        
        // Hamısı hazır olduqdan sonra birdəfəyə ekrana basırıq
        renderTemplateModalList(allLoadedTemplates);
    });
}

    // Şablon modalını bağlamaq
    if (customModalClose && customSelectModal) {
        customModalClose.addEventListener('click', () => {
            customSelectModal.style.display = 'none';
        });
    }

    if (customSelectModal) {
        customSelectModal.addEventListener('click', (e) => {
            if (e.target === customSelectModal) customSelectModal.style.display = 'none';
        });
    }

    // Modal daxilində axtarış
    if (templateSearchInput) {
        templateSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const filtered = allLoadedTemplates.filter(t => t.name.toLowerCase().includes(term));
            renderTemplateModalList(filtered);
        });
    }

    if (customerInput) {
    customerInput.addEventListener('input', () => {
        saveDraftToLocalStorage(); // Müştəri adı yazıldıqda yadda saxla
    });
}

if (dateInput) {
    dateInput.addEventListener('change', () => {
        saveDraftToLocalStorage(); // Tarix dəyişdikdə yadda saxla
    });
}
});

function setTodayDate() {
    if (dateInput) {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISODate = (new Date(now - offset)).toISOString().slice(0, 10);
        dateInput.value = localISODate;
    }
}

async function loadGlobalProductsAndTemplates() {
    try {
        // Məhsulları yükləyirik
        const pSnap = await getDocs(query(collection(db, "base_products"), orderBy("name")));
        dbProductsList = [];
        pSnap.forEach(d => dbProductsList.push(d.data()));

        allLoadedTemplates = [];

        // Baza şablonlarını əlavə edirik
        const tSnap = await getDocs(collection(db, "base_templates"));
        tSnap.forEach(docSnapshot => {
            const tData = docSnapshot.data();
            allLoadedTemplates.push({
                id: docSnapshot.id,
                name: tData.templateName,
                items: tData.items,
                isSpecial: false
            });
        });

        // Xüsusi şablonları əlavə edirik
        const specialSnap = await getDocs(collection(db, "special_templates"));
        if (!specialSnap.empty) {
            specialSnap.forEach(docSnapshot => {
                const tData = docSnapshot.data();
                // Dublikat yoxlaması (əgər eyni adla artıq düşübsə əlavə etməsin)
                const templateName = `⚡ ${tData.templateName || tData.name}`;
                const exists = allLoadedTemplates.some(t => t.name === templateName || t.name === (tData.templateName || tData.name));
                
                if (!exists) {
                    allLoadedTemplates.push({
                        id: docSnapshot.id,
                        name: templateName,
                        items: tData.items,
                        isSpecial: true
                    });
                }
            });
        }
    } catch (e) {
        console.error("İlkin data yüklənmə xətası:", e);
    }
}

if (btnNewInvoice) {
    btnNewInvoice.addEventListener('click', () => {
        btnNewInvoice.classList.add('clicked');
        setTimeout(() => btnNewInvoice.classList.remove('clicked'), 500);
        
        resetForm(); 
        
        // Yaddaşdakı karalamanı tamamilə silirik
        localStorage.removeItem('invoice_draft');
        
        showNotification("Siyahı sıfırlandı", "success");
    });
}

function renderItems() {
    itemsBody.innerHTML = '';
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
        const rowTotal = item.qty * item.price;
        grandTotal += rowTotal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: left; padding: 10px 5px;">${index + 1}</td>
            <td style="text-align: left; padding: 10px 5px;"><input type="text" class="item-name" value="${item.name || ''}" placeholder="Məhsulun adı"></td>
            <td style="text-align: left; padding: 10px 5px;"><input type="number" class="item-qty" value="${item.qty}" style="width: 60px;"></td>
            <td style="text-align: left; padding: 10px 5px;"><input type="number" class="item-price" value="${item.price || ''}" step="0.01" placeholder="0.00" style="width: 80px;"></td>
            <td style="text-align: left; padding: 10px 5px; font-weight: 600;" class="row-total-display">${rowTotal.toFixed(2)} AZN</td>
            <td style="text-align: left; padding: 10px 5px;"><button class="btn-delete-row">×</button></td>
        `;

        const nameInput = tr.querySelector('.item-name');
        const qtyInput = tr.querySelector('.item-qty');
        const priceInput = tr.querySelector('.item-price');
        const rowTotalDisplay = tr.querySelector('.row-total-display');
        const btnDeleteRow = tr.querySelector('.btn-delete-row');

        nameInput.addEventListener('input', (e) => {
            item.name = e.target.value;
            saveDraftToLocalStorage();
            const dropdown = document.getElementById('custom-dropdown');
            
            if (dropdown) {
                if (dropdown.parentNode !== document.body) document.body.appendChild(dropdown);
                
                const rect = nameInput.getBoundingClientRect();
                
                dropdown.style.position = 'fixed'; 
                dropdown.style.left = `${rect.left}px`;
                dropdown.style.top = `${rect.bottom}px`;
                dropdown.style.width = `${rect.width}px`;
                dropdown.style.display = 'block';
                
                dropdown.setAttribute('data-target-index', index);
                filterDropdownItems(e.target.value, dropdown);
            }
        });

        qtyInput.addEventListener('input', (e) => {
    item.qty = parseInt(e.target.value) || 0;
    // Bəzi yerlərdə quantity kimi də oxuna biləcəyi üçün hər ikisini eyni vaxtda təyin edək:
    item.quantity = item.qty; 
    rowTotalDisplay.textContent = (item.qty * item.price).toFixed(2) + " AZN";
    fastCalculateTotal();
    saveDraftToLocalStorage();
});

        priceInput.addEventListener('input', (e) => {
            item.price = parseFloat(e.target.value) || 0;
            rowTotalDisplay.textContent = (item.qty * item.price).toFixed(2) + " AZN";
            fastCalculateTotal();
            saveDraftToLocalStorage();
        });

        qtyInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });
        priceInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });

        btnDeleteRow.addEventListener('click', () => {
            if(invoiceItems.length === 1) {
                invoiceItems = [{ name: '', qty: 1, price: 0 }];
            } else {
                invoiceItems.splice(index, 1);
            }
            renderItems();
            saveDraftToLocalStorage();
        });

        itemsBody.appendChild(tr);
    });

    if (totalPriceView) totalPriceView.textContent = grandTotal.toFixed(2);
}

function filterDropdownItems(filterText, dropdown) {
    dropdown.innerHTML = '';
    const queryStr = filterText.toLowerCase().trim();
    const filtered = dbProductsList.filter(p => p.name.toLowerCase().includes(queryStr));
    
    if (filtered.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    filtered.forEach(prod => {
        const dItem = document.createElement('div');
        dItem.className = 'dropdown-item';
        dItem.innerHTML = `<span>${prod.name}</span> <span style="float:right; opacity:0.6;">${prod.price} AZN</span>`;
        dItem.dataset.price = prod.price;
        
        dItem.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const targetIndex = parseInt(dropdown.getAttribute('data-target-index'));
            invoiceItems[targetIndex].name = prod.name;
            invoiceItems[targetIndex].price = parseFloat(prod.price) || 0;
            renderItems();
            dropdown.style.display = 'none';
        });
        
        dropdown.appendChild(dItem);
    });
    dropdown.style.display = 'block';
}

function fastCalculateTotal() {
    const total = invoiceItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
    if (totalPriceView) totalPriceView.textContent = total.toFixed(2);
}

const btnAddItemEl = document.getElementById('btn-add-item');
if (btnAddItemEl) {
    btnAddItemEl.addEventListener('click', () => {
        btnAddItemEl.classList.add('clicked');
        setTimeout(() => btnAddItemEl.classList.remove('clicked'), 250);
        invoiceItems.push({ name: '', qty: 1, price: 0 });
        renderItems();
    });
}

const btnWaiting = document.getElementById('btn-waiting');
if (btnWaiting) {
    btnWaiting.addEventListener('click', async () => {
        btnWaiting.classList.add('clicked');
        setTimeout(() => btnWaiting.classList.remove('clicked'), 500);

        const customerName = customerInput.value.trim();
        const isFirstItemEmpty = invoiceItems.length === 1 && !invoiceItems[0].name.trim();

        if (!customerName || isFirstItemEmpty) {
            return showNotification("Müştəri adı və məhsul əlavə edin", "error");
        }

        const selectedDate = dateInput && dateInput.value ? new Date(dateInput.value) : new Date();

        const data = {
            customerName: customerName,
            items: invoiceItems,
            status: "waiting",
            updatedAt: selectedDate
        };

        try {
            if (currentActiveDocId) {
                await updateDoc(doc(db, "waiting_invoices", currentActiveDocId), data);
                showNotification("Qaimə uğurla yeniləndi!", "success");
            } else {
                await addDoc(collection(db, "waiting_invoices"), data);
                showNotification("Qaimə gözləməyə alındı!", "success");
            }
            resetForm();
            await fetchWaitingList();
        } catch (e) { 
            console.error(e); 
            showNotification("Xəta baş verdi!", "error");
        }
    });
}

async function fetchWaitingList() {
    if (!waitingListContainer) return;
    waitingListContainer.innerHTML = '<div class="loading-wrapper"><div class="sharp-ring-loader"></div></div>';
    try {
        const q = query(
            collection(db, "waiting_invoices"), 
            where("status", "==", "waiting")
        );
        const snap = await getDocs(q);
        
        allWaitingInvoices = [];
        snap.forEach(docSnap => {
            allWaitingInvoices.push({ id: docSnap.id, ...docSnap.data() });
        });

        allWaitingInvoices.sort((a, b) => {
            const timeA = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt).getTime();
            const timeB = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt).getTime();
            return timeB - timeA;
        });

        renderWaitingList(allWaitingInvoices);
    } catch (e) { 
        console.error(e); 
    }
}

function renderWaitingList(list) {
    if (!waitingListContainer) return;
    
    const panelHeaderTitle = document.querySelector('.waiting-panel .panel-header h3');
    if (panelHeaderTitle) {
        panelHeaderTitle.textContent = `Gözləyən Qaimələr (${list.length})`;
    }
    
    waitingListContainer.innerHTML = '';

    if(list.length === 0) {
        waitingListContainer.innerHTML = '<p style="font-size:12px; color:#9ca3af; text-align:center;">Gözləyən iş yoxdur.</p>';
        return;
    }

    list.forEach((data) => {
        const docId = data.id;
        const formattedDate = formatDate(data.updatedAt);

        // Qaimənin ümumi məbləğ hesablanması
        let totalAmount = 0;
        if (data.items && Array.isArray(data.items)) {
            totalAmount = data.items.reduce((sum, item) => sum + ((item.qty || 0) * (item.price || 0)), 0);
        }

        const div = document.createElement('div');
        div.className = 'waiting-item';
        div.innerHTML = `
            <div style="flex:1;" class="info-area">
                <strong style="color:#ffffff;">${data.customerName}</strong>
                <span style="display:block; font-size:11px; color:#a5b4fc; margin-top:2px;">${data.items.length} məhsul</span>
                <span style="display:block; font-size:10px; color:#9ca3af; margin-top:4px;">📅 ${formattedDate}</span>
            </div>
            <div class="action-area" style="display:flex; align-items:center; gap: 8px;">
                <!-- Tamamla butonunun solunda ümumi məbləğ -->
                <span style="font-size: 12px; font-weight: 600; color: #5bc0be; background: rgba(91, 192, 190, 0.1); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(91, 192, 190, 0.3); white-space: nowrap;">${totalAmount.toFixed(2)} AZN</span>                <button class="btn-complete-waiting">Tamamla</button>
                <button class="btn-delete-waiting">Sil</button>
            </div>
        `;

        div.addEventListener('click', (e) => {
            if(e.target.closest('.btn-delete-waiting') || e.target.closest('.btn-complete-waiting') || e.target.closest('.waiting-item-confirm-box')) return;
            currentActiveDocId = docId;
            customerInput.value = data.customerName;
            invoiceItems = data.items;

            if (dateInput && data.updatedAt) {
                const dateObj = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                const offset = dateObj.getTimezoneOffset() * 60000;
                const localISODate = (new Date(dateObj - offset)).toISOString().slice(0, 10);
                dateInput.value = localISODate;
            }

            renderItems();
            if (btnWaiting) btnWaiting.textContent = 'Yenilə';
        });

        const btnComplete = div.querySelector('.btn-complete-waiting');
        btnComplete.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await updateDoc(doc(db, "waiting_invoices", docId), {
                    status: "archived",
                    updatedAt: new Date()
                });
                if (currentActiveDocId === docId) resetForm();
                fetchWaitingList();
                showNotification("Qaimə uğurla arxivə köçürüldü!", "success");
            } catch (err) {
                showNotification("Xəta baş verdi!", "error");
            }
        });

        const btnDelete = div.querySelector('.btn-delete-waiting');
        const actionArea = div.querySelector('.action-area');

        btnDelete.addEventListener('click', (e) => {
            e.stopPropagation();
            btnDelete.style.display = 'none';
            
            const confirmBox = document.createElement('div');
            confirmBox.className = 'waiting-item-confirm-box';
            confirmBox.innerHTML = `
                <span style="color:#fff; font-size:13px; margin-right:5px;">Silinsin?</span>
                <button class="btn-confirm-yes">Bəli</button>
                <button class="btn-confirm-no">Xeyr</button>
            `;

            confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                eSub.stopPropagation();
                try {
                    await deleteDoc(doc(db, "waiting_invoices", docId));
                    if (currentActiveDocId === docId) resetForm();
                    fetchWaitingList();
                    showNotification("Qaimə uğurla silindi!", "success");
                } catch (err) {
                    showNotification("Silmək mümkün olmadı!", "error");
                }
            });

            confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                eSub.stopPropagation();
                confirmBox.remove();
                btnDelete.style.display = 'block';
            });

            actionArea.appendChild(confirmBox);
        });

        waitingListContainer.appendChild(div);
    });
}

const btnRefresh = document.getElementById('btn-refresh');
if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
        btnRefresh.classList.add('clicked');
        await fetchWaitingList();
        setTimeout(() => btnRefresh.classList.remove('clicked'), 250);
    });
}

function resetForm() {
    if (customerInput) customerInput.value = '';
    if (selectTemplate) selectTemplate.selectedIndex = 0;
    invoiceItems = [{ name: '', qty: 1, price: 0 }];
    currentActiveDocId = null;
    setTodayDate();
    renderItems();
    if (btnWaiting) btnWaiting.textContent = 'Gözləməyə Al';
}

const btnSettings = document.getElementById('btn-settings');
if (btnSettings) {
    btnSettings.addEventListener('click', (e) => {
        e.preventDefault();
        btnSettings.classList.add('clicked');
        setTimeout(() => {
            btnSettings.classList.remove('clicked');
            window.location.href = btnSettings.getAttribute('href');
        }, 500);
    });
}

if (selectTemplate) {
    selectTemplate.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (!selectedOption || !selectedOption.value) return; 
        
        try {
            const templateItems = JSON.parse(selectedOption.dataset.items);
            if (templateItems && templateItems.length > 0) {
                invoiceItems = templateItems.map(item => ({
                    name: item.name,
                    qty: item.qty || 1,
                    price: item.price || 0
                }));
                renderItems();
            }
        } catch (err) {
            console.error("Şablon tətbiq xətası:", err);
        }
    });
}

function formatDate(firestoreTimestamp) {
    if (!firestoreTimestamp) return "";
    const date = firestoreTimestamp.toDate ? firestoreTimestamp.toDate() : new Date(firestoreTimestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

if (btnSharePdf) {
    btnSharePdf.addEventListener('click', () => {
        btnSharePdf.classList.add('clicked');
        setTimeout(() => btnSharePdf.classList.remove('clicked'), 500);

        if (invoiceItems.length === 1 && !invoiceItems[0].name.trim()) {
            return showNotification("Boş qaimə paylaşıla bilməz!", "error");
        }
        openShareChoiceModal();
    });
}

function openShareChoiceModal() {
    const old = document.getElementById('share-choice-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'share-choice-modal';
    modal.className = 'share-choice-overlay';
    modal.innerHTML = `
        <div class="share-choice-box">
            <h3>Paylaşma üsulunu seçin</h3>
            <div class="share-choice-buttons">
                <button type="button" id="share-choice-image" class="share-choice-btn">
                    <span class="share-choice-icon">🖼️</span>
                    <span>Şəkil</span>
                </button>
                <button type="button" id="share-choice-pdf" class="share-choice-btn">
                    <span class="share-choice-icon">📄</span>
                    <span>PDF</span>
                </button>
            </div>
            <button type="button" id="share-choice-cancel" class="share-choice-cancel">Ləğv et</button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    document.getElementById('share-choice-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('share-choice-image').addEventListener('click', () => {
        modal.remove();
        generateAndShareInvoice('image');
    });
    document.getElementById('share-choice-pdf').addEventListener('click', () => {
        modal.remove();
        generateAndShareInvoice('pdf');
    });
}

const COMPANY_INFO = {
    name: 'ARAZ ELECTRON',
    tagline: 'Elektronika və Texniki Dəstək Xidmətləri',
    address: 'Beyləqan r. Magistral yol',
    website: 'arazelectron.com',
    email: 'info@arazelectron.com',
    phone: '+994514280906',
    footerNote: 'Blokbitaniya və Hard Diskə zəmanət verilmir.',
};

function buildInvoiceHTML() {
    const customerName = customerInput.value.trim() || "Müştəri";
    const selectedDate = dateInput ? dateInput.value : "";

    let formattedDate = "";
    if (selectedDate) {
        const parts = selectedDate.split("-");
        formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
    } else {
        const now = new Date();
        formattedDate = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    }

    let tableRowsHTML = "";
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
    const qVal = parseInt(item.qty !== undefined ? item.qty : (item.quantity || 1)) || 1;
    const pVal = parseFloat(item.price) || 0;
    const rowTotal = qVal * pVal;
    grandTotal += rowTotal;

    tableRowsHTML += `
        <tr style="border-bottom: 1px solid #e5e7eb; page-break-inside: avoid; break-inside: avoid;">
            <td style="padding: 10px 6px; font-size: 13px; color: #374151;">${index + 1}</td>
            <td style="padding: 10px 6px; font-size: 13px; font-weight: 700; color: #111111; word-break: break-word;">${item.name || ''}</td>
            <td style="padding: 10px 6px; font-size: 13px; text-align: center; color: #374151;">${qVal}</td>
            <td style="padding: 10px 6px; font-size: 13px; text-align: right; color: #374151;">${pVal.toFixed(2)}</td>
            <td style="padding: 10px 6px; font-size: 13px; text-align: right; font-weight: 700; color: #111111;">${rowTotal.toFixed(2)}</td>
        </tr>
    `;
});

    const html = `
        <div style="width: 794px; box-sizing: border-box; padding: 40px 45px; background-color: #ffffff; font-family: 'Noto Sans', Arial, sans-serif; color: #111111;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px;">
                <div>
                    <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 14px 0; letter-spacing: 0.3px;">SATIŞ QAİMƏSİ</h1>
                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">Kimə (Müştəri):</div>
                    <div style="font-size: 15px; font-weight: 700; padding-bottom: 6px; border-bottom: 1px solid #9ca3af; display: inline-block; min-width: 170px; margin-bottom: 10px;">${customerName}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">📅 Tarix: ${formattedDate}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 19px; font-weight: 800;">${COMPANY_INFO.name}</div>
                    <div style="font-size: 10.5px; color: #6b7280; margin: 3px 0 10px 0;">${COMPANY_INFO.tagline}</div>
                    <div style="font-size: 11px; color: #4b5563; line-height: 1.85;">
                        📍 ${COMPANY_INFO.address}<br>
                        🌐 ${COMPANY_INFO.website}<br>
                        ✉️ ${COMPANY_INFO.email}<br>
                        📞 ${COMPANY_INFO.phone}
                    </div>
                </div>
            </div>

            <table class="invoice-print-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                <thead>
                    <tr style="border-bottom: 2px solid #111111;">
                        <th style="padding: 8px 6px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; width: 5%;">#</th>
                        <th style="padding: 8px 6px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px;">Məhsulun adı</th>
                        <th style="padding: 8px 6px; text-align: center; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; width: 14%;">Miqdar</th>
                        <th style="padding: 8px 6px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; width: 14%;">Qiymət</th>
                        <th style="padding: 8px 6px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; width: 14%;">Cəmi</th>
                    </tr>
                </thead>
                <tbody>${tableRowsHTML}</tbody>
            </table>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 55px;">
                <img src="${COMPANY_INFO.stampSrc}" crossorigin="anonymous" style="width: 86.67px; height: 130px; display: block;">
                <div style="text-align: right;">
                    <span style="font-size: 14px; color: #374151;">Yekun Ödəniş: </span>
                    <span style="font-size: 20px; font-weight: 800;">${grandTotal.toFixed(2)} AZN</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 36px; font-size: 11px; font-weight: 700;">
                ${COMPANY_INFO.footerNote}
            </div>
        </div>
    `;

    return { html, customerName };
}

function buildInvoicePrintContainer() {
    const { html, customerName } = buildInvoiceHTML();

    const printContainer = document.createElement('div');
    printContainer.className = 'pdf-render-hidden';
    Object.assign(printContainer.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        zIndex: '999999998',
        opacity: '1',
        pointerEvents: 'none',
        width: '794px'
    });
    printContainer.innerHTML = html;

    return { printContainer, customerName };
}

function showCaptureOverlay() {
    let overlay = document.getElementById('pdf-capture-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'pdf-capture-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: '#0b132b',
        zIndex: '999999999',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontSize: '15px',
        fontWeight: '600',
        gap: '14px'
    });
    overlay.innerHTML = `
        <div style="width:34px; height:34px; border:3px solid rgba(255,255,255,0.2); border-top-color:#5bc0be; border-radius:50%; animation: qaimeShareSpin 0.8s linear infinite;"></div>
        <div>Hazırlanır...</div>
        <style>@keyframes qaimeShareSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function hideCaptureOverlay() {
    const overlay = document.getElementById('pdf-capture-overlay');
    if (overlay) overlay.remove();
}

async function waitForRenderReady(container) {
    if (document.fonts && document.fonts.ready) {
        try {
            await document.fonts.load("400 16px 'Noto Sans'");
            await document.fonts.load("700 16px 'Noto Sans'");
            await document.fonts.load("800 16px 'Noto Sans'");
            await document.fonts.ready;
        } catch (e) {}
    }

    if (container) {
        const images = Array.from(container.querySelectorAll('img'));
        await Promise.all(images.map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
                setTimeout(resolve, 3000);
            });
        }));
    }

    await new Promise(resolve => requestAnimationFrame(resolve));
}

function buildPdfBlobFromCanvas(canvas) {
    const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
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

function toSafeFileName(text) {
    const map = {
        'ə': 'e', 'Ə': 'E',
        'ı': 'i', 'İ': 'I',
        'ş': 's', 'Ş': 'S',
        'ç': 'c', 'Ç': 'C',
        'ö': 'o', 'Ö': 'O',
        'ü': 'u', 'Ü': 'U',
        'ğ': 'g', 'Ğ': 'G'
    };
    return String(text)
        .split('')
        .map((ch) => map[ch] !== undefined ? map[ch] : ch)
        .join('')
        .replace(/[^a-zA-Z0-9_\-]/g, '_');
}

async function generateAndShareInvoice(type) {
    if (btnSharePdf) btnSharePdf.disabled = true;

    showCaptureOverlay();
    const { printContainer, customerName } = buildInvoicePrintContainer();
    document.body.appendChild(printContainer);

    try {
        await waitForRenderReady(printContainer);

        const safeName = toSafeFileName(`Qaime_${customerName.replace(/\s+/g, '_')}`);

        const canvas = await html2canvas(printContainer, {
            scale: 1.5,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            imageTimeout: 0,
            windowWidth: 794,
            scrollX: 0,
            scrollY: 0
        });

        if (type === 'pdf') {
            const pdfBlob = await buildPdfBlobFromCanvas(canvas);
            const file = new File([pdfBlob], `${safeName}.pdf`, { type: 'application/pdf'});
            await shareOrDownloadFile(file, pdfBlob, `${safeName}.pdf`, 'PDF');
        } else {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
            const file = new File([blob], `${safeName}.png`, { type: 'image/png' });
            await shareOrDownloadFile(file, blob, `${safeName}.png`, 'Şəkil');
        }
    } catch (error) {
        console.error(error);
        showNotification("Xəta baş verdi! Yenidən cəhd edin.", "error");
    } finally {
        printContainer.remove();
        hideCaptureOverlay();
        if (btnSharePdf) btnSharePdf.disabled = false;
    }
}

async function shareOrDownloadFile(file, blob, filename, label) {
    if (!navigator.share) {
        showNotification("Bu brauzer paylaşma funksiyasını ümumiyyətlə dəstəkləmir.", "error");
    } else {
        try {
            await navigator.share({ files: [file], title: 'Satış Qaiməsi' });
            return;
        } catch (err) {
            if (err && err.name === 'AbortError') return;
            console.warn('navigator.share uğursuz oldu:', err);
            showNotification(`Paylaşma xətası: [${err && err.name}] ${err && err.message}`, "error");
        }
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

window.appOpenShareChoiceModal = openShareChoiceModal;
window.setExternalInvoiceData = (name, items) => {
    if (customerInput) customerInput.value = name;
    invoiceItems = items;
};

const btnSaveTemplateMini = document.getElementById('open-save-template-modal-btn');
const templateModal = document.getElementById('template-modal');
const modalTemplateNameInput = document.getElementById('modal-template-name-input');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

if (btnSaveTemplateMini && templateModal) {
    btnSaveTemplateMini.addEventListener('click', () => {
        if (invoiceItems.length === 1 && !invoiceItems[0].name.trim()) {
            return showNotification("Boş şablon yadda saxlanıla bilməz!", "error");
        }
        
        const customerName = customerInput ? customerInput.value.trim() : "";
        modalTemplateNameInput.value = customerName || "Yeni Şablon";
        
        templateModal.style.display = 'flex';
        modalTemplateNameInput.focus();
        modalTemplateNameInput.select();
    });
}

if (modalCancelBtn && templateModal) {
    modalCancelBtn.addEventListener('click', () => {
        templateModal.style.display = 'none';
    });
}

if (templateModal) {
    templateModal.addEventListener('click', (e) => {
        if (e.target === templateModal) {
            templateModal.style.display = 'none';
        }
    });
}

if (modalSaveBtn && templateModal) {
    modalSaveBtn.addEventListener('click', async () => {
        const templateNameVal = modalTemplateNameInput.value.trim();
        if (!templateNameVal) {
            return showNotification("Şablon adı boş ola bilməz!", "error");
        }

        if (!invoiceItems || invoiceItems.length === 0) {
            return showNotification("Qaimədə məhsul yoxdur!", "error");
        }

        try {
            const productsSnapshot = await getDocs(collection(db, "base_products"));
            const warehouseProducts = [];
            productsSnapshot.forEach(docSnap => {
                const pData = docSnap.data();
                if (pData.name) {
                    warehouseProducts.push(pData.name.toLowerCase().trim());
                }
            });

            let missingProducts = [];
            invoiceItems.forEach(item => {
                const itemName = (item.name || '').toLowerCase().trim();
                if (itemName && !warehouseProducts.includes(itemName)) {
                    missingProducts.push(item.name);
                }
            });

            if (missingProducts.length > 0) {
                showNotification(`Anbarda olmayan məhsul var: ${missingProducts.join(', ')}`, "error");
                return;
            }

            const templateData = {
                templateName: templateNameVal,
                items: invoiceItems.map(item => ({
                    name: item.name,
                    qty: parseInt(item.qty) || 1, 
                    price: parseFloat(item.price) || 0
                }))
            };

            await addDoc(collection(db, "special_templates"), templateData);
            
            showNotification("Şablon uğurla xüsusi şablonlara yadda saxlandı!", "success");
            templateModal.style.display = 'none';
            
            if (typeof loadSpecialTemplates === 'function') {
                loadSpecialTemplates(); 
            }
        } catch (err) {
            console.error("Şablon yadda saxlama xətası:", err);
            showNotification("Şablon yadda saxlanılmadı!", "error");
        }
    });
}

async function loadSpecialTemplates() {
    const specialContainer = document.getElementById('special-templates-container'); 
    if (!specialContainer) return;

    try {
        const querySnapshot = await getDocs(collection(db, "special_templates"));
        specialContainer.innerHTML = '';

        if (querySnapshot.empty) {
            specialContainer.innerHTML = '<p style="font-size:12px; color:#9ca3af; text-align:center; padding: 10px;">Xüsusi yadda saxlanılan şablon yoxdur.</p>';
            return;
        }

        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const docId = docSnapshot.id;

            const div = document.createElement('div');
            div.className = 'waiting-item'; 
            div.style.cssText = "background: #111827; padding: 12px; margin-bottom: 10px; border-radius: 8px; border: 1px solid #374151; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;";
            
            div.innerHTML = `
                <div style="flex:1;" class="info-area">
                    <strong style="color:#ffffff; font-size: 14px;">${data.templateName}</strong>
                    <span style="display:block; font-size:11px; color:#a5b4fc; margin-top:2px;">(${data.items.length} məhsul daxildir)</span>
                </div>
                <div class="action-area" style="display:flex; align-items:center; gap: 6px;">
                    <button class="btn-edit-special" title="Seç" style="background:#f59e0b; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;"><span style="font-size:14px;">✏️</span></button>
                    <button class="btn-delete-special" style="background-color:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Sil</button>
                </div>
            `;

            div.querySelector('.btn-edit-special').addEventListener('click', () => {
                invoiceItems = data.items.map(item => ({
                    name: item.name,
                    qty: item.qty || 1,
                    price: item.price || 0
                }));
                renderItems();
                showNotification(`"${data.templateName}" şablonu yükləndi!`, "success");
            });

            div.querySelector('.btn-delete-special').addEventListener('click', async () => {
                try {
                    await deleteDoc(doc(db, "special_templates", docId));
                    showNotification("Şablon silindi!", "success");
                    loadSpecialTemplates();
                } catch (err) {
                    showNotification("Silinmə xətası!", "error");
                }
            });

            specialContainer.appendChild(div);
        });
    } catch (e) {
        console.error("Xüsusi şablonları çəkmə xətası:", e);
    }
}

// Arxiv qaimələrini Firebase-dən çəkən funksiya
async function fetchArchiveList() {
    if (!archiveListContainer) return;
    archiveListContainer.innerHTML = '<div class="loading-wrapper"><div class="sharp-ring-loader"></div></div>';
    
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

        // Tarixə görə sıralama (ən sonuncu yuxarıda)
        allArchivedInvoices.sort((a, b) => {
            const timeA = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt).getTime();
            const timeB = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt).getTime();
            return timeB - timeA;
        });

        renderArchiveList(allArchivedInvoices);
    } catch (e) { 
        console.error("Arxiv yüklənmə xətası:", e);
        archiveListContainer.innerHTML = '<p style="font-size:12px; color:#ef4444; text-align:center;">Arxivi yükləmək mümkün olmadı.</p>';
    }
}

// Arxiv siyahısını ekranda göstərən funksiya
function renderArchiveList(list) {
    if (!archiveListContainer) return;
    archiveListContainer.innerHTML = '';

    if (list.length === 0) {
        archiveListContainer.innerHTML = '<p style="font-size:12px; color:#9ca3af; text-align:center; padding: 20px;">Qaimə Tapılmadı</p>';
        return;
    }

    list.forEach((data) => {
        const docId = data.id;
        const formattedDate = formatDate(data.updatedAt);

        const div = document.createElement('div');
        div.className = 'waiting-item';
        div.style.cssText = "background: #111827; padding: 12px; margin-bottom: 8px; border-radius: 8px; border: 1px solid #374151; display: flex; justify-content: space-between; align-items: center;";
        
        div.innerHTML = `
            <div style="flex:1;">
                <strong style="color:#ffffff; font-size: 14px;">${data.customerName}</strong>
                <span style="display:block; font-size:11px; color:#a5b4fc; margin-top:2px;">${data.items.length} məhsul</span>
                <span style="display:block; font-size:10px; color:#9ca3af; margin-top:4px;">📅 ${formattedDate}</span>
            </div>
            <div style="display:flex; gap: 6px;">
                <button class="btn-load-archive" style="background:#3b82f6; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Seç</button>
            </div>
        `;

        // "Seç" düyməsinə kliklədikdə qaiməni əsas ekrana gətirir
        div.querySelector('.btn-load-archive').addEventListener('click', () => {
            currentActiveDocId = docId;
            customerInput.value = data.customerName;
            invoiceItems = data.items;

            if (dateInput && data.updatedAt) {
                const dateObj = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                const offset = dateObj.getTimezoneOffset() * 60000;
                const localISODate = (new Date(dateObj - offset)).toISOString().slice(0, 10);
                dateInput.value = localISODate;
            }

            renderItems();
            if (btnWaiting) btnWaiting.textContent = 'Yenilə';
            
            // Modalı bağlayırıq
            if (archiveModal) archiveModal.style.display = 'none';
            showNotification("Arxivdən qaimə yükləndi", "success");
        });

        archiveListContainer.appendChild(div);
    });
}

// Modal daxilində şablon siyahısını çəkən funksiya
function renderTemplateModalList(list) {
    if (!templateListContainer) return;
    templateListContainer.innerHTML = '';

    if (list.length === 0) {
        templateListContainer.innerHTML = '<p style="font-size:13px; color:#9ca3af; text-align:center; padding: 20px;">Şablon tapılmadı</p>';
        return;
    }

    list.forEach(template => {
        const div = document.createElement('div');
        div.className = 'template-option-item';
        div.innerHTML = `
            <div>
                <strong style="color: #fff; font-size: 15px;">${template.name}</strong>
                <span style="display: block; font-size: 11px; color: #a5b4fc; margin-top: 2px;">${template.items.length} məhsul</span>
            </div>
            <span style="color: #5bc0be; font-size: 13px; font-weight: 600;">Seç ›</span>
        `;

        div.addEventListener('click', () => {
            invoiceItems = template.items.map(item => ({
                name: item.name,
                qty: item.qty || 1,
                price: item.price || 0
            }));
            renderItems();

            if (selectedTemplateText) {
                selectedTemplateText.textContent = template.name;
            }

            if (customSelectModal) customSelectModal.style.display = 'none';
            showNotification(`"${template.name}" şablonu tətbiq edildi`, "success");
        });

        templateListContainer.appendChild(div);
    });
}

// Yarımçıq qalmış qaiməni yadda saxlayan funksiya
function saveDraftToLocalStorage() {
    const draftData = {
        customerName: customerInput ? customerInput.value : '',
        invoiceDate: dateInput ? dateInput.value : '',
        items: invoiceItems,
        currentActiveDocId: currentActiveDocId
    };
    localStorage.setItem('invoice_draft', JSON.stringify(draftData));
}