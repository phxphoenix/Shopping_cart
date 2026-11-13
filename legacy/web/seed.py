from app.db import SessionLocal
from app.models import Customer

def run():
    db = SessionLocal()
    try:
        if db.query(Customer).count() == 0:
            db.add_all([
                Customer(name="Jan Kowalski", email="jan.kowalski@example.com"),
                Customer(name="Anna Nowak", email="anna.nowak@example.com"),
            ])
            db.commit()
            print("Seeded customers")
        else:
            print("Customers already exist")
    finally:
        db.close()

if __name__ == "__main__":
    run()
