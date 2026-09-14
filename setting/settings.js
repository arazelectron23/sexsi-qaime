import { db } from "../firebase.js"; 
import { 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    updateDoc, 
    doc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const productForm = document.getElementById('product-form');
const templateForm = document.getElementById('template-form');
const baseProductsList = document.getElementById('base-products-list');
const templateProductsSelector = document.getElementById('template-products-selector');
const baseTemplatesList = document.getElementById('base-templates-list');

let allGlobalProducts = [];

function showNotification(message, type = 'success') {
    const oldNotification = document.getElementById('custom-notification');
    if (oldNotification) oldNotification.remove();

    const notification = document.createElement('div');
    notification.id = 'custom-notification';
    notification.innerText = message;

    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '10px 18px',          // Daha kiçik və yığcam padding
        borderRadius: '8px',
        color: '#ffffff',
        fontWeight: '600',             // Şrift qalınlığı normallaşdırıldı
        fontSize: '14px',              // Şrift ölçüsü kiçildildi
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        transition: 'all 0.3s ease',
        opacity: '0',
        transform: 'translateX(50px)'
    });

    if (type === 'success') {
        notification.style.backgroundColor = '#10b981';
        notification.style.borderLeft = '5px solid #059669'; // Sol sərhəd incəldildi
    } else {
        notification.style.backgroundColor = '#ef4444';
        notification.style.borderLeft = '5px solid #dc2626'; // Sol sərhəd incəldildi
    }

    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 20);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(50px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadSettingsData();

    // Accordion menyular
    const toggleHeader = document.getElementById('toggle-products-header');
    const productsList = document.getElementById('base-products-list');
    const headerArrow = document.getElementById('header-arrow');

    if (toggleHeader && productsList && headerArrow) {
        toggleHeader.addEventListener('click', () => {
            productsList.classList.toggle('active');
            headerArrow.classList.toggle('rotate-arrow');
        });
    }

    const toggleTemplateHeader = document.getElementById('toggle-template-header');
    const templateSelector = document.getElementById('template-products-selector');
    const templateArrow = document.getElementById('template-arrow');

    if (toggleTemplateHeader && templateSelector && templateArrow) {
        toggleTemplateHeader.addEventListener('click', () => {
            templateSelector.classList.toggle('active');
            templateArrow.classList.toggle('rotate-arrow');
        });
    }
});

// Bütün məlumatları yükləyən tək və əsas funksiya
async function loadSettingsData() {
    await fetchBaseProducts();
    await fetchBaseTemplates();
    await fetchCustomTemplates();
}

