const BASE_URL = "";
let activeTab = "products";
let compareList = [];
let lastResultsData = null;
let selectedImageFile = null;

/* ── LOADER ── */
function showLoader(text = "Loading…") {
  const overlay = document.getElementById("loaderOverlay");
  const label   = document.getElementById("loaderText");
  if (label)   label.textContent = text;
  if (overlay) overlay.classList.add("visible");
}

function hideLoader() {
  const overlay = document.getElementById("loaderOverlay");
  if (overlay) overlay.classList.remove("visible");
}

/* ── TAB SWITCHING ── */
function switchTab(name) {
  activeTab = name;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  const tabBtn = document.getElementById(`tab-${name}`);
  const panel  = document.getElementById(`panel-${name}`);
  if (tabBtn) tabBtn.classList.add("active");
  if (panel)  panel.classList.add("active");
}

/* ── IMAGE SEARCH TOGGLE ── */
function toggleImageSearch() {
  const section = document.getElementById("imageSearchSection");
  const btn     = document.getElementById("cameraToggleBtn");
  if (!section || !btn) return;
  const isHidden = section.style.display === "none" || section.style.display === "";
  section.style.display = isHidden ? "block" : "none";
  btn.classList.toggle("active", isHidden);
}

/* ── COMPARE HELPERS ── */
function getProductKey(product) {
  return `${product.name}|${product.source}|${product.price}`;
}

function toggleCompareProduct(product) {
  const key = getProductKey(product);
  const idx = compareList.findIndex(item => getProductKey(item) === key);
  if (idx !== -1) {
    compareList.splice(idx, 1);
  } else {
    if (compareList.length >= 4) {
      alert("You can compare up to 4 products at a time.");
      return;
    }
    compareList.push(product);
  }
  updateCompareBar();
  rerenderCurrentResults();
}

function rerenderCurrentResults() {
  if (lastResultsData) renderWebProducts(lastResultsData);
}

function updateCompareBar() {
  const existing = document.getElementById("compareBar");
  if (existing) existing.remove();

  const resultsDiv = document.getElementById("results");
  const bar = document.createElement("div");
  bar.id = "compareBar";
  bar.className = "product-card";
  bar.style.background = "#f0f6ff";
  bar.style.border = "1.5px solid #a8c4ef";

  const names = compareList.map(p => p.name).join(" · ");
  bar.innerHTML = `
    <h3>Compare</h3>
    <p><b>${compareList.length}/4 selected</b></p>
    <p style="color:var(--ink-2)">${names || "No products selected yet"}</p>
  `;

  const compareBtn = document.createElement("button");
  compareBtn.textContent = "Compare Now";
  compareBtn.className = "btn-action";
  compareBtn.style.marginTop = ".75rem";
  compareBtn.disabled = compareList.length < 2;
  compareBtn.onclick = compareSelectedProducts;

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  clearBtn.className = "btn-ghost";
  clearBtn.style.marginTop = ".75rem";
  clearBtn.onclick = () => {
    compareList = [];
    updateCompareBar();
    rerenderCurrentResults();
    clearComparisonResult();
  };

  bar.appendChild(compareBtn);
  bar.appendChild(clearBtn);
  resultsDiv.prepend(bar);
}

function clearComparisonResult() {
  const existing = document.getElementById("comparisonResult");
  if (existing) existing.remove();
}

function renderComparisonResult(data) {
  clearComparisonResult();
  const resultsDiv = document.getElementById("results");
  const box = document.createElement("div");
  box.id = "comparisonResult";
  box.className = "product-card";
  box.style.background = "#f5f0fe";
  box.style.border = "1.5px solid #c4b2f8";

  const productsHtml = (data.products || []).map((p, i) =>
    `<p><b>Product ${i + 1}:</b> ${p.name}</p>`
  ).join("");

  box.innerHTML = `
    <h2 style="font-family:'Fraunces',serif;color:#5c3fb0;margin-bottom:.75rem;">AI Comparison</h2>
    ${productsHtml}
    <hr style="border:none;border-top:1px solid #d4c8f8;margin:.75rem 0">
    <p style="white-space:pre-wrap;font-size:.9rem;color:var(--ink-2)">${data.comparison || "No comparison available."}</p>
  `;

  const compareBar = document.getElementById("compareBar");
  if (compareBar) compareBar.insertAdjacentElement("afterend", box);
  else resultsDiv.prepend(box);
}

