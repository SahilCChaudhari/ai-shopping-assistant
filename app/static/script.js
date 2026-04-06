const BASE_URL = "";
let activeTab = "products";
let compareList = [];
let lastResultsData = null;
let selectedImageFile = null;

function switchTab(name) {
    activeTab = name;

    document.querySelectorAll(".tab").forEach(tab => {
        tab.classList.remove("active");
    });

    document.querySelectorAll(".panel").forEach(panel => {
        panel.classList.remove("active");
    });

    const tabBtn = document.getElementById(`tab-${name}`);
    const panel = document.getElementById(`panel-${name}`);

    if (tabBtn) tabBtn.classList.add("active");
    if (panel) panel.classList.add("active");
}

function toggleImageSearch() {
    const section = document.getElementById("imageSearchSection");
    const btn = document.getElementById("cameraToggleBtn");

    if (!section || !btn) return;

    const isHidden = section.style.display === "none" || section.style.display === "";

    if (isHidden) {
        section.style.display = "block";
        btn.style.background = "#2f6fed";
        btn.style.color = "white";
    } else {
        section.style.display = "none";
        btn.style.background = "";
        btn.style.color = "";
    }
}

function getProductKey(product) {
    return `${product.name}|${product.source}|${product.price}`;
}

function toggleCompareProduct(product) {
    const key = getProductKey(product);
    const existingIndex = compareList.findIndex(item => getProductKey(item) === key);

    if (existingIndex !== -1) {
        compareList.splice(existingIndex, 1);
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
    if (lastResultsData) {
        renderWebProducts(lastResultsData);
    }
}

function updateCompareBar() {
    const existing = document.getElementById("compareBar");
    if (existing) {
        existing.remove();
    }

    const resultsDiv = document.getElementById("results");
    const bar = document.createElement("div");
    bar.id = "compareBar";
    bar.className = "product-card";
    bar.style.marginBottom = "20px";
    bar.style.padding = "16px";
    bar.style.border = "1px solid #444";

    const names = compareList.map(p => p.name).join(" vs ");

    bar.innerHTML = `
        <h3>Compare Products</h3>
        <p><b>Selected:</b> ${compareList.length}/4</p>
        <p>${names || "No products selected yet"}</p>
    `;

    const compareBtn = document.createElement("button");
    compareBtn.textContent = "Compare Now";
    compareBtn.disabled = compareList.length < 2;
    compareBtn.onclick = compareSelectedProducts;

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.style.marginLeft = "10px";
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
    if (existing) {
        existing.remove();
    }
}

function renderComparisonResult(data) {
    clearComparisonResult();

    const resultsDiv = document.getElementById("results");
    const box = document.createElement("div");
    box.id = "comparisonResult";
    box.className = "product-card";
    box.style.border = "2px solid #4f7cff";
    box.style.padding = "20px";
    box.style.marginBottom = "20px";

    const productsHtml = (data.products || []).map((product, index) => `
        <p><b>Product ${index + 1}:</b> ${product.name}</p>
    `).join("");

    box.innerHTML = `
        <h2>AI Product Comparison</h2>
        ${productsHtml}
        <hr/>
        <p style="white-space: pre-wrap;">${data.comparison || "No comparison available."}</p>
    `;

    const compareBar = document.getElementById("compareBar");
    if (compareBar) {
        compareBar.insertAdjacentElement("afterend", box);
    } else {
        resultsDiv.prepend(box);
    }
}

async function compareSelectedProducts() {
    if (compareList.length < 2 || compareList.length > 4) {
        alert("Select between 2 and 4 products to compare.");
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/compare-products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                products: compareList
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Comparison failed");
            return;
        }

        renderComparisonResult(data);
    } catch (error) {
        alert("Comparison failed");
    }
}

function renderBestProduct(bestProduct) {
    if (!bestProduct) return "";

    return `
        <div class="product-card" style="border: 2px solid gold; background: #fffbe6; color: #111; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h2>⭐ Best Overall Pick</h2>
            <h3>${bestProduct.name || "No title"}</h3>
            <p><b>Source:</b> ${bestProduct.source || "Web"}</p>
            <p><b>Price:</b> ${bestProduct.price || "N/A"}</p>
            <p>${bestProduct.description || ""}</p>
            ${bestProduct.image ? `<img src="${bestProduct.image}" width="120" alt="product image">` : ""}
            <br/>
            ${bestProduct.link ? `<a href="${bestProduct.link}" target="_blank">View Product</a>` : ""}
        </div>
    `;
}