async function fetchBaseProducts() {
    if (!baseProductsList || !templateProductsSelector) return;
    
    baseProductsList.innerHTML = 'Yüklənir...';
    templateProductsSelector.innerHTML = '';

    try {
        const q = query(collection(db, "base_products"), orderBy("name"));
        const snap = await getDocs(q);
        
        baseProductsList.innerHTML = '';
        allGlobalProducts = [];

        if (snap.empty) {
            baseProductsList.innerHTML = '<p style="color:#9ca3af; font-size:12px;">Baza boşdur.</p>';
            templateProductsSelector.innerHTML = '<p style="color:#9ca3af; font-size:12px;">Əvvəlcə məhsul əlavə edin.</p>';
            return;
        }

        snap.forEach((docSnapshot) => {
            const prod = docSnapshot.data();
            const prodId = docSnapshot.id;
            
            allGlobalProducts.push({ id: prodId, ...prod });

            const pDiv = document.createElement('div');
            pDiv.className = 'setting-row-item';
            pDiv.id = `product-row-${prodId}`;
            pDiv.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%;">
                    <div style="flex: 1; word-break: break-word; color: #fff; font-size: 14px; text-align: left;">
                        ${prod.name}
                    </div>
                    <div class="action-area" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <span style="background: rgba(91, 192, 190, 0.1); border: 1px solid #5bc0be; color: #5bc0be; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; white-space: nowrap;">
                            ${prod.price.toFixed(2)} AZN
                        </span>
                        <button class="btn-edit-setting" onclick="enableProductEdit('${prodId}', '${prod.name.replace(/'/g, "\\'")}', ${prod.price})" style="background: #f59e0b; border: none; border-radius: 6px; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✏️</button>
                        <button class="btn-delete-setting" data-id="${prodId}" style="background-color: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 13px; font-weight: bold; cursor: pointer;">Sil</button>
                    </div>
                </div>
            `;
            
            const btnDeleteProd = pDiv.querySelector('.btn-delete-setting');
            const actionArea = pDiv.querySelector('.action-area');

            btnDeleteProd.addEventListener('click', (e) => {
                e.stopPropagation();
                btnDeleteProd.style.display = 'none';

                const editBtn = pDiv.querySelector('.btn-edit-setting');
                if (editBtn) editBtn.style.display = 'none';

                const confirmBox = document.createElement('div');
                confirmBox.className = 'setting-item-confirm-box';
                confirmBox.style.display = 'inline-flex';
                confirmBox.style.alignItems = 'center';
                confirmBox.innerHTML = `
                    <span style="font-size:12px; color:#ef4444; margin-right:5px; font-weight:bold;">Silinsin?</span>
                    <button class="btn-confirm-yes" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Bəli</button>
                    <button class="btn-confirm-no" style="background:#4b5563; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Xeyr</button>
                `;

                confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                    eSub.stopPropagation();
                    try {
                        await deleteDoc(doc(db, "base_products", prodId));
                        showNotification("Məhsul uğurla silindi!", "success");
                        loadSettingsData();
                    } catch (err) {
                        console.error("Məhsul silinmədi:", err);
                        showNotification("Məhsulu silmək mümkün olmadı!", "error");
                    }
                });

                confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                    eSub.stopPropagation();
                    confirmBox.remove();
                    btnDeleteProd.style.display = 'block';
                    if (editBtn) editBtn.style.display = 'block';
                });

                actionArea.appendChild(confirmBox);
            });

            baseProductsList.appendChild(pDiv);

            const label = document.createElement('label');
            label.className = 'checkbox-item';
            label.innerHTML = `
                <div class="checkbox-left">
                    <input type="checkbox" value="${prodId}" data-name="${prod.name}" data-price="${prod.price}">
                    <span style="font-weight: 500;">${prod.name}</span>
                </div>
                <span class="checkbox-price-tag">${prod.price.toFixed(2)} AZN</span>
            `;

            const checkbox = label.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    label.classList.add('checked-active');
                } else {
                    label.classList.remove('checked-active');
                }
            });

            templateProductsSelector.appendChild(label);
        });
    } catch (e) {
        console.error(e);
    }
}

window.enableProductEdit = function(id, currentName, currentPrice) {
    const row = document.getElementById(`product-row-${id}`);
    if (!row) return;

    row.innerHTML = `
        <div class="edit-input-group">
            <input type="text" class="edit-input-name" id="edit-name-${id}" value="${currentName}" autocomplete="off">
            <input type="number" class="edit-input-price" id="edit-price-${id}" value="${currentPrice}" step="0.01" autocomplete="off">
        </div>
        <div class="action-buttons" style="margin-left: 8px;">
            <button class="btn-save-edit" onclick="saveProductEdit('${id}')">💾</button>
            <button class="btn-cancel-edit" onclick="cancelProductEdit('${id}', '${currentName.replace(/'/g, "\\'")}', ${currentPrice})">❌</button>
        </div>
    `;
}

window.cancelProductEdit = function(id, name, price) {
    const row = document.getElementById(`product-row-${id}`);
    if (!row) return;

    row.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%;">
            <div style="flex: 1; word-break: break-word; color: #fff; font-size: 14px; text-align: left;">
                ${name}
            </div>
            <div class="action-area" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <span style="background: rgba(91, 192, 190, 0.1); border: 1px solid #5bc0be; color: #5bc0be; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; white-space: nowrap;">
                    ${Number(price).toFixed(2)} AZN
                </span>
                <button class="btn-edit-setting" onclick="enableProductEdit('${id}', '${name.replace(/'/g, "\\'")}', ${price})" style="background: #f59e0b; border: none; border-radius: 6px; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✏️</button>
                <button class="btn-delete-setting" data-id="${id}" style="background-color: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 13px; font-weight: bold; cursor: pointer;">Sil</button>
            </div>
        </div>
    `;

    const btnDeleteProd = row.querySelector('.btn-delete-setting');
    const actionArea = row.querySelector('.action-area');

    btnDeleteProd.addEventListener('click', (e) => {
        e.stopPropagation();
        btnDeleteProd.style.display = 'none';

        const editBtn = row.querySelector('.btn-edit-setting');
        if (editBtn) editBtn.style.display = 'none';

        const confirmBox = document.createElement('div');
        confirmBox.className = 'setting-item-confirm-box';
        confirmBox.style.display = 'inline-flex';
        confirmBox.style.alignItems = 'center';
        confirmBox.innerHTML = `
            <span style="font-size:12px; color:#ef4444; margin-right:5px; font-weight:bold;">Silinsin?</span>
            <button class="btn-confirm-yes" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Bəli</button>
            <button class="btn-confirm-no" style="background:#4b5563; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Xeyr</button>
        `;

        confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
            eSub.stopPropagation();
            try {
                await deleteDoc(doc(db, "base_products", id));
                showNotification("Məhsul sistemdən silindi!", "success");
                loadSettingsData();
            } catch (err) {
                console.error("Məhsul silinmədi:", err);
                showNotification("Xəta: Məhsul silinə bilmədi!", "error");
            }
        });

        confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
            eSub.stopPropagation();
            confirmBox.remove();
            btnDeleteProd.style.display = 'block';
            if (editBtn) editBtn.style.display = 'block';
        });

        actionArea.appendChild(confirmBox);
    });
}

