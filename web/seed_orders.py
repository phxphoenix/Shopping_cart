from datetime import datetime

from app.db import SessionLocal
from app.models import Customer, Order, OrderItem, PaymentDetails


def run():
    db = SessionLocal()
    try:
        if db.query(Order).count() > 0:
            print("Orders already exist")
            return

        customers = db.query(Customer).order_by(Customer.id).all()
        if not customers:
            print("No customers to seed")
            return

        def add_order(customer, items, payment):
            subtotal = sum(i["price"] * i["qty"] for i in items)
            delivery = 0.0 if subtotal >= 200 else 15.0
            total = subtotal + delivery

            order = Order(
                created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                subtotal=subtotal,
                delivery=delivery,
                total=total,
                payment_method=payment["method"],
                customer=customer,
            )
            db.add(order)
            db.flush()

            for i in items:
                db.add(
                    OrderItem(
                        order=order,
                        name=i["name"],
                        category=i["category"],
                        price=i["price"],
                        qty=i["qty"],
                    )
                )

            db.add(
                PaymentDetails(
                    order=order,
                    method=payment["method"],
                    card_number=payment.get("card_number"),
                    expiry=payment.get("expiry"),
                    cvv=payment.get("cvv"),
                    paypal_email=payment.get("paypal_email"),
                    bitcoin_wallet=payment.get("bitcoin_wallet"),
                )
            )

        add_order(
            customers[0],
            [
                {"name": "Koszulka", "price": 79.99, "qty": 1, "category": "Odziez"},
                {"name": "Plecak", "price": 149.99, "qty": 1, "category": "Akcesoria"},
                {"name": "Ksiazka Python", "price": 59.99, "qty": 1, "category": "Edukacja"},
            ],
            {"method": "PayPal", "paypal_email": customers[0].email},
        )

        if len(customers) > 1:
            add_order(
                customers[1],
                [
                    {"name": "Sluchawki", "price": 199.99, "qty": 1, "category": "Elektronika"},
                    {"name": "Ksiazka Python", "price": 59.99, "qty": 1, "category": "Edukacja"},
                ],
                {"method": "Bitcoin", "bitcoin_wallet": "bc1qexamplewalletaddress"},
            )

        db.commit()
        print("Seeded orders")
    finally:
        db.close()


if __name__ == "__main__":
    run()
