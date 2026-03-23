from products import CATALOG
from cart import ShoppingCart
from payments import CreditCardPayment, PayPalPayment, BitcoinPayment


def show_catalog():
    """Wyświetla dostępne produkty."""
    print("\n📋 KATALOG PRODUKTÓW:")
    print("-" * 40)
    for i, product in enumerate(CATALOG, start=1):
        print(f"  {i}. {product}")


def choose_payment():
    """Pozwala użytkownikowi wybrać metodę płatności."""
    print("\n💰 WYBIERZ METODĘ PŁATNOŚCI:")
    print("  1. 💳 Karta kredytowa")
    print("  2. 🅿️  PayPal")
    print("  3. ₿  Bitcoin")

    choice = input("\nTwój wybór (1-3): ").strip()

    if choice == "1":
        card_number = input("Numer karty (16 cyfr): ").strip()
        expiry = input("Data ważności (MM/RR): ").strip()
        cvv = input("CVV (3 cyfry): ").strip()
        return CreditCardPayment(card_number, expiry, cvv)

    elif choice == "2":
        email = input("Email PayPal: ").strip()
        return PayPalPayment(email)

    elif choice == "3":
        wallet = input("Adres portfela Bitcoin: ").strip()
        return BitcoinPayment(wallet)

    else:
        print("❌ Nieprawidłowy wybór, domyślnie: karta kredytowa")
        return CreditCardPayment("1234567890123456", "12/25", "123")


def main():
    """Główna pętla programu."""
    cart = ShoppingCart()

    print("🛍️  WITAJ W SKLEPIE INTERNETOWYM!")

    while True:
        print("\n📌 CO CHCESZ ZROBIĆ?")
        print("  1. Zobacz katalog")
        print("  2. Dodaj produkt do koszyka")
        print("  3. Usuń produkt z koszyka")
        print("  4. Pokaż koszyk")
        print("  5. Złóż zamówienie")
        print("  6. Wyjdź")

        choice = input("\nTwój wybór (1-6): ").strip()

        if choice == "1":
            show_catalog()

        elif choice == "2":
            show_catalog()
            try:
                idx = int(input("Numer produktu: ")) - 1
                qty = int(input("Ilość: "))
                if 0 <= idx < len(CATALOG):
                    cart.add(CATALOG[idx], qty)
                else:
                    print("❌ Nieprawidłowy numer produktu!")
            except ValueError:
                print("❌ Podaj liczbę!")

        elif choice == "3":
            if cart.is_empty():
                print("🛒 Koszyk jest pusty!")
            else:
                cart.display()
                try:
                    idx = int(input("Numer produktu do usunięcia: ")) - 1
                    items_list = list(cart._items.keys())
                    if 0 <= idx < len(items_list):
                        cart.remove(items_list[idx])
                    else:
                        print("❌ Nieprawidłowy numer!")
                except ValueError:
                    print("❌ Podaj liczbę!")

        elif choice == "4":
            cart.display()

        elif choice == "5":
            if cart.is_empty():
                print("❌ Koszyk jest pusty!")
            else:
                payment = choose_payment()
                cart.checkout(payment)

        elif choice == "6":
            print("\n👋 Dziękujemy za odwiedziny! Do zobaczenia!")
            break

        else:
            print("❌ Nieprawidłowa opcja, spróbuj ponownie.")


# 👇 Tu jest nasz bohater — blok kontrolny!
if __name__ == "__main__":
    main()