window.saveProductEdit = async function(id) {
    const newName = document.getElementById(`edit-name-${id}`).value.trim();
    const newPrice = parseFloat(document.getElementById(`edit-price-${id}`).value);

    if (!newName || isNaN(newPrice)) {
        showNotification("Zəhmət olmasa ad və qiyməti düzgün daxil edin!", "error");
        return;
    }

    try {
        await updateDoc(doc(db, "base_products", id), { 
            name: newName, 
            price: newPrice 
        });
        showNotification("Məhsul məlumatları yeniləndi!", "success");
        await loadSettingsData();
    } catch (error) {
        console.error("Xəta baş verdi:", error);
        showNotification("Məlumatı yeniləmək mümkün olmadı!", "error");
    }
}

if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('setting-item-name');
        const priceInput = document.getElementById('setting-item-price');

        const name = nameInput.value.trim();
        const price = parseFloat(priceInput.value) || 0;

        if (!name) return;

        try {
            await addDoc(collection(db, "base_products"), { name, price });
            showNotification("Yeni məhsul bazaya əlavə edildi!", "success");
            nameInput.value = '';
            priceInput.value = '';
            loadSettingsData();
        } catch(err) {
            console.error(err);
            showNotification("Məhsul əlavə edilərkən xəta baş verdi!", "error");
        }
    });
}

let pendingTemplateData = null;

if (templateForm) {
    templateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const templateNameInput = document.getElementById('template-name');
        const tName = templateNameInput.value.trim();

        if (!tName) {
            showNotification("Şablon adı daxil edin!", "error");
            return;
        }

        const checkedBoxes = templateProductsSelector.querySelectorAll('input[type="checkbox"]:checked');
        const selectedItems = [];

        checkedBoxes.forEach(box => {
            selectedItems.push({
                name: box.getAttribute('data-name'),
                price: parseFloat(box.getAttribute('data-price')) || 0,
                qty: 1 // İlkin olaraq 1 götürülür, modalda istifadəçi dəyişə biləcək
            });
        });

        if (selectedItems.length === 0) {
            showNotification("Şablona ən azı bir məhsul seçməlisiniz!", "error");
            return;
        }

        pendingTemplateData = { name: tName, items: selectedItems };
        openNewTemplateConfirmationModal(pendingTemplateData);
    });
}

