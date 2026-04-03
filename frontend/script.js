const BASE_URL = "http://127.0.0.1:5000";

async function searchProducts() {
  const keyword = document.getElementById("searchInput").value;

  const response = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ keyword })
  });

  const data = await response.json();
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";

  data.forEach(product => {
    resultsDiv.innerHTML += `
    <div class="product">
        <h3>${product.name}</h3>
        <p>Price: $${product.price}</p>
        <button onclick="addToCart(${product.id})">Add to Cart</button>
    </div>
    `;
  });
}

async function addToCart(productId) {
  await fetch(`${BASE_URL}/cart/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ product_id: productId, quantity: 1 })
  });

  alert("Item added to cart");
}

async function viewCart() {
  const response = await fetch(`${BASE_URL}/cart`);
  const data = await response.json();

  const cartDiv = document.getElementById("cart");
  cartDiv.innerHTML = "";

  data.forEach(item => {
    cartDiv.innerHTML += `
      <div>
        <p>${item.product.name} - Quantity: ${item.quantity}</p>
      </div>
    `;
  });
}

async function checkout() {
  const response = await fetch(`${BASE_URL}/checkout`, {
    method: "POST"
  });

  const data = await response.json();
  alert(`Order placed. Order ID: ${data.order_id}`);
}

async function trackOrder() {
  const orderId = document.getElementById("orderIdInput").value;

  if (!orderId) {
    alert("Please enter an order ID");
    return;
  }

  const response = await fetch(`http://127.0.0.1:5000/order/${orderId}`);
  const data = await response.json();

  if (!response.ok) {
    document.getElementById("orderStatus").innerHTML = data.error || "Order not found";
    return;
  }

  document.getElementById("orderStatus").innerHTML =
    `Order Status: ${data.status}, Total: $${data.total_amount}`;
}