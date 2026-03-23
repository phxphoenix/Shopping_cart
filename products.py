class Product:
    def __init__(self, name: str, price: float, category: str):
        self.name = name
        self.price = price
        self.category = category

    def __str__(self):
        return f"{self.name} ({self.category}) - {self.price:.2f} zł"


# Katalog dostępnych produktów
CATALOG = [
    Product("Laptop", 3499.99, "Elektronika"),
    Product("Słuchawki", 199.99, "Elektronika"),
    Product("Koszulka", 79.99, "Odzież"),
    Product("Plecak", 149.99, "Akcesoria"),
    Product("Książka Python", 59.99, "Edukacja"),
]