function openNewTemplateConfirmationModal(data) {
    const modal = document.getElementById('new-template-modal');
    const nameInput = document.getElementById('confirm-template-name');
    const container = document.getElementById('confirm-template-checkboxes');

    if (!modal || !nameInput || !container) return;

    nameInput.value = data.name;
    container.innerHTML = '';

    data.items.forEach(item => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(91, 192, 190, 0.1); border: 1px solid #5bc0be; border-radius: 8px; font-size: 14px; color: #e2e8f0;';
        
        label.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; flex: 1;">
                <input type="checkbox" checked disabled style="accent-color: #5bc0be; width:16px; height:16px;">
                <span>${item.name}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <input type="number" class="confirm-item-qty" value="${item.qty}" min="1" step="1" style="width: 55px; padding: 4px; text-align: center; background: #090915; border: 1px solid #3d3d6b; color: #fff; border-radius: 4px;">
                <span style="color: #5bc0be; font-weight: bold;">${item.price.toFixed(2)} AZN</span>
            </div>
        `;
        container.appendChild(label);
    });

    modal.style.display = 'flex';
}

window.closeNewTemplateModal = function() {
    const modal = document.getElementById('new-template-modal');
    if (modal) modal.style.display = 'none';
}

window.finalizeNewTemplate = async function() {
    if (!pendingTemplateData) return;

    const container = document.getElementById('confirm-template-checkboxes');
    const qtyInputs = container.querySelectorAll('.confirm-item-qty');

    pendingTemplateData.items.forEach((item, index) => {
        const val = parseFloat(qtyInputs[index].value);
        item.qty = isNaN(val) || val < 1 ? 1 : val;
    });

    try {
        await addDoc(collection(db, "base_templates"), {
            templateName: pendingTemplateData.name,
            items: pendingTemplateData.items
        });
        
        showNotification("Yeni şablon uğurla yaradıldı!", "success");
        closeNewTemplateModal();
        
        document.getElementById('template-name').value = '';
        loadSettingsData();
    } catch (err) {
        console.error(err);
        showNotification("Şablon yaradıla bilmədi!", "error");
    }
}

async function fetchBaseTemplates() {
    if (!baseTemplatesList) return;
    
    baseTemplatesList.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <span>Şablonlar yüklənir...</span>
        </div>
    `;

    try {
        const snap = await getDocs(collection(db, "base_templates"));
        baseTemplatesList.innerHTML = '';

        if (snap.empty) {
            baseTemplatesList.innerHTML = '<p style="color:#9ca3af; font-size:12px;">Şablon tapılmadı.</p>';
            return;
        }

        snap.forEach((docSnapshot) => {
            const tData = docSnapshot.data();
            const tId = docSnapshot.id;

            const tDiv = document.createElement('div');
            tDiv.className = 'setting-row-item';
            tDiv.style.display = 'flex';
            tDiv.style.justifyContent = 'space-between';
            tDiv.style.alignItems = 'center';
            tDiv.style.padding = '12px 6px';

            tDiv.innerHTML = `
                <div>
                    <strong style="font-size: 15px; color: #fff;">${tData.templateName}</strong>
                    <span style="font-size:12px; color:#9ca3af; display:block; margin-top:2px;">(${tData.items.length} məhsul daxildir)</span>
                </div>
                <div class="action-area" style="display:inline-flex; align-items:center; gap: 8px;">
                    <button class="btn-edit-setting" style="background-color: #f59e0b; padding: 6px 10px; border-radius: 4px; border: none; cursor: pointer; color: white;" onclick="openTemplateModal('${tId}', '${tData.templateName.replace(/'/g, "\\'")}')">✏️</button>
                    <button class="btn-delete-setting" style="background-color:#ef4444; padding: 6px 10px; border-radius: 4px; border: none; cursor: pointer; color: white;">Sil</button>
                </div>
            `;

            const btnDeleteTemplate = tDiv.querySelector('.btn-delete-setting');
            const actionArea = tDiv.querySelector('.action-area');

            btnDeleteTemplate.addEventListener('click', (e) => {
                e.stopPropagation();
                btnDeleteTemplate.style.display = 'none';
                const editBtn = tDiv.querySelector('.btn-edit-setting');
                if (editBtn) editBtn.style.display = 'none';

                const confirmBox = document.createElement('div');
                confirmBox.className = 'setting-item-confirm-box';
                confirmBox.style.display = 'inline-flex';
                confirmBox.style.alignItems = 'center';
                confirmBox.innerHTML = `
                    <span style="font-size:12px; color:#ef4444; margin-right:5px; font-weight:bold;">Silinsin?</span>
                    <button class="btn-confirm-yes" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Bəli</button>
                    <button class="btn-confirm-no" style="background:#4b5563; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Xeyr</button>
                `;

                confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                    eSub.stopPropagation();
                    try {
                        await deleteDoc(doc(db, "base_templates", tId));
                        showNotification("Şablon uğurla silindi!", "success");
                        loadSettingsData();
                    } catch (err) {
                        console.error("Şablon silinmədi:", err);
                        showNotification("Şablon silinə bilmədi!", "error");
                    }
                });

                confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                    eSub.stopPropagation();
                    confirmBox.remove();
                    btnDeleteTemplate.style.display = 'block';
                    if (editBtn) editBtn.style.display = 'block';
                });

                actionArea.appendChild(confirmBox);
            });

            baseTemplatesList.appendChild(tDiv);
        });
    } catch (e) {
        console.error(e);
        baseTemplatesList.innerHTML = '<p style="color:#ef4444; font-size:12px;">Şablonları yükləyərkən xəta baş verdi.</p>';
    }
}

