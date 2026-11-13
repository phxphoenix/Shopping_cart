from products import Product
from payments import PaymentMethod


class ShoppingCart:
    # Stala: prog darmowej dostawy
    FREE_DELIVERY_THRESHOLD = 200.00
    DELIVERY_COST = 15.00

    def __init__(self):
        # Slownik: produkt -> ilosc
        self._items: dict[Product, int] = {}

    def add(self, product: Product, quantity: int = 1):
        """Dodaje produkt do koszyka."""
        if quantity <= 0:
            print("Ilosc musi byc wieksza od 0!")
            return

        if product in self._items:
            self._items[product] += quantity
        else:
            self._items[product] = quantity

        print(f"Dodano: {product.name} x{quantity}")

    def remove(self, product: Product):
        """Usuwa produkt z koszyka."""
        if product in self._items:
            del self._items[product]
            print(f"Usunieto: {product.name}")
        else:
            print(f"Nie znaleziono {product.name} w koszyku")

    def get_subtotal(self) -> float:
        """Suma bez dostawy."""
        return sum(
            product.price * quantity
            for product, quantity in self._items.items()
        )

    def get_delivery_cost(self) -> float:
        """Koszt dostawy (darmowa powyzej progu)."""
        subtotal = self.get_subtotal()
        if subtotal >= self.FREE_DELIVERY_THRESHOLD:
            return 0.00
        return self.DELIVERY_COST

    def get_total(self) -> float:
        """Suma koncowa z dostawa."""
        return self.get_subtotal() + self.get_delivery_cost()

    def is_empty(self) -> bool:
        return len(self._items) == 0

    def display(self):
        """Wyswietla zawartosc koszyka."""
        if self.is_empty():
            print("\nKoszyk jest pusty!")
            return

        print("\n" + "=" * 50)
        print("TWOJ KOSZYK")
        print("=" * 50)

        for product, quantity in self._items.items():
            line_total = product.price * quantity
            print(f"  {product.name:<20} x{quantity}  {line_total:>10.2f} zl")

        print("-" * 50)
        print(f"  {'Suma produktow:':<25} {self.get_subtotal():>10.2f} zl")

        delivery = self.get_delivery_cost()
        if delivery == 0:
            print(f"  {'Dostawa:':<25} {'GRATIS':>10}")
        else:
            print(f"  {'Dostawa:':<25} {delivery:>10.2f} zl")
            remaining = self.FREE_DELIVERY_THRESHOLD - self.get_subtotal()
            print(f"  Dodaj za {remaining:.2f} zl, by miec darmowa dostawe!")

        print("=" * 50)
        print(f"  {'DO ZAPLATY:':<25} {self.get_total():>10.2f} zl")
        print("=" * 50)

    def checkout(self, payment: PaymentMethod) -> bool:
        """Realizuje zamowienie wybrana metoda platnosci."""
        if self.is_empty():
            print("Koszyk jest pusty — nie mozna zlozyc zamowienia!")
            return False

        self.display()
        total = self.get_total()

        print(f"\nMetoda platnosci: {payment.get_name()}")
        print("-" * 50)

        success = payment.process(total)

        if success:
            print("\nZAMOWIENIE ZLOZONE POMYSLNIE!")
            print("Twoje produkty sa w drodze!")
            self._items.clear()
        else:
            print("\nPLATNOSC NIE POWIODLA SIE")
            print("Sprobuj ponownie lub wybierz inna metode.")

        return success
