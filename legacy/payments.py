from abc import ABC, abstractmethod


class PaymentMethod(ABC):
    """Kazda metoda platnosci musi implementowac te metody."""

    @abstractmethod
    def validate(self) -> bool:
        pass

    @abstractmethod
    def process(self, amount: float) -> bool:
        pass

    @abstractmethod
    def get_name(self) -> str:
        pass


class CreditCardPayment(PaymentMethod):
    def __init__(self, card_number: str, expiry: str, cvv: str):
        self.card_number = card_number
        self.expiry = expiry
        self.cvv = cvv

    def validate(self) -> bool:
        if len(self.card_number.replace(" ", "")) != 16:
            print("Numer karty musi miec 16 cyfr!")
            return False
        if len(self.cvv) != 3:
            print("CVV musi miec 3 cyfry!")
            return False
        print("Dane karty poprawne")
        return True

    def process(self, amount: float) -> bool:
        if not self.validate():
            return False
        masked = "*" * 12 + self.card_number[-4:]
        print(f"Przetwarzam platnosc karta {masked}")
        print(f"Pobrano {amount:.2f} zl")
        return True

    def get_name(self) -> str:
        return "Karta kredytowa"


class PayPalPayment(PaymentMethod):
    def __init__(self, email: str):
        self.email = email
        self.is_logged_in = False

    def validate(self) -> bool:
        if "@" not in self.email or "." not in self.email:
            print("Nieprawidlowy adres email!")
            return False
        print(f"Konto PayPal ({self.email}) zweryfikowane")
        return True

    def login(self):
        if self.validate():
            self.is_logged_in = True
            print(f"Zalogowano do PayPal jako {self.email}")
        return self.is_logged_in

    def process(self, amount: float) -> bool:
        if not self.login():
            return False
        print("Przetwarzam platnosc PayPal...")
        print(f"Pobrano {amount:.2f} zl z konta {self.email}")
        return True

    def get_name(self) -> str:
        return "PayPal"


class BitcoinPayment(PaymentMethod):
    BTC_RATE = 250_000.00  # 1 BTC = 250 000 zl

    def __init__(self, wallet_address: str):
        self.wallet_address = wallet_address

    def validate(self) -> bool:
        if not self.wallet_address.startswith(("1", "3", "bc1")):
            print("Nieprawidlowy adres portfela Bitcoin!")
            return False
        if len(self.wallet_address) < 26:
            print("Adres portfela jest za krotki!")
            return False
        print("Portfel Bitcoin zweryfikowany")
        return True

    def _to_btc(self, amount_pln: float) -> float:
        return amount_pln / self.BTC_RATE

    def process(self, amount: float) -> bool:
        if not self.validate():
            return False
        btc_amount = self._to_btc(amount)
        print(f"Kurs: 1 BTC = {self.BTC_RATE:,.2f} zl")
        print(f"Do zaplaty: {btc_amount:.8f} BTC ({amount:.2f} zl)")
        print(f"Wysylam transakcje na adres {self.wallet_address[:10]}...")
        print("Transakcja zatwierdzona!")
        return True

    def get_name(self) -> str:
        return "Bitcoin"