function renderImageSearchSummary(data) {
    if (!data.parsed_image) return "";

    const parsed = data.parsed_image;

    return `
        <div class="product-card" style="border: 1px solid #4f7cff; padding: 16px; margin-bottom: 20px;">
            <h3>Image Search Detection</h3>
            <p><b>Search Query:</b> ${parsed.search_query || "N/A"}</p>
            <p><b>Brand:</b> ${parsed.brand || "Unknown"}</p>
            <p><b>Product Type:</b> ${parsed.product_type || "Unknown"}</p>
            <p><b>Color:</b> ${parsed.color || "Unknown"}</p>
            <p><b>Style:</b> ${parsed.style || "Unknown"}</p>
            <p><b>Material:</b> ${parsed.material || "Unknown"}</p>
        </div>
    `;
}

function renderProductCard(product) {
    const card = document.createElement("div");
    card.className = "product-card";

    const isSelected = compareList.some(item => getProductKey(item) === getProductKey(product));

    card.innerHTML = `
        <h3>${product.name || "No title"}</h3>
        <p><b>Source:</b> ${product.source || "Web"}</p>
        <p><b>Price:</b> ${product.price || "N/A"}</p>
        <p>${product.description || ""}</p>
        ${product.image ? `<img src="${product.image}" width="120" alt="product image">` : ""}
        <br/>
        ${product.link ? `<a href="${product.link}" target="_blank">View Product</a>` : ""}
    `;

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn-add";
    addBtn.textContent = "Add to Cart";

    addBtn.addEventListener("click", async () => {
        addBtn.textContent = "Adding...";
        addBtn.disabled = true;

        try {
            const response = await fetch(`${BASE_URL}/cart/add`, {
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

            const result = await response.json();

            if (!response.ok) {
                alert(result.error || "Failed to add item");
                addBtn.textContent = "Add to Cart";
                addBtn.disabled = false;
                return;
            }

            addBtn.textContent = "✓ Added!";
            updateCartCount();

            setTimeout(() => {
                addBtn.textContent = "Add to Cart";
                addBtn.disabled = false;
            }, 1500);
        } catch (error) {
            alert("Error adding to cart");
            addBtn.textContent = "Add to Cart";
            addBtn.disabled = false;
        }
    });

    const compareBtn = document.createElement("button");
    compareBtn.type = "button";
    compareBtn.textContent = isSelected ? "Remove Compare" : "Compare";
    compareBtn.style.marginLeft = "10px";
    compareBtn.onclick = () => toggleCompareProduct(product);

    card.appendChild(addBtn);
    card.appendChild(compareBtn);
    return card;
}

function renderWebProducts(data) {
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "";

    lastResultsData = data;

    const products = data.products || [];
    const bestProduct = data.best_product;

    if (!Array.isArray(products) || products.length === 0) {
        resultsDiv.innerHTML = `<p>No products found</p>`;
        return;
    }

    if (data.parsed_image) {
        resultsDiv.innerHTML += renderImageSearchSummary(data);
    }

    if (bestProduct) {
        resultsDiv.innerHTML += renderBestProduct(bestProduct);
    }

    const summary = document.createElement("p");
    summary.innerHTML = `<b>Showing ${products.length} result(s)</b>`;
    resultsDiv.appendChild(summary);

    products.forEach(product => {
        const card = renderProductCard(product);
        resultsDiv.appendChild(card);
    });

    updateCompareBar();
    switchTab("products");
}

async function searchWebProducts() {
    compareList = [];
    clearComparisonResult();

    const keyword = document.getElementById("searchInput").value.trim();
    const resultsDiv = document.getElementById("results");

    if (!keyword) {
        resultsDiv.innerHTML = `<p>Please enter a search query</p>`;
        return;
    }

    resultsDiv.innerHTML = `<p>Searching...</p>`;

    try {
        const response = await fetch(`${BASE_URL}/ai-search`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query: keyword
            })
        });

        const data = await response.json();

        if (!response.ok) {
            resultsDiv.innerHTML = `<p>${data.error || "AI search failed"}</p>`;
            return;
        }

        renderWebProducts(data);
    } catch (error) {
        console.error("AI search error:", error);
        resultsDiv.innerHTML = `<p>AI search failed</p>`;
    }
}

function setupImageDropZone() {
    const dropZone = document.getElementById("imageDropZone");
    const imageInput = document.getElementById("imageInput");
    const imagePreview = document.getElementById("imagePreview");

    if (!dropZone || !imageInput || !imagePreview) {
        return;
    }

    dropZone.addEventListener("click", () => imageInput.click());

    imageInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            handleSelectedImage(file);
        }
    });

    dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropZone.style.borderColor = "#4f7cff";
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.style.borderColor = "#666";
    });

    dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        dropZone.style.borderColor = "#666";

        const file = event.dataTransfer.files[0];
        if (file) {
            handleSelectedImage(file);
        }
    });

    function handleSelectedImage(file) {
        selectedImageFile = file;

        const reader = new FileReader();
        reader.onload = function (e) {
            imagePreview.innerHTML = `
                <p><b>Selected image:</b> ${file.name}</p>
                <img src="${e.target.result}" alt="Preview" style="max-width: 220px; border-radius: 8px; margin-top: 10px;" />
            `;
        };
        reader.readAsDataURL(file);
    }
}

