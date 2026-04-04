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

async function searchProducts() {
  const keyword = document.getElementById("searchInput").value.trim();
  const maxPrice = document.getElementById("maxPrice").value;
  const resultsDiv = document.getElementById("results");

  try {
    const body = { keyword };
    if (maxPrice) body.max_price = parseFloat(maxPrice);

    const response = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    resultsDiv.innerHTML = "";

    if (!data.length) {
      resultsDiv.innerHTML = `<p>No products found</p>`;
      return;
    }

    data.forEach(product => {
      const card = document.createElement("div");
      card.className = "product-card";

      card.innerHTML = `
        <h3>${product.name}</h3>
        <p><b>Category:</b> ${product.category}</p>
        <p><b>Price:</b> $${product.price}</p>
        <p>${product.description}</p>
      `;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-add";
      btn.textContent = "Add to Cart";

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.textContent = "Adding...";
        btn.disabled = true;
        await addToCart(product.id, btn);
      });

      card.appendChild(btn);
      resultsDiv.appendChild(card);
    });

    switchTab("products");
  } catch (error) {
    resultsDiv.innerHTML = `<p>Server error</p>`;
  }
}

async function addToCart(productId, btn) {
  try {
    const response = await fetch(`${BASE_URL}/cart/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, quantity: 1 })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Failed to add item");
      btn.textContent = "Add to Cart";
      btn.disabled = false;
      return;
    }

    btn.textContent = "✓ Added!";
    btn.style.background = "green";

    setTimeout(() => {
      btn.textContent = "Add to Cart";
      btn.style.background = "";
      btn.disabled = false;
    }, 1500);

    switchTab("products");
  } catch (error) {
    alert("Error adding to cart");
    btn.textContent = "Add to Cart";
    btn.disabled = false;
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
          <p>Quantity: ${item.quantity}</p>
          <p>Price: $${item.product.price}</p>
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
};