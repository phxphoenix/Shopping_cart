from __future__ import annotations

from pydantic import BaseModel


class CustomerCreate(BaseModel):
    name: str
    email: str = ""


class CustomerOut(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True


class OrderItemCreate(BaseModel):
    name: str
    category: str
    price: float
    qty: int


class PaymentDetailsCreate(BaseModel):
    method: str
    card_number: str | None = None
    expiry: str | None = None
    cvv: str | None = None
    paypal_email: str | None = None
    bitcoin_wallet: str | None = None


class OrderCreate(BaseModel):
    customer_id: int
    items: list[OrderItemCreate]
    payment: PaymentDetailsCreate


class OrderItemOut(BaseModel):
    id: int
    name: str
    category: str
    price: float
    qty: int

    class Config:
        from_attributes = True


class PaymentDetailsOut(BaseModel):
    method: str
    card_number: str | None = None
    expiry: str | None = None
    cvv: str | None = None
    paypal_email: str | None = None
    bitcoin_wallet: str | None = None

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    created_at: str
    subtotal: float
    delivery: float
    total: float
    payment_method: str
    customer: CustomerOut
    items: list[OrderItemOut]
    payment: PaymentDetailsOut

    class Config:
        from_attributes = True
