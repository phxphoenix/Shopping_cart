from __future__ import annotations

import io
import json
import os
import tkinter as tk
from contextlib import redirect_stdout
from datetime import datetime
from tkinter import messagebox

from products import CATALOG
from cart import ShoppingCart
from payments import CreditCardPayment, PayPalPayment, BitcoinPayment


class ShoppingCartApp:
    def __init__(self) -> None:
        self.cart = ShoppingCart()
        self.db_path = os.path.join(os.path.dirname(__file__), "data.json")
        self.db = self._load_db()

        self.root = tk.Tk()
        self.root.title("Shopping Cart")
        self.root.geometry("1100x760")
        self.root.configure(bg="#0b0f0b")

        self.fg = "#21f35a"
        self.accent = "#00ff66"
        self.bg = "#0b0f0b"
        self.panel = "#0f1a10"
        self.font = ("Courier New", 12)
        self.font_title = ("Courier New", 20, "bold")

        self._build_ui()
        self._refresh_cart()
        self._refresh_customers()
        self._refresh_orders()

    def _build_ui(self) -> None:
        header = tk.Label(
            self.root,
            text="SHOPPING CART",
            fg=self.accent,
            bg=self.bg,
            font=self.font_title,
        )
        header.pack(pady=10)

        main = tk.Frame(self.root, bg=self.bg)
        main.pack(fill="both", expand=True, padx=16, pady=8)

        left = tk.Frame(main, bg=self.panel, bd=2, relief="ridge")
        left.pack(side="left", fill="both", expand=True, padx=6, pady=6)

        mid = tk.Frame(main, bg=self.bg)
        mid.pack(side="left", fill="y", padx=6, pady=6)

        right = tk.Frame(main, bg=self.panel, bd=2, relief="ridge")
        right.pack(side="left", fill="both", expand=True, padx=6, pady=6)

        tk.Label(left, text="KATALOG", fg=self.fg, bg=self.panel, font=self.font).pack(pady=6)
        self.catalog_list = tk.Listbox(
            left,
            bg=self.bg,
            fg=self.fg,
            selectbackground=self.accent,
            selectforeground=self.bg,
            font=self.font,
            height=18,
        )
        self.catalog_list.pack(fill="both", expand=True, padx=8, pady=6)
        for p in CATALOG:
            self.catalog_list.insert("end", f"{p.name} | {p.price:.2f} zl | {p.category}")

        tk.Label(mid, text="OPERACJE", fg=self.fg, bg=self.bg, font=self.font).pack(pady=6)
        tk.Label(mid, text="Ilosc:", fg=self.fg, bg=self.bg, font=self.font).pack(pady=(8, 2))
        self.qty_entry = tk.Entry(mid, bg=self.bg, fg=self.fg, insertbackground=self.fg, font=self.font, width=6)
        self.qty_entry.insert(0, "1")
        self.qty_entry.pack()

        self._mk_button(mid, "DODAJ ->", self._add_to_cart).pack(pady=8, fill="x")
        self._mk_button(mid, "<- USUN", self._remove_from_cart).pack(pady=8, fill="x")
        self._mk_button(mid, "WYCZYSC", self._clear_cart).pack(pady=8, fill="x")

        tk.Label(mid, text="KLIENT:", fg=self.fg, bg=self.bg, font=self.font).pack(pady=(12, 2))
        self.customer_name = tk.Entry(mid, bg=self.bg, fg=self.fg, insertbackground=self.fg, font=self.font)
        self.customer_name.insert(0, "Imie i nazwisko")
        self.customer_name.pack(fill="x", pady=2)
        self.customer_email = tk.Entry(mid, bg=self.bg, fg=self.fg, insertbackground=self.fg, font=self.font)
        self.customer_email.insert(0, "email")
        self.customer_email.pack(fill="x", pady=2)
        self._mk_button(mid, "DODAJ KLIENTA", self._add_customer).pack(pady=6, fill="x")

        tk.Label(mid, text="PLATNOSC:", fg=self.fg, bg=self.bg, font=self.font).pack(pady=(16, 2))
        self.payment_var = tk.StringVar(value="Karta kredytowa")
        self.payment_menu = tk.OptionMenu(
            mid,
            self.payment_var,
            "Karta kredytowa",
            "PayPal",
            "Bitcoin",
        )
        self.payment_menu.configure(bg=self.bg, fg=self.fg, font=self.font, activebackground=self.panel)
        self.payment_menu["menu"].configure(bg=self.bg, fg=self.fg)
        self.payment_menu.pack(fill="x", pady=4)

        self._mk_button(mid, "ZAMOW", self._checkout).pack(pady=10, fill="x")

        tk.Label(right, text="KOSZYK", fg=self.fg, bg=self.panel, font=self.font).pack(pady=6)
        self.cart_list = tk.Listbox(
            right,
            bg=self.bg,
            fg=self.fg,
            selectbackground=self.accent,
            selectforeground=self.bg,
            font=self.font,
            height=16,
        )
        self.cart_list.pack(fill="both", expand=True, padx=8, pady=6)

        self.totals_label = tk.Label(right, text="", fg=self.fg, bg=self.panel, font=self.font, justify="left")
        self.totals_label.pack(pady=8, padx=8, anchor="w")

        bottom = tk.Frame(self.root, bg=self.bg)
        bottom.pack(fill="both", expand=False, padx=16, pady=(0, 8))

        history = tk.Frame(bottom, bg=self.panel, bd=2, relief="ridge")
        history.pack(side="left", fill="both", expand=True, padx=6, pady=6)

        customers = tk.Frame(bottom, bg=self.panel, bd=2, relief="ridge")
        customers.pack(side="left", fill="both", expand=True, padx=6, pady=6)

        history_header = tk.Frame(history, bg=self.panel)
        history_header.pack(fill="x", padx=6, pady=6)
        tk.Label(history_header, text="ORDER HISTORY", fg=self.fg, bg=self.panel, font=self.font).pack(side="left")
        self._mk_button(history_header, "X", self._delete_order).pack(side="right")
        self.orders_list = tk.Listbox(
            history,
            bg=self.bg,
            fg=self.fg,
            selectbackground=self.accent,
            selectforeground=self.bg,
            font=self.font,
            height=8,
        )
        self.orders_list.pack(fill="both", expand=True, padx=8, pady=6)
        self.orders_list.bind("<<ListboxSelect>>", self._on_order_select)
        self.orders_list.bind("<Double-Button-1>", self._open_order_details_window)

        self.order_details = tk.Text(history, height=6, bg=self.bg, fg=self.accent, font=self.font, relief="ridge", bd=2)
        self.order_details.pack(fill="both", expand=False, padx=8, pady=(0, 8))

        customers_header = tk.Frame(customers, bg=self.panel)
        customers_header.pack(fill="x", padx=6, pady=6)
        tk.Label(customers_header, text="KLIENCI", fg=self.fg, bg=self.panel, font=self.font).pack(side="left")
        self._mk_button(customers_header, "X", self._delete_customer).pack(side="right")
        self.customers_list = tk.Listbox(
            customers,
            bg=self.bg,
            fg=self.fg,
            selectbackground=self.accent,
            selectforeground=self.bg,
            font=self.font,
            height=8,
        )
        self.customers_list.pack(fill="both", expand=True, padx=8, pady=6)

        self.status = tk.Label(self.root, text="Gotowe.", fg=self.fg, bg=self.bg, font=self.font)
        self.status.pack(pady=(0, 10))

    def _mk_button(self, parent: tk.Widget, text: str, cmd) -> tk.Button:
        return tk.Button(
            parent,
            text=text,
            command=cmd,
            bg=self.panel,
            fg=self.accent,
            activebackground=self.accent,
            activeforeground=self.bg,
            font=self.font,
            relief="ridge",
            bd=2,
        )

    def _set_status(self, msg: str) -> None:
        self.status.config(text=msg)

    def _silent(self, func, *args, **kwargs):
        buf = io.StringIO()
        with redirect_stdout(buf):
            return func(*args, **kwargs)

    def _load_db(self) -> dict:
        if not os.path.exists(self.db_path):
            return {"customers": [], "orders": []}
        try:
            with open(self.db_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError("Invalid db")
        except Exception:
            return {"customers": [], "orders": []}
        data.setdefault("customers", [])
        data.setdefault("orders", [])
        return data

    def _save_db(self) -> None:
        with open(self.db_path, "w", encoding="utf-8") as f:
            json.dump(self.db, f, ensure_ascii=False, indent=2)

    def _selected_catalog_product(self):
        sel = self.catalog_list.curselection()
        if not sel:
            return None
        return CATALOG[sel[0]]

    def _selected_cart_product(self):
        sel = self.cart_list.curselection()
        if not sel:
            return None
        items = list(self.cart._items.keys())
        if sel[0] >= len(items):
            return None
        return items[sel[0]]

    def _add_to_cart(self) -> None:
        product = self._selected_catalog_product()
        if not product:
            self._set_status("Wybierz produkt z katalogu.")
            return
        try:
            qty = int(self.qty_entry.get().strip())
        except ValueError:
            self._set_status("Ilosc musi byc liczba.")
            return
        if qty <= 0:
            self._set_status("Ilosc musi byc > 0.")
            return
        self._silent(self.cart.add, product, qty)
        self._refresh_cart()
        self._set_status(f"Dodano: {product.name} x{qty}")

    def _remove_from_cart(self) -> None:
        product = self._selected_cart_product()
        if not product:
            self._set_status("Wybierz produkt w koszyku.")
            return
        self._silent(self.cart.remove, product)
        self._refresh_cart()
        self._set_status(f"Usunieto: {product.name}")

    def _clear_cart(self) -> None:
        if self.cart.is_empty():
            self._set_status("Koszyk jest pusty.")
            return
        self.cart._items.clear()
        self._refresh_cart()
        self._set_status("Koszyk wyczyszczony.")

    def _refresh_cart(self) -> None:
        self.cart_list.delete(0, "end")
        for product, qty in self.cart._items.items():
            line_total = product.price * qty
            self.cart_list.insert("end", f"{product.name} x{qty} | {line_total:.2f} zl")

        subtotal = self.cart.get_subtotal()
        delivery = self.cart.get_delivery_cost()
        total = self.cart.get_total()
        if delivery == 0:
            delivery_text = "GRATIS"
        else:
            delivery_text = f"{delivery:.2f} zl"

        self.totals_label.config(
            text=(
                f"Suma produktow: {subtotal:.2f} zl\n"
                f"Dostawa:        {delivery_text}\n"
                f"DO ZAPLATY:     {total:.2f} zl"
            )
        )

    def _refresh_customers(self) -> None:
        self.customers_list.delete(0, "end")
        for c in self.db.get("customers", []):
            name = c.get("name", "Anonimowy")
            email = c.get("email", "")
            label = f"{name} | {email}" if email else name
            self.customers_list.insert("end", label)

    def _refresh_orders(self) -> None:
        self.orders_list.delete(0, "end")
        for o in self.db.get("orders", []):
            ts = o.get("timestamp", "")
            customer = o.get("customer", {}).get("name", "Anonimowy")
            total = o.get("total", 0.0)
            self.orders_list.insert("end", f"{ts} | {customer} | {total:.2f} zl")
        self.order_details.delete("1.0", "end")

    def _get_selected_customer(self) -> dict | None:
        sel = self.customers_list.curselection()
        if not sel:
            return None
        idx = sel[0]
        customers = self.db.get("customers", [])
        if idx >= len(customers):
            return None
        return customers[idx]

    def _get_selected_order_index(self) -> int | None:
        sel = self.orders_list.curselection()
        if not sel:
            return None
        return sel[0]

    def _add_customer(self) -> None:
        name = self.customer_name.get().strip()
        email = self.customer_email.get().strip()
        if not name or name.lower() == "imie i nazwisko":
            self._set_status("Podaj imie i nazwisko klienta.")
            return
        self.db.setdefault("customers", [])
        self.db["customers"].append({"name": name, "email": email})
        self._save_db()
        self._refresh_customers()
        self._set_status(f"Dodano klienta: {name}")

    def _delete_customer(self) -> None:
        sel = self.customers_list.curselection()
        if not sel:
            self._set_status("Wybierz klienta do usuniecia.")
            return
        idx = sel[0]
        customers = self.db.get("customers", [])
        if idx >= len(customers):
            return
        removed = customers.pop(idx)
        self._save_db()
        self._refresh_customers()
        self._set_status(f"Usunieto klienta: {removed.get('name', '')}")

    def _delete_order(self) -> None:
        idx = self._get_selected_order_index()
        if idx is None:
            self._set_status("Wybierz zamowienie do usuniecia.")
            return
        orders = self.db.get("orders", [])
        if idx >= len(orders):
            return
        orders.pop(idx)
        self._save_db()
        self._refresh_orders()
        self._set_status("Usunieto zamowienie.")

    def _on_order_select(self, _event=None) -> None:
        sel = self.orders_list.curselection()
        if not sel:
            return
        idx = sel[0]
        orders = self.db.get("orders", [])
        if idx >= len(orders):
            return
        o = orders[idx]
        lines = [
            f"Data: {o.get('timestamp', '')}",
            f"Klient: {o.get('customer', {}).get('name', 'Anonimowy')}",
            f"Email: {o.get('customer', {}).get('email', '')}",
            f"Platnosc: {o.get('payment_method', '')}",
            f"Szczegoly platnosci: {self._format_payment_details(o.get('payment_details', {}))}",
            f"Suma produktow: {o.get('subtotal', 0.0):.2f} zl",
            f"Dostawa: {o.get('delivery', 0.0):.2f} zl",
            f"Do zaplaty: {o.get('total', 0.0):.2f} zl",
            "",
            "Produkty:",
        ]
        for item in o.get("items", []):
            lines.append(f"- {item.get('name')} x{item.get('qty')} ({item.get('price'):.2f} zl)")
        self.order_details.delete("1.0", "end")
        self.order_details.insert("end", "\n".join(lines))
    
    def _format_payment_details(self, details: dict) -> str:
        if not details:
            return "-"
        method = details.get("method", "")
        if method == "Karta kredytowa":
            return f"nr {details.get('card_number','')}, exp {details.get('expiry','')}, cvv {details.get('cvv','')}"
        if method == "PayPal":
            return f"email {details.get('email','')}"
        if method == "Bitcoin":
            return f"portfel {details.get('wallet','')}"
        return str(details)

    def _open_order_details_window(self, _event=None) -> None:
        idx = self._get_selected_order_index()
        if idx is None:
            return
        orders = self.db.get("orders", [])
        if idx >= len(orders):
            return
        o = orders[idx]

        dialog = tk.Toplevel(self.root)
        dialog.title("Szczegoly zamowienia")
        dialog.configure(bg=self.bg)
        dialog.geometry("520x420")
        dialog.grab_set()

        header = tk.Label(dialog, text="SZCZEGOLY ZAMOWIENIA", fg=self.fg, bg=self.bg, font=self.font)
        header.pack(pady=8)

        details = tk.Text(dialog, height=18, bg=self.bg, fg=self.accent, font=self.font, relief="ridge", bd=2)
        details.pack(fill="both", expand=True, padx=12, pady=8)

        lines = [
            f"Data: {o.get('timestamp', '')}",
            f"Klient: {o.get('customer', {}).get('name', 'Anonimowy')}",
            f"Email: {o.get('customer', {}).get('email', '')}",
            f"Platnosc: {o.get('payment_method', '')}",
            f"Szczegoly platnosci: {self._format_payment_details(o.get('payment_details', {}))}",
            f"Suma produktow: {o.get('subtotal', 0.0):.2f} zl",
            f"Dostawa: {o.get('delivery', 0.0):.2f} zl",
            f"Do zaplaty: {o.get('total', 0.0):.2f} zl",
            "",
            "Produkty:",
        ]
        for item in o.get("items", []):
            lines.append(f"- {item.get('name')} x{item.get('qty')} ({item.get('price'):.2f} zl)")
        details.insert("end", "\n".join(lines))
        details.config(state="disabled")

    def _checkout(self) -> None:
        if self.cart.is_empty():
            self._set_status("Koszyk jest pusty.")
            return
        if not self._get_selected_customer():
            self._set_status("Najpierw wybierz klienta z listy.")
            return
        method = self.payment_var.get()
        self._open_payment_dialog(method)

    def _open_payment_dialog(self, method: str) -> None:
        dialog = tk.Toplevel(self.root)
        dialog.title("Platnosc")
        dialog.configure(bg=self.bg)
        dialog.geometry("420x280")
        dialog.grab_set()

        tk.Label(dialog, text=f"Metoda: {method}", fg=self.fg, bg=self.bg, font=self.font).pack(pady=10)

        fields = {}
        if method == "Karta kredytowa":
            fields["Numer karty (16 cyfr)"] = tk.Entry(dialog, bg=self.bg, fg=self.fg, insertbackground=self.fg, font=self.font)
            fields["Data waznosci (MM/RR)"] = tk.Entry(dialog, bg=self.bg, fg=self.fg, insertbackground=self.fg, font=self.font)
            fields["CVV (3 cyfry)"] = tk.Entry(dialog, bg=self.bg, fg=self.fg, insertbackground=self.fg, font=self.font, show="*")
        elif method == "PayPal":
            fields["Email PayPal"] = tk.Entry(dialog, bg=self.bg, fg=self.fg, insertbackground=self.fg, font=self.font)
        else:
            fields["Adres portfela Bitcoin"] = tk.Entry(dialog, bg=self.bg, fg=self.fg, insertbackground=self.fg, font=self.font)

        for label, entry in fields.items():
            tk.Label(dialog, text=label, fg=self.fg, bg=self.bg, font=self.font).pack(pady=(6, 2))
            entry.pack(fill="x", padx=18)

        output = tk.Text(dialog, height=5, bg=self.bg, fg=self.accent, font=self.font, relief="ridge", bd=2)
        output.pack(fill="both", expand=True, padx=12, pady=8)

        def do_pay():
            customer = self._get_selected_customer() or {"name": "Anonimowy", "email": ""}
            if method == "Karta kredytowa":
                card_number = fields["Numer karty (16 cyfr)"].get().strip()
                expiry = fields["Data waznosci (MM/RR)"].get().strip()
                cvv = fields["CVV (3 cyfry)"].get().strip()
                payment = CreditCardPayment(card_number, expiry, cvv)
                payment_details = {
                    "method": "Karta kredytowa",
                    "card_number": card_number,
                    "expiry": expiry,
                    "cvv": cvv,
                }
            elif method == "PayPal":
                email = fields["Email PayPal"].get().strip()
                payment = PayPalPayment(email)
                payment_details = {"method": "PayPal", "email": email}
            else:
                wallet = fields["Adres portfela Bitcoin"].get().strip()
                payment = BitcoinPayment(wallet)
                payment_details = {"method": "Bitcoin", "wallet": wallet}

            buf = io.StringIO()
            with redirect_stdout(buf):
                success = payment.process(self.cart.get_total())
            output.delete("1.0", "end")
            output.insert("end", buf.getvalue().strip() or "Brak komunikatow.")

            if success:
                items_snapshot = []
                for product, qty in self.cart._items.items():
                    items_snapshot.append(
                        {"name": product.name, "price": product.price, "qty": qty, "category": product.category}
                    )
                order = {
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "customer": customer,
                    "items": items_snapshot,
                    "subtotal": self.cart.get_subtotal(),
                    "delivery": self.cart.get_delivery_cost(),
                    "total": self.cart.get_total(),
                    "payment_method": payment.get_name(),
                    "payment_details": payment_details,
                }
                self.db.setdefault("orders", [])
                self.db["orders"].append(order)
                self._save_db()
                self._refresh_orders()

                self.cart._items.clear()
                self._refresh_cart()
                self._set_status("Zamowienie zlozone pomyslnie.")
                messagebox.showinfo("Sukces", "Zamowienie zlozone pomyslnie.")
                dialog.destroy()
            else:
                self._set_status("Platnosc nie powiodla sie.")

        pay_btn = tk.Button(
            dialog,
            text="ZAPLAC",
            command=do_pay,
            bg=self.panel,
            fg=self.accent,
            activebackground=self.accent,
            activeforeground=self.bg,
            font=self.font,
            relief="ridge",
            bd=2,
        )
        pay_btn.pack(pady=6)

    def run(self) -> None:
        self.root.mainloop()


def main() -> None:
    app = ShoppingCartApp()
    app.run()


if __name__ == "__main__":
    main()
