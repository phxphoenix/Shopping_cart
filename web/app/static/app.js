const state = {
  catalog: [],
  cart: [],
  customers: [],
  orders: [],
  selectedCatalogIndex: null,
  selectedCartIndex: null,
  selectedCustomerId: null,
  selectedOrderId: null,
};

const els = {
  catalog: document.getElementById("catalog"),
  cart: document.getElementById("cart"),
  customers: document.getElementById("customers"),
  orders: document.getElementById("orders"),
  orderDetails: document.getElementById("order-details"),
  totals: document.getElementById("totals"),
  qty: document.getElementById("qty"),
  addToCart: document.getElementById("add-to-cart"),
  removeFromCart: document.getElementById("remove-from-cart"),
  clearCart: document.getElementById("clear-cart"),
  customerName: document.getElementById("customer-name"),
  customerEmail: document.getElementById("customer-email"),
  addCustomer: document.getElementById("add-customer"),
  paymentMethod: document.getElementById("payment-method"),
  paymentFields: document.getElementById("payment-fields"),
  placeOrder: document.getElementById("place-order"),
  status: document.getElementById("status"),
};

function setStatus(msg) {
  els.status.textContent = msg;
}

function money(val) {
  return `${val.toFixed(2)} zl`;
}

function renderList(el, items, selectedId, idField = "id") {
  el.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item.label;
    if (selectedId !== null && item[idField] === selectedId) {
      li.classList.add("selected");
    }
    li.addEventListener("click", () => item.onClick && item.onClick());
    el.appendChild(li);
  });
}

function refreshCatalog() {
  const items = state.catalog.map((p, idx) => ({
    label: `${p.name} | ${money(p.price)} | ${p.category}`,
    id: idx,
    onClick: () => {
      state.selectedCatalogIndex = idx;
      refreshCatalog();
    },
  }));
  renderList(els.catalog, items, state.selectedCatalogIndex, "id");
}

function refreshCart() {
  const items = state.cart.map((p, idx) => ({
    label: `${p.name} x${p.qty} | ${money(p.price * p.qty)}`,
    id: idx,
    onClick: () => {
      state.selectedCartIndex = idx;
      refreshCart();
    },
  }));
  renderList(els.cart, items, state.selectedCartIndex, "id");

  const subtotal = state.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const delivery = subtotal >= 200 ? 0 : 15;
  const total = subtotal + delivery;
  els.totals.textContent = `Suma: ${money(subtotal)} | Dostawa: ${money(delivery)} | Total: ${money(total)}`;
}

function refreshCustomers() {
  const items = state.customers.map((c) => ({
    label: `${c.name}${c.email ? " | " + c.email : ""}`,
    id: c.id,
    onClick: () => {
      state.selectedCustomerId = c.id;
      refreshCustomers();
    },
  }));
  renderList(els.customers, items, state.selectedCustomerId, "id");
}

function refreshOrders() {
  const items = state.orders.map((o) => ({
    label: `${o.created_at} | ${o.customer.name} | ${money(o.total)}`,
    id: o.id,
    onClick: () => {
      state.selectedOrderId = o.id;
      renderOrderDetails(o);
      refreshOrders();
    },
  }));
  renderList(els.orders, items, state.selectedOrderId, "id");
}

