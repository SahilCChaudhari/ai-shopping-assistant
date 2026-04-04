const BASE_URL = "";
let activeTab = "products";

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

function renderWebProducts(data) {
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    resultsDiv.innerHTML = `<p>No web results found</p>`;
    return;
  }

  data.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <h3>${product.name || "No title"}</h3>
      <p><b>Source:</b> ${product.source || "Web"}</p>
      <p><b>Price:</b> ${product.price || "N/A"}</p>
      <p>${product.description || ""}</p>
      ${product.image ? `<img src="${product.image}" width="120" alt="product image">` : ""}
      <br/>
      ${product.link ? `<a href="${product.link}" target="_blank">View Product</a>` : ""}
    `;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-add";
    btn.textContent = "Add to Cart";

    btn.addEventListener("click", async () => {
      btn.textContent = "Adding...";
      btn.disabled = true;

      try {
        const response = await fetch(`${BASE_URL}/cart/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: product.name,
            price: product.price,
            description: product.description,
            category: product.source || "Web",
            image: product.image,
            link: product.link,
            quantity: 1
          })
        });

        const result = await response.json();

        if (!response.ok) {
          alert(result.error || "Failed to add item");
          btn.textContent = "Add to Cart";
          btn.disabled = false;
          return;
        }

        btn.textContent = "✓ Added!";
        updateCartCount();

        setTimeout(() => {
          btn.textContent = "Add to Cart";
          btn.disabled = false;
        }, 1500);
      } catch (error) {
        alert("Error adding to cart");
        btn.textContent = "Add to Cart";
        btn.disabled = false;
      }
    });

    card.appendChild(btn);
    resultsDiv.appendChild(card);
  });

  switchTab("products");
}

async function searchWebProducts() {
  const keyword = document.getElementById("searchInput").value.trim();
  const maxPrice = document.getElementById("maxPrice").value;
  const resultsDiv = document.getElementById("results");

  try {
    const body = { keyword };
    if (maxPrice) body.max_price = parseFloat(maxPrice);

    const response = await fetch(`${BASE_URL}/web-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      resultsDiv.innerHTML = `<p>${data.error || "Web search failed"}</p>`;
      return;
    }

    renderWebProducts(data);
  } catch (error) {
    console.error("Web search error:", error);
    resultsDiv.innerHTML = `<p>Web search failed</p>`;
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
          ${item.product.image ? `<img src="${item.product.image}" width="120" alt="product image">` : ""}
          ${item.product.link ? `<p><a href="${item.product.link}" target="_blank">View Product</a></p>` : ""}
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
};

function startVoiceSearch() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

  recognition.lang = "en-US";
  recognition.start();

  recognition.onresult = function(event) {
    const speechResult = event.results[0][0].transcript;
    document.getElementById("searchInput").value = speechResult;
    searchWebProducts();
  };

  recognition.onerror = function(event) {
    console.error("Voice recognition error", event);
  };
}