async function compareSelectedProducts() {
  if (compareList.length < 2 || compareList.length > 4) {
    alert("Select 2–4 products to compare.");
    return;
  }
  showLoader("Comparing products…");
  try {
    const res = await fetch(`${BASE_URL}/compare-products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: compareList })
    });
    const data = await res.json();
    hideLoader();
    if (!res.ok) { alert(data.error || "Comparison failed"); return; }
    renderComparisonResult(data);
  } catch {
    hideLoader();
    alert("Comparison failed");
  }
}

/* ── RENDER HELPERS ── */
function renderBestProduct(bestProduct) {
  if (!bestProduct) return "";
  return `
    <div class="best-pick-card">
      <h3>${bestProduct.name || "No title"}</h3>
      <p><b>Source:</b> ${bestProduct.source || "Web"}</p>
      <p><b>Price:</b> ${bestProduct.price || "N/A"}</p>
      <p>${bestProduct.description || ""}</p>
      ${bestProduct.image ? `<img src="${bestProduct.image}" width="120" alt="product image">` : ""}
      ${bestProduct.link ? `<a href="${bestProduct.link}" target="_blank">View Product →</a>` : ""}
    </div>
  `;
}

function renderImageSearchSummary(data) {
  if (!data.parsed_image) return "";
  const p = data.parsed_image;
  return `
    <div class="img-summary-card">
      <h3>Image Detection</h3>
      <p><b>Query:</b> ${p.search_query || "N/A"}</p>
      <p>
        <b>Brand:</b> ${p.brand || "Unknown"} &nbsp;·&nbsp;
        <b>Type:</b> ${p.product_type || "Unknown"} &nbsp;·&nbsp;
        <b>Color:</b> ${p.color || "Unknown"}
      </p>
    </div>
  `;
}

function renderProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  const isSelected = compareList.some(item => getProductKey(item) === getProductKey(product));

  card.innerHTML = `
    <h3>${product.name || "No title"}</h3>
    <p><b>Source:</b> ${product.source || "Web"} &nbsp; <b>Price:</b> ${product.price || "N/A"}</p>
    <p>${product.description || ""}</p>
    ${product.image ? `<img src="${product.image}" width="120" alt="product image">` : ""}
    ${product.link ? `<a href="${product.link}" target="_blank">View Product →</a>` : ""}
  `;

  // Add to cart button
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-add";
  addBtn.textContent = "Add to Cart";
  addBtn.addEventListener("click", async () => {
    addBtn.textContent = "Adding…";
    addBtn.disabled = true;
    try {
      const res = await fetch(`${BASE_URL}/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: product.name,
          price: product.price,
          description: product.description,
          category: product.source || "Web",
          quantity: 1
        })
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || "Failed to add item");
        addBtn.textContent = "Add to Cart";
        addBtn.disabled = false;
        return;
      }
      addBtn.textContent = "✓ Added!";
      updateCartCount();
      setTimeout(() => { addBtn.textContent = "Add to Cart"; addBtn.disabled = false; }, 1500);
    } catch {
      alert("Error adding to cart");
      addBtn.textContent = "Add to Cart";
      addBtn.disabled = false;
    }
  });

  // Compare button
  const compareBtn = document.createElement("button");
  compareBtn.type = "button";
  compareBtn.className = isSelected ? "btn-compare selected" : "btn-compare";
  compareBtn.textContent = isSelected ? "✓ In Compare" : "Compare";
  compareBtn.onclick = () => toggleCompareProduct(product);

  card.appendChild(addBtn);
  card.appendChild(compareBtn);
  return card;
}

