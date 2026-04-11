from app.db import SessionLocal
from app.models import Customer

def run():
    db = SessionLocal()
    try:
        if db.query(Customer).count() == 0:
            db.add_all([
                Customer(name="Michał Pasikowski", email="ppp.poczta@gmail.com"),
                Customer(name="Drugi Klient", email="emaila.poczta@gmail.com"),
            ])
            db.commit()
            print("Seeded customers")
        else:
            print("Customers already exist")
    finally:
        db.close()

if __name__ == "__main__":
    run()
