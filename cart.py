from products import Product
from payments import PaymentMethod


class ShoppingCart:
    # Stała: próg darmowej dostawy
    FREE_DELIVERY_THRESHOLD = 200.00
    DELIVERY_COST = 15.00

    def __init__(self):
        # Słownik: produkt -> ilość
        self._items: dict[Product, int] = {}

    def add(self, product: Product, quantity: int = 1):
        """Dodaje produkt do koszyka."""
        if quantity <= 0:
            print("❌ Ilość musi być większa od 0!")
            return

        if product in self._items:
            self._items[product] += quantity
        else:
            self._items[product] = quantity

        print(f"🛒 Dodano: {product.name} x{quantity}")

    def remove(self, product: Product):
        """Usuwa produkt z koszyka."""
        if product in self._items:
            del self._items[product]
            print(f"🗑️ Usunięto: {product.name}")
        else:
            print(f"❌ Nie znaleziono {product.name} w koszyku")

    def get_subtotal(self) -> float:
        """Suma bez dostawy."""
        return sum(
            product.price * quantity
            for product, quantity in self._items.items()
        )

    def get_delivery_cost(self) -> float:
        """Koszt dostawy (darmowa powyżej progu)."""
        subtotal = self.get_subtotal()
        if subtotal >= self.FREE_DELIVERY_THRESHOLD:
            return 0.00
        return self.DELIVERY_COST

    def get_total(self) -> float:
        """Suma końcowa z dostawą."""
        return self.get_subtotal() + self.get_delivery_cost()

    def is_empty(self) -> bool:
        return len(self._items) == 0

    def display(self):
        """Wyświetla zawartość koszyka."""
        if self.is_empty():
            print("\n🛒 Koszyk jest pusty!")
            return

        print("\n" + "=" * 50)
        print("🛒 TWÓJ KOSZYK")
        print("=" * 50)

        for product, quantity in self._items.items():
            line_total = product.price * quantity
            print(f"  {product.name:<20} x{quantity}  {line_total:>10.2f} zł")

        print("-" * 50)
        print(f"  {'Suma produktów:':<25} {self.get_subtotal():>10.2f} zł")

        delivery = self.get_delivery_cost()
        if delivery == 0:
            print(f"  {'Dostawa:':<25} {'GRATIS':>10}")
        else:
            print(f"  {'Dostawa:':<25} {delivery:>10.2f} zł")
            remaining = self.FREE_DELIVERY_THRESHOLD - self.get_subtotal()
            print(f"  💡 Dodaj za {remaining:.2f} zł, by mieć darmową dostawę!")

        print("=" * 50)
        print(f"  {'DO ZAPŁATY:':<25} {self.get_total():>10.2f} zł")
        print("=" * 50)

    def checkout(self, payment: PaymentMethod) -> bool:
        """Realizuje zamówienie wybraną metodą płatności."""
        if self.is_empty():
            print("❌ Koszyk jest pusty — nie można złożyć zamówienia!")
            return False

        self.display()
        total = self.get_total()

        print(f"\n💰 Metoda płatności: {payment.get_name()}")
        print("-" * 50)

        success = payment.process(total)

        if success:
            print("\n🎉 ZAMÓWIENIE ZŁOŻONE POMYŚLNIE!")
            print(f"📦 Twoje produkty są w drodze!")
            self._items.clear()  # Czyścimy koszyk po zakupie
        else:
            print("\n❌ PŁATNOŚĆ NIE POWIODŁA SIĘ")
            print("Spróbuj ponownie lub wybierz inną metodę.")

        return success