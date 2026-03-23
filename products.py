class Product:
    def __init__(self, name: str, price: float, category: str):
        self.name = name
        self.price = price
        self.category = category

    def __str__(self):
        return f"{self.name} ({self.category}) - {self.price:.2f} zl"


# Katalog dostepnych produktow
CATALOG = [
    Product("Laptop", 3499.99, "Elektronika"),
    Product("Sluchawki", 199.99, "Elektronika"),
    Product("Koszulka", 79.99, "Odziez"),
    Product("Plecak", 149.99, "Akcesoria"),
    Product("Ksiazka Python", 59.99, "Edukacja"),
]