function renderWebProducts(data) {
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";
  lastResultsData = data;

  const products    = data.products || [];
  const bestProduct = data.best_product;

  if (!Array.isArray(products) || products.length === 0) {
    resultsDiv.innerHTML = `<div class="empty-state"><p>No products found. Try a different search.</p></div>`;
    return;
  }

  if (data.parsed_image) resultsDiv.innerHTML += renderImageSearchSummary(data);
  if (bestProduct)        resultsDiv.innerHTML += renderBestProduct(bestProduct);

  const label = document.createElement("p");
  label.className = "results-label";
  label.textContent = `${products.length} result${products.length !== 1 ? "s" : ""}`;
  resultsDiv.appendChild(label);

  products.forEach(product => resultsDiv.appendChild(renderProductCard(product)));
  updateCompareBar();
  switchTab("products");
}

/* ── SEARCH ── */
async function searchWebProducts() {
  compareList = [];
  clearComparisonResult();
  const keyword    = document.getElementById("searchInput").value.trim();
  const resultsDiv = document.getElementById("results");
  if (!keyword) {
    resultsDiv.innerHTML = `<div class="empty-state"><p>Please enter a search query.</p></div>`;
    return;
  }
  resultsDiv.innerHTML = "";
  showLoader("Searching for products…");
  try {
    const res = await fetch(`${BASE_URL}/ai-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: keyword })
    });
    const data = await res.json();
    hideLoader();
    if (!res.ok) {
      resultsDiv.innerHTML = `<div class="empty-state"><p>${data.error || "Search failed"}</p></div>`;
      return;
    }
    renderWebProducts(data);
  } catch {
    hideLoader();
    resultsDiv.innerHTML = `<div class="empty-state"><p>Search failed. Please try again.</p></div>`;
  }
}

/* ── IMAGE DROP ZONE SETUP ── */
function setupImageDropZone() {
  const dropZone     = document.getElementById("imageDropZone");
  const imageInput   = document.getElementById("imageInput");
  const imagePreview = document.getElementById("imagePreview");
  if (!dropZone || !imageInput || !imagePreview) return;

  dropZone.addEventListener("click", () => imageInput.click());
  imageInput.addEventListener("change", e => {
    if (e.target.files[0]) handleSelectedImage(e.target.files[0]);
  });
  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files[0]) handleSelectedImage(e.dataTransfer.files[0]);
  });

  function handleSelectedImage(file) {
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      imagePreview.innerHTML = `
        <p><b>${file.name}</b></p>
        <img src="${e.target.result}" alt="Preview" style="max-width:180px;border-radius:6px;margin-top:8px">
      `;
    };
    reader.readAsDataURL(file);
  }
}

async function findSimilarProductsFromImage() {
  if (!selectedImageFile) { alert("Please choose an image first."); return; }
  compareList = [];
  clearComparisonResult();
  document.getElementById("results").innerHTML = "";
  showLoader("Analyzing image…");
  try {
    const formData = new FormData();
    formData.append("image", selectedImageFile);
    const res  = await fetch(`${BASE_URL}/image-search`, { method: "POST", body: formData });
    const data = await res.json();
    hideLoader();
    if (!res.ok) {
      document.getElementById("results").innerHTML = `<div class="empty-state"><p>${data.error || "Image search failed"}</p></div>`;
      return;
    }
    renderWebProducts(data);
  } catch {
    hideLoader();
    document.getElementById("results").innerHTML = `<div class="empty-state"><p>Image search failed.</p></div>`;
  }
}

/* ── CART ── */
async function updateCartCount() {
  try {
    const res  = await fetch(`${BASE_URL}/cart`);
    const data = await res.json();
    let count = 0;
    data.forEach(item => count += item.quantity);
    document.getElementById("cartCount").textContent = count;
  } catch { /* silent */ }
}

async function viewCart() {
  const cartDiv = document.getElementById("cart");
  try {
    const res  = await fetch(`${BASE_URL}/cart`);
    const data = await res.json();
    cartDiv.innerHTML = "";

    if (!data.length) {
      cartDiv.innerHTML = `<div class="empty-state"><p>Your cart is empty.</p></div>`;
      updateCartCount();
      switchTab("cart");
      return;
    }

    let total = 0;
    data.forEach(item => {
      total += item.product.price * item.quantity;
      const card = document.createElement("div");
      card.className = "cart-card";
      card.innerHTML = `
        <div>
          <h3>${item.product.name}</h3>
          <p><b>Category:</b> ${item.product.category || "Web"}</p>
          <p><b>Qty:</b> ${item.quantity} &nbsp;·&nbsp; <b>Price:</b> $${item.product.price}</p>
          <p>${item.product.description || ""}</p>
        </div>
      `;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-delete";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async e => {
        e.preventDefault();
        e.stopPropagation();
        removeBtn.textContent = "Removing…";
        removeBtn.disabled = true;
        await removeFromCart(item.product.id);
      });
      card.appendChild(removeBtn);
      cartDiv.appendChild(card);
    });

    const summary = document.createElement("div");
    summary.className = "cart-summary";
    summary.innerHTML = `<p>Total: $${total.toFixed(2)}</p>`;
    const checkoutBtn = document.createElement("button");
    checkoutBtn.type = "button";
    checkoutBtn.id = "checkoutBtn";
    checkoutBtn.textContent = "Checkout →";
    checkoutBtn.addEventListener("click", checkout);
    summary.appendChild(checkoutBtn);
    cartDiv.appendChild(summary);

    updateCartCount();
    switchTab("cart");
  } catch {
    cartDiv.innerHTML = `<div class="empty-state"><p>Failed to load cart.</p></div>`;
  }
}

async function removeFromCart(productId) {
  try {
    const res = await fetch(`${BASE_URL}/cart/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Failed to remove item"); return; }
    await viewCart();
    updateCartCount();
    switchTab("cart");
  } catch {
    alert("Error removing item");
  }
}

// async function checkout() {
//   showLoader("Placing your order…");
//   try {
//     const res  = await fetch(`${BASE_URL}/checkout`, { method: "POST" });
//     const data = await res.json();
//     hideLoader();
//     if (!res.ok) { alert(data.message || "Checkout failed"); return; }
//     alert(`✅ Order placed! Order ID: ${data.order_id}`);
//     document.getElementById("orderIdInput").value = data.order_id;
//     updateCartCount();
//     switchTab("track");
//   } catch {
//     hideLoader();
//     alert("Checkout failed");
//   }
// }

async function checkout() {
    try {
        const response = await fetch(`${BASE_URL}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Checkout failed");
            return;
        }

        if (data.mode === "mock") {
            // Mock success - show confirmation
            alert(`✅ Order placed! Order ID: ${data.order_id}`);
            document.getElementById("orderIdInput").value = data.order_id;
            updateCartCount();
            switchTab("track");
        } else if (data.mode === "stripe") {
            // Redirect to Stripe's secure hosted checkout
            window.location.href = data.checkout_url;
        }
    } catch (error) {
        console.error("Checkout error:", error);
        alert("Checkout failed. Please try again.");
    }
}

/* ── ORDER TRACKING ── */
async function trackOrder() {
  const orderId   = document.getElementById("orderIdInput").value;
  const statusDiv = document.getElementById("orderStatus");
  if (!orderId) { alert("Enter an order ID"); return; }
  showLoader("Fetching order status…");
  try {
    const res  = await fetch(`${BASE_URL}/order/${orderId}`);
    const data = await res.json();
    hideLoader();
    if (!res.ok) {
      statusDiv.innerHTML = `<div class="empty-state"><p>Order not found.</p></div>`;
      return;
    }
    statusDiv.innerHTML = `
      <div class="status-card">
        <div class="status-badge">● ${data.status}</div>
        <p><b>Order ID:</b> ${data.id}</p>
        <p><b>Total:</b> $${data.total_amount}</p>
        <p><b>Placed:</b> ${data.created_at}</p>
      </div>
    `;
    switchTab("track");
  } catch {
    hideLoader();
    statusDiv.innerHTML = `<div class="empty-state"><p>Server error.</p></div>`;
  }
}

/* ── VOICE SEARCH ── */
function startVoiceSearch() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-US";
  recognition.start();
  recognition.onresult = e => {
    document.getElementById("searchInput").value = e.results[0][0].transcript;
    searchWebProducts();
  };
  recognition.onerror = e => console.error("Voice error", e);
}

/* ── INIT ── */
window.onload = function () {
  switchTab("products");
  updateCartCount();
  setupImageDropZone();
};