async function findSimilarProductsFromImage() {
    const resultsDiv = document.getElementById("results");

    if (!selectedImageFile) {
        alert("Please drag and drop or choose an image first.");
        return;
    }

    compareList = [];
    clearComparisonResult();
    resultsDiv.innerHTML = `<p>Analyzing image and finding similar products...</p>`;

    try {
        const formData = new FormData();
        formData.append("image", selectedImageFile);

        const response = await fetch(`${BASE_URL}/image-search`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            resultsDiv.innerHTML = `<p>${data.error || "Image search failed"}</p>`;
            return;
        }

        renderWebProducts(data);
    } catch (error) {
        console.error("Image search error:", error);
        resultsDiv.innerHTML = `<p>Image search failed</p>`;
    }
}

async function updateCartCount() {
    try {
        const response = await fetch(`${BASE_URL}/cart`);
        const data = await response.json();

        let count = 0;
        data.forEach(item => {
            count += item.quantity;
        });

        document.getElementById("cartCount").textContent = count;
    } catch (error) {
        console.error("Failed to update cart count", error);
    }
}

async function viewCart() {
    const cartDiv = document.getElementById("cart");

    try {
        const response = await fetch(`${BASE_URL}/cart`);
        const data = await response.json();

        cartDiv.innerHTML = "";

        if (!data.length) {
            cartDiv.innerHTML = `<p>Cart is empty</p>`;
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
                    <p><b>Quantity:</b> ${item.quantity}</p>
                    <p><b>Price:</b> $${item.product.price}</p>
                    <p>${item.product.description || ""}</p>
                </div>
            `;

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "btn-delete";
            removeBtn.textContent = "Remove";

            removeBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();
                removeBtn.textContent = "Removing...";
                removeBtn.disabled = true;
                await removeFromCart(item.product.id);
            });

            card.appendChild(removeBtn);
            cartDiv.appendChild(card);
        });

        const summary = document.createElement("div");
        summary.className = "cart-summary";
        summary.innerHTML = `
            <p><b>Total: $${total.toFixed(2)}</b></p>
            <button type="button" id="checkoutBtn">Checkout</button>
        `;

        summary.querySelector("#checkoutBtn").addEventListener("click", checkout);
        cartDiv.appendChild(summary);

        updateCartCount();
        switchTab("cart");
    } catch (error) {
        cartDiv.innerHTML = `<p>Failed to load cart</p>`;
    }
}

async function removeFromCart(productId) {
    try {
        const response = await fetch(`${BASE_URL}/cart/remove`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: productId })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Failed to remove item");
            return;
        }

        await viewCart();
        updateCartCount();
        switchTab("cart");
    } catch (error) {
        alert("Error removing item");
    }
}

async function checkout() {
    try {
        const response = await fetch(`${BASE_URL}/checkout`, {
            method: "POST"
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Checkout failed");
            return;
        }

        alert(`✅ Order placed! Your Order ID is: ${data.order_id}`);
        document.getElementById("orderIdInput").value = data.order_id;
        updateCartCount();
        switchTab("track");
    } catch (error) {
        alert("Checkout failed");
    }
}

async function trackOrder() {
    const orderId = document.getElementById("orderIdInput").value;
    const statusDiv = document.getElementById("orderStatus");

    if (!orderId) {
        alert("Enter order ID");
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/order/${orderId}`);
        const data = await response.json();

        if (!response.ok) {
            statusDiv.innerHTML = `<p>Order not found</p>`;
            return;
        }

        statusDiv.innerHTML = `
            <div class="status-card">
                <p><b>Order ID:</b> ${data.id}</p>
                <p><b>Status:</b> ${data.status}</p>
                <p><b>Total:</b> $${data.total_amount}</p>
                <p><b>Created:</b> ${data.created_at}</p>
            </div>
        `;

        switchTab("track");
    } catch (error) {
        statusDiv.innerHTML = `<p>Server error</p>`;
    }
}

window.onload = function () {
    switchTab("products");
    updateCartCount();
    setupImageDropZone();
};

function startVoiceSearch() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

    recognition.lang = "en-US";
    recognition.start();

    recognition.onresult = function (event) {
        const speechResult = event.results[0][0].transcript;
        document.getElementById("searchInput").value = speechResult;
        searchWebProducts();
    };

    recognition.onerror = function (event) {
        console.error("Voice recognition error", event);
    };
}