window.openTemplateModal = async function(tId, currentName) {
    const modal = document.getElementById('template-modal');
    const idInput = document.getElementById('modal-template-id');
    const nameInput = document.getElementById('modal-template-name');
    const checkboxesContainer = document.getElementById('modal-template-checkboxes');

    if (!modal || !idInput || !nameInput || !checkboxesContainer) return;

    idInput.value = tId;
    nameInput.value = currentName;
    checkboxesContainer.innerHTML = 'Məhsullar yüklənir...';

    modal.style.display = 'flex';

    try {
        const tempDoc = allGlobalProducts;
        const templateSnap = await getDocs(collection(db, "base_templates"));
        let currentTemplateItems = [];
        
        templateSnap.forEach(d => {
            if (d.id === tId) {
                currentTemplateItems = d.data().items || [];
            }
        });

        checkboxesContainer.innerHTML = '';

        tempDoc.forEach(prod => {
           const existingItem = currentTemplateItems.find(item => item.name === prod.name);
    const isChecked = !!existingItem;
    const currentQty = existingItem ? (existingItem.qty || 1) : 1;

    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.justifyContent = 'space-between';
    label.style.padding = '10px 14px';
    label.style.background = isChecked ? 'rgba(91, 192, 190, 0.1)' : '#16162a';
    label.style.border = isChecked ? '1px solid #5bc0be' : '1px solid #2e2e4f';
    label.style.borderRadius = '8px';
    label.style.cursor = 'pointer';
    label.style.fontSize = '14px';
    label.style.color = '#e2e8f0';
    label.style.transition = 'all 0.15s ease';

    label.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; flex: 1;">
            <input type="checkbox" value="${prod.id}" data-name="${prod.name}" data-price="${prod.price}" ${isChecked ? 'checked' : ''} style="accent-color: #5bc0be; width:16px; height:16px; cursor:pointer;">
            <span>${prod.name}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
            <input type="number" class="modal-item-qty" value="${currentQty}" min="1" step="1" style="width: 55px; padding: 4px; text-align: center; background: #090915; border: 1px solid #3d3d6b; color: #fff; border-radius: 4px;" onclick="event.stopPropagation()">
            <span style="color: #5bc0be; font-weight: bold;">${prod.price.toFixed(2)} AZN</span>
        </div>
    `;

            const cb = label.querySelector('input[type="checkbox"]');
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    label.style.background = 'rgba(91, 192, 190, 0.1)';
                    label.style.borderColor = '#5bc0be';
                } else {
                    label.style.background = '#16162a';
                    label.style.borderColor = '#2e2e4f';
                }
            });

            checkboxesContainer.appendChild(label);
        });

    } catch (err) {
        console.error("Məhsul siyahılaşdırılması zamanı xəta:", err);
        checkboxesContainer.innerHTML = 'Məhsulları yükləmək mümkün olmadı.';
    }
}

window.closeTemplateModal = function() {
    const modal = document.getElementById('template-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.saveTemplateModalFromModal = async function() {
    const tId = document.getElementById('modal-template-id').value;
    const nameInput = document.getElementById('modal-template-name');
    const checkboxesContainer = document.getElementById('modal-template-checkboxes');

    if (!tId || !nameInput || !checkboxesContainer) return;

    const newTemplateName = nameInput.value.trim();
    if (!newTemplateName) {
        showNotification("Şablon adı boş ola bilməz!", "error");
        return;
    }

    const checkedBoxes = checkboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
    const updatedItems = [];

    checkedBoxes.forEach(box => {
        updatedItems.push({
            name: box.getAttribute('data-name'),
            price: parseFloat(box.getAttribute('data-price')) || 0,
            qty: 1
        });
    });

    if (updatedItems.length === 0) {
        showNotification("Şablonda ən azı bir məhsul saxlamalısınız!", "error");
        return;
    }

    try {
        await updateDoc(doc(db, "base_templates", tId), {
            templateName: newTemplateName,
            items: updatedItems
        });
        
        showNotification("Şablon uğurla yeniləndi!", "success");
        closeTemplateModal();
        loadSettingsData();
    } catch (error) {
        console.error("Şablon yenilənmədi:", error);
        showNotification("Yadda saxlamaq mümkün olmadı!", "error");
    }
}

async function fetchCustomTemplates() {
    const customListContainer = document.getElementById('custom-templates-settings-list');
    if (!customListContainer) return;

    // Əgər struktur hələ qurulmayıbsa, əvvəlcə konteyneri təmizləyib yeni elementləri yaradırıq
    if (!customListContainer.querySelector('.special-main-wrapper')) {
        customListContainer.innerHTML = ''; // Köhnə statik başlığı tamamilə təmizləyirik

        const wrapper = document.createElement('div');
        wrapper.className = 'special-main-wrapper';
        wrapper.style.cssText = 'border: 1px solid #2e2e4f; border-radius: 8px; background: #16162a; overflow: hidden;';
        wrapper.innerHTML = `
            <div id="special-templates-header" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: #1f1f38;">
                <span style="font-size: 15px; font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                    ⭐ Xüsusi Yadda Saxlanılan Şablonlar
                </span>
                <span id="special-arrow" style="color: #9ca3af; font-size: 16px; font-weight: bold; transition: transform 0.2s ease;">&gt;</span>
            </div>
            <div id="special-templates-inner-content" style="display: none; padding: 12px; flex-direction: column; gap: 10px; border-top: 1px solid #2e2e4f;">
                <p style="color:#9ca3af; font-size:12px; text-align:center; margin:0;">Yüklənir...</p>
            </div>
        `;
        customListContainer.appendChild(wrapper);

        const header = wrapper.querySelector('#special-templates-header');
        const innerContent = wrapper.querySelector('#special-templates-inner-content');
        const arrow = wrapper.querySelector('#special-arrow');

        header.addEventListener('click', () => {
            if (innerContent.style.display === 'none') {
                innerContent.style.display = 'flex';
                arrow.style.transform = 'rotate(90deg)'; // Açıldıqda aşağı baxır
            } else {
                innerContent.style.display = 'none';
                arrow.style.transform = 'rotate(0deg)';  // Bağlı olduqda sağa baxır
            }
        });
    }

    const targetListDiv = document.getElementById('special-templates-inner-content');
    if (!targetListDiv) return;
    
    try {
        const snap = await getDocs(collection(db, "special_templates"));
        
        // Köhnə siyahı elementlərini təmizləyirik
        const existingRows = targetListDiv.querySelectorAll('.setting-row-item');
        existingRows.forEach(r => r.remove());

        const loadingText = targetListDiv.querySelector('p');
        if (loadingText) loadingText.remove();

        if (snap.empty) {
            if (!targetListDiv.querySelector('.no-template-msg')) {
                const msg = document.createElement('p');
                msg.className = 'no-template-msg';
                msg.style.cssText = 'color:#9ca3af; font-size:12px; text-align:center; margin:0;';
                msg.textContent = 'Xüsusi yadda saxlanılan şablon yoxdur.';
                targetListDiv.appendChild(msg);
            }
            return;
        }

        const noMsg = targetListDiv.querySelector('.no-template-msg');
        if (noMsg) noMsg.remove();

        snap.forEach((docSnapshot) => {
            const tData = docSnapshot.data();
            const tId = docSnapshot.id;
            const itemCount = tData.items ? tData.items.length : 0;

            const rowDiv = document.createElement('div');
            rowDiv.className = 'setting-row-item';
            rowDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #1f1f38; border: 1px solid #2e2e4f; border-radius: 8px;';

            rowDiv.innerHTML = `
                <div>
                    <strong style="font-size: 15px; color: #fff;">⭐ ${tData.templateName || tData.name || 'Adsız Şablon'}</strong>
                    <span style="font-size:12px; color:#9ca3af; display:block; margin-top:2px;">(${itemCount} məhsul daxildir)</span>
                </div>
                <div class="custom-template-actions" style="display:inline-flex; align-items:center; gap: 8px;">
                    <button class="btn-edit-setting btn-edit-custom-template" style="background-color: #f59e0b; padding: 6px 10px; border-radius: 4px; border: none; cursor: pointer; color: white;" onclick="openSpecialTemplateModal('${tId}', '${(tData.templateName || tData.name || '').replace(/'/g, "\\'")}')">✏️</button>
                    <button class="btn-delete-setting btn-delete-custom-template" data-id="${tId}">Sil</button>
                </div>
            `;

            const deleteBtn = rowDiv.querySelector('.btn-delete-custom-template');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteBtn.style.display = 'none';

                const actionArea = rowDiv.querySelector('.custom-template-actions');
                const confirmBox = document.createElement('div');
                confirmBox.className = 'setting-item-confirm-box';
                confirmBox.style.cssText = 'display: inline-flex; align-items: center;';
                confirmBox.innerHTML = `
                    <span style="font-size:12px; color:#ef4444; margin-right:5px; font-weight:bold;">Silinsin?</span>
                    <button class="btn-confirm-yes" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Bəli</button>
                    <button class="btn-confirm-no" style="background:#4b5563; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Xeyr</button>
                `;

                confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                    eSub.stopPropagation();
                    try {
                        await deleteDoc(doc(db, "special_templates", tId));
                        showNotification("Şablon uğurla silindi!", "success");
                        fetchCustomTemplates();
                    } catch (err) {
                        console.error("Şablon silinmədi:", err);
                        showNotification("Şablonu silmək mümkün olmadı!", "error");
                    }
                });

                confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                    eSub.stopPropagation();
                    confirmBox.remove();
                    deleteBtn.style.display = 'block';
                });

                actionArea.appendChild(confirmBox);
            });

            targetListDiv.appendChild(rowDiv);
        });

    } catch (e) {
        console.error("Xüsusi şablonlar yüklənmədi:", e);
        targetListDiv.innerHTML = '<p style="color:#ef4444; font-size:12px; text-align:center; margin:0;">Şablonları yükləyərkən xəta baş verdi.</p>';
    }
}

// Xüsusi şablonu redaktə etmək üçün modalı açan funksiya
window.openSpecialTemplateModal = async function(tId, currentName) {
    const modal = document.getElementById('template-modal');
    const idInput = document.getElementById('modal-template-id');
    const nameInput = document.getElementById('modal-template-name');
    const checkboxesContainer = document.getElementById('modal-template-checkboxes');

    if (!modal || !idInput || !nameInput || !checkboxesContainer) return;

    idInput.value = tId;
    nameInput.value = currentName;
    checkboxesContainer.innerHTML = 'Məhsullar yüklənir...';

    modal.style.display = 'flex';

    try {
        // Bütün qlobal məhsulları alırıq
        const tempDoc = allGlobalProducts;
        
        // Həmin xüsusi şablonun öz məhsullarını tapırıq
        const templateSnap = await getDocs(collection(db, "special_templates"));
        let currentTemplateItems = [];
        
        templateSnap.forEach(d => {
            if (d.id === tId) {
                currentTemplateItems = d.data().items || [];
            }
        });

        checkboxesContainer.innerHTML = '';

       tempDoc.forEach(prod => {
    const existingItem = currentTemplateItems.some(item => item.name === prod.name);
    // Əgər məhsul şablonda varsa, onun qty dəyərini tapırıq
    const foundItemData = currentTemplateItems.find(item => item.name === prod.name);
    const currentQty = foundItemData ? (foundItemData.qty || 1) : 1;
    
    const isChecked = !!existingItem;

    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.justifyContent = 'space-between';
    label.style.padding = '10px 14px';
    label.style.background = isChecked ? 'rgba(91, 192, 190, 0.1)' : '#16162a';
    label.style.border = isChecked ? '1px solid #5bc0be' : '1px solid #2e2e4f';
    label.style.borderRadius = '8px';
    label.style.cursor = 'pointer';
    label.style.fontSize = '14px';
    label.style.color = '#e2e8f0';
    label.style.transition = 'all 0.15s ease';

    label.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; flex: 1;">
            <input type="checkbox" value="${prod.id}" data-name="${prod.name}" data-price="${prod.price}" ${isChecked ? 'checked' : ''} style="accent-color: #5bc0be; width:16px; height:16px; cursor:pointer;">
            <span>${prod.name}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
            <input type="number" class="modal-item-qty" value="${currentQty}" min="1" step="1" style="width: 55px; padding: 4px; text-align: center; background: #090915; border: 1px solid #3d3d6b; color: #fff; border-radius: 4px;" onclick="event.stopPropagation()">
            <span style="color: #5bc0be; font-weight: bold;">${prod.price.toFixed(2)} AZN</span>
        </div>
    `;

    const cb = label.querySelector('input[type="checkbox"]');
    cb.addEventListener('change', () => {
        if (cb.checked) {
            label.style.background = 'rgba(91, 192, 190, 0.1)';
            label.style.borderColor = '#5bc0be';
        } else {
            label.style.background = '#16162a';
            label.style.borderColor = '#2e2e4f';
        }
    });

    checkboxesContainer.appendChild(label);
});

        // Modalın yadda saxla düyməsinin funksiyasını special_templates üçün yönləndiririk
        window.saveTemplateModalFromModal = async function() {
            const idVal = document.getElementById('modal-template-id').value;
            const newName = nameInput.value.trim();
            
            if (!newName) {
                showNotification("Şablon adı boş ola bilməz!", "error");
                return;
            }

            const checkedBoxes = checkboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
            const updatedItems = [];

           checkedBoxes.forEach(box => {
    const rowItem = box.closest('label');
    const qtyInput = rowItem ? rowItem.querySelector('.modal-item-qty') : null;
    const qty = parseFloat(qtyInput ? qtyInput.value : 1) || 1;

    updatedItems.push({
        name: box.getAttribute('data-name'),
        price: parseFloat(box.getAttribute('data-price')) || 0,
        qty: qty
    });
});
            if (updatedItems.length === 0) {
                showNotification("Şablonda ən azı bir məhsul saxlamalısınız!", "error");
                return;
            }

            try {
                await updateDoc(doc(db, "special_templates", idVal), {
                    templateName: newName,
                    items: updatedItems
                });
                
                showNotification("Xüsusi şablon uğurla yeniləndi!", "success");
                closeTemplateModal();
                loadSettingsData();
            } catch (error) {
                console.error("Şablon yenilənmədi:", error);
                showNotification("Yadda saxlamaq mümkün olmadı!", "error");
            }
        };

    } catch (err) {
        console.error("Xüsusi şablon redaktə xətası:", err);
        checkboxesContainer.innerHTML = 'Məhsulları yükləmək mümkün olmadı.';
    }
}