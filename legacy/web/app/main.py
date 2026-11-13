from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .db import SessionLocal, engine
from .models import Base, Customer, Order, OrderItem, PaymentDetails
from .schemas import (
    CustomerCreate,
    CustomerOut,
    OrderCreate,
    OrderOut,
)

FREE_DELIVERY_THRESHOLD = 200.0
DELIVERY_COST = 15.0

CATALOG = [
    {"name": "Laptop", "price": 3499.99, "category": "Elektronika"},
    {"name": "Sluchawki", "price": 199.99, "category": "Elektronika"},
    {"name": "Koszulka", "price": 79.99, "category": "Odziez"},
    {"name": "Plecak", "price": 149.99, "category": "Akcesoria"},
    {"name": "Ksiazka Python", "price": 59.99, "category": "Edukacja"},
]

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Shopping Cart Web")

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return FileResponse(BASE_DIR / "templates" / "index.html")


@app.get("/api/catalog")
def get_catalog():
    return CATALOG


@app.get("/api/customers", response_model=list[CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.query(Customer).order_by(Customer.id.desc()).all()


@app.post("/api/customers", response_model=CustomerOut)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name required")
    customer = Customer(name=payload.name.strip(), email=payload.email.strip())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()
    return {"ok": True}


@app.get("/api/orders", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return db.query(Order).order_by(Order.id.desc()).all()


@app.get("/api/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _calc_totals(items: list[dict]) -> tuple[float, float, float]:
    subtotal = 0.0
    for item in items:
        subtotal += float(item["price"]) * int(item["qty"])
    delivery = 0.0 if subtotal >= FREE_DELIVERY_THRESHOLD else DELIVERY_COST
    total = subtotal + delivery
    return subtotal, delivery, total


@app.post("/api/orders", response_model=OrderOut)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    customer = db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Items required")

    items_payload = [i.model_dump() for i in payload.items]
    subtotal, delivery, total = _calc_totals(items_payload)

    order = Order(
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        subtotal=subtotal,
        delivery=delivery,
        total=total,
        payment_method=payload.payment.method,
        customer=customer,
    )
    db.add(order)
    db.flush()

    for item in payload.items:
        db.add(
            OrderItem(
                order=order,
                name=item.name,
                category=item.category,
                price=item.price,
                qty=item.qty,
            )
        )

    payment = PaymentDetails(
        order=order,
        method=payload.payment.method,
        card_number=payload.payment.card_number,
        expiry=payload.payment.expiry,
        cvv=payload.payment.cvv,
        paypal_email=payload.payment.paypal_email,
        bitcoin_wallet=payload.payment.bitcoin_wallet,
    )
    db.add(payment)

    db.commit()
    db.refresh(order)
    return order


@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
    return {"ok": True}