function renderOrderDetails(order) {
  if (!order) {
    els.orderDetails.textContent = "";
    return;
  }
  const lines = [
    `Data: ${order.created_at}`,
    `Klient: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `Platnosc: ${order.payment_method}`,
    `Szczegoly: ${formatPayment(order.payment)}`,
    `Suma: ${money(order.subtotal)}`,
    `Dostawa: ${money(order.delivery)}`,
    `Total: ${money(order.total)}`,
    "",
    "Produkty:",
  ];
  order.items.forEach((i) => {
    lines.push(`- ${i.name} x${i.qty} (${money(i.price)})`);
  });
  els.orderDetails.textContent = lines.join("\n");
}

function formatPayment(p) {
  if (!p) return "-";
  if (p.method === "Karta kredytowa") return `nr ${p.card_number}, exp ${p.expiry}, cvv ${p.cvv}`;
  if (p.method === "PayPal") return `email ${p.paypal_email}`;
  if (p.method === "Bitcoin") return `portfel ${p.bitcoin_wallet}`;
  return p.method;
}

function renderPaymentFields() {
  const method = els.paymentMethod.value;
  els.paymentFields.innerHTML = "";

  if (method === "Karta kredytowa") {
    els.paymentFields.appendChild(makeInput("card_number", "Numer karty"));
    els.paymentFields.appendChild(makeInput("expiry", "Data waznosci (MM/RR)"));
    els.paymentFields.appendChild(makeInput("cvv", "CVV"));
  } else if (method === "PayPal") {
    els.paymentFields.appendChild(makeInput("paypal_email", "Email PayPal"));
  } else {
    els.paymentFields.appendChild(makeInput("bitcoin_wallet", "Adres portfela Bitcoin"));
  }
}

function makeInput(id, placeholder) {
  const input = document.createElement("input");
  input.className = "input";
  input.placeholder = placeholder;
  input.id = `payment-${id}`;
  return input;
}

async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadAll() {
  state.catalog = await apiGet("/api/catalog");
  state.customers = await apiGet("/api/customers");
  state.orders = await apiGet("/api/orders");
  refreshCatalog();
  refreshCart();
  refreshCustomers();
  refreshOrders();
}

els.addToCart.addEventListener("click", () => {
  if (state.selectedCatalogIndex === null) return setStatus("Wybierz produkt z katalogu.");
  const qty = parseInt(els.qty.value || "1", 10);
  if (Number.isNaN(qty) || qty <= 0) return setStatus("Ilosc musi byc > 0.");
  const product = state.catalog[state.selectedCatalogIndex];
  const existing = state.cart.find((c) => c.name === product.name);
  if (existing) existing.qty += qty;
  else state.cart.push({ ...product, qty });
  refreshCart();
  setStatus(`Dodano: ${product.name} x${qty}`);
});

els.removeFromCart.addEventListener("click", () => {
  if (state.selectedCartIndex === null) return setStatus("Wybierz produkt w koszyku.");
  state.cart.splice(state.selectedCartIndex, 1);
  state.selectedCartIndex = null;
  refreshCart();
  setStatus("Usunieto z koszyka.");
});

els.clearCart.addEventListener("click", () => {
  state.cart = [];
  state.selectedCartIndex = null;
  refreshCart();
  setStatus("Koszyk wyczyszczony.");
});

els.addCustomer.addEventListener("click", async () => {
  const name = els.customerName.value.trim();
  const email = els.customerEmail.value.trim();
  if (!name) return setStatus("Podaj imie i nazwisko klienta.");
  await apiPost("/api/customers", { name, email });
  state.customers = await apiGet("/api/customers");
  refreshCustomers();
  setStatus(`Dodano klienta: ${name}`);
});

els.paymentMethod.addEventListener("change", renderPaymentFields);

els.placeOrder.addEventListener("click", async () => {
  if (!state.selectedCustomerId) return setStatus("Najpierw wybierz klienta z listy.");
  if (!state.cart.length) return setStatus("Koszyk jest pusty.");

  const method = els.paymentMethod.value;
  const payment = { method };
  if (method === "Karta kredytowa") {
    payment.card_number = document.getElementById("payment-card_number").value;
    payment.expiry = document.getElementById("payment-expiry").value;
    payment.cvv = document.getElementById("payment-cvv").value;
  } else if (method === "PayPal") {
    payment.paypal_email = document.getElementById("payment-paypal_email").value;
  } else {
    payment.bitcoin_wallet = document.getElementById("payment-bitcoin_wallet").value;
  }

  const items = state.cart.map((i) => ({
    name: i.name,
    category: i.category,
    price: i.price,
    qty: i.qty,
  }));

  await apiPost("/api/orders", {
    customer_id: state.selectedCustomerId,
    items,
    payment,
  });

  state.orders = await apiGet("/api/orders");
  refreshOrders();
  state.cart = [];
  refreshCart();
  setStatus("Zamowienie zlozone.");
});

renderPaymentFields();
loadAll().catch((err) => setStatus(err.message));
