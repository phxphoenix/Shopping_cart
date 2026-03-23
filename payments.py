from abc import ABC, abstractmethod


# --- Klasa bazowa (abstrakcyjna) ---
class PaymentMethod(ABC):
    """Każda metoda płatności musi implementować te metody."""

    @abstractmethod
    def validate(self) -> bool:
        pass

    @abstractmethod
    def process(self, amount: float) -> bool:
        pass

    @abstractmethod
    def get_name(self) -> str:
        pass


# --- Karta kredytowa ---
class CreditCardPayment(PaymentMethod):
    def __init__(self, card_number: str, expiry: str, cvv: str):
        self.card_number = card_number
        self.expiry = expiry
        self.cvv = cvv

    def validate(self) -> bool:
        # Sprawdzamy podstawowe warunki
        if len(self.card_number.replace(" ", "")) != 16:
            print("❌ Numer karty musi mieć 16 cyfr!")
            return False
        if len(self.cvv) != 3:
            print("❌ CVV musi mieć 3 cyfry!")
            return False
        print("✅ Dane karty poprawne")
        return True

    def process(self, amount: float) -> bool:
        if not self.validate():
            return False
        # Maskujemy numer karty dla bezpieczeństwa
        masked = "*" * 12 + self.card_number[-4:]
        print(f"💳 Przetwarzam płatność kartą {masked}")
        print(f"💳 Pobrano {amount:.2f} zł")
        return True

    def get_name(self) -> str:
        return "Karta kredytowa"


# --- PayPal ---
class PayPalPayment(PaymentMethod):
    def __init__(self, email: str):
        self.email = email
        self.is_logged_in = False

    def validate(self) -> bool:
        if "@" not in self.email or "." not in self.email:
            print("❌ Nieprawidłowy adres email!")
            return False
        print(f"✅ Konto PayPal ({self.email}) zweryfikowane")
        return True

    def login(self):
        """Symulacja logowania do PayPal."""
        if self.validate():
            self.is_logged_in = True
            print(f"🔐 Zalogowano do PayPal jako {self.email}")
        return self.is_logged_in

    def process(self, amount: float) -> bool:
        if not self.login():
            return False
        print(f"🅿️ Przetwarzam płatność PayPal...")
        print(f"🅿️ Pobrano {amount:.2f} zł z konta {self.email}")
        return True

    def get_name(self) -> str:
        return "PayPal"


# --- Bitcoin ---
class BitcoinPayment(PaymentMethod):
    # Przykładowy kurs BTC
    BTC_RATE = 250_000.00  # 1 BTC = 250 000 zł

    def __init__(self, wallet_address: str):
        self.wallet_address = wallet_address

    def validate(self) -> bool:
        # Prawdziwy adres BTC zaczyna się od 1, 3 lub bc1
        if not self.wallet_address.startswith(("1", "3", "bc1")):
            print("❌ Nieprawidłowy adres portfela Bitcoin!")
            return False
        if len(self.wallet_address) < 26:
            print("❌ Adres portfela jest za krótki!")
            return False
        print(f"✅ Portfel Bitcoin zweryfikowany")
        return True

    def _to_btc(self, amount_pln: float) -> float:
        """Przelicza PLN na BTC."""
        return amount_pln / self.BTC_RATE

    def process(self, amount: float) -> bool:
        if not self.validate():
            return False
        btc_amount = self._to_btc(amount)
        print(f"₿ Kurs: 1 BTC = {self.BTC_RATE:,.2f} zł")
        print(f"₿ Do zapłaty: {btc_amount:.8f} BTC ({amount:.2f} zł)")
        print(f"₿ Wysyłam transakcję na adres {self.wallet_address[:10]}...")
        print(f"₿ Transakcja zatwierdzona!")
        return True

    def get_name(self) -> str:
        return "Bitcoin"